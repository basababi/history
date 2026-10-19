/**
 * POST /api/voice/score — Voice Battle оноолт (ADR-006, Бүлэг 3.4)
 *
 * Монгол хэлний ASR 10–25% WER бүсэд байгаа тул free transcription-ийг ЯГ
 * тааруулж оноо өгвөл ЗӨВ хэлсэн хэрэглэгчийн 20–30% нь буруу үнэлгээ авна.
 * Шийдэл: зорилтот текст урьдчилж мэдэгдэж байгаа тул FastAPI дээрх
 * Wav2Vec2/MMS CTC forced alignment-ээр phoneme confidence гаргана.
 *
 * Бүлэг 6.5: «Дуу хоолойн бичлэгийг оноолсны дараа ШУУД устгана —
 *             түүхий аудио хадгалахгүй.»
 */
import { NextResponse } from 'next/server';
import { scoreReading, type TongueTwister } from '@nomad/core';
import { VoiceScoreRequestSchema } from '@nomad/contracts';
import { apiError, parseBody, requireAuth, route } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Түргэн хэллэгүүд — Бүлэг 3.4 (ардын аман зохиол) */
export const TONGUE_TWISTERS: TongueTwister[] = [
  {
    id: 1,
    text: 'Намуухан намуун навчис намарч намуухан намын намуун навчис намарч',
    minSeconds: 6,
    maxSeconds: 14,
  },
  {
    id: 2,
    text: 'Замбага зулай зангилаа замбуулаг зангилаа',
    minSeconds: 4,
    maxSeconds: 10,
  },
  {
    id: 3,
    text: 'Хүчит хүлэг хүрэн морь хүндэт хүний хүслийг хүргэв',
    minSeconds: 5,
    maxSeconds: 12,
  },
  {
    id: 4,
    text: 'Тавин таван саарал тарган тугал тарав',
    minSeconds: 4,
    maxSeconds: 9,
  },
  {
    id: 5,
    text: 'Шар шувуу шаргал шонхор шувууны шарх шалгав',
    minSeconds: 4,
    maxSeconds: 10,
  },
];

export const POST = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const parsed = await parseBody(req, VoiceScoreRequestSchema);
  if (!parsed.ok) return parsed.response;
  const { twisterId, durationSec, audioBase64 } = parsed.data;

  const twister = TONGUE_TWISTERS.find((t) => t.id === twisterId);
  if (!twister) {
    return apiError('TWISTER_NOT_FOUND', 'Ийм түргэн хэллэг байхгүй', 404);
  }

  const serviceUrl = process.env.VOICE_SERVICE_URL;

  // ─── Аудиогүй бол оноолохгүй: «товч дараад 85 оноо» алдааг хаана ───
  if (!audioBase64) {
    return apiError(
      'AUDIO_REQUIRED',
      'Дуу хоолойн бичлэг шаардлагатай. Микрофоны зөвшөөрлөө шалгана уу.',
      400
    );
  }

  if (!serviceUrl) {
    // Graceful degradation — модуль хаагдана, худал оноо ӨГӨХГҮЙ (ADR-006)
    return apiError(
      'VOICE_SERVICE_UNAVAILABLE',
      'Дуу хоолойн үйлчилгээ түр боломжгүй байна. Бусад сорилтууд хэвийн ажиллаж байна.',
      503,
      true
    );
  }

  // ─── FastAPI: CTC forced alignment ───
  let alignment: { confidence: number; pauseStdDev?: number };
  try {
    const res = await fetch(`${serviceUrl}/align`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        target_text: twister.text,
        audio_base64: audioBase64,
        language: 'mn',
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`voice service ${res.status}`);
    const data = (await res.json()) as {
      confidence: number;
      pause_std_dev?: number;
    };
    alignment = {
      confidence: data.confidence,
      pauseStdDev: data.pause_std_dev,
    };
  } catch (err) {
    console.error('[voice] alignment алдаа:', err);
    return apiError(
      'VOICE_SERVICE_UNAVAILABLE',
      'Оноолт хийж чадсангүй. Дахин оролдоно уу.',
      503,
      true
    );
  }

  const result = scoreReading(twister, {
    confidence: alignment.confidence,
    durationSec,
    pauseStdDev: alignment.pauseStdDev,
  });

  // ⚠ Түүхий аудио ЭНД ХАДГАЛАГДААГҮЙ — санах ойгоос гарлаа (Бүлэг 6.5)
  return NextResponse.json({ ...result, audioDiscarded: true });
});

/** GET /api/voice/score — түргэн хэллэгийн жагсаалт */
export const GET = route(async (req) => {
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ twisters: TONGUE_TWISTERS });
});
