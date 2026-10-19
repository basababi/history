/**
 * Интерактив өгүүлэмжийн тест (ROADMAP C2)
 *
 * Хамгийн чухал шалгуур: клиент ХУУРАМЧ зам илгээж XP авч чадахгүй.
 */
import { describe, expect, it } from 'vitest';
import {
  STORY_MAX_DEPTH,
  STORY_START_KEY,
  validateStory,
  walkStoryPath,
  type StoryNode,
} from '../src/story';

const GOOD: StoryNode[] = [
  {
    key: 'start',
    body: 'Та бол 1206 оны Их хуралдай дээрх элч.',
    choices: [
      { label: 'Тэмүүжинийг дэмжинэ', nextKey: 'support', factNote: 'Ши цзи' },
      { label: 'Чимээгүй ажиглана', nextKey: 'observe' },
    ],
  },
  {
    key: 'support',
    body: 'Та дуугаа өргөв.',
    choices: [{ label: 'Үргэлжлүүлэх', nextKey: 'end_a' }],
  },
  { key: 'observe', body: 'Та юу ч хэлсэнгүй.', choices: [], endingLabel: 'Ажиглагч' },
  { key: 'end_a', body: 'Тэмүүжин Чингис хаан цол хүртэв.', choices: [], endingLabel: 'Дэмжигч' },
];

describe('validateStory — эвдэрсэн граф ӨС-д орохгүй', () => {
  it('зөв граф тэнцэнэ', () => {
    expect(validateStory(GOOD).ok).toBe(true);
  });

  it('start зангилаагүй бол таслана', () => {
    const res = validateStory(GOOD.filter((n) => n.key !== STORY_START_KEY));
    expect(res.ok).toBe(false);
    expect(res.errors[0]!.code).toBe('NO_START');
  });

  it('байхгүй зангилаа руу заасан сонголтыг барина', () => {
    const broken: StoryNode[] = [
      { key: 'start', body: 'A', choices: [{ label: 'x', nextKey: 'ghost' }] },
      { key: 'e', body: 'E', choices: [] },
    ];
    const res = validateStory(broken);
    expect(res.errors.some((e) => e.code === 'DANGLING_CHOICE')).toBe(true);
  });

  it('давхардсан түлхүүрийг барина', () => {
    const dup = [...GOOD, { key: 'start', body: 'дахин', choices: [] }];
    expect(validateStory(dup).errors.some((e) => e.code === 'DUPLICATE_KEY')).toBe(true);
  });

  it('төгсгөлгүй графыг таслана', () => {
    const endless: StoryNode[] = [
      { key: 'start', body: 'A', choices: [{ label: 'x', nextKey: 'b' }] },
      { key: 'b', body: 'B', choices: [{ label: 'y', nextKey: 'start' }] },
    ];
    const res = validateStory(endless);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.code === 'NO_ENDING')).toBe(true);
  });

  it('🔴 мөчлөгийг барина — хязгааргүй давталт үүсэхгүй', () => {
    const cyclic: StoryNode[] = [
      { key: 'start', body: 'A', choices: [{ label: 'x', nextKey: 'b' }] },
      { key: 'b', body: 'B', choices: [{ label: 'y', nextKey: 'start' }] },
      { key: 'e', body: 'E', choices: [] },
    ];
    expect(validateStory(cyclic).errors.some((e) => e.code === 'CYCLE')).toBe(true);
  });

  it('хүрч болохгүй зангилааг мэдээлнэ', () => {
    const orphan = [...GOOD, { key: 'lost', body: 'Хэн ч ирэхгүй', choices: [] }];
    expect(validateStory(orphan).errors.some((e) => e.code === 'UNREACHABLE_NODE')).toBe(
      true
    );
  });
});

describe('🔴 walkStoryPath — клиент XP хуурч чадахгүй', () => {
  it('хүчинтэй зам төгсгөл буцаана', () => {
    const res = walkStoryPath(GOOD, ['support', 'end_a']);
    expect(res.valid).toBe(true);
    expect(res.endingKey).toBe('end_a');
  });

  it('нэг алхмын төгсгөл ажиллана', () => {
    expect(walkStoryPath(GOOD, ['observe']).endingKey).toBe('observe');
  });

  it('графт байхгүй алхмыг ТАТГАЛЗАНА', () => {
    const res = walkStoryPath(GOOD, ['end_a']);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('INVALID_STEP');
  });

  it('огт байхгүй түлхүүрийг татгалзана', () => {
    expect(walkStoryPath(GOOD, ['hack']).valid).toBe(false);
  });

  it('дуусгаагүй зам XP авахгүй', () => {
    const res = walkStoryPath(GOOD, ['support']);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('NOT_AN_ENDING');
  });

  it('хоосон зам нь төгсгөл биш (start нь сонголттой)', () => {
    expect(walkStoryPath(GOOD, []).reason).toBe('NOT_AN_ENDING');
  });

  it('хэт урт замыг таслана', () => {
    const long = new Array(STORY_MAX_DEPTH + 1).fill('support');
    expect(walkStoryPath(GOOD, long).reason).toBe('TOO_LONG');
  });

  it('start байхгүй бол аюулгүйгээр таслана', () => {
    expect(walkStoryPath([], ['x']).reason).toBe('BAD_START');
  });
});

describe('Өгүүлэмжийн зохиомжийн дүрэм', () => {
  it('🔴 аль ч төгсгөл «буруу» гэж тэмдэглэгдээгүй', () => {
    // Бүх төгсгөл нэртэй байх ёстой — «унасан» төгсгөл байхгүй
    for (const n of GOOD.filter((x) => x.choices.length === 0)) {
      expect(n.endingLabel).toBeTruthy();
    }
  });

  it('олон төгсгөлтэй — сонголт үнэхээр нөлөөлнө', () => {
    expect(GOOD.filter((n) => n.choices.length === 0).length).toBeGreaterThan(1);
  });
});
