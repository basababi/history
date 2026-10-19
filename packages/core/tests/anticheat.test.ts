import { describe, expect, it } from 'vitest';
import {
  acceptOfflineAttempt,
  ANOMALY_AVG_MS_THRESHOLD,
  detectAnomaly,
  MAX_OFFLINE_LAG_MS,
  RATE_LIMIT_PER_HOUR,
  serverResponseMs,
} from '../src/anticheat';

describe('detectAnomaly — Бүлэг 6.1', () => {
  it('бот: дундаж <800мс БӨГӨӨД нарийвчлал >95% → тэмдэглэнэ', () => {
    const r = detectAnomaly({
      responseMsList: [400, 350, 500, 420, 380, 410],
      correctCount: 6,
    });
    expect(r.flagged).toBe(true);
    expect(r.accuracy).toBe(1);
  });

  it('хурдан ч алддаг → тэмдэглэхгүй', () => {
    const r = detectAnomaly({
      responseMsList: [400, 350, 500, 420, 380, 410],
      correctCount: 4,
    });
    expect(r.flagged).toBe(false);
  });

  it('нарийвчлалтай ч удаан → тэмдэглэхгүй (жинхэнэ мэддэг хүн)', () => {
    const r = detectAnomaly({
      responseMsList: [4000, 3500, 5000, 4200, 3800],
      correctCount: 5,
    });
    expect(r.flagged).toBe(false);
  });

  it('түүвэр хэт бага → тэмдэглэхгүй (буруу эерэг)', () => {
    const r = detectAnomaly({ responseMsList: [200, 200], correctCount: 2 });
    expect(r.flagged).toBe(false);
  });

  it('хоосон түүвэр аюулгүй', () => {
    const r = detectAnomaly({ responseMsList: [], correctCount: 0 });
    expect(r.flagged).toBe(false);
    expect(r.avgMs).toBe(0);
  });

  it('босго нь баримт бичгийн тоотой таарна', () => {
    expect(ANOMALY_AVG_MS_THRESHOLD).toBe(800);
    expect(RATE_LIMIT_PER_HOUR).toBe(120);
  });
});

describe('acceptOfflineAttempt — Бүлэг 6.6, дээд 24 цагийн хоцрогдол', () => {
  const now = Date.UTC(2026, 7, 25, 12, 0);

  it('саяхны офлайн хариултыг хүлээж авна', () => {
    const r = acceptOfflineAttempt({
      clientAnsweredAt: now - 60 * 60 * 1000,
      serverNow: now,
    });
    expect(r.accepted).toBe(true);
  });

  it('24 цагаас хэтэрсэн бол татгалзана', () => {
    const r = acceptOfflineAttempt({
      clientAnsweredAt: now - MAX_OFFLINE_LAG_MS - 1000,
      serverNow: now,
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('TOO_OLD');
  });

  it('ирээдүйн timestamp — цаг хуурсныг илрүүлнэ', () => {
    const r = acceptOfflineAttempt({
      clientAnsweredAt: now + 60_000,
      serverNow: now,
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('FUTURE_TIMESTAMP');
  });

  it('яг 24 цагийн хилд хүлээж авна', () => {
    const r = acceptOfflineAttempt({
      clientAnsweredAt: now - MAX_OFFLINE_LAG_MS,
      serverNow: now,
    });
    expect(r.accepted).toBe(true);
  });
});

describe('serverResponseMs — алдааны засвар №4', () => {
  it('асуултын served_at-аас хэмжинэ, сессийн эхлэлээс БИШ', () => {
    const servedAt = 1_000_000;
    expect(serverResponseMs(servedAt, servedAt + 3200)).toBe(3200);
  });

  it('сөрөг утга гарахгүй (цаг ухарсан тохиолдол)', () => {
    expect(serverResponseMs(1_000_000, 999_000)).toBe(0);
  });
});
