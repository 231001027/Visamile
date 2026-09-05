import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { put, get } from "@vercel/blob";

export interface StorageAdapter {
  /** Persist bytes; returns the key to store in the database. */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  getSignedDownloadUrl(key: string): Promise<string>;
}

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, data: Buffer): Promise<string> {
    if (process.env.VERCEL) {
      throw new Error(
        "Local disk uploads do not work on Vercel. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or BLOB_READ_WRITE_TOKEN / S3)."
      );
    }
    const fullPath = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(path.join(UPLOAD_ROOT, key));
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    return `/api/documents/${encodeURIComponent(key)}`;
  }
}

class SupabaseStorage implements StorageAdapter {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase storage.");
    }
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || "documents";
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const { error } = await this.client.storage.from(this.bucket).upload(key, data, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error(error?.message || `Object not found: ${key}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedDownloadUrl(key: string): Promise<string> {
    // Keep downloads behind our auth-gated API route.
    return `/api/documents/${encodeURIComponent(key)}`;
  }
}

class BlobStorage implements StorageAdapter {
  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await put(key, data, {
      access: "private",
      contentType,
      addRandomSuffix: false,
    });
    return key;
  }

  async get(key: string): Promise<Buffer> {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      throw new Error(`Object not found: ${key}`);
    }
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
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

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType })
    );
    return key;
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
  const driver = (process.env.STORAGE_DRIVER || "").toLowerCase();

  if (
    driver === "supabase" ||
    (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && driver !== "local" && driver !== "s3" && driver !== "blob")
  ) {
    return new SupabaseStorage();
  }
  if (driver === "blob" || process.env.BLOB_READ_WRITE_TOKEN) {
    return new BlobStorage();
  }
  if (driver === "s3" && process.env.S3_BUCKET) {
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
