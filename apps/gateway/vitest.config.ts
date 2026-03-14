import path from 'node:path';

import { defineNestjsTestConfig } from '../../packages/nestjs-common/vitest.nestjs.config';

const nestjsCommonSrc = path.resolve(__dirname, '../../packages/nestjs-common/src/index.ts');

export default defineNestjsTestConfig({
  resolve: {
    alias: [
      {
        find: /^@spechive\/nestjs-common$/,
        replacement: nestjsCommonSrc,
      },
    ],
  },
});
