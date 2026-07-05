'use client';

import { useMemo } from 'react';
import { detectChanges, describeChanges } from '@/lib/services/diffDetector';
import type { ExamRegions } from '@/types/domain';

interface Props {
  baseline: ExamRegions | null;
  yesterday: ExamRegions | null;
  today: ExamRegions;
  /** 추이 페이지 링크 — 있으면 배너 우측 상단에 '추이' 버튼 표시 */
  trendHref?: string;
}

/**
 * 오늘 증상 위에 표시되는 변화 양상 배너.
 * - 기존(baseline) 대비 변화
 * - 어제(yesterday) 대비 변화
 * 둘 다 변화 없으면 "변화 없음" 표시.
 */
export function ChangeBanner({ baseline, yesterday, today, trendHref }: Props) {
  const vsBaseline = useMemo(
    () => (baseline ? describeChanges(detectChanges(baseline, today)) : null),
    [baseline, today],
  );
  const vsYesterday = useMemo(
    () => (yesterday ? describeChanges(detectChanges(yesterday, today)) : null),
    [yesterday, today],
  );

  const baselineHasChange =
    vsBaseline && (vsBaseline.worsened.length > 0 || vsBaseline.improved.length > 0);
  const yesterdayHasChange =
    vsYesterday && (vsYesterday.worsened.length > 0 || vsYesterday.improved.length > 0);

  return (
    <div className="relative space-y-2 rounded-md border border-slate-200 bg-white p-3 pr-16 text-xs dark:border-slate-700 dark:bg-slate-900">
      {trendHref && (
        <a
          href={trendHref}
          className="absolute right-2 top-2 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          추이 →
        </a>
      )}
      {/* 기존 대비 */}
      <div>
        <span className="font-medium text-slate-500 dark:text-slate-400">기존 대비: </span>
        {!baseline ? (
          <span className="text-slate-400">기존 증상 미입력</span>
        ) : !baselineHasChange ? (
          <span className="text-slate-400 dark:text-slate-500">변화 없음</span>
        ) : (
          <ChangeBits worsened={vsBaseline!.worsened} improved={vsBaseline!.improved} />
        )}
      </div>

      {/* 어제 대비 */}
      <div>
        <span className="font-medium text-slate-500 dark:text-slate-400">어제 대비: </span>
        {!yesterday ? (
          <span className="text-slate-400">이전 기록 없음</span>
        ) : !yesterdayHasChange ? (
          <span className="text-slate-400 dark:text-slate-500">변화 없음</span>
        ) : (
          <ChangeBits worsened={vsYesterday!.worsened} improved={vsYesterday!.improved} />
        )}
      </div>
    </div>
  );
}

function ChangeBits({ worsened, improved }: { worsened: string[]; improved: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {improved.map((t, i) => (
        <span
          key={`i${i}`}
          className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        >
          ▲ {t}
        </span>
      ))}
      {worsened.map((t, i) => (
        <span
          key={`w${i}`}
          className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          ▼ {t}
        </span>
      ))}
    </span>
  );
}
