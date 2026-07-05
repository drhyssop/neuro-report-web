'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toggleMViewAction, excludeFromMviewAction } from '@/lib/actions/mview';
import type { MViewPatient, MViewSection } from '@/app/(app)/mview/page';
import {
  loadMViewOrders,
  saveMViewOrders,
  applyMViewOrder,
  type SectionOrders,
} from '@/lib/utils/mviewOrder';

interface PickerPatient {
  id: string;
  alias: string;
  ward: string | null;
  diagnosis: string | null;
  isConsult: boolean;
  consultDept: string | null;
}

interface Props {
  sections: MViewSection[];
  pickerPatients: PickerPatient[];
}

const accentMap: Record<MViewSection['accent'], string> = {
  purple: 'text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  blue: 'text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  cyan: 'text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  green: 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  amber: 'text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  rose: 'text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
};

// localStorage 순서 유틸은 공유 파일(mviewOrder)로 이동 — 회진문서 출력과 공유

export function MViewClient({ sections, pickerPatients }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [orders, setOrders] = useState<SectionOrders>({});

  // 마운트 시 localStorage에서 순서 로드
  useEffect(() => {
    setOrders(loadMViewOrders());
  }, []);

  // 저장된 순서 적용된 sections
  const orderedSections = useMemo(() => {
    return sections.map((s) => ({
      ...s,
      patients: applyMViewOrder(s.patients, orders[s.title], (p) => p.patientId),
    }));
  }, [sections, orders]);

  const nonEmpty = orderedSections.filter((s) => s.patients.length > 0);

  const fullText = useMemo(() => {
    const lines: string[] = [];
    for (const s of nonEmpty) {
      const isFu = s.title === 'F/U 검사 환자';
      lines.push(`■ ${s.title} (${s.patients.length})`);
      s.patients.forEach((p, i) => {
        const head = p.ward ? `[${p.ward}] ${p.alias}` : p.alias;
        const ageStr = p.age != null ? ` ${p.age}${p.sex || ''}` : '';
        const sp = p.pastOpHistory ? ` · s/p ${p.pastOpHistory}` : '';
        const consult = p.isConsult ? ` · 협진(${p.consultDept || ''})` : '';
        lines.push(`${i + 1}. ${head}${ageStr}${sp}${consult}`);
        if (isFu) {
          // F/U: 영상(followup만) 먼저, 수술까지만
          if (p.followupFindings.length > 0) {
            lines.push(`   영상:`);
            for (const f of p.followupFindings) lines.push(`     - ${f}`);
          }
          if (p.surgeryName || p.surgeryLabel)
            lines.push(`   수술: ${p.surgeryType === 'local' ? '[L] ' : ''}${p.surgeryName ?? ''}${p.surgeryLabel ? ` (${p.surgeryLabel})` : ''}`);
        } else {
          if (p.surgeryName || p.surgeryLabel)
            lines.push(`   수술: ${p.surgeryType === 'local' ? '[L] ' : ''}${p.surgeryName ?? ''}${p.surgeryLabel ? ` (${p.surgeryLabel})` : ''}`);
          if (p.historyHx) lines.push(`   hx: ${p.historyHx}`);
          if (p.symptoms.length > 0) lines.push(`   증상: ${p.symptoms.join(', ')}`);
          if (p.physical.length > 0) lines.push(`   피지컬: ${p.physical.join(', ')}`);
          if (p.patientMemo) lines.push(`   메모: ${p.patientMemo.replace(/\n/g, ' ')}`);
          if (p.ongoingAbx.length > 0) lines.push(`   abx: ${p.ongoingAbx.join(', ')}`);
          if (p.imagingFindings.length > 0) {
            lines.push(`   영상:`);
            for (const f of p.imagingFindings) lines.push(`     - ${f}`);
          }
          if (p.consultHistory) lines.push(`   협진 메모: ${p.consultHistory}`);
        }
      });
      lines.push('');
    }
    return lines.join('\n').trim();
  }, [nonEmpty]);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(fullText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = fullText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addToMView(patientId: string) {
    const fd = new FormData();
    fd.set('patient_id', patientId);
    fd.set('next', 'true');
    startTransition(async () => {
      await toggleMViewAction(fd);
      setShowPicker(false);
    });
  }

  function removeFromMView(patientId: string) {
    const fd = new FormData();
    fd.set('patient_id', patientId);
    fd.set('next', 'false');
    startTransition(async () => {
      await toggleMViewAction(fd);
      // 순서 저장에서도 제거
      setOrders((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = next[key].filter((id) => id !== patientId);
        }
        saveMViewOrders(next);
        return next;
      });
    });
  }

  // 자동으로 올라온 환자를 "오늘 하루" m-view에서 제외
  function excludeToday(patientId: string) {
    const fd = new FormData();
    fd.set('patient_id', patientId);
    startTransition(async () => {
      await excludeFromMviewAction(fd);
    });
  }

  // 카드 제외 버튼: 수동추가 환자는 영구 해제, 자동 환자는 오늘만 제외
  function handleRemove(patientId: string, isManual: boolean) {
    if (isManual) {
      removeFromMView(patientId);
    } else {
      if (!confirm('이 환자를 오늘 m-view 리스트에서 제외합니다. (내일 다시 대상이면 자동으로 올라옵니다)'))
        return;
      excludeToday(patientId);
    }
  }

  function handleSectionReorder(sectionTitle: string, newOrder: string[]) {
    setOrders((prev) => {
      const next = { ...prev, [sectionTitle]: newOrder };
      saveMViewOrders(next);
      return next;
    });
  }

  function resetOrder() {
    if (!confirm('환자 순서를 기본으로 되돌립니까? (병동 순서)')) return;
    setOrders({});
    saveMViewOrders({});
  }

  const hasCustomOrder = Object.keys(orders).length > 0;

  return (
    <div className="space-y-4">
      {/* 액션 버튼들 */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          {showPicker ? '닫기' : '+ 보드에서 추가'}
        </button>
        {hasCustomOrder && (
          <button
            type="button"
            onClick={resetOrder}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
          >
            순서 초기화
          </button>
        )}
        <button
          type="button"
          onClick={copyAll}
          disabled={nonEmpty.length === 0}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        >
          {copied ? '복사됨 ✓' : '전체 복사'}
        </button>
      </div>

      {/* Picker */}
      {showPicker && (
        <div className="rounded-md border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 text-xs font-medium dark:text-slate-200">
            m-view에 추가할 환자 선택 ({pickerPatients.length}명 후보)
          </div>
          {pickerPatients.length === 0 ? (
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              추가 가능한 환자가 없습니다.
            </p>
          ) : (
            <div className="space-y-1">
              {pickerPatients.map((pp) => (
                <button
                  key={pp.id}
                  type="button"
                  onClick={() => addToMView(pp.id)}
                  disabled={isPending}
                  className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left text-xs hover:border-slate-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500"
                >
                  <div className="flex items-center gap-1.5">
                    {pp.ward && (
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium dark:bg-slate-700 dark:text-slate-300">
                        {pp.ward}
                      </span>
                    )}
                    <span className="font-medium dark:text-slate-100">{pp.alias}</span>
                    {pp.isConsult && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        협진({pp.consultDept || ''})
                      </span>
                    )}
                  </div>
                  <span className="truncate text-slate-500 dark:text-slate-400">
                    {pp.diagnosis || '진단명 미입력'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        ⇅ 카테고리 안에서 환자 카드를 드래그하면 회진 순서를 자유롭게 바꿀 수 있어요. 순서는 이 기기에만 저장됩니다.
      </p>

      {/* 섹션별 환자 카드 */}
      {nonEmpty.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          오늘 m-view 대상 환자가 없습니다.
        </p>
      ) : (
        orderedSections.map((s) => (
          <SortableSectionView
            key={s.title}
            section={s}
            onRemove={(id, isManual) => handleRemove(id, isManual)}
            onReorder={(newOrder) => handleSectionReorder(s.title, newOrder)}
            isPending={isPending}
          />
        ))
      )}
    </div>
  );
}

function SortableSectionView({
  section: s,
  onRemove,
  onReorder,
  isPending,
}: {
  section: MViewSection;
  onRemove: (id: string, isManual: boolean) => void;
  onReorder: (newOrder: string[]) => void;
  isPending: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (s.patients.length === 0) return null;

  const ids = s.patients.map((p) => p.patientId);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    onReorder(newOrder);
  }

  return (
    <div className="space-y-2">
      <div className={`border-l-4 pl-2 text-sm font-medium ${accentMap[s.accent]}`}>
        {s.title} ({s.patients.length})
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {s.patients.map((p, i) => (
              <SortableMViewCard
                key={p.patientId}
                num={i + 1}
                patient={p}
                onRemove={() => onRemove(p.patientId, !!p.isOnMview)}
                isPending={isPending}
                isFollowup={s.title === 'F/U 검사 환자'}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableMViewCard({
  num,
  patient: p,
  onRemove,
  isPending,
  isFollowup,
}: {
  num: number;
  patient: MViewPatient;
  onRemove: () => void;
  isPending: boolean;
  isFollowup?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.patientId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        {/* 드래그 핸들 */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="순서 변경"
          className="cursor-grab touch-none px-1 py-0.5 text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500"
        >
          ⋮⋮
        </button>

        <Link href={`/patient/${p.patientId}`} className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 dark:text-slate-500">{num}.</span>
            {p.ward && (
              <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium dark:bg-slate-800 dark:text-slate-300">
                {p.ward}
              </span>
            )}
            <span className="font-medium dark:text-slate-100">{p.alias}</span>
            {p.age != null && (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {p.age}{p.sex || ''}
              </span>
            )}
            {p.pastOpHistory && (
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                s/p {p.pastOpHistory}
              </span>
            )}
            {p.isConsult && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                협진({p.consultDept || ''})
              </span>
            )}
          </div>
        </Link>

        <button
          type="button"
          onClick={onRemove}
          disabled={isPending}
          title={p.isOnMview ? 'm-view에서 제거' : '오늘 m-view에서 제외'}
          className="shrink-0 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
        >
          제외
        </button>
      </div>

      <Link
        href={`/patient/${p.patientId}`}
        className="mt-2 block space-y-1 text-slate-700 dark:text-slate-300"
      >
        {isFollowup ? (
          <>
            {/* F/U 검사 환자: 영상 먼저, 그 다음 수술. 증상/피지컬/abx/메모는 생략 (환자일보에서 확인) */}
            {p.followupFindings.length > 0 && (
              <div className="flex gap-2">
                <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">영상:</span>
                <div className="flex-1 space-y-0.5">
                  {p.followupFindings.map((f, idx) => (
                    <div key={idx}>• {f}</div>
                  ))}
                </div>
              </div>
            )}
            {(p.surgeryName || p.surgeryLabel) && (
              <Row label="수술">
                {p.surgeryType === 'local' && (
                  <span className="mr-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white">L</span>
                )}
                {p.surgeryName}
                {p.surgeryLabel && (
                  <span className="ml-2 text-slate-500 dark:text-slate-400">({p.surgeryLabel})</span>
                )}
              </Row>
            )}
          </>
        ) : (
          <>
            {(p.surgeryName || p.surgeryLabel) && (
              <Row label="수술">
                {p.surgeryType === 'local' && (
                  <span className="mr-1 rounded bg-amber-500 px-1 text-[10px] font-bold text-white">L</span>
                )}
                {p.surgeryName}
                {p.surgeryLabel && (
                  <span className="ml-2 text-slate-500 dark:text-slate-400">({p.surgeryLabel})</span>
                )}
              </Row>
            )}
            {p.historyHx && <Row label="hx">{p.historyHx}</Row>}
            {p.symptoms.length > 0 && <Row label="증상">{p.symptoms.join(', ')}</Row>}
            {p.physical.length > 0 && <Row label="피지컬">{p.physical.join(', ')}</Row>}
            {p.patientMemo && <Row label="메모">{p.patientMemo}</Row>}
            {p.ongoingAbx.length > 0 && <Row label="abx">{p.ongoingAbx.join(', ')}</Row>}
            {p.imagingFindings.length > 0 && (
              <div className="flex gap-2">
                <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">영상:</span>
                <div className="flex-1 space-y-0.5">
                  {p.imagingFindings.map((f, idx) => (
                    <div key={idx}>• {f}</div>
                  ))}
                </div>
              </div>
            )}
            {p.consultHistory && <Row label="협진 메모">{p.consultHistory}</Row>}
          </>
        )}
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      {label && (
        <span className="shrink-0 font-medium text-slate-500 dark:text-slate-400">{label}:</span>
      )}
      <span className="flex-1 leading-relaxed">{children}</span>
    </div>
  );
}
