import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "lib/clients";
import { Image } from "lib/types/Image";

export const getPreSignedUrl = async (
  image: Image,
  prefix: string,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: `${prefix}/${image.id}.${image.type}`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};
