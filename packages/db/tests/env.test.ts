import { describe, expect, it } from 'vitest';
import { assertPostgresUrl, isLocalDatabaseHost, postgresConnectOptions } from '../src/env';

describe('PostgreSQL connection configuration', () => {
  it('accepts a complete Railway PostgreSQL URL and trims surrounding whitespace', () => {
    const url = ' postgresql://postgres:secret@interchange.proxy.rlwy.net:41776/railway ';

    expect(assertPostgresUrl(url)).toBe(url.trim());
  });

  it('rejects malformed or non-PostgreSQL URLs with actionable errors', () => {
    expect(() => assertPostgresUrl('<DATABASE_PUBLIC_URL>')).toThrow('DATABASE_URL буруу');
    expect(() => assertPostgresUrl('https://example.com/db')).toThrow('postgres://');
    expect(() => assertPostgresUrl('postgresql:railway')).toThrow('hostname');
  });

  it('requires SSL for remote PostgreSQL and disables it for local development', () => {
    const remote = 'postgresql://postgres:secret@interchange.proxy.rlwy.net:41776/railway';
    const local = 'postgresql://postgres:secret@localhost:5432/railway';

    expect(isLocalDatabaseHost(remote)).toBe(false);
    expect(postgresConnectOptions(remote)).toEqual({ max: 1, ssl: 'require' });
    expect(isLocalDatabaseHost(local)).toBe(true);
    expect(postgresConnectOptions(local)).toEqual({ max: 1, ssl: false });
  });
});
