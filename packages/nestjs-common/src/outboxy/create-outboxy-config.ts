import { PostgreSqlDialect, PostgreSqlInboxDialect } from '@outboxy/dialect-postgres';

import { createOutboxyAdapter } from './outboxy-adapter';

/** Shared Outboxy module configuration used by both OSS and cloud workers. */
export function createOutboxyModuleConfig() {
  return {
    dialect: new PostgreSqlDialect(),
    adapter: createOutboxyAdapter(),
    inbox: {
      enabled: true,
      dialect: new PostgreSqlInboxDialect(),
    },
  };
}
