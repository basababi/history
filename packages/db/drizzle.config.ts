import { defineConfig } from 'drizzle-kit';
import { loadEnv } from './src/env';

loadEnv();

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54321/postgres',
  },
});
