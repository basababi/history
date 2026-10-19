/**
 * Зуучлалын оноолтын тест (ROADMAP C1)
 *
 * Хамгийн чухал шалгуур: ХУУЛСАН тайлбар тэнцэхгүй. Зуучлалын бүх учир
 * нь ойлгосон эсэхийг шалгах — хуулбар үүнийг харуулж чадахгүй.
 */
import { describe, expect, it } from 'vitest';
import {
  deriveKeyTerms,
  MEDIATION_MAX_CHARS,
  MEDIATION_PASS_SCORE,
  MEDIATION_PROMPT,
  mediationXp,
  scoreMediation,
} from '../src/mediation';

const REFERENCE =
  'Модун шаньюй нь МЭӨ 209 онд Хүннү гүрнийг байгуулж, түмт цэргийн ' +
  'зохион байгуулалтыг нэвтрүүлсэн анхны удирдагч юм.';

describe('deriveKeyTerms — оноосон нэрийг урт үгнээс дээгүүр тавина', () => {
  it('гол дүн нэр ба он цагийг сонгоно', () => {
    const terms = deriveKeyTerms(REFERENCE);
    expect(terms).toContain('Модун');
    expect(terms).toContain('Хүннү');
  });

  it('оноосон нэр нь нөхцөлөөр уртассан үйл үгнээс ӨМНӨ эрэмбэлэгдэнэ', () => {
    // Регресс: анхны «хамгийн урт үг» эвристик «байгуулалтыг»,
    // «нэвтрүүлсэн» гэсэн үгсийг сонгож «Модун»-ыг бүрмөсөн орхидог байв.
    const terms = deriveKeyTerms(REFERENCE);
    expect(terms.indexOf('Модун')).toBeLessThan(terms.indexOf('байгуулалтыг'));
  });

  it('цөөн байр сонгоход зөвхөн оноосон нэр үлдэнэ', () => {
    expect(deriveKeyTerms(REFERENCE, 3)).not.toContain('байгуулалтыг');
  });

  it('limit-ээс хэтрэхгүй', () => {
    expect(deriveKeyTerms(REFERENCE, 3)).toHaveLength(3);
  });
});

describe('scoreMediation — агуулгын хамрах хүрээ', () => {
  it('гол нэр томьёог өөрийн үгээр дурдсан тайлбар тэнцэнэ', () => {
    const res = scoreMediation({
      userText:
        'Модун гэдэг хүн Хүннү улсаа анх байгуулаад цэргээ түмт болгож хуваасан.',
      referenceText: REFERENCE,
    });
    expect(res.passed).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(MEDIATION_PASS_SCORE);
    expect(res.copied).toBe(false);
  });

  it('огт хамааралгүй текст тэнцэхгүй', () => {
    const res = scoreMediation({
      userText: 'Өнөөдөр цаг агаар сайхан байна, би хөл бөмбөг үзсэн.',
      referenceText: REFERENCE,
    });
    expect(res.passed).toBe(false);
    expect(res.coverageScore).toBe(0);
    expect(res.missedTerms.length).toBeGreaterThan(0);
  });

  it('дурдаагүй нэр томьёог missedTerms-д буцаана', () => {
    const res = scoreMediation({
      userText: 'Модун гэдэг хүн ямар нэг зүйл хийсэн гэсэн.',
      referenceText: REFERENCE,
    });
    expect(res.matchedTerms.length + res.missedTerms.length).toBeGreaterThan(0);
    expect(res.missedTerms.length).toBeGreaterThan(0);
  });

  it('keyTerms заавал өгвөл түүгээр л хэмжинэ', () => {
    const res = scoreMediation({
      userText: 'Хүннү гүрэн байгуулагдсан.',
      referenceText: REFERENCE,
      keyTerms: ['Хүннү'],
    });
    expect(res.matchedTerms).toEqual(['Хүннү']);
    expect(res.missedTerms).toEqual([]);
    expect(res.coverageScore).toBe(60);
  });
});

