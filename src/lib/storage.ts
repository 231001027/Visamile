import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getSignedDownloadUrl(key: string): Promise<string>;
}

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<void> {
    const fullPath = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(path.join(UPLOAD_ROOT, key));
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return `/api/documents/${encodeURIComponent(key)}`;
  }
}

class S3Storage implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET!;
    this.client = new S3Client({
      region: process.env.S3_REGION || "ap-south-1",
      credentials: process.env.S3_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY!,
            secretAccessKey: process.env.S3_SECRET_KEY!,
          }
        : undefined,
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType })
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Object not found: ${key}`);
    return Buffer.from(bytes);
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: 300,
    });
  }
}

function createStorage(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === "s3" && process.env.S3_BUCKET) {
    return new S3Storage();
  }
  return new LocalDiskStorage();
}

export const storage: StorageAdapter = createStorage();

export function buildStorageKey(scope: string, originalFileName: string) {
  const ext = path.extname(originalFileName);
  const random = crypto.randomBytes(8).toString("hex");
  return `${scope}/${Date.now()}-${random}${ext}`;
}
