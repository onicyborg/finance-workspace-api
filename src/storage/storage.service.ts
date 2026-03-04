import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.getOrThrow<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.getOrThrow<string>(
      'R2_SECRET_ACCESS_KEY',
    );

    this.bucket = this.config.getOrThrow<string>('R2_BUCKET_NAME');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createUploadUrl(fileType: string) {
    const key = `transactions/${randomUUID()}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: 60, // URL berlaku 60 detik
    });

    return {
      key,
      uploadUrl,
    };
  }

  async uploadTransactionAttachment(
    transactionId: string,
    file: Express.Multer.File,
  ) {
    if (!file.mimetype.startsWith('image/')) {
      throw new Error('Only images allowed');
    }

    const compressed = await sharp(file.buffer)
      .resize({ width: 1600 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `transactions/${transactionId}/${randomUUID()}.jpg`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: compressed,
        ContentType: 'image/jpeg',
      }),
    );

    return {
      key,
      size: compressed.length,
      mimeType: 'image/jpeg',
    };
  }
}
