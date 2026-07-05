'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { BilateralRow } from './BilateralRow';
import { PathologicSignsSection } from './PathologicSignsSection';
import { CollapsibleSection } from './CollapsibleSection';
import { motorStatus, sensoryStatus } from '@/lib/services/examStatus';
import { cn } from '@/lib/utils/cn';
import type { BrainExam, Bilateral, MotorGrade, PathologicSigns } from '@/types/domain';

interface Props {
  value: BrainExam;
  yesterday?: BrainExam;
  onChange: (next: BrainExam) => void;
  /** 마운트 자동채움 전용 콜백 — 회진 확인(reviewed)으로 치지 않음 */
  onAutoInit?: (next: BrainExam) => void;
  /** 오늘 증상 모드에서 History 칸 숨김 (baseline 모드에서는 표시) */
  hideHistory?: boolean;
  dailyExtras?: ReactNode;
  collapsibleNeuro?: boolean;
}

const GCS_E = [
  { v: 4, label: 'Spontaneous' },
  { v: 3, label: 'To voice' },
  { v: 2, label: 'To pain' },
  { v: 1, label: 'None' },
];
const GCS_V = [
  { v: 5, label: 'Oriented' },
  { v: 4, label: 'Confused' },
  { v: 3, label: 'Inappropriate' },
  { v: 2, label: 'Sounds' },
  { v: 1, label: 'None' },
];
const GCS_M = [
  { v: 6, label: 'Obeys' },
  { v: 5, label: 'Localizes' },
  { v: 4, label: 'Withdraws' },
  { v: 3, label: 'Flexion' },
  { v: 2, label: 'Extension' },
  { v: 1, label: 'None' },
];

