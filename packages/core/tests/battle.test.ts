import { describe, expect, it } from 'vitest';
import {
  applyRound,
  BATTLE_ROUNDS,
  battleResult,
  botAccuracy,
  botResponseMs,
  emptyTally,
  resolveRound,
} from '../src/battle';

describe('botAccuracy — тоглогчийн XP-ээс хамаарна', () => {
  it('шинэ тоглогчид 0.55', () => {
    expect(botAccuracy(0)).toBeCloseTo(0.55);
  });

  it('дээд хязгаар 0.85-аас хэтрэхгүй', () => {
    expect(botAccuracy(1_000_000)).toBe(0.85);
  });

  it('XP өсөхөд хүчирхэгжинэ', () => {
    expect(botAccuracy(10_000)).toBeGreaterThan(botAccuracy(1_000));
  });
});

describe('botResponseMs', () => {
  it('2500–8000 мс хооронд', () => {
    for (const r of [0, 0.5, 1]) {
      const ms = botResponseMs(r);
      expect(ms).toBeGreaterThanOrEqual(2500);
      expect(ms).toBeLessThanOrEqual(8000);
    }
  });
});

describe('resolveRound', () => {
  it('зөвхөн тоглогч зөв → тоглогч ялна', () => {
    const r = resolveRound({
      playerCorrect: true,
      opponentCorrect: false,
      playerMs: 5000,
      opponentMs: 1000,
    });
    expect(r.winner).toBe('player');
  });

  it('зөвхөн өрсөлдөгч зөв → өрсөлдөгч ялна', () => {
    const r = resolveRound({
      playerCorrect: false,
      opponentCorrect: true,
      playerMs: 100,
      opponentMs: 9000,
    });
    expect(r.winner).toBe('opponent');
  });

  it('хоёулаа зөв → ХУРДАН нь ялна', () => {
    expect(
      resolveRound({
        playerCorrect: true,
        opponentCorrect: true,
        playerMs: 2000,
        opponentMs: 5000,
      }).winner
    ).toBe('player');

    expect(
      resolveRound({
        playerCorrect: true,
        opponentCorrect: true,
        playerMs: 6000,
        opponentMs: 3000,
      }).winner
    ).toBe('opponent');
  });

  it('хоёулаа буруу → оноогүй', () => {
    expect(
      resolveRound({
        playerCorrect: false,
        opponentCorrect: false,
        playerMs: 1000,
        opponentMs: 1000,
      }).winner
    ).toBe('none');
  });

  it('яг тэнцүү хугацаа → оноогүй', () => {
    expect(
      resolveRound({
        playerCorrect: true,
        opponentCorrect: true,
        playerMs: 3000,
        opponentMs: 3000,
      }).winner
    ).toBe('none');
  });
});

describe('applyRound — тойрог ҮРГЭЛЖ урагшилна (алдааны засвар №2)', () => {
  it('5 тойргийн дараа заавал дуусна', () => {
    let tally = emptyTally();
    for (let i = 0; i < BATTLE_ROUNDS; i++) {
      expect(tally.finished).toBe(false);
      tally = applyRound(tally, 'player');
    }
    expect(tally.finished).toBe(true);
    expect(tally.round).toBe(BATTLE_ROUNDS);
    expect(tally.playerScore).toBe(BATTLE_ROUNDS);
  });

  it('«none» тойрог ч гэсэн round-ыг урагшлуулна', () => {
    let tally = emptyTally();
    for (let i = 0; i < BATTLE_ROUNDS; i++) tally = applyRound(tally, 'none');
    expect(tally.finished).toBe(true);
    expect(tally.playerScore).toBe(0);
    expect(tally.opponentScore).toBe(0);
  });

  it('оноо зөв хуримтлагдана', () => {
    let tally = emptyTally();
    tally = applyRound(tally, 'player');
    tally = applyRound(tally, 'opponent');
    tally = applyRound(tally, 'player');
    expect(tally.playerScore).toBe(2);
    expect(tally.opponentScore).toBe(1);
    expect(tally.round).toBe(3);
  });
});

describe('battleResult', () => {
  it('ялалт / хожигдол / тэнцээ', () => {
    expect(battleResult({ playerScore: 3, opponentScore: 2, round: 5, finished: true })).toBe('win');
    expect(battleResult({ playerScore: 1, opponentScore: 4, round: 5, finished: true })).toBe('lose');
    expect(battleResult({ playerScore: 2, opponentScore: 2, round: 5, finished: true })).toBe('draw');
  });
});
