import { describe, expect, it } from 'vitest';
import {
  classifyDifficulty,
  KPI_ACCURACY_MAX,
  KPI_ACCURACY_MIN,
  fitDecayLambda,
  lambdaFromProbe,
  meetsTarget,
  PROBE_WEEKS,
  RETENTION_TARGETS,
  UNGAMIFIED_CONTINUATION_TARGET,
  ungamifiedContinuationRate,
} from '../src/retention';

describe('Хойшлуулсан шалгалт — Бүлэг 8.5', () => {
  it('хэмжих цэгүүд 2/4/8/12 долоо хоног', () => {
    expect([...PROBE_WEEKS]).toEqual([2, 4, 8, 12]);
  });

  it('зорилтууд баримт бичгийн тоотой таарна', () => {
    expect(RETENTION_TARGETS[2]).toBe(0.85);
    expect(RETENTION_TARGETS[4]).toBe(0.75);
    expect(RETENTION_TARGETS[8]).toBe(0.6);
    expect(RETENTION_TARGETS[12]).toBe(0.5);
  });

  it('meetsTarget зорилтод хүрснийг шалгана', () => {
    expect(meetsTarget({ week: 8, retained: 0.71, sampleSize: 100 })).toBe(true);
    expect(meetsTarget({ week: 8, retained: 0.55, sampleSize: 100 })).toBe(false);
  });
});

describe('lambdaFromProbe — экспоненциал бууралт', () => {
  it('Wu & Wang (2026): 8 дх-т 71% → λ ≈ 0.0428', () => {
    const lambda = lambdaFromProbe(8, 0.71);
    expect(lambda).toBeCloseTo(0.0428, 3);
  });

  it('бууралтгүй (100%) → λ = 0', () => {
    expect(lambdaFromProbe(4, 1)).toBe(0);
  });

  it('хүчингүй оролт → null', () => {
    expect(lambdaFromProbe(0, 0.5)).toBeNull();
    expect(lambdaFromProbe(4, 0)).toBeNull();
    expect(lambdaFromProbe(4, 1.5)).toBeNull();
  });
});

describe('fitDecayLambda — олон цэгээс тохируулах', () => {
  it('төгс экспоненциал өгөгдөлд λ-г сэргээнэ (R² ≈ 1)', () => {
    const trueLambda = 0.05;
    const probes = PROBE_WEEKS.map((w) => ({
      week: w,
      retained: Math.exp(-trueLambda * w),
      sampleSize: 100,
    }));
    const { lambda, rSquared } = fitDecayLambda(probes);
    expect(lambda).toBeCloseTo(trueLambda, 6);
    expect(rSquared).toBeCloseTo(1, 6);
  });

  it('бодит хэлбэрийн өгөгдөлд эерэг λ гарна', () => {
    const { lambda } = fitDecayLambda([
      { week: 2, retained: 0.88, sampleSize: 120 },
      { week: 4, retained: 0.78, sampleSize: 110 },
      { week: 8, retained: 0.63, sampleSize: 95 },
      { week: 12, retained: 0.52, sampleSize: 80 },
    ]);
    expect(lambda).not.toBeNull();
    expect(lambda!).toBeGreaterThan(0);
    expect(lambda!).toBeLessThan(0.2);
  });

  it('цэг хангалтгүй бол null', () => {
    expect(fitDecayLambda([{ week: 2, retained: 0.8, sampleSize: 10 }]).lambda).toBeNull();
    expect(fitDecayLambda([]).lambda).toBeNull();
  });
});

describe('Багажгүй үргэлжлэл — жинхэнэ дотоод сэдлийн шалгуур', () => {
  it('зорилт 25%', () => {
    expect(UNGAMIFIED_CONTINUATION_TARGET).toBe(0.25);
  });

  it('хувийг зөв тооцоолно', () => {
    expect(
      ungamifiedContinuationRate({ usersWhoDisabledStreak: 200, returnedWithin2Weeks: 60 })
    ).toBe(0.3);
  });

  it('тэгд хуваахаас хамгаална', () => {
    expect(
      ungamifiedContinuationRate({ usersWhoDisabledStreak: 0, returnedWithin2Weeks: 0 })
    ).toBe(0);
  });
});

describe('classifyDifficulty — контентийн чанар (Бүлэг 8.4)', () => {
  it('65–75% нь тэнцвэртэй', () => {
    expect(classifyDifficulty(70, 100)).toBe('balanced');
    expect(classifyDifficulty(65, 100)).toBe('balanced');
    expect(classifyDifficulty(75, 100)).toBe('balanced');
  });

  it('75%-иас дээш нь хэт амархан', () => {
    expect(classifyDifficulty(90, 100)).toBe('too-easy');
    expect(classifyDifficulty(76, 100)).toBe('too-easy');
  });

  it('65%-иас доош нь хэт хүнд', () => {
    expect(classifyDifficulty(40, 100)).toBe('too-hard');
    expect(classifyDifficulty(64, 100)).toBe('too-hard');
  });

  it('20 оролдлогоос бага бол дүгнэхгүй — түүвэр хангалтгүй', () => {
    expect(classifyDifficulty(1, 1)).toBe('insufficient');
    expect(classifyDifficulty(19, 19)).toBe('insufficient');
    expect(classifyDifficulty(12, 20)).toBe('too-hard'); // 60% — 20 нь хангалттай түүвэр
  });

  it('KPI хүрээ баримт бичгийн тоотой таарна', () => {
    expect(KPI_ACCURACY_MIN).toBe(0.65);
    expect(KPI_ACCURACY_MAX).toBe(0.75);
  });
});
