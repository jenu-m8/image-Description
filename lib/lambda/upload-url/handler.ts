import { APIGatewayEvent, Handler } from "aws-lambda";
import { NONE_CLASSIFICATION, SOURCE_IMAGES_PREFIX } from "lib/constants";
import { Image } from "lib/types/Image";
import { putPreSignedUrls } from "lib/utils/putPreSignedUrls";
import { writeToDynamoDB } from "lib/utils/writeToDynamoDB";

interface Body {
    images: Image[];
}

const validateImages = (images: Image[]): boolean => {
    return images.every(
        (image: Image) =>
            image.id && image.type && ["png", "jpeg"].includes(image.type),
    );
};
export const main: Handler = async (event: APIGatewayEvent) => {
    const body: Body = JSON.parse(event.body || "{}");
    const images: Image[] = body.images || [];

    if (images.length === 0 || !validateImages(images)) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Invalid image array in request body." }),
        };
    }

    const requestId = event.requestContext.requestId;
    const prefix = `${SOURCE_IMAGES_PREFIX}/${requestId}`;
    const signedUrls = await putPreSignedUrls(images, prefix);
    if (!process.env.CLASSIFICATION_TABLE_NAME) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Classification table name is not defined",
            }),
        };
    }

    images.forEach((image) => {
        image.classification = NONE_CLASSIFICATION;
        image.resized = false;
    });

    await writeToDynamoDB(images, requestId);

    return {
        statusCode: 200,
        body: JSON.stringify({ requestId, signedUrls }),
    };
};
