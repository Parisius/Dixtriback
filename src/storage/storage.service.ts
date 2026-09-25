import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

interface S3Config {
  endpoint: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  keyPrefix: string;
  forcePathStyle: boolean;
  autoCreateBucket: boolean;
}

/**
 * Thin wrapper over an S3-compatible store (MinIO). Deliberately conservative:
 *  - never changes bucket policies (the bucket stays private; public files are
 *    served through the API, which is what lets us share someone else's MinIO safely);
 *  - never logs credentials;
 *  - a missing/unreachable store never stops the API booting — uploads answer 503.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly cfg: S3Config;
  private readonly client: S3Client | null;
  private bucketReady = false;

  constructor(config: ConfigService) {
    this.cfg = config.get<S3Config>('s3')!;
    this.client = this.isConfigured()
      ? new S3Client({
          endpoint: this.cfg.endpoint,
          region: this.cfg.region,
          credentials: { accessKeyId: this.cfg.accessKey, secretAccessKey: this.cfg.secretKey },
          forcePathStyle: this.cfg.forcePathStyle,
          maxAttempts: 3,
        })
      : null;
  }

  isConfigured(): boolean {
    return !!(this.cfg.endpoint && this.cfg.accessKey && this.cfg.secretKey && this.cfg.bucket);
  }

  async onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn('S3_* is not configured: file uploads are disabled (503).');
      return;
    }
    try {
      await this.ensureBucket();
      this.logger.log(`Storage ready (bucket "${this.cfg.bucket}" at ${this.cfg.endpoint}).`);
    } catch (err) {
      this.logger.warn(`Storage check failed (${this.describe(err)}); will retry on first upload.`);
    }
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException("Le stockage de fichiers n'est pas configuré.");
    }
    return this.client;
  }

  /** Verifies the bucket exists (creating it only when S3_AUTO_CREATE_BUCKET=true). Memoized. */
  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    const client = this.requireClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
    } catch (err: any) {
      const notFound = err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404;
      if (notFound && this.cfg.autoCreateBucket) {
        await client.send(new CreateBucketCommand({ Bucket: this.cfg.bucket }));
        this.logger.log(`Created bucket "${this.cfg.bucket}".`);
      } else {
        throw err;
      }
    }
    this.bucketReady = true;
  }

  /** Error summary that is useful and safe to log: never includes credentials. */
  private describe(err: any): string {
    const status = err?.$metadata?.httpStatusCode;
    const hint =
      status === 403 ? 'access denied: wrong key, or no permission on this bucket'
      : status === 404 ? `bucket "${this.cfg.bucket}" not found (and S3_AUTO_CREATE_BUCKET is ${this.cfg.autoCreateBucket})`
      : status === 400 ? 'bad request: often a region/signature mismatch'
      : err?.code === 'ECONNREFUSED' || err?.cause?.code === 'ECONNREFUSED' ? 'connection refused: check S3_ENDPOINT'
      : '';
    return [err?.name ?? 'Error', status ? `HTTP ${status}` : null, hint || null].filter(Boolean).join(', ');
  }

  private unavailable(action: string, err: any): never {
    this.logger.error(`Storage ${action} failed: ${this.describe(err)}`);
    throw new ServiceUnavailableException('Le stockage de fichiers est momentanément indisponible.');
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.requireClient();
    try {
      await this.ensureBucket();
      await client.send(
        new PutObjectCommand({
          Bucket: this.cfg.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        }),
      );
    } catch (err) {
      this.unavailable('put', err);
    }
  }

  /** Returns null when the object does not exist. */
  async get(key: string): Promise<{ body: Readable; length?: number } | null> {
    const client = this.requireClient();
    try {
      await this.ensureBucket();
      const out = await client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
      return { body: out.Body as Readable, length: out.ContentLength };
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
      this.unavailable('get', err);
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    try {
      await this.ensureBucket();
      await client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
    } catch (err) {
      this.unavailable('delete', err);
    }
  }

  /** Full object key for a logical path: prefixed with S3_KEY_PREFIX when set. The full key is what gets stored. */
  buildKey(path: string): string {
    return this.cfg.keyPrefix ? `${this.cfg.keyPrefix}/${path}` : path;
  }

  get bucket(): string {
    return this.cfg.bucket;
  }
}
