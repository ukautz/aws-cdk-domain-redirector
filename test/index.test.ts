import * as cdk from 'aws-cdk-lib';
import { aws_certificatemanager as acm, aws_cloudfront as cloudfront, aws_route53 as route53 } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { type IConstruct } from 'constructs';
import { DomainRedirector, type DomainRedirectorProps } from '../lib';

/*
 * Example test
 */
describe('Domain Redirector', () => {
  describe('Intended setup', () => {
    // WHEN
    const stack = newTestStack();

    // THEN
    assertSnapshot(stack);
    assertRedirectBucket(stack);
    assertCloudFrontDistribution(stack);
    assertRecords(stack);
  });

  test('Domains not matching hosted zone fail', () => {
    expect(() => {
      newTestStack({
        domains: ['foo.tld', 'bar.tld'],
      });
    }).toThrowError();
  });
});

function getChild(parent: IConstruct, ...names: string[]): IConstruct {
  const child = parent.node.findChild(names.shift() as string);
  return names.length ? getChild(child, ...names) : child;
}

function assertRecords(stack: cdk.Stack): void {
  const template = Template.fromStack(stack);
  const distribution = getChild(stack, 'MyTestConstruct', 'Distribution') as cloudfront.Distribution;
  describe('Route53', () => {
    it('Creates Records', () => {
      template.resourceCountIs('AWS::Route53::RecordSet', 2);
    });
    it('Has record for www domain', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'www.domain.tld.',
        Type: 'A',
        AliasTarget: {
          DNSName: stack.resolve(distribution.domainName),
        },
      });
    });
    it('Has record for other domain', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'other.domain.tld.',
        Type: 'A',
        AliasTarget: {
          DNSName: stack.resolve(distribution.domainName),
        },
      });
    });
  });
}

function assertCloudFrontDistribution(stack: cdk.Stack): void {
  const template = Template.fromStack(stack);
  describe('CloudFront', () => {
    it('Creates distribution', () => {
      template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
    it('Associates all domains', () => {
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          Aliases: ['www.domain.tld', 'other.domain.tld'],
        },
      });
    });
    it('Has certificate associated', () => {
      const certificate = getChild(stack, 'MyTestConstruct', 'Certificate') as acm.Certificate;
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          ViewerCertificate: {
            AcmCertificateArn: stack.resolve(certificate.certificateArn),
          },
        },
      });
    });
  });
}

function assertRedirectBucket(stack: cdk.Stack): void {
  const template = Template.fromStack(stack);
  describe('S3', () => {
    it('Creates bucket', () => {
      template.resourceCountIs('AWS::S3::Bucket', 1);
    });
    it('Forwards to target', () => {
      template.hasResourceProperties('AWS::S3::Bucket', {
        WebsiteConfiguration: {
          RedirectAllRequestsTo: {
            HostName: 'target.tld',
            Protocol: 'https',
          },
        },
      });
    });
  });
}

function assertSnapshot(stack: cdk.Stack): void {
  const template = Template.fromStack(stack);
  it('Has consistent snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot();
  });
}

function newTestStack(props?: Partial<DomainRedirectorProps>): cdk.Stack {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, 'TestStack');
  const hostedZone = new route53.HostedZone(stack, 'HostedZone', {
    zoneName: 'domain.tld',
  });
  new DomainRedirector(stack, 'MyTestConstruct', {
    domains: ['www.domain.tld', 'other.domain.tld'],
    targetDomain: 'target.tld',
    ...props,
    hostedZone,
  });
  return stack;
}
