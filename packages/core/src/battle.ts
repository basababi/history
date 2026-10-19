/**
 * PvP тулааны логик — Бүлэг 7.3
 *
 * ⚠ ОДООГИЙН ХЯЗГААР: бодит real-time PvP (Ably/Socket.io) хараахан
 * холбогдоогүй. Энэ модуль нь СЕРВЕРИЙН ТАЛД ажилладаг бот өрсөлдөгчийг
 * тодорхойлно. Бот нь тоглогчийн XP-ээс хамаарч хүчээ тохируулна.
 *
 * Бодит хүнтэй тулаан нэмэгдэхэд `resolveRound()` интерфэйс өөрчлөгдөхгүй —
 * зөвхөн `opponentCorrect`-ийг ботоос биш, нөгөө тоглогчоос авна.
 */

export const BATTLE_ROUNDS = 5;

/** Ботийн зөв хариулах магадлал: 0.55–0.85 (тоглогчийн XP-ээс) */
export function botAccuracy(playerXp: number): number {
  return Math.min(0.85, 0.55 + playerXp / 20_000);
}

/** Ботийн хариултын хугацаа (мс): 2500–8000 */
export function botResponseMs(random: number = Math.random()): number {
  return Math.round(2500 + random * 5500);
}

export type RoundWinner = 'player' | 'opponent' | 'none';

export interface RoundOutcome {
  playerCorrect: boolean;
  opponentCorrect: boolean;
  playerMs: number;
  opponentMs: number;
  winner: RoundWinner;
}

/**
 * Тойргийн ялагчийг тодорхойлно.
 * Хоёулаа зөв бол ХУРДАН нь ялна (серверийн цагаар хэмжсэн).
 */
export function resolveRound(params: {
  playerCorrect: boolean;
  opponentCorrect: boolean;
  playerMs: number;
  opponentMs: number;
}): RoundOutcome {
  const { playerCorrect, opponentCorrect, playerMs, opponentMs } = params;

  let winner: RoundWinner = 'none';
  if (playerCorrect && !opponentCorrect) winner = 'player';
  else if (!playerCorrect && opponentCorrect) winner = 'opponent';
  else if (playerCorrect && opponentCorrect) {
    winner =
      playerMs < opponentMs ? 'player' : playerMs > opponentMs ? 'opponent' : 'none';
  }

  return { playerCorrect, opponentCorrect, playerMs, opponentMs, winner };
}

export interface BattleTally {
  playerScore: number;
  opponentScore: number;
  round: number;
  finished: boolean;
}

/** Тойргийн үр дүнгээс оноог шинэчилнэ — цэвэр функц */
export function applyRound(tally: BattleTally, winner: RoundWinner): BattleTally {
  const next: BattleTally = {
    playerScore: tally.playerScore + (winner === 'player' ? 1 : 0),
    opponentScore: tally.opponentScore + (winner === 'opponent' ? 1 : 0),
    round: tally.round + 1,
    finished: false,
  };
  next.finished = next.round >= BATTLE_ROUNDS;
  return next;
}

export function emptyTally(): BattleTally {
  return { playerScore: 0, opponentScore: 0, round: 0, finished: false };
}

export type BattleResult = 'win' | 'lose' | 'draw';

export function battleResult(tally: BattleTally): BattleResult {
  if (tally.playerScore > tally.opponentScore) return 'win';
  if (tally.playerScore < tally.opponentScore) return 'lose';
  return 'draw';
}
