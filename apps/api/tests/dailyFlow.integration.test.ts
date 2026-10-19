/**
 * «Өдрийн тав»-ын бүтэн урсгал — БОДИТ Postgres (PGlite) дээр, цагийг хянаж.
 *
 *   зочин → өнөөдөр → нээх/хариулах ×5 → дүн → сорилтын линк →
 *   найз сорилтоор тоглох → тулаан → өрсөлдөгч → бүлэг
 *
 * Шударга байдлын шаардлага бүр (зөв хариулт урьдчилж явахгүй, хариултаа
 * өөрчлөх боломжгүй, хугацааг сервер хэмжинэ, спойлергүй линк) энд
 * бодитоор шалгагдана.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  isValidRecoveryCode,
  isValidShareCode,
  optionOrder,
  shouldShuffleOptions,
  toDisplayIndex,
  type QuestionFormat,
} from '@nomad/core';
import { makeDb } from './helpers/harness';

process.env.SESSION_SECRET = 'integration-test-secret';
delete process.env.DAILY_LAUNCH_DAY;

const { db } = await makeDb();

vi.mock('@/lib/db', () => ({
  get db() {
    return db;
  },
  isDbConfigured: () => true,
}));

const schema = await import('@nomad/db');
const { POST: guest } = await import('../app/api/auth/guest/route');
const { POST: restore } = await import('../app/api/auth/restore/route');
const meRoute = await import('../app/api/me/route');
const { GET: today } = await import('../app/api/daily/today/route');
const { POST: next } = await import('../app/api/daily/next/route');
const { POST: answer } = await import('../app/api/daily/answer/route');
const { GET: result } = await import('../app/api/daily/result/route');
const { GET: challenge } = await import('../app/api/challenges/[code]/route');
const { GET: rivals } = await import('../app/api/rivals/route');
const groupsRoute = await import('../app/api/groups/route');
const { GET: groupDetail } = await import('../app/api/groups/[id]/route');
const { DELETE: leaveGroup } = await import('../app/api/groups/[id]/membership/route');
const { GET: groupPreview } = await import('../app/api/groups/preview/[code]/route');
const { GET: linkPage } = await import('../app/c/[code]/route');

// ─── Туслагчид ───

type Handler = (req: Request) => Promise<Response>;
type ParamHandler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

function req(method: string, url: string, token?: string, body?: unknown): Request {
  return new Request(`http://test.local${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call<T = Record<string, unknown>>(
  handler: Handler,
  method: string,
  url: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; body: T }> {
  const res = await handler(req(method, url, token, body));
  return { status: res.status, body: (await res.json()) as T };
}

async function callP<P, T = Record<string, unknown>>(
  handler: ParamHandler<P>,
  params: P,
  method: string,
  url: string,
  token?: string
): Promise<{ status: number; body: T }> {
  const res = await handler(req(method, url, token), { params: Promise.resolve(params) });
  return { status: res.status, body: (await res.json()) as T };
}

const T0 = new Date('2026-10-20T02:00:00Z'); // UB 10:00, 2026-10-20 (#2)
const DAY = '2026-10-20';
let now = T0.getTime();
function advance(ms: number) {
  now += ms;
  vi.setSystemTime(now);
}

interface Q {
  dayKey: string;
  position: number;
  questionId: number;
  options: string[];
  remainingMs: number;
}

/** Тухайн асуултын ЗӨВ хариултын харагдах индекс (тест л мэднэ) */
async function correctDisplayIndex(dayKey: string, questionId: number): Promise<number> {
  const [q] = await db.select().from(schema.questions).where(eq(schema.questions.id, questionId));
  const order = optionOrder(
    dayKey,
    questionId,
    (q!.options as string[]).length,
    shouldShuffleOptions(q!.format as QuestionFormat)
  );
  return toDisplayIndex(order, q!.correctIndex);
}

async function newGuest() {
  const r = await call<{ token: string; userId: number; recoveryCode: string }>(guest, 'POST', '/api/auth/guest');
  expect(r.status).toBe(200);
  return r.body;
}

