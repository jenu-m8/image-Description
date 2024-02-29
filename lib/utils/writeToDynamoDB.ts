import { BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBClient } from "lib/clients";
import { MAX_DYNAMO_DB_BATCH_SIZE, NONE_CLASSIFICATION } from "lib/constants";
import { Image } from "lib/types/Image";
import { chunkArray } from "lib/utils/chunkArray";

type ItemType = {
  requestId: { S: string };
  imageId: { S: string };
  imageType: { S: string };
  classification: { S: string };
  confidence: { N: string };
  resized: { BOOL: boolean };
  cost: { N: string };
  service: { S: string };
  updatedAt: { S: string };
  processingTime: { N: string };
  resizedOn?: { S: string };
};

export const writeToDynamoDB = async (
  images: Image[],
  requestId: string,
): Promise<void> => {
  const batches = chunkArray(images, MAX_DYNAMO_DB_BATCH_SIZE);
  for (const batch of batches) {
    const putRequests = batch.map((image) => {
      const Item: ItemType = {
        requestId: { S: requestId },
        imageId: { S: image.id },
        imageType: { S: image.type },
        classification: { S: image.classification || NONE_CLASSIFICATION },
        confidence: { N: image.confidence?.toString() || "0" },
        resized: { BOOL: image.resized || false },
        cost: { N: image.cost?.toString() || "0" },
        service: { S: image.service || "" },
        updatedAt: { S: new Date().toISOString() },
        processingTime: { N: image.processingTime?.toString() || "0" },
      };
      if (image.resizedOn) {
        Item.resizedOn = { S: image.resizedOn };
      }
      return {
        PutRequest: {
          Item: Item,
        },
      };
    });

    const batchWriteCommand = new BatchWriteItemCommand({
      RequestItems: {
        [process.env.CLASSIFICATION_TABLE_NAME as string]: putRequests,
      },
    });

    await dynamoDBClient.send(batchWriteCommand);
  }
};
