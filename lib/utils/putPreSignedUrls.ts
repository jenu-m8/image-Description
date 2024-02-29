import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "lib/clients";
import { Image } from "lib/types/Image";

export const putPreSignedUrls = async (
  images: Image[],
  prefix: string,
): Promise<
  {
    id: string;
    uploadUrl: string;
  }[]
> => {
  return Promise.all(
    images.map(async (image) => {
      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: `${prefix}/${image.id}.${image.type}`,
        ContentType: `image/${image.type}`,
      });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return { id: image.id, uploadUrl: url };
    }),
  );
};
