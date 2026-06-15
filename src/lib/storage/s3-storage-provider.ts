import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import type { StorageProvider, StorageUploadResult } from "./types"

function getS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION || "auto"
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false"

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 depolama yapılandırması eksik. S3_ENDPOINT, S3_ACCESS_KEY_ID ve S3_SECRET_ACCESS_KEY ortam değişkenlerini ayarlayınız."
    )
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle,
  })
}

function getBucket(): string {
  return process.env.S3_BUCKET || "bakimx-media"
}

function getPublicUrl(key: string): string {
  const publicDomain = process.env.S3_PUBLIC_DOMAIN
  const endpoint = process.env.S3_ENDPOINT || ""
  const bucket = getBucket()

  if (publicDomain) {
    return `https://${publicDomain}/${key}`
  }

  return `${endpoint}/${bucket}/${key}`
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