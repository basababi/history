/**
 * OG зураг — хуваалцсан линкийн карт (Satori → PNG)
 *
 * Messenger-т линк дангаараа биш, ЗУРАГТАЙ карт болж харагдана. Карт нь
 * «Бат 4/5 авсан» гэдгийг нээхээс ӨМНӨ хэлдэг тул дарах магадлал хамгийн
 * их нөлөөлөх цэг.
 *
 * ⚠ ФОНТ: Unbounded-д Ө, Ү үсэг БАЙХГҮЙ (дөрвөлжин болж гардаг) — тиймээс
 *   монгол кириллийг бүрэн дэмждэг Montserrat-ыг ашиглана. Satori нь
 *   фонтгүй тэмдэгтийг ХООСОН зурдаг тул энэ нь заавал.
 * ⚠ Satori-д div бүр олон хүүхэдтэй бол `display: flex` заавал. JSX-ийн
 *   `/{n}` нь ХОЁР текст хүүхэд болдог, ТОО хүүхэд (`{4}`) текст гэж танигддаггүй —
 *   текстийг үргэлж НЭГ мөр (template string / String()) болгоно.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import React from 'react';

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const STORY_SIZE = { width: 1080, height: 1920 } as const;

const C = {
  bg: '#080E18',
  card1: '#162238',
  card2: '#0B1322',
  gold: '#DDB058',
  goldLight: '#F5D38A',
  teal: '#2FD2C5',
  coral: '#E65C3E',
  text: '#F8F5EE',
  muted: '#9BB2CD',
  line: 'rgba(221, 176, 88, 0.55)',
} as const;

type FontSpec = { name: string; data: ArrayBuffer; weight: 600 | 800; style: 'normal' };

let fontsPromise: Promise<FontSpec[]> | null = null;

/** Фонтыг нэг удаа уншиж кэшлэнэ */
export function loadOgFonts(): Promise<FontSpec[]> {
  if (!fontsPromise) {
    const dir = path.join(process.cwd(), 'assets', 'fonts');
    const read = async (file: string) => {
      const buf = await readFile(path.join(dir, file));
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    };
    fontsPromise = Promise.all([read('Montserrat_600SemiBold.ttf'), read('Montserrat_800ExtraBold.ttf')]).then(
      ([semi, extra]) => [
        { name: 'Montserrat', data: semi, weight: 600, style: 'normal' },
        { name: 'Montserrat', data: extra, weight: 800, style: 'normal' },
      ]
    );
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

// ─── Хэсгүүд ───

/** Өлзий хээ — брэндийн тэмдэг (апп дахь `Ulzii`-тэй ижил зам) */
function Ulzii({ size, color = C.gold }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <g fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 30 H80 V50 H60 V70 H80 V90 H40 V70 H60 V50 H40 Z" />
        <path d="M30 40 V80 M90 40 V80" />
        <path d="M30 40 H50 M70 40 H90 M30 80 H50 M70 80 H90" />
      </g>
    </svg>
  );
}

function Marks({ marks, total, size }: { marks: boolean[]; total: number; size: number }) {
  return (
    <div style={{ display: 'flex', gap: size * 0.28 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < marks.length;
        const ok = marks[i] === true;
        return (
          <div
            key={i}
            style={{
              width: size,
              height: size,
              borderRadius: size * 0.22,
              backgroundColor: ok ? C.gold : 'transparent',
              border: `${Math.max(3, size * 0.07)}px solid ${ok ? C.gold : done ? C.coral : C.line}`,
            }}
          />
        );
      })}
    </div>
  );
}

function Frame({ children, width, height }: { children: React.ReactNode; width: number; height: number }) {
  const inset = Math.round(width * 0.022);
  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        backgroundColor: C.bg,
        backgroundImage: `radial-gradient(circle at 30% 20%, ${C.card1} 0%, ${C.card2} 55%, ${C.bg} 100%)`,
        fontFamily: 'Montserrat',
        color: C.text,
        padding: inset,
      }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          border: `3px solid ${C.line}`,
          borderRadius: inset * 1.2,
          padding: inset * 1.6,
        }}>
        {children}
      </div>
    </div>
  );
}

