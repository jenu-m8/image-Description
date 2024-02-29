import { DescribeExecutionCommand } from "@aws-sdk/client-sfn";
import { sfnClient } from "lib/clients";

export const getStepFunctionExecutionElapsedTime = async (
  executionId: string,
): Promise<number> => {
  const describeExecutionCommand = new DescribeExecutionCommand({
    executionArn: executionId,
  });
  const describeExecutionResult = await sfnClient.send(
    describeExecutionCommand,
  );

  console.log(
    "describeExecutionResult",
    JSON.stringify(describeExecutionResult),
  );

  const startDate = describeExecutionResult.startDate;
  const stopDate = new Date();

  if (!startDate || !stopDate) {
    console.error("Error processing images: startDate or stopDate is null");
    return 0;
  }
  try {
    return stopDate.getTime() - startDate.getTime();
  } catch (error) {
    console.error("Error processing images:", error);
  }

  return 0;
};
