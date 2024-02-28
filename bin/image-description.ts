#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ImageDescriptionStack } from '../lib/image-description-stack';

const app = new cdk.App();
new ImageDescriptionStack(app, 'ImageDescriptionStack');
