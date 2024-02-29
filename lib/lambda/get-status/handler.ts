import { APIGatewayProxyEvent, Handler } from "aws-lambda";
import { NONE_CLASSIFICATION } from "lib/constants";
import { getStepFunctionExecutionElapsedTime } from "lib/utils/getStepFunctionExecutionElapsedTime";
import { queryDynamoDB } from "lib/utils/queryDynamoDB";

type StepFunctionEvent = {
  requestId: string;
  executionId?: string;
};

type Event = StepFunctionEvent | APIGatewayProxyEvent;

const isApiGatewayEvent = (event: any): event is APIGatewayProxyEvent => {
  return event && typeof event.httpMethod === "string";
};

const getRequestId = (event: Event): string => {
  if (isApiGatewayEvent(event)) {
    return event.pathParameters?.requestId as string;
  } else {
    return event.requestId;
  }
};

const getExecutionId = (event: Event): string | null => {
  if (!isApiGatewayEvent(event)) {
    return event.executionId || null;
  }
  return null;
};

export const main: Handler = async (event: Event) => {
  const requestId = getRequestId(event);
  const response = await queryDynamoDB(requestId);

  let totalCost = 0;
  response?.forEach((image) => {
    totalCost += image.cost ? image.cost : 0;
  });
  totalCost = Math.round(totalCost * 100000000) / 100000000;

  const images = response
    ?.filter((image) => image.classification !== NONE_CLASSIFICATION)
    .map((image) => ({
      id: image.imageId,
      classification: image.classification,
      confidence: image.confidence,
      cost: image.cost,
      service: image.service,
      processingTime: image.processingTime ? image.processingTime / 1000 : 0,
    }));

  const hasUnprocessedImages = response?.some(
    (image) => image.classification === NONE_CLASSIFICATION,
  );

  if (isApiGatewayEvent(event)) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        images: images,
        totalCostInUSD: totalCost,
        hasUnprocessedImages: hasUnprocessedImages,
      }),
    };
  }
  let totalProcessingTime = undefined;
  const executionId = getExecutionId(event);
  if (executionId) {
    totalProcessingTime =
      await getStepFunctionExecutionElapsedTime(executionId);
  }

  return {
    images: images,
    totalCostInUSD: totalCost,
    requestId: requestId,
    totalProcessingTimeInSeconds: totalProcessingTime
      ? totalProcessingTime / 1000
      : undefined,
    hasUnprocessedImages: hasUnprocessedImages,
  };
};
