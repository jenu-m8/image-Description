import { NONE_CLASSIFICATION } from "lib/constants";

export const descriptionMap = {
  UNCLASSIFIED: "Unclassified",
};

export type DescriptionMap = keyof typeof descriptionMap;
export const getDescription = (description: string): string => {
  const descriptionKey = Object.keys(descriptionMap).find((key) => description.includes(key)) as
    | DescriptionMap
    | undefined;
  return descriptionKey ? descriptionMap[descriptionKey] : NONE_CLASSIFICATION;
};
