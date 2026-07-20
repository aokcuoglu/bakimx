import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { StorageProvider, StorageUploadResult } from "./types"

function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  // Real AWS S3 needs a concrete region; a custom endpoint (MinIO) ignores it, so keep the
  // legacy default so self-hosted setups without S3_REGION still work.
  const region = process.env.S3_REGION || (endpoint ? "auto" : "us-east-1")

  // A custom endpoint (self-hosted / MinIO) requires explicit static credentials. Without an
  // endpoint we target AWS S3 and fall back to the default credential provider chain: the ECS
  // task role in prod, and SSO (AWS_PROFILE) or AWS_* env vars during local development.
  if (endpoint && (!accessKeyId || !secretAccessKey)) {
    throw new Error(
      "S3 depolama yapılandırması eksik: özel S3_ENDPOINT verildiğinde S3_ACCESS_KEY_ID ve S3_SECRET_ACCESS_KEY zorunludur."
    )
  }

  // Path-style for a custom endpoint (MinIO), virtual-hosted for AWS S3. Explicit override wins.
  const forcePathStyle =
    process.env.S3_FORCE_PATH_STYLE !== undefined
      ? process.env.S3_FORCE_PATH_STYLE === "true"
      : Boolean(endpoint)

  return new S3Client({
    region,
    forcePathStyle,
    ...(endpoint ? { endpoint } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  })
}

function getBucket(): string {
  return process.env.S3_BUCKET || "bakimx-media"
}

function getPublicUrl(key: string): string {
  const publicDomain = process.env.S3_PUBLIC_DOMAIN
  if (publicDomain) {
    return `https://${publicDomain}/${key}`
  }

  const bucket = getBucket()
  const endpoint = process.env.S3_ENDPOINT
  if (endpoint) {
    return `${endpoint}/${bucket}/${key}`
  }

  // AWS S3 virtual-hosted URL. Objects are read through presigned URLs (see getSignedUrl), so
  // this is only the stored reference, not the serving path.
  const region = process.env.S3_REGION || "us-east-1"
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export class S3StorageProvider implements StorageProvider {
  async upload(file: File, path: string): Promise<StorageUploadResult> {
    const client = getS3Client()
    const bucket = getBucket()
    const buffer = Buffer.from(await file.arrayBuffer())

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: buffer,
        ContentType: file.type,
      })
    )

    return { url: getPublicUrl(path), key: path }
  }

  async delete(key: string): Promise<void> {
    const client = getS3Client()
    const bucket = getBucket()

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const client = getS3Client()
    const bucket = getBucket()

    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn }
    )
  }
}
