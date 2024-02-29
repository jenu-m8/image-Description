import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { S3Client } from "@aws-sdk/client-s3";
import { SFNClient } from "@aws-sdk/client-sfn";
import { AWS_REGION } from "lib/constants";

export const dynamoDBClient = new DynamoDBClient({ region: AWS_REGION });

export const rekognitionClient = new RekognitionClient({
  region: AWS_REGION,
});

export const s3Client = new S3Client({ region: AWS_REGION });

export const sfnClient = new SFNClient({ region: AWS_REGION });
