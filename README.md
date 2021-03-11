# AWS CDK Construct: Domain Redirectorx

An AWS CDK pattern / solution construct.

**This is experimental! Do not use in production**, I use it for my private blog.

Implements HTTP(S) redirection for a set of domains to a domain target, as in:
- `https://www.yourdomain.tld` -> `https://yourdomain.tld` (or vice versa or whatever you have)

## Usage

**Note:** The NPM package is hosted on [Github packages](https://github.com/features/packages) as I do not consider it production ready and do not want to contribute to accidental installs… Read up how to use Github Packages hosted NPM packages if you want to use it. Read up how to use [Github Packages hosted NPM packages](https://docs.github.com/en/packages/guides/configuring-npm-for-use-with-github-packages#installing-a-package) if you want to use it

In your stack:

```typescript
import * as cdk from '@aws-cdk/core';
import * as route53 from '@aws-cdk/aws-route53';
import { DomainRedirector } from '@ukautz/aws-cdk-domain-redirector';

export class YourStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.Stack) {
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
    new DomainRedirector(this, 'Redirector', {
      domains: ['www.your-domain.tld', 'other.your-domain.tld'],
      targetDomain: 'somewhere-else.tld,
      hostedZone,
    });
  }
}

```

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests