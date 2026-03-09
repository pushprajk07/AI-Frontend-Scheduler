import { BaseStorage } from './BaseStorage.ts';
import { StorageFile, StorageProvider } from './types.ts';
import { ClientSecretCredential } from '@azure/identity';
import {
    BlobSASPermissions,
    BlobServiceClient,
    SASProtocol,
    generateBlobSASQueryParameters
} from '@azure/storage-blob';
import * as dotenv from 'dotenv';
import { PassThrough, Readable, Writable } from 'stream';

dotenv.config();
export class AzureBlobStorage extends BaseStorage {
    private blobServiceClient: BlobServiceClient;
    private readonly containerName: string;
    private readonly basePath: string;
    constructor() {
        super();
        this.containerName = process.env.BUCKET_NAME || '';
        this.basePath = process.env.STORAGE_BASE_PATH || '';
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
        const clientId = process.env.AZURE_CLIENT_ID;
        const tenantId = process.env.AZURE_TENANT_ID;
        const clientSecret = process.env.AZURE_CLIENT_SECRET;
        if (!accountName) throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required');
        if (!clientId) throw new Error('AZURE_CLIENT_ID is required');
        if (!tenantId) throw new Error('AZURE_TENANT_ID is required');
        if (!clientSecret) throw new Error('AZURE_CLIENT_SECRET is required');
        if (!this.containerName) {
            throw new Error('BUCKET_NAME  is required');
        }
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        this.blobServiceClient = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential);
    }

    getStorageProviderName(): StorageProvider {
        return StorageProvider.AzureBlobStorage;
    }
    private getFullPath(key: string): string {
        return this.basePath ? `${this.basePath.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}` : key;
    }
    async uploadFile(params: { srcFilePath: string; destinationKey: string }): Promise<void> {
        const { srcFilePath, destinationKey } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(destinationKey));
        await blockBlobClient.uploadFile(srcFilePath);
    }

    async uploadData(params: { data: string | Buffer; destinationKey: string; contentType?: string }): Promise<void> {
        const { data, destinationKey, contentType } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(destinationKey));
        await blockBlobClient.upload(data, Buffer.byteLength(data), {
            blobHTTPHeaders: contentType ? { blobContentType: contentType } : undefined
        });
    }

    async downloadDocument(params: { srcKey: string; destinationFilePath: string }): Promise<void> {
        const { srcKey, destinationFilePath } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(srcKey));
        await blockBlobClient.downloadToFile(this.getFullPath(destinationFilePath));
    }

    async getData(params: { key: string }): Promise<Buffer> {
        const { key } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));
        const downloadResponse = await blockBlobClient.download(0);
        const chunks: Buffer[] = [];

        if (!downloadResponse.readableStreamBody) {
            throw new Error('No readable stream available');
        }

        for await (const chunk of downloadResponse.readableStreamBody) {
            if (Buffer.isBuffer(chunk)) {
                chunks.push(chunk);
            } else if (chunk && typeof chunk === 'object') {
                chunks.push(Buffer.from(chunk as Uint8Array));
            } else {
                chunks.push(Buffer.from(String(chunk)));
            }
        }

        return Buffer.concat(chunks);
    }

    async generateDownloadSignedUrl(params: { key: string; fileName?: string }): Promise<string> {
        const { key, fileName = `file-${Date.now()}` } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));

        const startsOn = new Date();
        const expiresOn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // Get user delegation key
        const userDelegationKey = await this.blobServiceClient.getUserDelegationKey(startsOn, expiresOn);

        const sasOptions = {
            containerName: this.containerName,
            blobName: this.getFullPath(key),
            permissions: BlobSASPermissions.parse('r'),
            startsOn,
            expiresOn,
            protocol: SASProtocol.Https,
            ...(fileName && { contentDisposition: `attachment; filename="${fileName}"` })
        };

        const sasToken = generateBlobSASQueryParameters(
            sasOptions,
            userDelegationKey,
            this.blobServiceClient.accountName
        ).toString();

        return `${blockBlobClient.url}?${sasToken}`;
    }

    async deleteFile(params: { key: string }): Promise<void> {
        const { key } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));
        await blockBlobClient.delete();
    }

    async generateUploadSignedUrl(params: {
        key: string;
        contentType?: string;
    }): Promise<{ url: string; headers?: Record<string, string> }> {
        const { key, contentType } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));

        const startsOn = new Date();
        const expiresOn = new Date(Date.now() + 60 * 60 * 1000); // 60 minutes

        // Get user delegation key
        const userDelegationKey = await this.blobServiceClient.getUserDelegationKey(startsOn, expiresOn);

        const sasOptions = {
            containerName: this.containerName,
            blobName: this.getFullPath(key),
            permissions: BlobSASPermissions.parse('cw'),
            startsOn,
            expiresOn,
            protocol: process.env.ENV !== 'local' ? SASProtocol.Https : SASProtocol.HttpsAndHttp,
            contentType: contentType || 'application/octet-stream'
        };

        const sasToken = generateBlobSASQueryParameters(
            sasOptions,
            userDelegationKey,
            this.blobServiceClient.accountName
        ).toString();

        return { url: `${blockBlobClient.url}?${sasToken}`, headers: { 'x-ms-blob-type': 'BlockBlob' } };
    }

    async documentExists(params: { key: string }): Promise<boolean> {
        const { key } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));
        return await blockBlobClient.exists();
    }

    async copyFile(params: { srcKey: string; destinationKey: string }): Promise<void> {
        const { srcKey, destinationKey } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const sourceBlockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(srcKey));
        const destinationBlockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(destinationKey));

        const sourceUrl = sourceBlockBlobClient.url;
        await destinationBlockBlobClient.beginCopyFromURL(sourceUrl);
    }

    async getFileMetadata(params: { key: string }): Promise<{ size?: number }> {
        const { key } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));
        const properties = await blockBlobClient.getProperties();
        return { size: properties.contentLength };
    }

    async createReadStream(params: { key: string }): Promise<Readable> {
        const { key } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));
        const downloadResponse = await blockBlobClient.download(0);

        if (!downloadResponse.readableStreamBody) {
            throw new Error('No readable stream available');
        }

        return downloadResponse.readableStreamBody as Readable;
    }

    // eslint-disable-next-line require-await
    async createWriteStream(params: { key: string; contentType?: string }): Promise<Writable> {
        const { key, contentType } = params;
        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(this.getFullPath(key));

        const passThrough = new PassThrough();

        // Start uploading from the stream
        const uploadPromise = blockBlobClient.uploadStream(passThrough, undefined, undefined, {
            blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' }
        });

        uploadPromise.then(() => passThrough.emit('finish')).catch(err => passThrough.emit('error', err));

        return passThrough;
    }

    getRawFile(params: { key: string }): StorageFile {
        const { key } = params;

        const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
        const blobClient = containerClient.getBlobClient(this.getFullPath(key));

        return {
            createReadStream: options => {
                const start = options?.start;
                const end = options?.end;
                const count = end !== undefined && start !== undefined ? end - start + 1 : undefined;

                const stream = new Readable({
                    async read() {
                        const downloadResponse = await blobClient.download(start, count);
                        const body = downloadResponse.readableStreamBody;

                        if (body) {
                            body.on('data', chunk => this.push(chunk));
                            body.on('end', () => this.push(null));
                            body.on('error', err => this.destroy(err));
                        } else {
                            this.push(null);
                        }
                    }
                });

                return stream;
            },

            getMetadata: async () => {
                const properties = await blobClient.getProperties();
                return [{ size: properties.contentLength }];
            }
        };
    }
}
