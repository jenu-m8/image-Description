import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBClient } from "lib/clients";
import { DynamoDBImage } from "lib/types/DynamoDBImage";

export const queryDynamoDB = async (
  requestId: string,
): Promise<DynamoDBImage[]> => {
  const queryCommand = new QueryCommand({
    TableName: process.env.CLASSIFICATION_TABLE_NAME,
    KeyConditionExpression: "requestId = :requestId",
    ExpressionAttributeValues: {
      ":requestId": { S: requestId },
    },
    ConsistentRead: true,
  });
  const queryResult = await dynamoDBClient.send(queryCommand);
  const items = queryResult.Items;
  return (
    items?.map((item) => ({
      requestId: item.requestId.S as string,
      imageId: item.imageId.S as string,
      classification: item.classification.S as string,
      confidence: (item.confidence?.N && parseFloat(item.confidence.N)) || 0,
      imageType: item.imageType.S as string,
      resized: item.resized.BOOL as boolean,
      cost: (item.cost?.N && parseFloat(item.cost.N)) || 0,
      service: item.service.S as string,
      processingTime:
        (item.processingTime?.N && parseInt(item.processingTime.N)) || 0,
    })) || []
  );
};
