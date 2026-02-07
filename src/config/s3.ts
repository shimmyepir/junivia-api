import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = env.AWS_BUCKET_NAME;
