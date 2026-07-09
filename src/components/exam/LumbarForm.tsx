'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { BilateralRow } from './BilateralRow';
import { SensorySection } from './SensorySection';
import { DermatomePain } from './DermatomePain';
import { DtrRow } from './DtrRow';
import { PathologicSignsSection } from './PathologicSignsSection';
import { PainBox } from './PainBox';
import { CollapsibleSection } from './CollapsibleSection';
import { MOTOR_GROUPS, DTR_GROUPS } from '@/lib/constants/regions';
import { motorStatus, dtrStatus, sensoryStatus } from '@/lib/services/examStatus';
import type { LumbarExam, Bilateral, MotorGrade, DtrGrade, PathologicSigns } from '@/types/domain';
import type { DermatomePainEntry } from '@/types/domainV2';

interface Props {
  value: LumbarExam;
  yesterday?: LumbarExam;
  onChange: (next: LumbarExam) => void;
  /** 마운트 자동채움 전용 콜백 — 회진 확인(reviewed)으로 치지 않음 */
  onAutoInit?: (next: LumbarExam) => void;
  /** 오늘 증상 모드에서 History 칸 숨김 (baseline 모드에서는 표시) */
  hideHistory?: boolean;
  dailyExtras?: ReactNode;
  /** intact일 때 motor/dtr/sensory 섹션 접기 활성화 */
  collapsibleNeuro?: boolean;
}

export function LumbarForm({ value, yesterday, onChange, onAutoInit, dailyExtras, collapsibleNeuro, hideHistory }: Props) {
  // 첫 마운트 시 motor/dtr이 완전히 비어있으면 기본값(motor 5/5, DTR 2+) 자동 채움
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const motorEmpty = !value.motor || Object.keys(value.motor).length === 0;
    const dtrEmpty = !value.dtr || Object.keys(value.dtr).length === 0;

    if (motorEmpty || dtrEmpty) {
      const next: LumbarExam = { ...value };
      if (motorEmpty) {
        const defaultMotor: Record<string, Bilateral<MotorGrade>> = {};
        for (const m of MOTOR_GROUPS.lumbar) {
          defaultMotor[m.key] = { lt: 5, rt: 5 };
        }
        next.motor = defaultMotor as LumbarExam['motor'];
      }
      if (dtrEmpty) {
        const defaultDtr: Record<string, Bilateral<DtrGrade>> = {};
        for (const d of DTR_GROUPS.lumbar) {
          defaultDtr[d.key] = { lt: 2, rt: 2 };
        }
        next.dtr = defaultDtr as LumbarExam['dtr'];
      }
      (onAutoInit ?? onChange)(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(p: Partial<LumbarExam>) {
    onChange({ ...value, ...p });
  }
  function patchMotor(key: string, v: Bilateral<MotorGrade>) {
    onChange({ ...value, motor: { ...(value.motor ?? {}), [key]: v } });
  }
  function patchDtr(key: string, v: Bilateral<DtrGrade>) {
    onChange({ ...value, dtr: { ...(value.dtr ?? {}), [key]: v } });
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

      <Section title="Pain">
        <div className="space-y-2">
          <PainBox
            title="Back pain"
            active={!!value.backPain}
            onActiveChange={(v) =>
              patch({
                backPain: v || undefined,
                mainPain: !v && value.mainPain === 'back' ? null : value.mainPain,
              })
            }
            vas={value.backVas ?? null}
            onVasChange={(v) => patch({ backVas: v })}
            isMain={value.mainPain === 'back'}
            onMainChange={(next) => patch({ mainPain: next ? 'back' : null })}
          />
          <PainBox
            title="Radicular pain"
            active={!!value.radicularPain}
            onActiveChange={(v) =>
              patch({
                radicularPain: v || undefined,
                mainPain: !v && value.mainPain === 'radicular' ? null : value.mainPain,
              })
            }
            vas={value.radicularVas ?? null}
            onVasChange={(v) => patch({ radicularVas: v })}
            isMain={value.mainPain === 'radicular'}
            onMainChange={(next) => patch({ mainPain: next ? 'radicular' : null })}
          />
          <label className="flex items-center gap-2 text-xs dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!value.nic}
              onChange={(e) => patch({ nic: e.target.checked || undefined })}
            />
            NIC (Neurogenic Intermittent Claudication)
          </label>
        </div>
      </Section>

      <Section title="Radicular pain location (Dermatome)">
        <DermatomePain
          region="lumbar"
          entries={painEntries}
          onChange={(entries) => onChange({ ...value, sensoryPain: entries })}
          dominance={value.radicularDominance}
          onDominanceChange={(d) => onChange({ ...value, radicularDominance: d })}
        />
      </Section>

      <CollapsibleSection
        title="Motor power (기본 5/5)"
        collapsible={collapsibleNeuro}
        isNormal={motorStatus('lumbar', value).normal}
        summary={motorStatus('lumbar', value).summary}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MOTOR_GROUPS.lumbar.map((m) => (
            <BilateralRow
              key={m.key}
              label={m.label}
              myotome={m.myotome}
              value={value.motor?.[m.key as keyof typeof value.motor] ?? undefined}
              yesterday={yesterday?.motor?.[m.key as keyof typeof value.motor] ?? undefined}
              onChange={(v) => patchMotor(m.key, v)}
            />
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="DTR (기본 2+)"
        collapsible={collapsibleNeuro}
        isNormal={dtrStatus('lumbar', value).normal}
        summary={dtrStatus('lumbar', value).summary}
      >
        <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          <span />
          <span>Rt</span>
          <span>Lt</span>
        </div>
        {DTR_GROUPS.lumbar.map((d) => (
          <DtrRow
            key={d.key}
            label={d.label}
            value={value.dtr?.[d.key as keyof typeof value.dtr] ?? undefined}
            onChange={(v) => patchDtr(d.key, v)}
          />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Sensory status (dermatome별 hypesthesia 등)"
        collapsible={collapsibleNeuro}
        isNormal={sensoryStatus('lumbar', value).normal}
        summary={sensoryStatus('lumbar', value).summary}
      >
        <SensorySection
          region="lumbar"
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

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

const textareaCls = inputCls;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}
