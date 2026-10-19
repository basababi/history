/**
 * Хуваалцах блок — дүнгийн дэлгэцийн хамгийн чухал хэсэг
 *
 *   [ Найзаа сорих ]            ← гол үйлдэл: Messenger/Instagram жагсаалт
 *   [ Story ]   [ Линк хуулах ]
 *
 * Нэргүй зочин дарвал эхлээд нэрээ тавина — найз нь «Зочин чамайг сорьж
 * байна» гэж харах нь утгагүй.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { buildShareText } from '@nomad/core';
import { PrimaryButton } from '@/components/ui';
import { celebrateFeedback } from '@/feedback';
import { challengeUrl, copyText, prepareStoryFile, shareLink, shareStoryImage } from '@/lib/share';
import { spacing } from '@/theme';
import { FlashText, SmallButton, useFlash } from './bits';
import { NameSheet } from './NameSheet';

type Pending = 'link' | 'story' | null;

export function ShareActions({
  shareCode,
  dayNumber,
  correct,
  total,
  totalMs,
  marks,
  needsName,
  primaryLabel = 'Найзаа сорих',
}: {
  shareCode: string;
  dayNumber: number;
  correct: number;
  total: number;
  totalMs: number;
  marks: readonly boolean[];
  needsName: boolean;
  primaryLabel?: string;
}) {
  const [named, setNamed] = useState(!needsName);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [message, flash] = useFlash();
  const url = challengeUrl(shareCode);
  const storyFile = useRef<File | null>(null);

  // Story зургийг урьдчилж бэлдэнэ — дарах агшинд шууд хуваалцахын тулд
  useEffect(() => {
    let alive = true;
    void prepareStoryFile(shareCode).then((f) => {
      if (alive) storyFile.current = f;
    });
    return () => {
      alive = false;
    };
  }, [shareCode]);

  async function run(kind: Exclude<Pending, null>) {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'link') {
        const outcome = await shareLink({
          title: 'Эртний Өв · Өдрийн тав',
          text: buildShareText({ dayNumber, correct, total, totalMs, marks, url }),
          url,
        });
        if (outcome === 'shared') {
          celebrateFeedback();
          flash('Илгээгдлээ. Найз чинь тоглоход тулааны дүн энд гарна.');
        } else if (outcome === 'copied') {
          flash('Хуулагдлаа — Messenger, Instagram-д наагаад илгээ.');
        } else if (outcome === 'failed') {
          flash('Хуваалцаж чадсангүй. «Линк хуулах»-ыг оролдоод үз.');
        }
      } else {
        const outcome = await shareStoryImage(shareCode, storyFile.current);
        if (outcome === 'opened') flash('Зураг нээгдлээ — удаан дараад хадгалаарай.');
        else if (outcome === 'failed') flash('Зураг бэлдэж чадсангүй. Дахин оролдоно уу.');
      }
    } finally {
      setBusy(false);
    }
  }

  function start(kind: Exclude<Pending, null>) {
    if (!named) {
      setPending(kind);
      return;
    }
    void run(kind);
  }

  return (
    <View style={styles.wrap}>
      <PrimaryButton title={busy ? 'Бэлдэж байна…' : primaryLabel} onPress={() => start('link')} disabled={busy} />
      <View style={styles.row}>
        <SmallButton label="Story" icon="share" onPress={() => start('story')} disabled={busy} style={styles.flex} />
        <SmallButton
          label="Линк хуулах"
          icon="link"
          disabled={busy}
          style={styles.flex}
          onPress={() => {
            void copyText(url).then((ok) => flash(ok ? 'Линк хуулагдлаа' : 'Хуулж чадсангүй'));
          }}
        />
      </View>
      <FlashText message={message} />

      <NameSheet
        visible={pending !== null}
        reason="Найз чинь хэн сорьж байгааг мэдэх хэрэгтэй. Нэр чинь сорилтын карт дээр гарна."
        onClose={() => setPending(null)}
        onSaved={() => {
          const next = pending;
          setNamed(true);
          setPending(null);
          // ⚠ Вэб: хүлээлтийн дараа хөтөч хуваалцахыг хориглоно — дахин дарахыг хүснэ
          if (Platform.OS === 'web') flash('Нэр хадгалагдлаа. Одоо дахин дарж илгээгээрэй.');
          else if (next) void run(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
