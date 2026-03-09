import { StorageFile, StorageProvider } from './types.ts';
import { Readable, Writable } from 'stream';

export abstract class BaseStorage {
    abstract getStorageProviderName(): StorageProvider;
    abstract uploadFile(params: { srcFilePath: string; destinationKey: string }): Promise<void>;
    abstract uploadData(params: { data: string | Buffer; destinationKey: string; contentType?: string }): Promise<void>;
    abstract getData(params: { key: string }): Promise<Buffer>;
    abstract downloadDocument(params: { srcKey: string; destinationFilePath: string }): Promise<void>;
    abstract generateDownloadSignedUrl(params: { key: string; fileName?: string }): Promise<string>;
    abstract deleteFile(params: { key: string }): Promise<void>;
    abstract generateUploadSignedUrl(params: {
        key: string;
        contentType?: string;
    }): Promise<{ url: string; headers?: Record<string, string> }>;
    abstract documentExists(params: { key: string }): Promise<boolean>;
    abstract copyFile(params: { srcKey: string; destinationKey: string }): Promise<void>;
    abstract getFileMetadata(params: { key: string }): Promise<{ size?: number }>;
    abstract createReadStream(params: { key: string }): Promise<Readable>;
    abstract createWriteStream(params: { key: string; contentType?: string }): Promise<Writable>;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getRawFile(params: { key: string }): StorageFile {
        throw new Error('Method not implementation');
    }
}
