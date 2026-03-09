import { BaseStorage } from './BaseStorage.ts';
import { StorageProvider } from './types.ts';
import ClientS3 from '@aws-sdk/client-s3';
import S3RequestPresigner from '@aws-sdk/s3-request-presigner';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { Readable, Writable } from 'stream';

dotenv.config();

export class AWSS3 extends BaseStorage {
    private client: ClientS3.S3Client;
    private readonly bucketName: string;
    private readonly basePath: string;
    constructor() {
        super();
        this.bucketName = process.env.BUCKET_NAME || '';
        this.basePath = process.env.STORAGE_BASE_PATH || '';
        if (!this.bucketName) {
            throw new Error('BUCKET_NAME is required');
        }
        if (!process.env.AWS_REGION) {
            throw new Error('AWS_REGION is required');
        }
        if (!process.env.AWS_ACCESS_KEY_ID) {
            throw new Error('AWS_ACCESS_KEY_ID is required');
        }
        if (!process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS_SECRET_ACCESS_KEY is required');
        }
        this.client = new ClientS3.S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    getStorageProviderName(): StorageProvider {
        return StorageProvider.AWSS3;
    }
    private getFullPath(key: string): string {
        return this.basePath ? `${this.basePath.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}` : key;
    }

    async uploadFile(params: { srcFilePath: string; destinationKey: string }) {
        const { srcFilePath, destinationKey } = params;
        const fileStream = fs.createReadStream(srcFilePath);

        const command = new ClientS3.PutObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(destinationKey),
            Body: fileStream
        });

        await this.client.send(command);
    }

    async uploadData(params: { data: string | Buffer; destinationKey: string; contentType?: string }) {
        const { destinationKey, data, contentType } = params;
        const command = new ClientS3.PutObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(destinationKey),
            Body: data,
            ...(contentType && { ContentType: contentType })
        });
        await this.client.send(command);
    }

    async downloadDocument(params: { srcKey: string; destinationFilePath: string }): Promise<void> {
        const { srcKey, destinationFilePath } = params;
        const fileStream = fs.createWriteStream(destinationFilePath);

        const command = new ClientS3.GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(srcKey)
        });

        const response = await this.client.send(command);
        (response.Body as Readable).pipe(fileStream);
    }

    async getData(params: { key: string }): Promise<Buffer> {
        const { key } = params;
        const command = new ClientS3.GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });

        const response = await this.client.send(command);

        return new Promise<Buffer>((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            (response.Body as Readable).on('data', chunk => chunks.push(chunk));
            (response.Body as Readable).on('end', () => resolve(Buffer.concat(chunks)));
            (response.Body as Readable).on('error', reject);
        });
    }

    async generateDownloadSignedUrl(params: { key: string; fileName?: string }): Promise<string> {
        const { key, fileName } = params;

        const command = new ClientS3.GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });
        return await S3RequestPresigner.getSignedUrl(this.client, command, {
            expiresIn: 15 * 60, // 15 minutes
            ...(fileName && { responseContentDisposition: `attachment; filename="${fileName}"` })
        });
    }

    async deleteFile(params: { key: string }) {
        const { key } = params;
        const command = new ClientS3.DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });
        await this.client.send(command);
    }
    async generateUploadSignedUrl(params: {
        key: string;
        contentType?: string;
    }): Promise<{ url: string; headers?: Record<string, string> }> {
        const { key, contentType } = params;
        const command = new ClientS3.PutObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key),
            ContentType: contentType
        });
        return { url: await S3RequestPresigner.getSignedUrl(this.client, command, { expiresIn: 15 * 60 }) }; // 15 minutes
    }
    async documentExists(params: { key: string }): Promise<boolean> {
        const { key } = params;
        const command = new ClientS3.HeadObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });

        await this.client.send(command);
        return true;
    }

    async copyFile(params: { srcKey: string; destinationKey: string }) {
        const { srcKey, destinationKey } = params;
        const encodedSourceKey = encodeURIComponent(`${this.bucketName}/${srcKey}`);
        const command = new ClientS3.CopyObjectCommand({
            CopySource: encodedSourceKey,
            Bucket: this.bucketName,
            Key: this.getFullPath(destinationKey)
        });
        await this.client.send(command);
    }

    async getFileMetadata(params: { key: string }) {
        const { key } = params;
        const command = new ClientS3.HeadObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });

        const data = await this.client.send(command);

        const size = data.ContentLength;
        return { size };
    }

    async createReadStream(params: { key: string }): Promise<Readable> {
        const { key } = params;
        const command = new ClientS3.GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.getFullPath(key)
        });

        const response = await this.client.send(command);
        return response.Body as Readable;
    }

    // eslint-disable-next-line require-await
    async createWriteStream(): Promise<Writable> {
        throw new Error('createWriteStream not implemented for S3.');
    }
}
