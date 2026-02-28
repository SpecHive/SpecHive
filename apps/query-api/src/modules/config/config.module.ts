import { createConfigModule } from '@assertly/nestjs-common';

import { envSchema } from './env.validation';

export const ConfigModule = createConfigModule(envSchema);
