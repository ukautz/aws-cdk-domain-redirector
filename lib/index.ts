import * as cdk from '@aws-cdk/core';

export interface RedirectorProps {
  // Define construct properties here
}

export class Redirector extends cdk.Construct {

  constructor(scope: cdk.Construct, id: string, props: RedirectorProps = {}) {
    super(scope, id);

    // Define construct contents here
  }
}
