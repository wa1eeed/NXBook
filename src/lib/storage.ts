import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const client = new S3Client({
  region: process.env.R2_ACCOUNT_ID ? "auto" : (process.env.AWS_REGION ?? "me-south-1"),
  ...(process.env.R2_ACCOUNT_ID && {
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  }),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string> {
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000" }))
  return `${PUBLIC_URL}/${key}`
}

export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(client, new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn: 300 })
}

export const StorageKeys = {
  businessLogo: (id: string, ext: string) => `businesses/${id}/logo.${ext}`,
  serviceImage: (bId: string, sId: string, ext: string) => `businesses/${bId}/services/${sId}.${ext}`,
  staffAvatar: (bId: string, sId: string, ext: string) => `businesses/${bId}/staff/${sId}.${ext}`,
}
