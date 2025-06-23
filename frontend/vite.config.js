import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import 'dotenv/config';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 80,
    host: '0.0.0.0',
  },
  preview: {
    port: 80,
    host: '0.0.0.0',
  }
});