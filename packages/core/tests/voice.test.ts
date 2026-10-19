import { describe, expect, it } from 'vitest';
import {
  durationFitScore,
  feedbackFor,
  pacingScoreFromStdDev,
  scoreReading,
  VOICE_WEIGHTS,
  type TongueTwister,
} from '../src/voice';

const TWISTER: TongueTwister = {
  id: 1,
  text: 'Хүчит хүлэг хүрэн морь хүндэт хүний хүслийг хүргэв',
  minSeconds: 5,
  maxSeconds: 12,
};

describe('durationFitScore', () => {
  it('бүсийн голд 100', () => {
    expect(durationFitScore(8.5, 5, 12)).toBe(100);
  });

  it('бүсийн ирмэгт 70', () => {
    expect(durationFitScore(5, 5, 12)).toBe(70);
    expect(durationFitScore(12, 5, 12)).toBe(70);
  });

  it('хэт хурдан бол буурна', () => {
    expect(durationFitScore(1, 5, 12)).toBeLessThan(20);
    expect(durationFitScore(0, 5, 12)).toBe(0);
  });

  it('хэт удаан бол буурна', () => {
    expect(durationFitScore(24, 5, 12)).toBe(0);
    expect(durationFitScore(14, 5, 12)).toBeLessThan(70);
  });
});

describe('pacingScoreFromStdDev', () => {
  it('тогтвортой хэмнэл = өндөр оноо', () => {
    expect(pacingScoreFromStdDev(0)).toBe(100);
  });

  it('тогтворгүй хэмнэл = бага оноо', () => {
    expect(pacingScoreFromStdDev(1)).toBe(0);
    expect(pacingScoreFromStdDev(0.5)).toBe(50);
  });

  it('хэмжигдээгүй бол саармаг 70', () => {
    expect(pacingScoreFromStdDev(undefined)).toBe(70);
  });
});

describe('scoreReading — ADR-006, алдааны засвар №12', () => {
  it('төгс уншлага 100 хүрнэ (өмнөх ×0.85 таслалт УСТСАН)', () => {
    const r = scoreReading(TWISTER, {
      confidence: 1,
      durationSec: 8.5,
      pauseStdDev: 0,
    });
    expect(r.score).toBe(100);
  });

  it('маш муу уншлага 0 хүрнэ — бүтэн муж ашиглагдана', () => {
    const r = scoreReading(TWISTER, {
      confidence: 0,
      durationSec: 40,
      pauseStdDev: 2,
    });
    expect(r.score).toBe(0);
  });

  it('оноо ҮРГЭЛЖ 0–100 мужид', () => {
    for (const conf of [0, 0.3, 0.6, 1]) {
      for (const dur of [0.5, 5, 8.5, 12, 30]) {
        const r = scoreReading(TWISTER, { confidence: conf, durationSec: dur });
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('жин нь ADR-006-тай таарна: confidence 0.5, pacing 0.3, duration 0.2', () => {
    expect(VOICE_WEIGHTS.confidence).toBe(0.5);
    expect(VOICE_WEIGHTS.pacing).toBe(0.3);
    expect(VOICE_WEIGHTS.duration).toBe(0.2);
    expect(
      VOICE_WEIGHTS.confidence + VOICE_WEIGHTS.pacing + VOICE_WEIGHTS.duration
    ).toBeCloseTo(1);
  });

  it('alignment confidence нь хамгийн их жинтэй', () => {
    const high = scoreReading(TWISTER, { confidence: 1, durationSec: 8.5, pauseStdDev: 0.5 });
    const low = scoreReading(TWISTER, { confidence: 0.2, durationSec: 8.5, pauseStdDev: 0.5 });
    expect(high.score - low.score).toBeGreaterThan(35);
  });
});

describe('feedbackFor — pass/fail БИШ, урам хугалахгүй', () => {
  it('бүх түвшинд эерэг хэллэг', () => {
    for (const s of [0, 30, 55, 75, 95]) {
      const f = feedbackFor(s);
      expect(f.length).toBeGreaterThan(0);
      expect(f).not.toMatch(/бүтэлгүй|унасан|fail/i);
    }
  });

  it('85+ дээд түвшний магтаал (одоо хүрч болно)', () => {
    expect(feedbackFor(85)).toContain('Гайхалтай');
    expect(feedbackFor(100)).toContain('Гайхалтай');
  });
});
