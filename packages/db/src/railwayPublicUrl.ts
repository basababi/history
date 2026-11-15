/* eslint-disable no-console -- CLI: гаралт нь зориудын */
/**
 * Railway CLI-ээс DATABASE_PUBLIC_URL авна — PowerShell-д URL paste хийхгүй.
 *
 * Төсөл холбоогүй бол: railway link -p <project> -e <env> -s <postgres-service>
 */
import { execFileSync } from 'node:child_process';
import { assertPostgresUrl } from './env';

function railway(args: string[]): string {
  const bin = process.platform === 'win32' ? 'railway.cmd' : 'railway';
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not recognized|ENOENT/i.test(msg)) {
      throw new Error('railway CLI олдсонгүй. npm install --global @railway/cli && railway login');
    }
    throw new Error(`railway ${args.join(' ')} амжилтгүй. railway login / railway link хийнэ үү.`);
  }
}

export function railwayPublicUrl(): string {
  const raw = railway(['variable', 'list', '--json']);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const vars = (parsed.variables ?? parsed) as Record<string, string | undefined>;
  const url = vars.DATABASE_PUBLIC_URL;
  if (!url) {
    throw new Error(
      'DATABASE_PUBLIC_URL олдсонгүй. Postgres сервисийг railway link -s <service> гэж холбоно уу.'
    );
  }
  const checked = assertPostgresUrl(url);
  const host = new URL(checked).host;
  console.log(`Railway DATABASE_PUBLIC_URL (${host})`);
  return checked;
}
