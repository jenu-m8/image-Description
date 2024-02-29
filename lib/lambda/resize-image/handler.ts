import { StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Handler, S3Event, S3EventRecord } from "aws-lambda";
import { sfnClient } from "lib/clients";
import { NONE_CLASSIFICATION } from "lib/constants";
import { queryDynamoDB } from "lib/utils/queryDynamoDB";
import { resizeImage } from "lib/utils/resizeImage";
import { writeToDynamoDB } from "lib/utils/writeToDynamoDB";

interface ImageInfo {
  id: string;
  type: string;
  requestId: string;
  resized: boolean;
  classification: string;
  resizedOn?: string;
}

const processImage = async (record: S3EventRecord): Promise<ImageInfo> => {
  const keyParts = record.s3.object.key.split("/");
  await resizeImage(record.s3.object.key);
  return {
    id: keyParts[2].split(".")[0],
    type: keyParts[2].split(".")[1],
    requestId: keyParts[1],
    resized: true,
    classification: NONE_CLASSIFICATION,
    resizedOn: new Date().toISOString().split("T")[0],
  };
};

const startExecution = async (requestId: string) => {
  const startExecutionCommand = new StartExecutionCommand({
    stateMachineArn: process.env.STATE_MACHINE_ARN!,
    input: JSON.stringify({ requestId }),
  });
  // await sfnClient.send(startExecutionCommand);
};

export const main: Handler = async (event: S3Event) => {
  try {
    const images = await Promise.all(event.Records.map(processImage));

    const requestIds = new Set(images.map((image) => image.requestId));

    const dbWritesAndExecutions = Array.from(requestIds).map(
      async (requestId) => {
        const imagesForRequestId = images.filter(
          (image) => image.requestId === requestId,
        );
        await writeToDynamoDB(imagesForRequestId, requestId);

        const response = await queryDynamoDB(requestId);
        const allImagesResized = response.every(
          (item) => item.resized && item.requestId === requestId,
        );
        // if (allImagesResized) {
        //   await startExecution(requestId);
        // }
      },
    );

    await Promise.all(dbWritesAndExecutions);
  } catch (error) {
    console.error("Error processing images:", error);
    throw error;
  }
};
