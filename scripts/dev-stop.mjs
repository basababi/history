/**
 * Хөгжүүлэлтийн бүх серверийг зогсооно: `npm run dev:stop`
 *
 * Терминалыг Ctrl+C-гүйгээр хаах, эсвэл процесс өлгөгдөх үед портууд
 * эзлэгдсэн хэвээр үлддэг. Дараа нь `EADDRINUSE` гарч эхэлдэг тул
 * энэ скрипт тухайн портуудыг сонсож буй процессыг л зогсооно.
 *
 * ⚠ Бүх node процессыг устгахгүй — зөвхөн доорх портуудыг эзэлж
 * байгааг нь. Ингэснээр өөр төслийн ажил тасрахгүй.
 */
import { execSync } from 'node:child_process';

const PORTS = [
  { port: 3001, name: 'API (next dev)' },
  { port: 8081, name: 'Metro (expo start)' },
  { port: 54321, name: 'Локал Postgres (PGlite)' },
];

const isWindows = process.platform === 'win32';

/** Тухайн портыг СОНСОЖ буй процессын PID-үүд */
function pidsOnPort(port) {
  try {
    if (isWindows) {
      const out = execSync(`netstat -ano -p TCP | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        // "  TCP    0.0.0.0:3001   0.0.0.0:0   LISTENING   20528"
        const cols = line.trim().split(/\s+/);
        const local = cols[1] ?? '';
        const pid = cols[cols.length - 1];
        if (local.endsWith(`:${port}`) && /^\d+$/.test(pid) && pid !== '0') {
          pids.add(pid);
        }
      }
      return [...pids];
    }

    const out = execSync(`lsof -ti tcp:${port} -s TCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split(/\s+/).filter(Boolean);
  } catch {
    return []; // порт сул
  }
}

function kill(pid) {
  try {
    execSync(isWindows ? `taskkill /F /PID ${pid} /T` : `kill -9 ${pid}`, {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

let stopped = 0;

for (const { port, name } of PORTS) {
  const pids = pidsOnPort(port);
  if (pids.length === 0) {
    console.log(`  · ${port} сул — ${name}`);
    continue;
  }
  for (const pid of pids) {
    const ok = kill(pid);
    console.log(
      ok
        ? `  ✓ ${port} чөлөөлөв (PID ${pid}) — ${name}`
        : `  ✗ ${port} зогсоож чадсангүй (PID ${pid}) — эрх шалгана уу`
    );
    if (ok) stopped += 1;
  }
}

console.log(
  stopped === 0
    ? '\nЗогсоох процесс байсангүй.'
    : `\n${stopped} процесс зогслоо. Одоо npm run db:dev ажиллуулж болно.`
);
