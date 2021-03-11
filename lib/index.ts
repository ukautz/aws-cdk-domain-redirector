import * as cdk from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as origins from '@aws-cdk/aws-cloudfront-origins';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import * as s3 from '@aws-cdk/aws-s3';

const defaultCacheDuration = cdk.Duration.hours(1);

export interface DomainRedirectorProps {
  /**
   *
   * @default 1 hour
   */
  cacheDuration?: cdk.Duration;

  /**
   * A list of domains that are to be redirect to the target
   */
  domains: string[];

  /**
   * The Route53 hosted zone(s) of the domains.
   *
   * DNS validation records will be created within as well as the A records
   * that route the domains to the CloudFront
   */
  hostedZone: route53.IHostedZone;

  /**
   * The target domain to which the redirects will be delegated to
   */
  targetDomain: string;
}

/**
 * SameDomainRedirector implements a simple CloudFront and S3 based HTTP(S) redirection.
 *
 * Resource setup:
 * - S3 Bucket, that redirects all incoming requests to target domain
 * - CloudFront Distribution, that accepts requests for all (to-be-redirected) domains
 * - ACM Certificate, that validates all (to-be-redirected) domains and is associated with CloudFront Distribution
 *
 * @experimental
 */
export class DomainRedirector extends cdk.Construct {
  public readonly bucket: s3.IBucket;
  public readonly certificate: acm.ICertificate;
  public readonly distribution: cloudfront.IDistribution;

  constructor(scope: cdk.Construct, id: string, props: DomainRedirectorProps) {
    super(scope, id);

    if (props.domains.length === 0) throw new Error('No domains are provided');

    const apex = props.hostedZone.zoneName.replace(/\.+$/, '');
    const invalid = props.domains.filter((domain) => domain != apex && !domain.endsWith('.' + apex));
    if (invalid.length > 0)
      throw new Error(`Hosted zone name ${apex} does not match all domains (${invalid.join(', ')})`);

    this.bucket = this.initBucket(props);
    this.certificate = this.initCertificate(props);
    this.distribution = this.initDistribution(props);
    this.routeRecords(props);
  }

  private initBucket(props: DomainRedirectorProps): s3.Bucket {
    return new s3.Bucket(this, 'Bucket', {
      publicReadAccess: true,
      websiteRedirect: {
        hostName: props.targetDomain,
        protocol: s3.RedirectProtocol.HTTPS,
      },
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private initCertificate(props: DomainRedirectorProps): acm.Certificate {
    return new acm.DnsValidatedCertificate(this, 'Certificate', {
      domainName: props.domains[0],
      ...(props.domains.length > 1 ? { subjectAlternativeNames: props.domains.slice(1) } : {}),
      hostedZone: props.hostedZone,
      region: 'us-east-1',
    });
  }

  private initDistribution(props: DomainRedirectorProps): cloudfront.Distribution {
    return new cloudfront.Distribution(this, 'Distribution', {
      domainNames: props.domains,
      certificate: this.certificate,
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket),
        cachePolicy: new cloudfront.CachePolicy(this, 'CachePolicy', {
          defaultTtl: props.cacheDuration ?? defaultCacheDuration,
        }),
      },
    });
  }

  private routeRecords(props: DomainRedirectorProps) {
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution));
    props.domains.forEach((domain) => {
      new route53.ARecord(this, `Record_${domain}`, {
        recordName: domain,
        zone: props.hostedZone,
        target,
      });
    });
  }
}
