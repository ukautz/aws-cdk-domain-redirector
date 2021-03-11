import { expect as expectCDK, countResources, haveResource, SynthUtils, haveResourceLike } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as route53 from '@aws-cdk/aws-route53';
import { DomainRedirector, DomainRedirectorProps } from '../lib';

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

function assertRecords(stack: cdk.Stack) {
  describe('Route53', () => {
    it('Creates Records', () => {
      expectCDK(stack).to(countResources('AWS::Route53::RecordSet', 2));
    });
    it('Has record for www domain', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::Route53::RecordSet', {
          Name: 'www.domain.tld.',
          Type: 'A',
          AliasTarget: {
            DNSName: undefined,
          },
        })
      );
    });
    it('Has record for other domain', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::Route53::RecordSet', {
          Name: 'other.domain.tld.',
          Type: 'A',
          AliasTarget: {
            DNSName: undefined,
          },
        })
      );
    });
  });
}

function assertCloudFrontDistribution(stack: cdk.Stack) {
  describe('CloudFront', () => {
    it('Creates distribution', () => {
      expectCDK(stack).to(countResources('AWS::CloudFront::Distribution', 1));
    });
    it('Associates all domains', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            Aliases: ['www.domain.tld', 'other.domain.tld'],
          },
        })
      );
    });
    it('Has certificate associated', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::CloudFront::Distribution', {
          DistributionConfig: {
            ViewerCertificate: {
              AcmCertificateArn: undefined,
            },
          },
        })
      );
    });
  });
}

function assertRedirectBucket(stack: cdk.Stack) {
  describe('S3', () => {
    it('Creates bucket', () => {
      expectCDK(stack).to(countResources('AWS::S3::Bucket', 1));
    });
    it('Forwards to target', () => {
      expectCDK(stack).to(
        haveResourceLike('AWS::S3::Bucket', {
          WebsiteConfiguration: {
            RedirectAllRequestsTo: {
              HostName: 'target.tld',
              Protocol: 'https',
            },
          },
        })
      );
    });
  });
}

function assertSnapshot(stack: cdk.Stack) {
  it('Has consistent snapshot', () => {
    expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
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
