/**
 * Хөгжүүлэлтийн үндсэн хуудас.
 *
 * Энэ апп нь зөвхөн API — UI байхгүй. Гэвч `/` дээр хоосон 404 гарах нь
 * «сервер эвдэрсэн» мэт харагддаг тул холболтын төлөв ба зам бүрийг
 * жагсаасан хуудас үзүүлнэ.
 */
import { sql } from 'drizzle-orm';
import { db, isDbConfigured } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Health {
  ok: boolean;
  detail: string;
}

async function dbHealth(): Promise<Health> {
  if (!isDbConfigured()) {
    return { ok: false, detail: 'DATABASE_URL тохируулагдаагүй — .env-ээ шалгана уу' };
  }
  try {
    const res = await db.execute(
      sql`SELECT count(*)::int AS n FROM questions WHERE status = 'published'`
    );
    // postgres-js нь массив, PGlite нь `{ rows }` буцаадаг — хоёуланг зохицуулна
    const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows) ?? [];
    const n = (rows[0] as { n?: number } | undefined)?.n ?? 0;
    return { ok: true, detail: `холбогдсон · ${n} нийтлэгдсэн асуулт` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : 'холбогдож чадсангүй',
    };
  }
}

const ROUTES: Array<{ method: string; path: string; note: string }> = [
  { method: 'GET', path: '/api/profile', note: 'профайл, rank, streak' },
  { method: 'PATCH', path: '/api/profile', note: 'нэр, аватар, streak-гүй горим' },
  { method: 'GET', path: '/api/catalog', note: 'баатар, олдвор, эрин' },
  { method: 'POST', path: '/api/quiz/session', note: 'сесс эхлүүлэх (correctIndex явахгүй)' },
  { method: 'POST', path: '/api/quiz/answer', note: 'хариулт — сервер оноолно' },
  { method: 'POST', path: '/api/quiz/fifty-fifty', note: '50/50 perk' },
  { method: 'POST', path: '/api/quiz/finish', note: 'дүн, XP, unlock' },
  { method: 'GET', path: '/api/league/me', note: '30 хүний чансаа' },
  { method: 'POST', path: '/api/league/rollover', note: 'долоо хоногийн cron' },
  { method: 'POST', path: '/api/mentor/ask', note: 'RAG чат' },
  { method: 'GET', path: '/api/voice/score', note: 'түргэн хэллэгийн жагсаалт' },
  { method: 'POST', path: '/api/voice/score', note: 'forced alignment оноолт' },
  { method: 'GET', path: '/api/offline/pack', note: 'маргаашийн багц' },
  { method: 'POST', path: '/api/offline/sync', note: 'офлайн дараалал' },
  { method: 'POST', path: '/api/battle/round', note: 'PvP тойрог' },
  { method: 'POST', path: '/api/content/report', note: 'буруу асуулт мэдээлэх' },
  { method: 'GET', path: '/api/retention/probe', note: 'хойшлуулсан шалгалт' },
  { method: 'GET', path: '/api/billing/checkout', note: 'Hero Story Pass' },
];

export default async function DevIndex() {
  const health = await dbHealth();
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <main style={S.main}>
      <h1 style={S.h1}>Эртний Өв — API</h1>
      <p style={S.lede}>
        Энэ апп нь зөвхөн API. Хэрэглэгчийн интерфэйс нь <code>apps/mobile</code>{' '}
        дотор — <code>npm run dev:mobile</code>.
      </p>

      <div style={{ ...S.card, borderColor: health.ok ? '#2C7A51' : '#A03B29' }}>
        <span style={{ ...S.dot, background: health.ok ? '#2C7A51' : '#A03B29' }} />
        <b>Өгөгдлийн сан:</b>&nbsp;{health.detail}
      </div>

      {!health.ok && (
        <div style={S.hint}>
          Локал ӨС эхлүүлэх: <code>npm run db:dev</code>
        </div>
      )}

      {isDev && (
        <div style={S.hint}>
          Хөгжүүлэлтэд нэвтрэлтийг <code>x-dev-user: 1</code> толгойгоор
          орлуулж болно. Production-д ажиллахгүй.
        </div>
      )}

      <h2 style={S.h2}>Замууд</h2>
      <table style={S.table}>
        <tbody>
          {ROUTES.map((r) => (
            <tr key={`${r.method} ${r.path}`}>
              <td style={S.method}>{r.method}</td>
              <td style={S.path}>{r.path}</td>
              <td style={S.note}>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 760,
    margin: '0 auto',
    padding: '48px 24px 80px',
    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
    color: '#131820',
    background: '#fff',
    minHeight: '100vh',
  },
  h1: { fontSize: 28, margin: '0 0 8px', letterSpacing: '-0.02em' },
  lede: { color: '#5A6472', lineHeight: 1.6, margin: '0 0 24px' },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 14,
  },
  dot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  hint: {
    marginTop: 12,
    padding: '10px 14px',
    background: '#F1F4F8',
    borderRadius: 8,
    fontSize: 13.5,
    color: '#48525F',
    lineHeight: 1.6,
  },
  h2: { fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginTop: 36 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  method: {
    padding: '7px 10px 7px 0',
    fontFamily: 'ui-monospace, monospace',
    color: '#0E5E7E',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    borderBottom: '1px solid #E8EBF0',
    verticalAlign: 'top',
  },
  path: {
    padding: '7px 14px 7px 0',
    fontFamily: 'ui-monospace, monospace',
    borderBottom: '1px solid #E8EBF0',
    whiteSpace: 'nowrap',
  },
  note: {
    padding: '7px 0',
    color: '#5A6472',
    borderBottom: '1px solid #E8EBF0',
  },
};
