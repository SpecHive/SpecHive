import { z } from 'zod';

export const minioEnvSchema = z.object({
  MINIO_ENDPOINT: z.string().default('localhost:9000'),
  MINIO_PUBLIC_ENDPOINT: z.string().default('localhost:9000'),
  MINIO_USE_SSL: z.enum(['true', 'false']).default('false'),
  MINIO_PUBLIC_USE_SSL: z.enum(['true', 'false']).optional(),
  MINIO_BUCKET: z.string().default('assertly-artifacts'),
  MINIO_APP_ACCESS_KEY: z.string().default('assertly-app'),
  MINIO_APP_SECRET_KEY: z.string().default('assertly-app-secret-key'),
});

export const minioProductionRefinement = {
  ssl: {
    check: (env: { NODE_ENV: string; MINIO_ENDPOINT: string; MINIO_USE_SSL: string }) => {
      if (env.NODE_ENV !== 'production') return true;
      const isLoopback = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(env.MINIO_ENDPOINT);
      return isLoopback || env.MINIO_USE_SSL === 'true';
    },
    message: 'MINIO_USE_SSL must be true in production for non-localhost endpoints',
    path: ['MINIO_USE_SSL'],
  },
};

export type MinioEnvConfig = z.infer<typeof minioEnvSchema>;
