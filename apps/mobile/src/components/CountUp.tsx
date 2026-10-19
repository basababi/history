/**
 * XP тоологч — тоо өсөж тоологдоно (ROADMAP A2)
 *
 * ЯАГААД: «+15 XP» гэж шууд гарах нь мэдрэгдэхгүй. Тоо өсөж тоологдох нь
 * ялалтыг СУНГАЖ, анзаарагдам болгоно — Duolingo-гийн үндсэн заль.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { isReduceMotion } from './motion';

export function CountUp({
  value,
  duration = 700,
  prefix = '',
  suffix = '',
  style,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState(isReduceMotion() ? value : 0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isReduceMotion() || duration <= 0) {
      setShown(value);
      return;
    }

    const startedAt = Date.now();
    const from = 0;

    raf.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - startedAt) / duration);
      // easeOutCubic — эхэндээ хурдан, төгсгөлд удаан
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));
      if (t >= 1 && raf.current) {
        clearInterval(raf.current);
        raf.current = null;
      }
    }, 32);

    return () => {
      if (raf.current) clearInterval(raf.current);
      raf.current = null;
    };
  }, [value, duration]);

  return (
    <Text style={style} accessibilityLabel={`${prefix}${value}${suffix}`}>
      {prefix}
      {shown}
      {suffix}
    </Text>
  );
}
