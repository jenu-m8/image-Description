export type Image = {
  id: string;
  type: string;
  requestId: string;
  signedUrl?: string;
  resized?: boolean;
  classification?: string;
  confidence?: number;
  cost?: number;
  service?: string;
  processingTime?: number;
  resizedOn?: string;
};
