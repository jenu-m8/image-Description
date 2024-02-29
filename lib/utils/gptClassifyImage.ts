import { Image } from "lib/types/Image";
import { descriptionMap } from "lib/types/DescriptionMap";
import OpenAI from "openai";

const openai = new OpenAI();
export const gptClassifyImage = async (image: Image): Promise<any> => {
  try {
    const keys = Object.keys(descriptionMap).join(", ");
    const prompt = `What’s in this image?: ${keys}.`;

    return await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: { url: image.signedUrl as string },
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("Error classifying image:", image.id, JSON.stringify(error));
    throw error;
  }
};
