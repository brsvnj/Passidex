import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Document storage. Uses an S3-compatible bucket (EU region) when configured;
 * otherwise writes to local disk under UPLOAD_DIR so inbound documents work in
 * dev. Returns an opaque storageKey used to fetch bytes back for AI parsing.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>("S3_BUCKET");
    const accessKeyId = this.config.get<string>("S3_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("S3_SECRET_ACCESS_KEY");
    if (bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region: this.config.get<string>("S3_REGION") || "eu-central-1",
        endpoint: this.config.get<string>("S3_ENDPOINT") || undefined,
        forcePathStyle: !!this.config.get<string>("S3_ENDPOINT"),
        credentials: { accessKeyId, secretAccessKey },
      });
    }
  }

  private get bucket(): string {
    return this.config.get<string>("S3_BUCKET") || "";
  }
  private get uploadDir(): string {
    return this.config.get<string>("UPLOAD_DIR") || "uploads";
  }

  /** Persist bytes; returns a storageKey. */
  async put(
    orgId: string,
    filename: string,
    body: Buffer,
  ): Promise<string> {
    const safe = filename.replace(/[^\w.\-]+/g, "_");
    const key = `${orgId}/${randomBytes(8).toString("hex")}-${safe}`;

    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body }),
      );
      return key;
    }

    const path = join(this.uploadDir, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    this.logger.debug(`[storage:local] wrote ${path} (${body.length} bytes)`);
    return key;
  }

  /** Fetch bytes previously stored under storageKey. */
  async get(storageKey: string): Promise<Buffer> {
    if (this.s3) {
      const res = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Empty object at ${storageKey}`);
      return Buffer.from(bytes);
    }
    return readFile(join(this.uploadDir, storageKey));
  }
}
