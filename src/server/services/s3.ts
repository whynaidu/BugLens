import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "";
const PRESIGNED_URL_EXPIRES_IN = 3600; // 1 hour

/**
 * Generate S3 key for screenshots
 * Format: {orgId}/{projectId}/{flowId}/{screenshotId}/{filename}
 */
export function generateS3Key(
  orgId: string,
  projectId: string,
  flowId: string,
  screenshotId: string,
  filename: string
): string {
  return `${orgId}/${projectId}/${flowId}/${screenshotId}/${filename}`;
}

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  });

  return url;
}

/**
 * Generate a presigned URL for downloading a file from S3
 */
export async function generateDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  });

  return url;
}

/**
 * Delete an object from S3
 */
export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Delete multiple objects from S3 (e.g., original, thumbnail, preview)
 */
export async function deleteScreenshotFiles(baseKey: string): Promise<void> {
  const keysToDelete = [
    baseKey, // original file
    baseKey.replace(/\.[^.]+$/, "-thumbnail.webp"),
    baseKey.replace(/\.[^.]+$/, "-preview.webp"),
  ];

  await Promise.all(
    keysToDelete.map(async (key) => {
      try {
        await deleteObject(key);
      } catch {
        // Ignore errors for files that don't exist
      }
    })
  );
}

/**
 * Get object metadata from S3
 */
export async function getObjectMetadata(key: string): Promise<{
  contentType?: string;
  contentLength?: number;
  lastModified?: Date;
} | null> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
    };
  } catch {
    return null;
  }
}

/**
 * Get the public CDN URL for a file (if CloudFront is configured)
 */
export function getCdnUrl(key: string): string {
  const cdnDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  if (cdnDomain) {
    return `https://${cdnDomain}/${key}`;
  }
  // Fallback to S3 URL
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
}
