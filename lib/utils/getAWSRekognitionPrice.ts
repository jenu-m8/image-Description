export const getAWSRekognitionPrice = () => {
  const price = {
    "us-east-1": 0.001,
    "us-east-2": 0.001,
    "us-west-1": 0.00117,
    "us-west-2": 0.001,
    "ca-central-1": 0.00111,
    "eu-central-1": 0.0012,
    "eu-west-1": 0.001,
    "eu-west-2": 0.00116,
    "ap-south-1": 0.00125,
    "ap-northeast-2": 0.0012,
    "ap-southeast-1": 0.0013,
    "ap-southeast-2": 0.0012,
    "ap-northeast-1": 0.0013,
  };
  const region = process.env.AWS_REGION as keyof typeof price;
  return region ? price[region] : 0.0013;
};
