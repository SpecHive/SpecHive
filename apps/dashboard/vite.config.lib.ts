import { resolve } from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      rollupTypes: true,
      include: ['src'],
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/lib-entry.ts'),
      formats: ['es'],
      fileName: 'spechive-dashboard',
    },
    outDir: 'dist/lib',
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-router',
        'sonner',
        'recharts',
        'lucide-react',
        /^@radix-ui\//,
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        '@spechive/api-types',
      ],
    },
    cssCodeSplit: false,
  },
});
