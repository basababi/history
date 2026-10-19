/**
 * Voice Battle — түргэн хэллэгийн сорил (Бүлэг 3.4, ADR-006)
 *
 * Алдааны засвар №12: микрофон БОДИТООР ажиллана. Өмнө нь зүгээр секундомер
 * байсан тул дуугаа гаргалгүй товч дараад 85 оноо авч болдог байв.
 *
 * SDK 57-д `expo-av` дэмжигдэхээ больсон тул `expo-audio` ашиглана.
 *
 * Оноолт нь сервер дээр CTC forced alignment-ээр хийгдэнэ (ADR-006).
 * Түүхий аудио оноолсны дараа ШУУД устгагдана (Бүлэг 6.5).
 * Pass/fail БИШ — «хөгжилтэй оноо» 0–100.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import type { VoiceScoreResponse } from '@nomad/contracts';
import { ApiError } from '@/api/client';
import { scoreVoice } from '@/api/endpoints';
import { Card, ErrorState, PrimaryButton, ProgressBar, Skeleton } from '@/components/ui';
import { useTwisters } from '@/hooks/queries';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

type Phase = 'ready' | 'recording' | 'scoring' | 'scored' | 'error';

export default function VoiceBattleScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, refetch } = useTwisters();
  /**
   * ⚠ `useAudioRecorder` hook-ийг ЗОРИУДААР ашиглахгүй. Тэр нь бичигчийг
   * expo-modules-core-ийн «shared object» болгож үүсгээд, дэлгэц дахин
   * холбогдох буюу кодын шинэчлэлт болоход native талд нь чөлөөлдөг.
   * Гэтэл JS тал хуучин дугаараа барьсаар байдаг тул дараагийн хандалтад
   * «Cannot use shared object that was already released» гэж УНАЖ,
   * ErrorBoundary хүртэл очиж байв.
   *
   * Оронд нь бичигчийг зөвхөн бичих агшинд үүсгээд дараа нь шууд
   * чөлөөлнө: рендерийн үед бичигчид огт хандахгүй, микрофон ч сул
   * зогсохгүй.
   */
  const recorderRef = useRef<AudioRecorder | null>(null);

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [result, setResult] = useState<VoiceScoreResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(0);

  const twisters = data?.twisters ?? [];
  const twister = twisters[index];

  // Бичлэгийн явцын тоолуур
  useEffect(() => {
    if (phase !== 'recording') return;
    const iv = setInterval(() => {
      setElapsed((Date.now() - startedAt.current) / 1000);
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  /** Бичигчийг зогсоож чөлөөлнө — алдаа гарсан ч дэлгэц унахгүй */
  const releaseRecorder = useCallback(async () => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (!rec) return;
    try {
      if (rec.isRecording) await rec.stop();
    } catch {
      // Аль хэдийн зогссон — цаашид чөлөөлөх нь чухал
    }
    try {
      rec.release();
    } catch {
      // Давхар чөлөөлөлт
    }
  }, []);

  // Дэлгэцээс гарахад бичлэгийг зогсоож, микрофоныг чөлөөлнө
  useEffect(() => {
    return () => {
      void releaseRecorder();
    };
  }, [releaseRecorder]);

  const start = useCallback(async () => {
    setErrorMsg(null);
    setResult(null);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setErrorMsg(
          'Микрофоны зөвшөөрөл олгогдоогүй байна. Тохиргооноос идэвхжүүлнэ үү.'
        );
        setPhase('error');
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await releaseRecorder(); // өмнөх оролдлогын үлдэгдэл

      const rec = new AudioModule.AudioRecorder({});
      recorderRef.current = rec;
      await rec.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      rec.record();

      startedAt.current = Date.now();
      setElapsed(0);
      setPhase('recording');
    } catch {
      void releaseRecorder();
      setErrorMsg('Бичлэг эхлүүлж чадсангүй. Микрофоноо шалгана уу.');
      setPhase('error');
    }
  }, [releaseRecorder]);

  const stop = useCallback(async () => {
    if (phase !== 'recording' || !twister) return;
    const durationSec = (Date.now() - startedAt.current) / 1000;
    setPhase('scoring');

    const rec = recorderRef.current;
    try {
      if (!rec) throw new Error('Бичигч бэлэн биш');
      await rec.stop();
      const uri = rec.uri;
      if (!uri) throw new Error('Бичлэг олдсонгүй');

      // Аудиог base64 болгож серверт илгээнэ — сервер оноолоод ШУУД устгана.
      // ⚠ `fetch(uri).blob()` БИШ: RN-ийн Blob файлыг native санд хуулаад
      //   буцааж base64 болгодог тул удаан (анхааруулга ч өгдөг). Файлын
      //   системээс шууд уншина.
      const audioBase64 = await new File(uri).base64();

      const score = await scoreVoice({
        twisterId: twister.id,
        durationSec,
        audioBase64,
      });
      setResult(score);
      setPhase('scored');
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : 'Оноолт хийж чадсангүй. Дахин оролдоно уу.'
      );
      setPhase('error');
    } finally {
      // Оноолт амжилттай ч, алдаатай ч микрофоныг чөлөөлнө
      void releaseRecorder();
    }
  }, [phase, twister, releaseRecorder]);

  function next() {
    setIndex((i) => (i + 1) % Math.max(1, twisters.length));
    setPhase('ready');
    setResult(null);
    setErrorMsg(null);
  }

  if (isLoading) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ padding: spacing.md }}>
          <Skeleton height={40} />
          <Skeleton height={120} />
        </View>
      </View>
    );
  }

  if (isError || !twister) {
    return (
      <View style={[styles.flex, styles.center, { paddingTop: insets.top }]}>
        <ErrorState
          title="Түргэн хэллэг ачаалж чадсангүй"
          message="Сүлжээгээ шалгаад дахин оролдоно уу."
          actionLabel="Дахин оролдох"
          onAction={() => void refetch()}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + spacing.md },
      ]}>
      <Text style={styles.title}>🎤 Түргэн хэллэг</Text>
      <Text style={styles.subtitle}>
        Чанга, тодорхой уншаарай. Энэ бол тэнцэх/унах шалгалт биш — зүгээр л
        хөгжилтэй оноо.
      </Text>

      <Card>
        <Text style={styles.twister}>{twister.text}</Text>
        <Text style={styles.hint}>
          Хэвийн хэмнэл: {twister.minSeconds}–{twister.maxSeconds} секунд
        </Text>
      </Card>

      {phase === 'ready' && (
        <PrimaryButton title="Эхэлье 🎙️" onPress={() => void start()} />
      )}

      {phase === 'recording' && (
        <View style={styles.recordingBox}>
          <View style={styles.pulse}>
            <Text style={{ fontSize: 40 }}>🎙️</Text>
          </View>
          <Text style={styles.recordingNote}>
            Бичиж байна… {elapsed.toFixed(1)} сек
          </Text>
          <PrimaryButton title="Дууслаа" onPress={() => void stop()} />
        </View>
      )}

      {phase === 'scoring' && (
        <Card style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.scoringText}>Дуудлагыг шинжилж байна…</Text>
          <ProgressBar progress={0.6} />
        </Card>
      )}

      {phase === 'error' && (
        <Card>
          <ErrorState
            emoji="🎙️"
            title="Оноолт боломжгүй"
            message={errorMsg ?? 'Тодорхойгүй алдаа.'}
            actionLabel="Дахин оролдох"
            onAction={() => setPhase('ready')}
          />
        </Card>
      )}

      {phase === 'scored' && result && (
        <Card style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{result.score}/100</Text>
          <ProgressBar progress={result.score / 100} />
          <Text style={styles.feedback}>{result.feedback}</Text>

          <View style={styles.breakdown}>
            <Detail label="Дуудлага" value={result.confidenceScore} />
            <Detail label="Хэмнэл" value={result.pacingScore} />
            <Detail label="Хугацаа" value={result.durationScore} />
          </View>

          <Text style={styles.detail}>
            ⏱ {result.durationSec.toFixed(1)} сек
            {result.audioDiscarded ? ' · 🔒 Бичлэг устгагдсан' : ''}
          </Text>

          <PrimaryButton title="Дараагийн хэллэг →" onPress={next} />
        </Card>
      )}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.detailValue}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
  container: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '900', fontFamily: fontFamily.display, },
  subtitle: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 19 },
  twister: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 28,
    textAlign: 'center',
  },
  hint: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  recordingBox: { alignItems: 'center', gap: spacing.md },
  pulse: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgCardLight,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingNote: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  scoringText: { color: colors.textMuted, fontSize: fontSize.sm },
  scoreCard: { alignItems: 'center', gap: spacing.md },
  scoreValue: { color: colors.primary, fontSize: 44, fontWeight: '900' },
  feedback: { color: colors.text, fontSize: fontSize.md, textAlign: 'center' },
  breakdown: { flexDirection: 'row', alignSelf: 'stretch' },
  detailValue: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  detailLabel: { color: colors.textMuted, fontSize: fontSize.sm - 2 },
  detail: { color: colors.textMuted, fontSize: fontSize.sm - 1 },
});