/** Бүх 5 асуултад хариулна; `pattern[i]` true бол зөв */
async function playDay(token: string, dayKey: string, pattern: boolean[], challengeCode?: string) {
  for (let i = 0; i < pattern.length; i++) {
    const n = await call<{ done: boolean; question: Q }>(next, 'POST', '/api/daily/next', token, {
      dayKey,
      ...(i === 0 && challengeCode ? { challengeCode } : {}),
    });
    expect(n.status).toBe(200);
    expect(n.body.done).toBe(false);
    const correct = await correctDisplayIndex(dayKey, n.body.question.questionId);
    const pick = pattern[i] ? correct : (correct + 1) % n.body.question.options.length;
    advance(4_000);
    const a = await call<{ isCorrect: boolean; finished: boolean }>(answer, 'POST', '/api/daily/answer', token, {
      dayKey,
      position: n.body.question.position,
      selectedIndex: pick,
    });
    expect(a.status).toBe(200);
    expect(a.body.isCorrect).toBe(pattern[i]);
  }
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  await schema.seedAll(db);
}, 60_000);

afterAll(() => {
  vi.useRealTimers();
});

// ─── Тестүүд ───

let alice: { token: string; userId: number; recoveryCode: string };
let bob: { token: string; userId: number; recoveryCode: string };
let aliceCode = '';

describe('Зочны нэвтрэлт', () => {
  it('бүртгэлгүйгээр шууд токен + 25 тэмдэгтийн сэргээх код', async () => {
    alice = await newGuest();
    expect(isValidRecoveryCode(alice.recoveryCode)).toBe(true);
    const me = await call<{ displayName: string | null }>(meRoute.GET, 'GET', '/api/me', alice.token);
    expect(me.status).toBe(200);
    expect(me.body.displayName).toBeNull();
  });

  it('🔴 сэргээх кодыг ӨС-д ТЕКСТЭЭР хадгалахгүй', async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, alice.userId));
    expect(u!.providerId).not.toContain(alice.recoveryCode);
    expect(u!.providerId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('сэргээх кодоор (зураастай, жижиг үсгээр ч) ижил бүртгэлд нэвтэрнэ', async () => {
    const pretty = alice.recoveryCode.toLowerCase().replace(/(.{5})(?=.)/g, '$1-');
    const r = await call<{ userId: number }>(restore, 'POST', '/api/auth/restore', undefined, { recoveryCode: pretty });
    expect(r.status).toBe(200);
    expect(r.body.userId).toBe(alice.userId);
  });

  it('буруу кодыг татгалзана', async () => {
    const wrong = await call(restore, 'POST', '/api/auth/restore', undefined, { recoveryCode: 'A'.repeat(25) });
    expect(wrong.status).toBe(404);
    const bad = await call(restore, 'POST', '/api/auth/restore', undefined, { recoveryCode: 'IIIIIIIIIIIIIIIIIIIIIIIII' });
    expect(bad.status).toBe(400);
  });

  it('нэвтрээгүй хүсэлтийг татгалзана', async () => {
    expect((await call(today, 'GET', '/api/daily/today')).status).toBe(401);
  });
});

