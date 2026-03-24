import { Global, Module } from '@nestjs/common';

import { isProductionProvider, IS_PRODUCTION } from './is-production.provider';

@Global()
@Module({
  providers: [isProductionProvider],
  exports: [IS_PRODUCTION],
})
export class IsProductionModule {}
