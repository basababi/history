import { describe, expect, it } from 'vitest';
import {
  assignBuckets,
  LEAGUE_BUCKET_SIZE,
  movementForRank,
  rankEntries,
  tierAfterMovement,
} from '../src/league';

describe('movementForRank — дээд 5 ↑, доод 5 ↓ (Бүлэг 3.6)', () => {
  it('1–5 байр дээш шилжинэ', () => {
    for (let r = 1; r <= 5; r++) {
      expect(movementForRank(r, 30)).toBe('promote');
    }
  });

  it('26–30 байр доош шилжинэ', () => {
    for (let r = 26; r <= 30; r++) {
      expect(movementForRank(r, 30)).toBe('relegate');
    }
  });

  it('6–25 байр хэвээр', () => {
    expect(movementForRank(6, 30)).toBe('stay');
    expect(movementForRank(15, 30)).toBe('stay');
    expect(movementForRank(25, 30)).toBe('stay');
  });
});

describe('tierAfterMovement — хязгаарт тогтоно', () => {
  it('bronze доош явахгүй', () => {
    expect(tierAfterMovement('bronze', 'relegate')).toBe('bronze');
  });

  it('platinum дээш явахгүй', () => {
    expect(tierAfterMovement('platinum', 'promote')).toBe('platinum');
  });

  it('дунд түвшнүүд хөдөлнө', () => {
    expect(tierAfterMovement('silver', 'promote')).toBe('gold');
    expect(tierAfterMovement('silver', 'relegate')).toBe('bronze');
    expect(tierAfterMovement('gold', 'stay')).toBe('gold');
  });
});

describe('assignBuckets — ~30 хүний бүлэг, глобал leaderboard БИШ', () => {
  it('30 хүн = 1 бүлэг', () => {
    const b = assignBuckets(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(b).toHaveLength(1);
    expect(b[0]).toHaveLength(30);
  });

  it('65 хүн = 30 + 30 + 5 → сүүлийн жижиг бүлэг нийлнэ', () => {
    const b = assignBuckets(Array.from({ length: 65 }, (_, i) => i + 1));
    expect(b).toHaveLength(2);
    expect(b[0]).toHaveLength(30);
    expect(b[1]).toHaveLength(35); // 30 + 5 нийлсэн
  });

  it('45 хүн = 30 + 15 (15 ≥ 10 тул нийлэхгүй)', () => {
    const b = assignBuckets(Array.from({ length: 45 }, (_, i) => i + 1));
    expect(b).toHaveLength(2);
    expect(b[1]).toHaveLength(15);
  });

  it('хоосон жагсаалт', () => {
    expect(assignBuckets([])).toEqual([]);
  });

  it('бүх хэрэглэгч яг нэг л бүлэгт орно', () => {
    const ids = Array.from({ length: 137 }, (_, i) => i + 1);
    const flat = assignBuckets(ids).flat().sort((a, b) => a - b);
    expect(flat).toEqual(ids);
    expect(new Set(flat).size).toBe(ids.length);
  });

  it('бүлгийн хэмжээ тогтмолтой таарна', () => {
    expect(LEAGUE_BUCKET_SIZE).toBe(30);
  });
});

describe('rankEntries — тэнцсэн оноог детерминистик эрэмбэлнэ', () => {
  it('оноогоор буурахаар', () => {
    const r = rankEntries([
      { userId: 3, weeklyXp: 100 },
      { userId: 1, weeklyXp: 300 },
      { userId: 2, weeklyXp: 200 },
    ]);
    expect(r.map((e) => e.userId)).toEqual([1, 2, 3]);
    expect(r.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it('оноо тэнцвэл userId-аар тогтвортой', () => {
    const input = [
      { userId: 9, weeklyXp: 50 },
      { userId: 4, weeklyXp: 50 },
    ];
    expect(rankEntries(input).map((e) => e.userId)).toEqual([4, 9]);
    // Дахин дуудахад ижил үр дүн
    expect(rankEntries(input).map((e) => e.userId)).toEqual([4, 9]);
  });
});
