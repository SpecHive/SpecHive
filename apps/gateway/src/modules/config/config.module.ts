import { createConfigModule } from '@spechive/nestjs-common';

import { envSchema } from './env.validation';

export const ConfigModule = createConfigModule(envSchema);