export function BrainForm({ value, yesterday, onChange, onAutoInit, dailyExtras, collapsibleNeuro, hideHistory }: Props) {
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const next: BrainExam = { ...value };
    let changed = false;
    if (!value.motorUpper) {
      next.motorUpper = { lt: 5, rt: 5 };
      changed = true;
    }
    if (!value.motorLower) {
      next.motorLower = { lt: 5, rt: 5 };
      changed = true;
    }
    if (changed) (onAutoInit ?? onChange)(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(p: Partial<BrainExam>) {
    onChange({ ...value, ...p });
  }

  const gcsSum =
    value.gcsE != null && value.gcsV != null && value.gcsM != null
      ? value.gcsE + value.gcsV + value.gcsM
      : null;

  return (
    <div className="space-y-4">
      {!hideHistory && (
      <Section title="History">
        <textarea
          value={value.hx ?? ''}
          onChange={(e) => patch({ hx: e.target.value })}
          placeholder="주호소, 발현 시점, 동반 증상"
          rows={2}
          className={inputCls}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            value={value.medication ?? ''}
            onChange={(e) => patch({ medication: e.target.value })}
            placeholder="복용약물"
            className={inputCls}
          />
          <input
            value={value.onset ?? ''}
            onChange={(e) => patch({ onset: e.target.value })}
            placeholder="Onset 시간"
            className={inputCls}
          />
        </div>
      </Section>
      )}

      {dailyExtras}

      <Section title="Mental status">
        <PillGroup
          options={[
            { value: 'alert', label: 'Alert', tone: 'good' },
            { value: 'drowsy', label: 'Drowsy', tone: 'warn' },
            { value: 'stupor', label: 'Stupor', tone: 'warn' },
            { value: 'semicoma', label: 'Semicoma', tone: 'bad' },
            { value: 'coma', label: 'Coma', tone: 'bad' },
          ]}
          value={value.mentalStatus ?? null}
          onChange={(v) => patch({ mentalStatus: v as BrainExam['mentalStatus'] })}
        />
      </Section>

      <Section title={`GCS${gcsSum != null ? ` — Total ${gcsSum}/15` : ''}`}>
        <div className="space-y-3">
          <GcsRow label="E (Eye opening)" options={GCS_E} value={value.gcsE} onChange={(v) => patch({ gcsE: v as BrainExam['gcsE'] })} />
          <GcsRow label="V (Verbal)" options={GCS_V} value={value.gcsV} onChange={(v) => patch({ gcsV: v as BrainExam['gcsV'] })} />
          <GcsRow label="M (Motor)" options={GCS_M} value={value.gcsM} onChange={(v) => patch({ gcsM: v as BrainExam['gcsM'] })} />
          {gcsSum != null && (
            <div
              className={cn(
                'mt-2 rounded-md border p-2 text-center text-sm font-medium',
                gcsSum >= 13
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : gcsSum >= 9
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
              )}
            >
              GCS Total: {gcsSum}/15
              {gcsSum >= 13 && ' (Mild)'}
              {gcsSum >= 9 && gcsSum <= 12 && ' (Moderate)'}
              {gcsSum <= 8 && ' (Severe)'}
            </div>
          )}
        </div>
      </Section>

      <Section title="Pupil">
        <div className="space-y-2">
          <PupilRow
            label="Rt"
            value={value.pupil?.rt}
            onChange={(v) => patch({ pupil: { lt: value.pupil?.lt ?? {}, rt: v } })}
          />
          <PupilRow
            label="Lt"
            value={value.pupil?.lt}
            onChange={(v) => patch({ pupil: { lt: v, rt: value.pupil?.rt ?? {} } })}
          />
        </div>
      </Section>

      <Section title="EOM (안구운동)">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">Rt</div>
            <PillGroup
              options={[
                { value: 'full', label: 'Full', tone: 'good' },
                { value: 'limited', label: 'Limited', tone: 'warn' },
                { value: 'fixed', label: 'Fixed', tone: 'bad' },
              ]}
              value={value.eom?.rt ?? null}
              onChange={(v) =>
                patch({ eom: { lt: value.eom?.lt ?? null, rt: v as 'full' | 'limited' | 'fixed' | null } })
              }
            />
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500 dark:text-slate-400">Lt</div>
            <PillGroup
              options={[
                { value: 'full', label: 'Full', tone: 'good' },
                { value: 'limited', label: 'Limited', tone: 'warn' },
                { value: 'fixed', label: 'Fixed', tone: 'bad' },
              ]}
              value={value.eom?.lt ?? null}
              onChange={(v) =>
                patch({ eom: { lt: v as 'full' | 'limited' | 'fixed' | null, rt: value.eom?.rt ?? null } })
              }
            />
          </div>
        </div>
      </Section>

      <Section title="Facial / Speech">
        <Label>Facial</Label>
        <PillGroup
          options={[
            { value: 'symmetric', label: 'Symmetric', tone: 'good' },
            { value: 'central-palsy', label: 'Central palsy', tone: 'warn' },
            { value: 'peripheral-palsy', label: 'Peripheral palsy', tone: 'warn' },
          ]}
          value={value.facial ?? null}
          onChange={(v) => patch({ facial: v as BrainExam['facial'] })}
        />

        <Label className="mt-3">Aphasia</Label>
        <PillGroup
          options={[
            { value: 'none', label: 'None', tone: 'good' },
            { value: 'motor', label: 'Motor', tone: 'warn' },
            { value: 'sensory', label: 'Sensory', tone: 'warn' },
            { value: 'global', label: 'Global', tone: 'bad' },
          ]}
          value={value.aphasia ?? null}
          onChange={(v) => patch({ aphasia: v as BrainExam['aphasia'] })}
        />

        <Label className="mt-3">Dysarthria</Label>
        <PillGroup
          options={[
            { value: 'none', label: 'None', tone: 'good' },
            { value: 'mild', label: 'Mild', tone: 'warn' },
            { value: 'severe', label: 'Severe', tone: 'bad' },
          ]}
          value={value.dysarthria ?? null}
          onChange={(v) => patch({ dysarthria: v as BrainExam['dysarthria'] })}
        />
      </Section>

      <CollapsibleSection
        title="Sensory (전반적)"
        collapsible={collapsibleNeuro}
        isNormal={sensoryStatus('brain', value).normal}
        summary={sensoryStatus('brain', value).summary}
      >
        <PillGroup
          options={[
            { value: 'intact', label: 'Intact', tone: 'good' },
            { value: 'hyper', label: 'Hyperesthesia', tone: 'warn' },
            { value: 'hypo', label: 'Hypoesthesia', tone: 'bad' },
          ]}
          value={value.sensory ?? null}
          onChange={(v) => patch({ sensory: v as BrainExam['sensory'] })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Motor power (기본 5/5)"
        collapsible={collapsibleNeuro}
        isNormal={motorStatus('brain', value).normal}
        summary={motorStatus('brain', value).summary}
      >
        <BilateralRow
          label="Upper extremity"
          value={value.motorUpper}
          yesterday={yesterday?.motorUpper}
          onChange={(v: Bilateral<MotorGrade>) => patch({ motorUpper: v })}
        />
        <div className="h-2" />
        <BilateralRow
          label="Lower extremity"
          value={value.motorLower}
          yesterday={yesterday?.motorLower}
          onChange={(v: Bilateral<MotorGrade>) => patch({ motorLower: v })}
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

function GcsRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: number; label: string }[];
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const selected = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(selected ? null : o.v)}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px]',
                selected
                  ? 'border-slate-700 bg-slate-900 text-white dark:border-slate-300 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
              )}
            >
              {o.v}. {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

function PupilRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: { size?: number; reactivity?: 'prompt' | 'sluggish' | 'fixed' | null };
  onChange: (v: { size?: number; reactivity?: 'prompt' | 'sluggish' | 'fixed' | null }) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        max={10}
        step={0.5}
        value={value?.size ?? ''}
        onChange={(e) =>
          onChange({ ...value, size: e.target.value === '' ? undefined : parseFloat(e.target.value) })
        }
        placeholder="size (mm)"
        className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
      <PillGroup
        compact
        options={[
          { value: 'prompt', label: 'Prompt', tone: 'good' },
          { value: 'sluggish', label: 'Sluggish', tone: 'warn' },
          { value: 'fixed', label: 'Fixed', tone: 'bad' },
        ]}
        value={value?.reactivity ?? null}
        onChange={(v) => onChange({ ...value, reactivity: v as 'prompt' | 'sluggish' | 'fixed' | null })}
      />
    </div>
  );
}

function PillGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: { value: string; label: string; tone: 'good' | 'warn' | 'bad' }[];
  value: string | null;
  onChange: (v: string | null) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(selected ? null : o.value)}
            className={cn(
              'rounded-md border text-xs transition',
              compact ? 'px-2 py-0.5' : 'px-3 py-1',
              selected
                ? toneColor(o.tone)
                : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function toneColor(tone: 'good' | 'warn' | 'bad'): string {
  switch (tone) {
    case 'good':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300';
    case 'warn':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300';
    case 'bad':
      return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300';
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-1 text-xs text-slate-500 dark:text-slate-400', className)}>{children}</div>;
}
