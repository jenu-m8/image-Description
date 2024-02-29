import {Construct} from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as s3Notifications from 'aws-cdk-lib/aws-s3-notifications';
import {SOURCE_IMAGES_PREFIX} from "./constants/index";


export class ImageDescriptionStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const bucket = new s3.Bucket(this, "Bucket", {
            versioned: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });

        const descriptionTable = new aws_dynamodb.Table(
            this,
            "descriptionTable",
            {
                partitionKey: {
                    name: "requestId",
                    type: cdk.aws_dynamodb.AttributeType.STRING,
                },
                sortKey: {
                    name: "imageId",
                    type: cdk.aws_dynamodb.AttributeType.STRING,
                },
                billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
                removalPolicy: cdk.RemovalPolicy.DESTROY,
            },
        );

        const api = new apigateway.RestApi(this, "ImageDescriptionApi", {
            restApiName: "Image Description API",
            description: "This service serves Image Description API.",
            endpointConfiguration: {
                types: [cdk.aws_apigateway.EndpointType.REGIONAL],
            },
        });

        const apiKey = new apigateway.ApiKey(this, "ImageDescriptionApiKey", {
            apiKeyName: "Image Description API Key",
        });

        const usagePlan = new apigateway.UsagePlan(
            this,
            "ImageClassificationUsagePlan",
            {
                name: "Image Classification Usage Plan",
                throttle: {
                    rateLimit: 10,
                    burstLimit: 2,
                },
            },
        );

        usagePlan.addApiKey(apiKey);

        usagePlan.addApiStage({
            stage: api.deploymentStage,
            api: api,
        });

        const uploadUrlLambda = new lambdaNodeJs.NodejsFunction(
            this,
            "UploadUrlLambda",
            {
                entry: "./lib/lambda/upload-url/handler.ts",
                handler: "main",
                environment: {
                    BUCKET_NAME: bucket.bucketName,
                    CLASSIFICATION_TABLE_NAME: descriptionTable.tableName,
                },
                timeout: cdk.Duration.seconds(28),
                runtime: lambda.Runtime.NODEJS_18_X,
            },
        );

        uploadUrlLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:GetObject", "s3:PutObject"],
                resources: [bucket.bucketArn + "/*"],
            }),
        );

        uploadUrlLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                    "dynamodb:GetItem",
                    "dynamodb:BatchWriteItem",
                ],
                resources: [descriptionTable.tableArn],
            }),
        );

        const uploadUrlIntegration = new apigateway.LambdaIntegration(
            uploadUrlLambda,
        );
        const uploadUrlResource = api.root.addResource("upload-url");
        uploadUrlResource.addMethod("POST", uploadUrlIntegration);


        const gptDescriptionDetectionLambda = new lambdaNodeJs.NodejsFunction(
            this,
            "GPTDescriptionDetectionLambda",
            {
                entry: "./lib/lambda/gpt-description-detection/handler.ts",
                handler: "main",
                environment: {
                    CLASSIFICATION_TABLE_NAME: descriptionTable.tableName,
                },
                timeout: cdk.Duration.seconds(28),
                runtime: lambda.Runtime.NODEJS_18_X,
            },
        );

        gptDescriptionDetectionLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                    "dynamodb:GetItem",
                    "dynamodb:BatchWriteItem",
                ],
                resources: [descriptionTable.tableArn],
            }),
        );

        gptDescriptionDetectionLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:GetObject", "s3:PutObject"],
                resources: [bucket.bucketArn + "/*"],
            }),
        );


        const getStatusLambda = new lambdaNodeJs.NodejsFunction(
            this,
            "GetStatusLambda",
            {
                entry: "./lib/lambda/get-status/handler.ts",
                handler: "main",
                environment: {
                    CLASSIFICATION_TABLE_NAME: descriptionTable.tableName,
                },
                timeout: cdk.Duration.seconds(28),
                runtime: lambda.Runtime.NODEJS_18_X,
            },
        );

        getStatusLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["dynamodb:Query"],
                resources: [descriptionTable.tableArn],
            }),
        );

        getStatusLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["states:DescribeExecution"],
                resources: ["*"],
            }),
        );


        const descriptionDetectionUsingGPT = new tasks.LambdaInvoke(
            this,
            "LabelDetectionUsingGPT",
            {
                lambdaFunction: gptDescriptionDetectionLambda,
            },
        );



        const getStatusTask = new tasks.LambdaInvoke(this, "GetStatus", {
            lambdaFunction: getStatusLambda,
            payload: sfn.TaskInput.fromObject({
                requestId: sfn.JsonPath.stringAt("$.Payload.requestId"),
                "executionId.$": "$$.Execution.Id",
            }),
        });


        const failTask = new sfn.Fail(this, "Fail");

        const imageDescriptionStepFunction = new sfn.StateMachine(
            this,
            "ImageDescriptionStepFunction",
            {
                definition: descriptionDetectionUsingGPT
                    .addRetry({
                        maxAttempts: 30,
                        backoffRate: 2.0,
                        interval: cdk.Duration.seconds(60),
                        errors: ["States.ALL"],
                    })
                    .next(
                        new sfn.Choice(this, "RateLimited")
                            .when(
                                sfn.Condition.booleanEquals(
                                    "$.Payload.rateLimitError",
                                    true,
                                ),
                                new sfn.Wait(this, "WaitForGPTRetry", {
                                    time: sfn.WaitTime.duration(
                                        cdk.Duration.seconds(120),
                                    ),
                                }).next(descriptionDetectionUsingGPT),
                            )
                            .otherwise(
                                new sfn.Choice(this, "HasErrors")
                                    .when(
                                        sfn.Condition.booleanEquals(
                                            "$.Payload.error",
                                            true,
                                        ),
                                        failTask,
                                    )
                                    .otherwise(
                                        new sfn.Choice(
                                            this,
                                            "HasUnclassifiedImagesCheckTwo",
                                        )
                                            .when(
                                                sfn.Condition.numberGreaterThan(
                                                    "$.Payload.unclassifiedImagesCount",
                                                    0,
                                                ),
                                                new sfn.Wait(this, "WaitForGPT", {
                                                    time: sfn.WaitTime.duration(
                                                        cdk.Duration.seconds(5),
                                                    ),
                                                }).next(descriptionDetectionUsingGPT),
                                            )
                                            .otherwise(getStatusTask),
                                    ),
                            )
                    ),
            },
        );


        const sharpLayer = new lambda.LayerVersion(this, "SharpLambdaLayer", {
            code: lambda.Code.fromAsset("./lib/lambda/sharp-layer", {
                bundling: {
                    image: lambda.Runtime.NODEJS_16_X.bundlingImage,
                    entrypoint: ["/bin/sh", "-c"],
                    command: [
                        "mkdir -p /asset-output/nodejs && cp -r /asset-input/. /asset-output/nodejs",
                    ],
                },
            }),
            compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
            description: "Sharp layer for image resizing",
        });



        const resizeImageLambda = new lambdaNodeJs.NodejsFunction(
            this,
            "ResizeImageLambda",
            {
                entry: "./lib/lambda/resize-image/handler.ts",
                handler: "main",
                environment: {
                    BUCKET_NAME: bucket.bucketName,
                    CLASSIFICATION_TABLE_NAME: descriptionTable.tableName,
                    STATE_MACHINE_ARN: imageDescriptionStepFunction.stateMachineArn,
                },
                timeout: cdk.Duration.seconds(28),
                runtime: lambda.Runtime.NODEJS_18_X,
                layers: [sharpLayer],
            },
        );

        resizeImageLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:GetObject", "s3:PutObject"],
                resources: [bucket.bucketArn + "/*"],
            }),
        );

        resizeImageLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    "dynamodb:PutItem",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                    "dynamodb:GetItem",
                    "dynamodb:BatchWriteItem",
                ],
                resources: [descriptionTable.tableArn],
            }),
        );

        resizeImageLambda.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["states:StartExecution"],
                resources: [imageDescriptionStepFunction.stateMachineArn],
            }),
        );


        bucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3Notifications.LambdaDestination(resizeImageLambda),
            {
                prefix: `${SOURCE_IMAGES_PREFIX}/`,
            },
        );


    }
}
