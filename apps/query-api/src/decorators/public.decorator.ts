import { IS_PUBLIC_KEY } from '@assertly/nestjs-common';
import { SetMetadata } from '@nestjs/common';

export { IS_PUBLIC_KEY };
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