describe('Өдрийн тав — шударга урсгал', () => {
  it('өнөөдрийн тав: дугаар, хоосон явц, багц үүснэ', async () => {
    const r = await call<{ dayKey: string; dayNumber: number; play: { status: string; total: number } }>(
      today,
      'GET',
      '/api/daily/today',
      alice.token
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ dayKey: DAY, dayNumber: 2, play: { status: 'not_started', total: 5 } });
    const [set] = await db.select().from(schema.dailySets).where(eq(schema.dailySets.dayKey, DAY));
    expect(set!.questionIds).toHaveLength(5);
  });

  it('🔴 нээсэн асуултад зөв хариулт ХЭЗЭЭ Ч ороогүй', async () => {
    const r = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(r.status).toBe(200);
    const raw = JSON.stringify(r.body);
    expect(raw).not.toMatch(/correct/i);
    expect(raw).not.toContain('explanation');
    expect(r.body.question).toMatchObject({ position: 0, total: 5, remainingMs: 20_000 });
  });

  it('хуудас сэргээхэд ижил асуулт, таймер шинээр эхлэхгүй', async () => {
    advance(5_000);
    const r = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(r.body.question.position).toBe(0);
    expect(r.body.question.remainingMs).toBe(15_000);
  });

  it('🔴 нээгдээгүй асуултад хариулах боломжгүй', async () => {
    const r = await call<{ error: { code: string } }>(answer, 'POST', '/api/daily/answer', alice.token, {
      dayKey: DAY,
      position: 3,
      selectedIndex: 0,
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NOT_SERVED');
  });

  it('зөв хариулт — сервер оноолж, тайлбар + эх сурвалж буцаана', async () => {
    const [play] = await db.select().from(schema.dailyPlays).where(eq(schema.dailyPlays.userId, alice.userId));
    const [row] = await db.select().from(schema.dailyAnswers).where(eq(schema.dailyAnswers.playId, play!.id));
    const correct = await correctDisplayIndex(DAY, row!.questionId);

    const r = await call<{ isCorrect: boolean; correctIndex: number; responseMs: number; sourceRef: string }>(
      answer,
      'POST',
      '/api/daily/answer',
      alice.token,
      { dayKey: DAY, position: 0, selectedIndex: correct }
    );
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ isCorrect: true, correctIndex: correct, responseMs: 5_000 });
    expect(r.body.sourceRef.length).toBeGreaterThan(0);
  });

  it('🔴 хариултаа ӨӨРЧЛӨХ боломжгүй — дахин илгээвэл анхны дүн', async () => {
    const r = await call<{ isCorrect: boolean; responseMs: number }>(answer, 'POST', '/api/daily/answer', alice.token, {
      dayKey: DAY,
      position: 0,
      selectedIndex: 3,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ isCorrect: true, responseMs: 5_000 });
  });

  it('🔴 хугацаа хэтэрвэл (сервер цагаар) зөв сонголт ч тооцогдохгүй', async () => {
    const n = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(n.body.question.position).toBe(1);
    const correct = await correctDisplayIndex(DAY, n.body.question.questionId);
    advance(30_000);
    const r = await call<{ isCorrect: boolean; timedOut: boolean; responseMs: number }>(
      answer,
      'POST',
      '/api/daily/answer',
      alice.token,
      { dayKey: DAY, position: 1, selectedIndex: correct }
    );
    expect(r.body).toMatchObject({ isCorrect: false, timedOut: true, responseMs: 20_000 });
  });

  it('🔴 таб хааж зугтвал асуулт «хугацаа дууссан» болж дараагийнх нээгдэнэ', async () => {
    const n1 = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(n1.body.question.position).toBe(2);
    advance(60_000);
    const n2 = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(n2.body.question.position).toBe(3);
  });

  it('сүүлийн хоёр асуулт → тоглолт хаагдана, сорилтын код үүснэ', async () => {
    const correct3 = await correctDisplayIndex(DAY, (await currentQuestionId(alice.userId, 3))!);
    advance(3_000);
    await call(answer, 'POST', '/api/daily/answer', alice.token, { dayKey: DAY, position: 3, selectedIndex: correct3 });

    const n = await call<{ question: Q }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    const correct4 = await correctDisplayIndex(DAY, n.body.question.questionId);
    advance(6_000);
    const last = await call<{ finished: boolean }>(answer, 'POST', '/api/daily/answer', alice.token, {
      dayKey: DAY,
      position: 4,
      selectedIndex: correct4,
    });
    expect(last.body.finished).toBe(true);

    const done = await call<{ done: boolean }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: DAY });
    expect(done.body.done).toBe(true);
  });

  it('дүн: оноо, хугацаа, байр, цуврал, нэр шаардлага', async () => {
    const r = await call<{
      correct: number;
      total: number;
      totalMs: number;
      marks: boolean[];
      shareCode: string;
      rank: { position: number; players: number };
      streak: { current: number; best: number };
      needsName: boolean;
      dayNumber: number;
    }>(result, 'GET', `/api/daily/result?dayKey=${DAY}`, alice.token);
    expect(r.status).toBe(200);
    // 0: зөв (5с) · 1: хугацаа (20с) · 2: хугацаа (20с) · 3: зөв (3с) · 4: зөв (6с)
    expect(r.body).toMatchObject({
      correct: 3,
      total: 5,
      totalMs: 54_000,
      marks: [true, false, false, true, true],
      rank: { position: 1, players: 1 },
      streak: { current: 1, best: 1 },
      needsName: true,
      dayNumber: 2,
    });
    expect(isValidShareCode(r.body.shareCode)).toBe(true);
    aliceCode = r.body.shareCode;
  });
});

