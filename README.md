# AWS CDK Construct: Domain Redirector

This library provides a L3 AWS-CDK Construct, that implements an HTTPS redirector via CloudFront and S3.

It creates the following resources:

- ACM Certificate: Terminates provided domains (that ought to be redirected)
- Route53 Record(s): Routes provided domains (that ought to be redirected) to CloudFront
- CloudFront Distribution: Receives requests and return redirections; has certificate installed
- S3 Bucket: Creates redirection responses to target domain

![Diagram](daomin-redirect.png)

Example use-case is redirecting www to non-www, or vice versa, like:

- `https://www.yourdomain.tld` -> `https://yourdomain.tld`

## Usage

Install package:

```sh
$ npm install @ukautz/aws-cdk-domain-redirector
```

In your stack:

```typescript
import * as cdk from 'aws-cdk-lib';
import { aws_route53 as route53 } from 'aws-cdk-lib';
import { DomainRedirector } from '@ukautz/aws-cdk-domain-redirector';
import { Construct } from 'constructs';

export class YourStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.Stack) {
    super(scope, id, props);

    // load or create a hosted zone
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'your-domain.tld',
    });

    // redirect all the following to https://somewhere-else.tld
    // - http://www.your-domain.tld
    // - https://www.your-domain.tld
    // - http://other.your-domain.tld
    // - https://other.your-domain.tld
    // NOTE: all redirected `domains` but be in the same, provided `hostedZone`
    new DomainRedirector(this, 'Redirector', {
      domains: ['www.your-domain.tld', 'other.your-domain.tld'],
      targetDomain: 'somewhere-else.tld',
      hostedZone,
    });
  }
}
```

## See also

- [`@ukautz/aws-cdk-static-website`](https://github.com/ukautz/aws-cdk-static-website) - an AWS-CDK L3 construct for static website hosting
