// Proxy infrastructure — re-exported for cloud-gateway to compose its own module.
export { ProxyModule } from './proxy/proxy.module';
export { ProxyService } from './proxy/proxy.service';

// Individual proxy controllers — cloud-gateway replaces IngestionProxyController
// with a cloud version that adds usage recording and quota enforcement.
export { AuthProxyController } from './proxy/controllers/auth-proxy.controller';
export { IngestionProxyController } from './proxy/controllers/ingestion-proxy.controller';
export { MutationProxyController } from './proxy/controllers/mutation-proxy.controller';
export { QueryProxyController } from './proxy/controllers/query-proxy.controller';

// Security middleware — strips spoofed internal headers from incoming requests.
export { StripInternalHeadersMiddleware } from '../middleware/strip-internal-headers.middleware';
