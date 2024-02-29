export type DynamoDBImage = {
  requestId: string;
  imageId: string;
  classification: string;
  confidence: number;
  imageType: string;
  resized: boolean;
  cost: number;
  service: string;
  processingTime: number;
};
