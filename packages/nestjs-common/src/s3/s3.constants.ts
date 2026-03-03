export const S3_CLIENT = Symbol('S3_CLIENT');
export const S3_PRESIGNER_CLIENT = Symbol('S3_PRESIGNER_CLIENT');
export const S3_BUCKET = Symbol('S3_BUCKET');
export const S3_PUBLIC_ENDPOINT = Symbol('S3_PUBLIC_ENDPOINT');

export interface S3ModuleConfig {
  endpoint: string;
  publicEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  useSSL: boolean;
  publicUseSSL: boolean;
  bucket: string;
}
