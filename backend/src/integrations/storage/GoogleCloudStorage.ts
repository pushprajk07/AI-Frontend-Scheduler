import { BaseStorage } from './BaseStorage.ts';
import { StorageFile, StorageProvider } from './types.ts';
import { File, Storage } from '@google-cloud/storage';
import * as dotenv from 'dotenv';

dotenv.config();

export class GoogleCloudStorage extends BaseStorage {
    private storage: Storage;
    private readonly bucketName: string;
    private readonly basePath: string;
    constructor() {
        super();
        const credentialsString = process.env.GOOGLE_CLOUD_APPLICATION_CREDENTIALS;
        if (!credentialsString || credentialsString.trim() === '') {
            throw new Error('GOOGLE_CLOUD_APPLICATION_CREDENTIALS is required');
        }
        this.storage = new Storage({
            credentials: JSON.parse(process.env.GOOGLE_CLOUD_APPLICATION_CREDENTIALS || '{}')
        });
        this.bucketName = process.env.BUCKET_NAME || '';
        this.basePath = process.env.STORAGE_BASE_PATH || '';
        if (!this.bucketName) {
            throw new Error('BUCKET_NAME is required');
        }
    }
    getStorageProviderName(): StorageProvider {
        return StorageProvider.GoogleCloudStorage;
    }
    private getFullPath(key: string): string {
        return this.basePath ? `${this.basePath.replace(/\/$/, '')}/${key.replace(/^\//, '')}` : key;
    }
    async uploadFile(params: { srcFilePath: string; destinationKey: string }) {
        const { srcFilePath, destinationKey } = params;
        const fullPath = this.getFullPath(destinationKey);
        await this.storage.bucket(this.bucketName).upload(srcFilePath, { destination: fullPath });
    }

    async uploadData(params: { data: string | Buffer; destinationKey: string; contentType?: string }) {
        const { destinationKey, data, contentType } = params;
        const fullPath = this.getFullPath(destinationKey);
        await this.storage
            .bucket(this.bucketName)
            .file(fullPath)
            .save(data, { metadata: { ...(contentType && { contentType }) } });
    }

    async downloadDocument(params: { srcKey: string; destinationFilePath: string }): Promise<void> {
        const { srcKey, destinationFilePath } = params;
        const fullPath = this.getFullPath(srcKey);
        await this.storage.bucket(this.bucketName).file(fullPath).download({ destination: destinationFilePath });
    }

    async getData(params: { key: string }): Promise<Buffer> {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        const [data] = await this.storage.bucket(this.bucketName).file(fullPath).download();
        return data;
    }

    async generateDownloadSignedUrl(params: { key: string; fileName?: string }): Promise<string> {
        const { key, fileName } = params;
        const fullPath = this.getFullPath(key);
        const [url] = await this.storage
            .bucket(this.bucketName)
            .file(fullPath)
            .getSignedUrl({
                version: 'v4',
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                ...(fileName && { responseDisposition: `attachment; filename="${fileName}"` })
            });
        return url;
    }

    async deleteFile(params: { key: string }) {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        await this.storage.bucket(this.bucketName).file(fullPath).delete();
    }

    async generateUploadSignedUrl(params: {
        key: string;
        contentType?: string;
    }): Promise<{ url: string; headers?: Record<string, string> }> {
        const { key, contentType } = params;
        const fullPath = this.getFullPath(key); // Use full path
        const [url] = await this.storage // Use this.storage
            .bucket(this.bucketName) // Use this.bucketName
            .file(fullPath)
            .getSignedUrl({
                version: 'v4',
                action: 'write',
                expires: Date.now() + 60 * 60 * 1000, // 60 minutes
                contentType: contentType || 'application/octet-stream'
            });
        return { url };
    }

    async documentExists(params: { key: string }): Promise<boolean> {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        const [doesExist] = await this.storage.bucket(this.bucketName).file(fullPath).exists();
        return doesExist;
    }

    async copyFile(params: { srcKey: string; destinationKey: string }) {
        const { srcKey, destinationKey } = params;
        const storage = new Storage();
        const srcFile = storage.bucket(this.bucketName).file(this.getFullPath(srcKey));
        const destFile = storage.bucket(this.bucketName).file(this.getFullPath(destinationKey));
        await srcFile.copy(destFile);
    }

    async getFileMetadata(params: { key: string }) {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        const [metadata] = await this.storage.bucket(this.bucketName).file(fullPath).getMetadata();
        const size = typeof metadata.size === 'string' ? parseFloat(metadata.size) : undefined;
        return { size };
    }

    async createReadStream(params: { key: string }) {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        return await Promise.resolve(this.storage.bucket(this.bucketName).file(fullPath).createReadStream());
    }

    async createWriteStream(params: { key: string; contentType?: string }) {
        const { key, contentType } = params;
        return await Promise.resolve(
            this.storage
                .bucket(this.bucketName)
                .file(this.getFullPath(key))
                .createWriteStream(contentType ? { contentType } : {})
        );
    }

    getRawFile(params: { key: string }): StorageFile {
        const { key } = params;
        const fullPath = this.getFullPath(key);
        const file: File = this.storage.bucket(this.bucketName).file(fullPath);

        return {
            createReadStream: options => file.createReadStream(options),
            getMetadata: async () => {
                const [metadata] = await file.getMetadata();
                return [{ size: metadata.size }];
            }
        };
    }
}
