import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "lib/clients";
import {
  RESIZED_IMAGE_DIMENSION,
  RESIZED_IMAGES_PREFIX,
  SOURCE_IMAGES_PREFIX,
} from "lib/constants";
import { streamToBuffer } from "lib/utils/streamToBuffer";
import sharp from "sharp";

export const resizeImage = async (key: string): Promise<void> => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: key,
  });
  const sourceImageObject = await s3Client.send(getObjectCommand);
  const sourceImage = await streamToBuffer(
    sourceImageObject.Body as NodeJS.ReadableStream,
  );
  const image = sharp(sourceImage);
  const metadata = await image.metadata();
  const resizeDimension =
    Math.max(metadata.width ?? 0, metadata.height ?? 0) >
    RESIZED_IMAGE_DIMENSION
      ? RESIZED_IMAGE_DIMENSION
      : undefined;
  const resizedImage = resizeDimension
    ? await image
        .resize({
          width: resizeDimension,
          height: resizeDimension,
        })
        .toBuffer()
    : sourceImage;
  const fileName = key.replace(SOURCE_IMAGES_PREFIX, RESIZED_IMAGES_PREFIX);
  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME!,
    Key: fileName,
    Body: resizedImage,
  });
  await s3Client.send(putObjectCommand);
};
