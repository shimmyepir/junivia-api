import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET } from "../config/s3.js";
import { env } from "../config/env.js";
import crypto from "crypto";

interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload an image to S3
 */
export const uploadImage = async (
  file: Express.Multer.File,
): Promise<UploadResult> => {
  const fileExtension = file.originalname.split(".").pop() || "jpg";
  const key = `puzzles/${crypto.randomUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  const url = `${env.AWS_BUCKET_URL}/${key}`;

  return { url, key };
};

/**
 * Upload an audio file to S3
 */
export const uploadAudio = async (
  file: Express.Multer.File,
): Promise<UploadResult> => {
  const fileExtension = file.originalname.split(".").pop() || "mp3";
  const key = `audiobooks/${crypto.randomUUID()}.${fileExtension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  const url = `${env.AWS_BUCKET_URL}/${key}`;

  return { url, key };
};

/**
 * Delete an image from S3
 */
export const deleteImage = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Generate a presigned URL for temporary access to a private image
 */
export const getPresignedUrl = async (
  key: string,
  expiresIn: number = 3600,
): Promise<string> => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};
