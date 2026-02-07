import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("8000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // MongoDB
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // JWT
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  // AWS S3
  AWS_REGION: z.string().default("auto"),
  AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required"),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required"),
  AWS_BUCKET_NAME: z.string().min(1, "AWS_BUCKET_NAME is required"),
  AWS_ENDPOINT: z.string().min(1, "AWS_ENDPOINT is required"),
  AWS_BUCKET_URL: z.string().min(1, "AWS_BUCKET_URL is required"),

  // Admin
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
