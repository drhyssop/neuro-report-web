'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { SensorySection } from './SensorySection';
import { DermatomePain } from './DermatomePain';
import { DtrRow } from './DtrRow';
import { PathologicSignsSection } from './PathologicSignsSection';
import { CollapsibleSection } from './CollapsibleSection';
import { dtrStatus, sensoryStatus } from '@/lib/services/examStatus';
import type { ThoracicExam, Bilateral, DtrGrade, PathologicSigns } from '@/types/domain';
import type { DermatomePainEntry } from '@/types/domainV2';

interface Props {
  value: ThoracicExam;
  yesterday?: ThoracicExam;
  onChange: (next: ThoracicExam) => void;
  /** 마운트 자동채움 전용 콜백 — 회진 확인(reviewed)으로 치지 않음 */
  onAutoInit?: (next: ThoracicExam) => void;
  /** 오늘 증상 모드에서 History 칸 숨김 (baseline 모드에서는 표시) */
  hideHistory?: boolean;
  dailyExtras?: ReactNode;
  collapsibleNeuro?: boolean;
}

export function ThoracicForm({ value, yesterday, onChange, onAutoInit, dailyExtras, collapsibleNeuro, hideHistory }: Props) {
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    if (!value.dtr) {
      (onAutoInit ?? onChange)({ ...value, dtr: { lt: 2, rt: 2 } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(p: Partial<ThoracicExam>) {
    onChange({ ...value, ...p });
  }

  const painEntries = (value.sensoryPain ?? []) as DermatomePainEntry[];

  return (
    <div className="space-y-4">
      {!hideHistory && (
      <Section title="History">
        <textarea
          value={value.hx ?? ''}
          onChange={(e) => patch({ hx: e.target.value })}
          placeholder="주호소, 통증 양상, 발현 시점 등"
          rows={2}
          className={textareaCls}
        />
      </Section>
      )}

      {dailyExtras}

      <Section title="Dermatome pain">
        <DermatomePain
          region="thoracic"
          entries={painEntries}
          onChange={(entries) => onChange({ ...value, sensoryPain: entries })}
        />
      </Section>

      <CollapsibleSection
        title="DTR (thoracic — 기본 2+)"
        collapsible={collapsibleNeuro}
        isNormal={dtrStatus('thoracic', value).normal}
        summary={dtrStatus('thoracic', value).summary}
      >
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          <span />
          <span>Rt</span>
          <span>Lt</span>
        </div>
        <DtrRow
          label="DTR"
          value={value.dtr as Bilateral<DtrGrade> | undefined}
          onChange={(v) => patch({ dtr: v })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Sensory status (dermatome별 hypesthesia 등)"
        collapsible={collapsibleNeuro}
        isNormal={sensoryStatus('thoracic', value).normal}
        summary={sensoryStatus('thoracic', value).summary}
      >
        <SensorySection
          region="thoracic"
          value={value.sensory}
          yesterday={yesterday?.sensory}
          onChange={(v) => onChange({ ...value, sensory: v })}
        />
      </CollapsibleSection>

      <Section title="Pathologic signs">
        <PathologicSignsSection
          value={value.pathologicSigns}
          onChange={(p: PathologicSigns) => patch({ pathologicSigns: p })}
        />
      </Section>
    </div>
  );
}

const textareaCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}