function Brand({ scale = 1, right }: { scale?: number; right?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
        <Ulzii size={54 * scale} />
        <div style={{ fontSize: 34 * scale, fontWeight: 800, color: C.gold, letterSpacing: 6 * scale }}>
          ЭРТНИЙ ӨВ
        </div>
      </div>
      {right ? (
        <div style={{ fontSize: 28 * scale, fontWeight: 800, color: C.teal, letterSpacing: 3 * scale }}>{right}</div>
      ) : null}
    </div>
  );
}

function Cta({ label, scale = 1 }: { label: string; scale?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${16 * scale}px ${34 * scale}px`,
        borderRadius: 999,
        backgroundImage: `linear-gradient(180deg, ${C.goldLight}, #B58728)`,
        color: '#0C0A04',
        fontSize: 30 * scale,
        fontWeight: 800,
      }}>
      {label}
    </div>
  );
}

// ─── Картууд ───

export interface ChallengeCardData {
  dayNumber: number;
  name: string;
  title: string;
  correct: number;
  total: number;
  timeText: string;
  marks: boolean[];
}

export function ChallengeCard({ d }: { d: ChallengeCardData }) {
  return (
    <Frame {...OG_SIZE}>
      <Brand right={`ӨДРИЙН ТАВ #${d.dayNumber}`} />
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 196, fontWeight: 800, color: C.gold, lineHeight: 1 }}>{String(d.correct)}</div>
            <div style={{ fontSize: 96, fontWeight: 800, color: C.muted, lineHeight: 1.2 }}>{`/${d.total}`}</div>
          </div>
          <div style={{ fontSize: 40, fontWeight: 600, color: C.text, marginTop: 8 }}>{d.timeText}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 30 }}>
          <Marks marks={d.marks} total={d.total} size={64} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 46, fontWeight: 800 }}>{d.name}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: C.teal }}>{d.title}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 26, fontWeight: 600, color: C.muted }}>Монголын түүх · домог · зүйр үг</div>
        <Cta label="Чи давж чадах уу?" />
      </div>
    </Frame>
  );
}

export function ChallengeStory({ d }: { d: ChallengeCardData }) {
  const s = 1.6;
  return (
    <Frame {...STORY_SIZE}>
      <Brand scale={1.25} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 44,
        }}>
        <div style={{ fontSize: 40 * s * 0.8, fontWeight: 800, color: C.teal, letterSpacing: 6 }}>
          {`ӨДРИЙН ТАВ #${d.dayNumber}`}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 300, fontWeight: 800, color: C.gold, lineHeight: 1 }}>{String(d.correct)}</div>
          <div style={{ fontSize: 150, fontWeight: 800, color: C.muted, lineHeight: 1.2 }}>{`/${d.total}`}</div>
        </div>
        <Marks marks={d.marks} total={d.total} size={110} />
        <div style={{ fontSize: 60, fontWeight: 600 }}>{d.timeText}</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 76, fontWeight: 800 }}>{d.name}</div>
          <div style={{ fontSize: 44, fontWeight: 600, color: C.teal }}>{d.title}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
        <Cta label="Чи давж чадах уу?" scale={1.5} />
        <div style={{ fontSize: 34, fontWeight: 600, color: C.muted }}>Монголын түүх · домог · зүйр үг</div>
      </div>
    </Frame>
  );
}

export function GroupCard({ name, members }: { name: string; members: number }) {
  return (
    <Frame {...OG_SIZE}>
      <Brand right="НАЙЗЫН БҮЛЭГ" />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 18 }}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.muted }}>Урилга</div>
        <div style={{ fontSize: 84, fontWeight: 800, color: C.gold, lineHeight: 1.05 }}>{name}</div>
        <div style={{ fontSize: 36, fontWeight: 600 }}>{`${members} гишүүн · өдөр бүр 5 асуулт`}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Cta label="Бүлэгт нэгдэх" />
      </div>
    </Frame>
  );
}

export function BrandCard() {
  return (
    <Frame {...OG_SIZE}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 34 }}>
        <Ulzii size={150} />
        <div style={{ fontSize: 96, fontWeight: 800, color: C.gold, letterSpacing: 12 }}>ЭРТНИЙ ӨВ</div>
        <div style={{ fontSize: 40, fontWeight: 600 }}>Өдөр бүр 5 асуулт. Найзаа сорь.</div>
        <Marks marks={[true, true, false, true, true]} total={5} size={46} />
      </div>
    </Frame>
  );
}