describe('🔴 Хуулбарыг илрүүлэх — механикийн гол цэг', () => {
  it('тайлбарыг шууд хуулсан бол өөрийн үгийн оноо 0', () => {
    const res = scoreMediation({ userText: REFERENCE, referenceText: REFERENCE });
    expect(res.copied).toBe(true);
    expect(res.originalityScore).toBe(0);
  });

  it('хуулсан тайлбар нэр томьёо бүрэн хамарсан ч ТЭНЦЭХГҮЙ', () => {
    const res = scoreMediation({ userText: REFERENCE, referenceText: REFERENCE });
    expect(res.coverageScore).toBe(60); // агуулга бүрэн
    expect(res.passed).toBe(false); // гэвч зуучлал биш
  });

  it('хуулсан үед сэтгэгдэл нь шалтгааныг тайлбарлана', () => {
    const res = scoreMediation({ userText: REFERENCE, referenceText: REFERENCE });
    expect(res.feedback).toContain('хуул');
  });
});

describe('Уртын шалгуур', () => {
  it('хэт богино бичвэрт уртын оноо 0', () => {
    const res = scoreMediation({ userText: 'Хүннү', referenceText: REFERENCE });
    expect(res.lengthScore).toBe(0);
    expect(res.passed).toBe(false);
  });

  it('нэг өгүүлбэрийн хязгаарт багтвал бүтэн оноо', () => {
    const res = scoreMediation({
      userText: 'Модун гэдэг хүн Хүннү улсаа байгуулж цэргээ түмээр хуваасан.',
      referenceText: REFERENCE,
    });
    expect(res.lengthScore).toBe(15);
  });

  it('эссэ бичвэл уртын оноо буурна — нэг өгүүлбэр гэсэн даалгавар', () => {
    const long = 'Модун шаньюй Хүннү улсыг байгуулсан удирдагч. '.repeat(12);
    expect(long.length).toBeGreaterThan(MEDIATION_MAX_CHARS);
    const res = scoreMediation({ userText: long, referenceText: REFERENCE });
    expect(res.lengthScore).toBe(8);
  });
});

describe('mediationXp', () => {
  it('тэнцээгүй бол XP олгохгүй', () => {
    const res = scoreMediation({ userText: 'Мэдэхгүй', referenceText: REFERENCE });
    expect(mediationXp(res)).toBe(0);
  });

  it('хуулсан бол XP олгохгүй', () => {
    const res = scoreMediation({ userText: REFERENCE, referenceText: REFERENCE });
    expect(mediationXp(res)).toBe(0);
  });

  it('тэнцсэн бол XP олгоно', () => {
    const res = scoreMediation({
      userText:
        'Модун гэдэг хүн Хүннү улсаа анх байгуулаад цэргээ түмт болгож хуваасан.',
      referenceText: REFERENCE,
    });
    expect(mediationXp(res)).toBeGreaterThan(0);
  });
});

describe('Детерминист байдал — LLM-гүй, хий үзэгдэлгүй', () => {
  it('ижил оролтод ижил үр дүн', () => {
    const input = { userText: 'Хүннү улсыг Модун байгуулсан юм.', referenceText: REFERENCE };
    expect(scoreMediation(input)).toEqual(scoreMediation(input));
  });

  it('дөрвөн төрөл бүрд заавар бэлэн', () => {
    expect(Object.keys(MEDIATION_PROMPT)).toHaveLength(4);
    for (const p of Object.values(MEDIATION_PROMPT)) {
      expect(p.length).toBeGreaterThan(10);
    }
  });

  it('оноо 0–100 хооронд', () => {
    for (const t of ['', 'а', REFERENCE, 'Хүннү Модун түмт цэрэг байгуулсан']) {
      const s = scoreMediation({ userText: t, referenceText: REFERENCE });
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
});
