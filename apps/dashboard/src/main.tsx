import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import { App } from './App';
import { apiClient } from './shared/lib/api-client';

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl)
  throw new Error('VITE_API_URL is not set. Set this environment variable before building.');
apiClient.setBaseUrl(apiUrl);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
