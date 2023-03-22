import { Template } from 'aws-cdk-lib/assertions';
import { aws_route53 as route53, aws_cloudfront as cloudfront, aws_cloudformation as cloudformation } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import { DomainRedirector, DomainRedirectorProps } from '../lib';
import { IConstruct } from 'constructs';


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

function getChild(stack: cdk.Stack, names: string[]): IConstruct {
  let current: IConstruct = stack;
  names.forEach((name) => {
    current = current.node.findChild(name)
  });
  return current;
}

function assertRecords(stack: cdk.Stack) {
  const template = Template.fromStack(stack);
  const distribution = getChild(stack, ["MyTestConstruct", "Distribution"]) as cloudfront.Distribution;
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
      })
    });
    it('Has record for other domain', () => {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: 'other.domain.tld.',
        Type: 'A',
        AliasTarget: {
          DNSName: stack.resolve(distribution.domainName),
        },
      })
    });
  });
}

function assertCloudFrontDistribution(stack: cdk.Stack) {
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
      })
    });
    it('Has certificate associated', () => {
      const certificate = getChild(stack, ["MyTestConstruct", "Certificate", "CertificateRequestorResource"]) as cloudformation.CfnCustomResource;
      template.hasResourceProperties('AWS::CloudFront::Distribution', {
        DistributionConfig: {
          ViewerCertificate: {
            AcmCertificateArn: stack.resolve(certificate.getAtt('Arn')),
          },
        },
      })
    });
  });
}

function assertRedirectBucket(stack: cdk.Stack) {
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
      })
    });
  });
}

function assertSnapshot(stack: cdk.Stack) {
  const template = Template.fromStack(stack);
  it('Has consistent snapshot', () => {
    expect(template.toJSON()).toMatchSnapshot()
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
