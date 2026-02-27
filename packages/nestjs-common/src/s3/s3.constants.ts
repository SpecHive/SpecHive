export const S3_CLIENT = Symbol('S3_CLIENT');
export const S3_BUCKET = Symbol('S3_BUCKET');

export interface S3ModuleConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  useSSL: boolean;
  bucket: string;
}
