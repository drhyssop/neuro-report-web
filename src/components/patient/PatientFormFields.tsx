'use client';

import type { PatientCreate } from '@/lib/schemas/patient';
import { surgeryStatus, computePod } from '@/types/domainV2';
import { cn } from '@/lib/utils/cn';

interface Props {
  value: Partial<PatientCreate>;
  onChange: (next: Partial<PatientCreate>) => void;
  professors?: string[];
}

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500';

export function PatientFormFields({ value, onChange, professors }: Props) {
  function patch(p: Partial<PatientCreate>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className="space-y-4">
      {/* 기본 정보 */}
      <Section title="기본 정보">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="환자 별칭 *">
            <input
              value={value.alias ?? ''}
              onChange={(e) => patch({ alias: e.target.value })}
              placeholder="예: 201호-A"
              required
              className={inputCls}
            />
          </Field>
          <Field label="진단명">
            <input
              value={value.diagnosis ?? ''}
              onChange={(e) => patch({ diagnosis: e.target.value || undefined })}
              placeholder="예: HIVD L4-5"
              className={inputCls}
            />
          </Field>
          <Field label="나이">
            <input
              type="number"
              min={0}
              max={120}
              value={value.age ?? ''}
              onChange={(e) =>
                patch({ age: e.target.value ? parseInt(e.target.value) : undefined })
              }
              className={inputCls}
            />
          </Field>
          <Field label="성별">
            <select
              value={value.sex ?? ''}
              onChange={(e) => patch({ sex: (e.target.value || undefined) as 'M' | 'F' })}
              className={inputCls}
            >
              <option value="">선택…</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </Field>
          <Field label="담당 교수">
            <select
              value={value.professor ?? ''}
              onChange={(e) => patch({ professor: e.target.value || undefined })}
              className={inputCls}
            >
              <option value="">미지정</option>
              {(professors ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="병동 (예: 1013, 926, sb)">
            <input
              value={value.ward ?? ''}
              onChange={(e) => patch({ ward: e.target.value || undefined })}
              placeholder="1013"
              className={inputCls}
            />
          </Field>
          <Field label="자리 (병동 내 위치)">
            <select
              value={value.bed_seat ?? ''}
              onChange={(e) =>
                patch({ bed_seat: e.target.value ? parseInt(e.target.value) : null })
              }
              className={inputCls}
            >
              <option value="">모름 (?)</option>
              <option value="6">6번 자리</option>
              <option value="5">5번 자리</option>
              <option value="4">4번 자리</option>
              <option value="3">3번 자리</option>
              <option value="2">2번 자리</option>
              <option value="1">1번 자리</option>
            </select>
          </Field>
          <Field label="주요 부위">
            <select
              value={value.region_main ?? ''}
              onChange={(e) =>
                patch({ region_main: (e.target.value || undefined) as PatientCreate['region_main'] })
              }
              className={inputCls}
            >
              <option value="">선택…</option>
              <option value="brain">Brain</option>
              <option value="cervical">Cervical</option>
              <option value="thoracic">Thoracic</option>
              <option value="lumbar">Lumbar</option>
            </select>
          </Field>
          <Field label="입원일 *">
            <input
              type="date"
              value={value.admitted_at ?? ''}
              onChange={(e) => patch({ admitted_at: e.target.value })}
              required
              className={inputCls}
            />
          </Field>
          <Field label="퇴원 예정일">
            <input
              type="date"
              value={value.expected_discharge ?? ''}
              onChange={(e) =>
                patch({ expected_discharge: e.target.value || undefined })
              }
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* 수술 정보 — 통합된 surgery_date */}
      <SurgerySection
        surgeryName={value.surgery_name}
        surgeryDate={value.surgery_date}
        surgeryType={value.surgery_type}
        bmd={value.bmd}
        onChange={(p) => patch(p)}
      />

      {/* 협진 정보 */}
      <Section title="협진 정보">
        <label className="flex items-center gap-2 text-xs dark:text-slate-300">
          <input
            type="checkbox"
            checked={!!value.is_consult}
            onChange={(e) => patch({ is_consult: e.target.checked })}
          />
          협진 환자
        </label>
        {value.is_consult && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="원과 (이니셜, 예: EDDO)">
              <input
                value={value.consult_dept ?? ''}
                onChange={(e) => patch({ consult_dept: e.target.value || undefined })}
                maxLength={10}
                className={inputCls}
              />
            </Field>
            <Field label="협진 히스토리" wide>
              <textarea
                value={value.consult_history ?? ''}
                onChange={(e) =>
                  patch({ consult_history: e.target.value || undefined })
                }
                rows={3}
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </Section>

      {/* 입원예정은 입원일로 자동 판정 (별도 체크 없음) */}
      <Section title="안내">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          입원일이 <span className="font-medium">미래 날짜</span>면 자동으로 <span className="font-medium">입원예정</span>으로,
          오늘이거나 지난 날짜면 <span className="font-medium">입원환자</span>로 분류됩니다.
          일정이 바뀌어 입원하지 않으면 환자를 삭제하세요.
        </p>
        <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
          ⓘ 항생제/영상 검사 기록은 환자 상세 화면에서 매일 입력하세요.
        </p>
      </Section>

      {/* 메모 + 수술력 — 환자 정보 가장 뒤쪽 (참고용) */}
      <Section title="자유 메모">
        <textarea
          value={value.patient_memo ?? ''}
          onChange={(e) => patch({ patient_memo: e.target.value || undefined })}
          rows={3}
          placeholder="환자별 자유 메모 (가족분만 보이는 노트)"
          className={inputCls}
        />
      </Section>

      {/* 수술력 — 가장 뒤쪽 (참고용) */}
      <Section title="관련 수술력 (Past op history)">
        <textarea
          value={value.past_op_history ?? ''}
          onChange={(e) => patch({ past_op_history: e.target.value || undefined })}
          rows={3}
          placeholder="예: 2019 L4-5 disectomy, 2023 ACDF C5-6 등"
          className={inputCls}
        />
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          기존 수술 이력 참고용. 환자일보·출력문서 헤더에 &quot;s/p ...&quot; 로 표시됩니다.
        </p>
      </Section>
    </div>
  );
}

// ============= 서브 섹션들 =============

function SurgerySection({
  surgeryName,
  surgeryDate,
  surgeryType,
  bmd,
  onChange,
}: {
  surgeryName?: string;
  surgeryDate?: string;
  surgeryType?: 'general' | 'local';
  bmd?: string;
  onChange: (p: Partial<PatientCreate>) => void;
}) {
  const status = surgeryStatus(surgeryDate);
  const pod = computePod(surgeryDate);
  const today = new Date().toISOString().slice(0, 10);
  const stype = surgeryType ?? 'general';

  return (
    <Section title="수술 정보">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="수술명 (예정/실시 공용)" wide>
          <div className="flex gap-1.5">
            <input
              value={surgeryName ?? ''}
              onChange={(e) => onChange({ surgery_name: e.target.value || undefined })}
              placeholder="예: L4-5 PLIF"
              className={cn(inputCls, 'flex-1')}
            />
            <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-300 dark:border-slate-600">
              <button
                type="button"
                onClick={() => onChange({ surgery_type: 'general' })}
                title="General (일반 수술 · 입원)"
                className={cn(
                  'px-3 text-sm font-medium',
                  stype === 'general'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                G
              </button>
              <button
                type="button"
                onClick={() => onChange({ surgery_type: 'local' })}
                title="Local (국소시술 · 입원 안 함)"
                className={cn(
                  'border-l border-slate-300 px-3 text-sm font-medium dark:border-slate-600',
                  stype === 'local'
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-500 dark:text-slate-400',
                )}
              >
                L
              </button>
            </div>
          </div>
        </Field>
        <Field label="수술일">
          <input
            type="date"
            value={surgeryDate ?? ''}
            onChange={(e) => onChange({ surgery_date: e.target.value || undefined })}
            className={inputCls}
          />
        </Field>
        <Field label="상태 (자동)">
          <div
            className={cn(
              'flex h-[38px] items-center rounded-md border px-3 text-sm',
              !surgeryDate
                ? 'border-slate-300 text-slate-400 dark:border-slate-600 dark:text-slate-500'
                : status === 'planned'
                  ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  : 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300',
            )}
          >
            {!surgeryDate
              ? '수술 정보 없음'
              : status === 'planned'
                ? '예정'
                : `POD #${pod}`}
          </div>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="BMD (골밀도 T-score, 예: -2.6)">
          <input
            value={bmd ?? ''}
            onChange={(e) => onChange({ bmd: e.target.value || undefined })}
            placeholder="-2.6"
            className={inputCls}
          />
        </Field>
      </div>
      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        오늘({today}) 이전이면 자동으로 POD 계산, 이후면 예정.
      </p>
    </Section>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-200">{title}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="text-xs text-slate-600 dark:text-slate-400">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