async function currentQuestionId(userId: number, position: number): Promise<number | undefined> {
  const [play] = await db.select().from(schema.dailyPlays).where(eq(schema.dailyPlays.userId, userId));
  const rows = await db.select().from(schema.dailyAnswers).where(eq(schema.dailyAnswers.playId, play!.id));
  return rows.find((r) => r.position === position)?.questionId;
}

describe('Нэр', () => {
  it('линк, хориотой тэмдэгттэй нэрийг татгалзана', async () => {
    const r = await call<{ error: { code: string } }>(meRoute.PATCH, 'PATCH', '/api/me', alice.token, {
      displayName: 'www.spam.mn',
    });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('BAD_NAME');
  });

  it('нэр тавина (зай шахагдана)', async () => {
    const r = await call<{ displayName: string }>(meRoute.PATCH, 'PATCH', '/api/me', alice.token, {
      displayName: '  Бат  ',
    });
    expect(r.status).toBe(200);
    expect(r.body.displayName).toBe('Бат');
  });
});

describe('Сорилтын линк — спойлергүй, нээлттэй', () => {
  it('🔴 нэвтрээгүй ч дүн харагдана, асуулт ОГТ илчлэгдэхгүй', async () => {
    const r = await callP<{ code: string }, Record<string, unknown>>(challenge, { code: aliceCode }, 'GET', `/api/challenges/${aliceCode}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      dayKey: DAY,
      owner: { displayName: 'Бат' },
      ownerResult: { correct: 3, total: 5, marks: [true, false, false, true, true] },
      viewer: null,
    });
    const raw = JSON.stringify(r.body);
    for (const leak of ['options', 'body', 'correctIndex', 'explanation', 'questionId']) {
      expect(raw).not.toContain(leak);
    }
  });

  it('линкийн хуудас OG мета-тай (crawler-т зориулсан)', async () => {
    const res = await linkPage(req('GET', `/c/${aliceCode}`), { params: Promise.resolve({ code: aliceCode }) });
    const html = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('og:title');
    expect(html).toContain('Бат 3/5 авлаа');
    expect(html).toContain(`/api/og/challenge/${aliceCode}`);
  });

  it('буруу кодонд 404/400', async () => {
    expect((await callP(challenge, { code: 'ZZZZ2222' }, 'GET', '/api/challenges/ZZZZ2222')).status).toBe(404);
    expect((await callP(challenge, { code: 'bad' }, 'GET', '/api/challenges/bad')).status).toBe(400);
  });
});

describe('Найз сорилтоор тоглоно → тулаан → өрсөлдөгч', () => {
  it('сорилтоор орж ирсэн найз тоглоод тулааны дүнгээ харна', async () => {
    bob = await newGuest();
    await call(meRoute.PATCH, 'PATCH', '/api/me', bob.token, { displayName: 'Болд' });

    const before = await callP<{ code: string }, { viewer: { status: string } }>(
      challenge,
      { code: aliceCode },
      'GET',
      `/api/challenges/${aliceCode}`,
      bob.token
    );
    expect(before.body.viewer.status).toBe('not_started');

    await playDay(bob.token, DAY, [true, true, true, true, false], aliceCode);

    const r = await call<{
      duel: { outcome: string; detail: string; record: { wins: number; days: number }; opponent: { displayName: string } };
      needsName: boolean;
    }>(result, 'GET', `/api/daily/result?dayKey=${DAY}`, bob.token);
    expect(r.body.needsName).toBe(false);
    expect(r.body.duel.opponent.displayName).toBe('Бат');
    expect(r.body.duel.outcome).toBe('win');
    // Гарах тийн ялгал зөв: «Батаас»
    expect(r.body.duel.detail).toBe('Чи Батаас 1 оноогоор түрүүллээ.');
    expect(r.body.duel.record).toMatchObject({ wins: 1, days: 1 });
  });

  it('хоёулаа өрсөлдөгч болсон — ээлжлэн сорих тулаан', async () => {
    const r = await call<{ rivals: Array<{ displayName: string; record: { losses: number }; today: { played: boolean; correct: number } }> }>(
      rivals,
      'GET',
      '/api/rivals',
      alice.token
    );
    expect(r.body.rivals).toHaveLength(1);
    expect(r.body.rivals[0]).toMatchObject({
      displayName: 'Болд',
      record: { losses: 1 },
      today: { played: true, correct: 4 },
    });
  });

  it('сорилтын хуудас тоглосон найзад тулааны дүнг харуулна', async () => {
    const r = await callP<{ code: string }, { viewer: { status: string; duel: { outcome: string } } }>(
      challenge,
      { code: aliceCode },
      'GET',
      `/api/challenges/${aliceCode}`,
      bob.token
    );
    expect(r.body.viewer).toMatchObject({ status: 'finished', duel: { outcome: 'win' } });
  });

  it('өдрийн байр ба асуултын зөв хувь (3+ тоглогчтой үед)', async () => {
    const carol = await newGuest();
    await playDay(carol.token, DAY, [true, true, true, true, true]);
    const r = await call<{ rank: { position: number; players: number }; perQuestion: Array<{ correctRate: number | null }> }>(
      result,
      'GET',
      `/api/daily/result?dayKey=${DAY}`,
      carol.token
    );
    expect(r.body.rank).toEqual({ position: 1, players: 3 });
    // 0-р асуулт: гурвуулаа зөв
    expect(r.body.perQuestion[0]!.correctRate).toBe(1);
  });
});

describe('Өдрийн дүрэм', () => {
  it('🔴 ирээдүйн өдрийг тоглох боломжгүй', async () => {
    const r = await call<{ error: { code: string } }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: '2026-10-21' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('FUTURE_DAY');
  });

  it('багцгүй өнгөрсөн өдөр олдохгүй', async () => {
    const r = await call<{ error: { code: string } }>(next, 'POST', '/api/daily/next', alice.token, { dayKey: '2026-10-01' });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NO_SUCH_DAY');
  });

  it('маргааш шинэ багц, дараалан тоглоход цуврал өснө', async () => {
    advance(24 * 3600_000);
    const t = await call<{ dayKey: string; dayNumber: number; play: { status: string } }>(today, 'GET', '/api/daily/today', alice.token);
    expect(t.body).toMatchObject({ dayKey: '2026-10-21', dayNumber: 3, play: { status: 'not_started' } });

    const [d1] = await db.select().from(schema.dailySets).where(eq(schema.dailySets.dayKey, DAY));
    const [d2] = await db.select().from(schema.dailySets).where(eq(schema.dailySets.dayKey, '2026-10-21'));
    // 21 асуулттай санд саяхан орсон асуулт давтагдахгүй
    for (const id of d2!.questionIds) expect(d1!.questionIds).not.toContain(id);

    await playDay(alice.token, '2026-10-21', [true, false, true, false, true]);
    const me = await call<{ streak: { current: number; best: number; playedToday: boolean } }>(meRoute.GET, 'GET', '/api/me', alice.token);
    expect(me.body.streak).toEqual({ current: 2, best: 2, playedToday: true });
  });

  it('🔴 өчигдрийн сорилтыг өнөөдөр тоглох нь цувралд ТООЦОГДОХГҮЙ', async () => {
    const dave = await newGuest();
    await playDay(dave.token, DAY, [true, true, false, false, false], aliceCode);
    const me = await call<{ streak: { current: number } }>(meRoute.GET, 'GET', '/api/me', dave.token);
    expect(me.body.streak.current).toBe(0);
    const [play] = await db.select().from(schema.dailyPlays).where(eq(schema.dailyPlays.userId, dave.userId));
    expect(play!.onTime).toBe(false);
  });
});

describe('Найзын бүлэг', () => {
  let groupId = 0;
  let groupCode = '';

  it('нэргүй зочин бүлэг үүсгэхээс өмнө нэрээ тавина', async () => {
    const anon = await newGuest();
    const r = await call<{ error: { code: string } }>(groupsRoute.POST, 'POST', '/api/groups', anon.token, {
      action: 'create',
      name: 'Найзууд',
    });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NAME_REQUIRED');
  });

  it('бүлэг үүсгэж, кодоор нэгдэнэ', async () => {
    const c = await call<{ group: { id: number; code: string; memberCount: number; isOwner: boolean }; created: boolean }>(
      groupsRoute.POST,
      'POST',
      '/api/groups',
      alice.token,
      { action: 'create', name: 'ШУТИС 3-р курс' }
    );
    expect(c.status).toBe(200);
    expect(c.body).toMatchObject({ created: true, group: { memberCount: 1, isOwner: true } });
    groupId = c.body.group.id;
    groupCode = c.body.group.code;

    const preview = await callP<{ code: string }, { name: string; memberCount: number; isMember: boolean }>(
      groupPreview,
      { code: groupCode },
      'GET',
      `/api/groups/preview/${groupCode}`
    );
    expect(preview.body).toMatchObject({ name: 'ШУТИС 3-р курс', memberCount: 1, isMember: false });

    const j = await call<{ group: { memberCount: number } }>(groupsRoute.POST, 'POST', '/api/groups', bob.token, {
      action: 'join',
      code: groupCode.toLowerCase(),
    });
    expect(j.body.group.memberCount).toBe(2);

    // Дахин нэгдэх — идемпотент
    const again = await call<{ group: { memberCount: number } }>(groupsRoute.POST, 'POST', '/api/groups', bob.token, {
      action: 'join',
      code: groupCode,
    });
    expect(again.body.group.memberCount).toBe(2);
  });

  it('долоо хоногийн чансаа ба өнөөдрийн самбар', async () => {
    const r = await callP<{ id: string }, { members: Array<{ displayName: string; rank: number; weekCorrect: number; today: { played: boolean } }> }>(
      groupDetail,
      { id: String(groupId) },
      'GET',
      `/api/groups/${groupId}`,
      bob.token
    );
    expect(r.status).toBe(200);
    // Бат: 3 + 3 = 6 (хоёр өдөр) · Болд: 4 (нэг өдөр)
    expect(r.body.members.map((m) => [m.displayName, m.weekCorrect, m.rank])).toEqual([
      ['Бат', 6, 1],
      ['Болд', 4, 2],
    ]);
    expect(r.body.members[0]!.today.played).toBe(true);
  });

  it('🔴 гишүүн бус хүн бүлгийг харахгүй', async () => {
    const stranger = await newGuest();
    const r = await callP(groupDetail, { id: String(groupId) }, 'GET', `/api/groups/${groupId}`, stranger.token);
    expect(r.status).toBe(404);
  });

  it('эзэн гарвал эзэмшил шилжинэ, сүүлийн гишүүн гарвал бүлэг устана', async () => {
    await callP(leaveGroup, { id: String(groupId) }, 'DELETE', `/api/groups/${groupId}/membership`, alice.token);
    const [g] = await db.select().from(schema.friendGroups).where(eq(schema.friendGroups.id, groupId));
    expect(g!.ownerId).toBe(bob.userId);

    await callP(leaveGroup, { id: String(groupId) }, 'DELETE', `/api/groups/${groupId}/membership`, bob.token);
    const gone = await db.select().from(schema.friendGroups).where(eq(schema.friendGroups.id, groupId));
    expect(gone).toHaveLength(0);
  });
});
