'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { DermatomePainEntry } from '@/types/domainV2';
import type { Region } from '@/types/domain';

interface Props {
  region: Region;
  entries: DermatomePainEntry[];
  onChange: (entries: DermatomePainEntry[]) => void;
  dominance?: 'R>L' | 'L>R';
  onDominanceChange?: (d: 'R>L' | 'L>R' | undefined) => void;
}

const DERMATOMES_BY_REGION: Record<Region, string[]> = {
  brain: [],
  cervical: ['C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'T1'],
  thoracic: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T10', 'T12'],
  lumbar: ['L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3'],
};

/** 참고용 dermatome map 이미지 경로 — public/dermatomes/{region}.png */
const DERMATOME_MAP_SRC: Partial<Record<Region, string>> = {
  cervical: '/dermatomes/cervical.png',
  thoracic: '/dermatomes/thoracic.png',
  lumbar: '/dermatomes/lumbar.png',
};

/**
 * Dermatome pain — Lt/Rt 분리해서 각각 multi-select.
 * 각 side에 자유 메모 (디테일: '무릎부터 발가락까지' 등).
 *
 * 데이터 모델: DermatomePainEntry 한 row = 하나의 side
 *   - side: 'Lt' | 'Rt'
 *   - dermatome: 멀티 선택을 한 entry로 압축 — dermatome 필드는 join된 문자열로 (예: "L4,L5")
 *     (호환을 위해 기존 구조 유지하되 dermatome 필드에 콤마 join)
 *   - note: 자유 메모
 */
export function DermatomePain({ region, entries, onChange, dominance, onDominanceChange }: Props) {
  const dermatomes = DERMATOMES_BY_REGION[region];

  if (dermatomes.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500">
        이 부위는 dermatome pain 입력을 지원하지 않습니다
      </p>
    );
  }

  // entries에서 Lt/Rt 각각 추출 (각 side는 1개 row)
  const ltEntry = entries.find((e) => e.side === 'Lt') ?? null;
  const rtEntry = entries.find((e) => e.side === 'Rt') ?? null;

  function getSelected(side: 'Lt' | 'Rt'): string[] {
    const entry = side === 'Lt' ? ltEntry : rtEntry;
    if (!entry || !entry.dermatome) return [];
    return entry.dermatome.split(',').filter(Boolean);
  }

  function getQualities(side: 'Lt' | 'Rt'): Record<string, 'pain' | 'tingling'> {
    const entry = side === 'Lt' ? ltEntry : rtEntry;
    return entry?.dermatomeQualities ?? {};
  }

  function writeSide(
    side: 'Lt' | 'Rt',
    selected: string[],
    quals: Record<string, 'pain' | 'tingling'>,
    note?: string,
  ) {
    const existing = side === 'Lt' ? ltEntry : rtEntry;
    const others = entries.filter((e) => e.side !== side);
    const noteVal = note ?? existing?.note ?? '';

    // 선택된 dermatome도 없고 메모도 없으면 entry 제거
    if (selected.length === 0 && !noteVal.trim()) {
      onChange(others);
      return;
    }

    // 선택 안 된 dermatome의 quality는 정리
    const cleanQuals: Record<string, 'pain' | 'tingling'> = {};
    for (const d of selected) {
      if (quals[d] === 'tingling') cleanQuals[d] = 'tingling';
      // pain은 기본값이므로 굳이 저장 안 함 (맵을 가볍게 유지)
    }

    const next: DermatomePainEntry = {
      side,
      dermatome: selected.join(','),
      note: noteVal,
      ...(Object.keys(cleanQuals).length > 0 ? { dermatomeQualities: cleanQuals } : {}),
    };
    onChange([...others, next]);
  }

  /**
   * 칩 3단 순환: 안 눌림 → 통증(pain) → 저림(tingling) → 안 눌림
   * dermatome이 처음 선택되면 자동으로 통증 상태가 된다.
   */
  function cycle(side: 'Lt' | 'Rt', d: string) {
    const selected = getSelected(side);
    const quals = { ...getQualities(side) };
    const isSelected = selected.includes(d);
    const current = isSelected ? (quals[d] ?? 'pain') : 'off';

    if (current === 'off') {
      // off → pain
      writeSide(side, [...selected, d], quals);
    } else if (current === 'pain') {
      // pain → tingling
      quals[d] = 'tingling';
      writeSide(side, selected, quals);
    } else {
      // tingling → off
      delete quals[d];
      writeSide(
        side,
        selected.filter((x) => x !== d),
        quals,
      );
    }
  }

  function setNote(side: 'Lt' | 'Rt', note: string) {
    writeSide(side, getSelected(side), getQualities(side), note);
  }

  function clearSide(side: 'Lt' | 'Rt') {
    const others = entries.filter((e) => e.side !== side);
    onChange(others);
  }

  const mapSrc = DERMATOME_MAP_SRC[region];

  return (
    <div className="space-y-3">
      {mapSrc && <DermatomeMapThumb region={region} src={mapSrc} />}
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        칩을 누를 때마다 <span className="font-medium text-slate-600 dark:text-slate-300">통증</span> →{' '}
        <span className="font-medium text-indigo-600 dark:text-indigo-400">저림</span> → 해제 순으로 바뀝니다.
      </p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SidePanel
          side="Rt"
          dermatomes={dermatomes}
          selected={getSelected('Rt')}
          qualities={getQualities('Rt')}
          note={rtEntry?.note ?? ''}
          onCycle={(d) => cycle('Rt', d)}
          onNoteChange={(n) => setNote('Rt', n)}
          onClear={() => clearSide('Rt')}
        />
        <SidePanel
          side="Lt"
          dermatomes={dermatomes}
          selected={getSelected('Lt')}
          qualities={getQualities('Lt')}
          note={ltEntry?.note ?? ''}
          onCycle={(d) => cycle('Lt', d)}
          onNoteChange={(n) => setNote('Lt', n)}
          onClear={() => clearSide('Lt')}
        />
      </div>

      {/* 양측 통증 시 우세측 선택 (both L5 (R>L) 표기용) */}
      {getSelected('Rt').length > 0 && getSelected('Lt').length > 0 && onDominanceChange && (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-700">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">더 심한 쪽:</span>
          {([['R>L', 'Rt 우세'], ['L>R', 'Lt 우세']] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onDominanceChange(dominance === val ? undefined : val)}
              className={
                dominance === val
                  ? 'rounded-md border border-slate-900 bg-slate-900 px-2.5 py-1 text-xs font-medium text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300'
              }
            >
              {label}
            </button>
          ))}
          {dominance && (
            <button
              type="button"
              onClick={() => onDominanceChange(undefined)}
              className="text-[11px] text-slate-400"
            >
              해제 (=)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 우상단에 작게 띄우는 dermatome 분포도 참고 이미지.
 * 클릭하면 새 탭에서 원본 크기로 열림.
 * 이미지 로드 실패 시 자동으로 숨김 (파일이 아직 없는 경우 대비).
 */
function DermatomeMapThumb({ region, src }: { region: Region; src: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="flex items-start justify-end">
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        title={`${region} dermatome 참고도 (클릭 시 크게 보기)`}
        className="group inline-flex flex-col items-end"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`${region} dermatome map`}
          onError={() => setHidden(true)}
          className="h-32 w-auto rounded-md border border-slate-200 bg-white object-contain p-1 transition group-hover:border-slate-400 dark:border-slate-700 dark:bg-slate-100"
        />
        <span className="mt-0.5 text-[9px] text-slate-400 group-hover:text-slate-600 dark:text-slate-500">
          참고 dermatome map (클릭 = 크게)
        </span>
      </a>
    </div>
  );
}

function SidePanel({
  side,
  dermatomes,
  selected,
  qualities,
  note,
  onCycle,
  onNoteChange,
  onClear,
}: {
  side: 'Lt' | 'Rt';
  dermatomes: string[];
  selected: string[];
  qualities: Record<string, 'pain' | 'tingling'>;
  note: string;
  onCycle: (d: string) => void;
  onNoteChange: (n: string) => void;
  onClear: () => void;
}) {
  const hasAny = selected.length > 0 || note.trim().length > 0;
  return (
    <div className="rounded-md border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{side}</span>
        {hasAny && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] text-slate-400 hover:text-red-600 dark:text-slate-500"
          >
            clear
          </button>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {dermatomes.map((d) => {
          const isSel = selected.includes(d);
          const q = isSel ? qualities[d] ?? 'pain' : null;
          return (
            <button
              type="button"
              key={d}
              onClick={() => onCycle(d)}
              title={q === 'tingling' ? '저림' : q === 'pain' ? '통증' : '선택 안 됨'}
              className={cn(
                'rounded-md border px-2 py-1 text-xs transition',
                q === 'pain' &&
                  'border-slate-700 bg-slate-900 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900',
                q === 'tingling' &&
                  'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500',
                !q &&
                  'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {d}
              {q === 'tingling' && <span className="ml-1 text-[9px] opacity-90">저림</span>}
            </button>
          );
        })}
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="자유 메모 (예: 무릎부터 발가락까지, NRS 7/10 등)"
        rows={2}
        className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </div>
  );
}
