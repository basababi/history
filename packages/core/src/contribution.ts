/**
 * Ахмад үеийн дуу хоолой — хувь нэмрийн дүрэм (ROADMAP B3)
 *
 * СУДАЛГААНЫ ҮНДЭСЛЭЛ: Khan — «биет бус өв нь биет өвөөс илүү чухал».
 * LOCUS төслийн үе хоорондын контент бүтээлт.
 *
 * ⚠ БҮЛЭГ 6.3-ЫН ГОЛ ДҮРЭМ: ЦУГЛУУЛАХАД XP олгоно, БАТАЛГААЖУУЛАХАД
 *   олгохгүй. Хэрэв батлагдсаны төлөө XP олговол хүүхэд их XP авахын
 *   тулд зохиож бичих сэдэлтэй болно — контентийн чанар унана.
 *   Тиймээс XP нь ИЛГЭЭХ үед олгогдоно, түүхчийн шийдвэрээс хамаарахгүй.
 */

/** Цуглуулж болох биет бус өвийн төрөл */
export type ContributionKind = 'proverb' | 'legend' | 'story' | 'custom' | 'song';

export const CONTRIBUTION_LABEL: Record<ContributionKind, string> = {
  proverb: 'Зүйр цэцэн үг',
  legend: 'Домог',
  story: 'Үлгэр',
  custom: 'Ёс заншил',
  song: 'Дуу, магтаал',
};

/** Төрөл бүрд тохирох урт — зүйр үг богино, үлгэр урт */
export const CONTRIBUTION_LIMITS: Record<ContributionKind, { min: number; max: number }> = {
  proverb: { min: 10, max: 300 },
  legend: { min: 80, max: 2000 },
  story: { min: 80, max: 2000 },
  custom: { min: 40, max: 1200 },
  song: { min: 20, max: 1200 },
};

/** Нэг хүүхэд өдөрт хамгийн ихдээ хэдэн зүйл илгээж болох */
export const CONTRIBUTION_DAILY_LIMIT = 3;

/** Илгээсний XP — түүхчийн шийдвэрээс ХАМААРАХГҮЙ */
export const CONTRIBUTION_XP = 25;

export type ContributionStatus = 'pending' | 'approved' | 'rejected';

export interface ContributionCheck {
  ok: boolean;
  /** Тэнцээгүй шалтгааны код */
  reason?:
    | 'NO_CONSENT'
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'NO_ELDER_LABEL'
    | 'DAILY_LIMIT';
  /** Хэрэглэгчид харуулах монгол мессеж */
  message?: string;
}

/**
 * Хувь нэмрийг хүлээж авах эсэх. ЦЭВЭР функц — сервер шалгана.
 *
 * ⚠ `consentConfirmed` нь заавал. Хүүхэд ахмад хүнээс зөвшөөрөл авсан
 *   гэдгээ баталгаажуулаагүй бол хүлээж авахгүй — хууль зүйн, ёс зүйн
 *   шаардлага (Бүлэг 6.5).
 */
export function checkContribution(input: {
  kind: ContributionKind;
  body: string;
  elderLabel: string;
  consentConfirmed: boolean;
  todayCount: number;
}): ContributionCheck {
  const { kind, body, elderLabel, consentConfirmed, todayCount } = input;

  if (!consentConfirmed) {
    return {
      ok: false,
      reason: 'NO_CONSENT',
      message:
        'Өвөө эмээгээсээ зөвшөөрөл авсан эсэхээ баталгаажуулна уу. Энэ бол тэдний түүх.',
    };
  }

  if (elderLabel.trim().length < 2) {
    return {
      ok: false,
      reason: 'NO_ELDER_LABEL',
      message: 'Хэнээс сонссоноо бичнэ үү (ж нь «Дорж өвөө»). Бүтэн нэр хэрэггүй.',
    };
  }

  const limits = CONTRIBUTION_LIMITS[kind];
  const len = body.trim().length;

  if (len < limits.min) {
    return {
      ok: false,
      reason: 'TOO_SHORT',
      message: `${CONTRIBUTION_LABEL[kind]} дор хаяж ${limits.min} тэмдэгт байх ёстой.`,
    };
  }
  if (len > limits.max) {
    return {
      ok: false,
      reason: 'TOO_LONG',
      message: `${limits.max} тэмдэгтэд багтаана уу. Хэт урт бол хэсэглэн илгээж болно.`,
    };
  }

  if (todayCount >= CONTRIBUTION_DAILY_LIMIT) {
    return {
      ok: false,
      reason: 'DAILY_LIMIT',
      message: `Өдөрт ${CONTRIBUTION_DAILY_LIMIT} хүртэл зүйл илгээж болно. Маргааш дахин ирээрэй.`,
    };
  }

  return { ok: true };
}

/**
 * Илгээсний XP.
 *
 * ⚠ Батлагдсан эсэхээс ХАМААРАХГҮЙ гэдгийг функцийн гарын үсэг өөрөө
 *   баталгаажуулна: `status` параметр огт байхгүй.
 */
export function contributionXp(check: ContributionCheck): number {
  return check.ok ? CONTRIBUTION_XP : 0;
}
