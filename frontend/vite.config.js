import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import 'dotenv/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  }
});