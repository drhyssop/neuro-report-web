'use client';

import type { PatientReportData } from '@/lib/services/reportBuilder';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  reports: PatientReportData[];
  /** 수동 순서변경 활성화 (환자일보 화면용). 주어지면 드래그 가능 */
  onReorder?: (orderedIds: string[]) => void;
}

/**
 * 회진문서 표 — 환자별 카드형 블록.
 * onReorder가 주어지면 드래그로 순서변경 가능 (단일 컬럼), 아니면 인쇄용 2단 표시.
 */
export function RoundingTable({ reports, onReorder }: Props) {
  if (reports.length === 0) {
    return <p className="text-sm text-slate-500">입원 환자 없음.</p>;
  }

  if (onReorder) {
    return <SortableRoundingTable reports={reports} onReorder={onReorder} />;
  }

  return (
    <div className="columns-1 gap-2 md:columns-2 print:columns-2 print:gap-3">
      {reports.map((r) => (
        <PatientBlock key={r.id} r={r} />
      ))}
    </div>
  );
}

function SortableRoundingTable({
  reports,
  onReorder,
}: {
  reports: PatientReportData[];
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = reports.map((r) => r.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(ids, oldIdx, newIdx));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={reports.map((r) => r.id)} strategy={rectSortingStrategy}>
        <div className="columns-1 gap-2 md:columns-2">
          {reports.map((r) => (
            <SortablePatientBlock key={r.id} r={r} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortablePatientBlock({ r }: { r: PatientReportData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: r.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="relative"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute right-1 top-1 z-10 cursor-grab rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 active:cursor-grabbing dark:border-slate-600 dark:bg-slate-800"
        title="드래그로 순서 변경"
      >
        ⠿
      </button>
      <PatientBlock r={r} />
    </div>
  );
}

function PatientBlock({ r }: { r: PatientReportData }) {
  // 헤더 라인: [병동] 이름 나이성별 · 진단 HD · 수술 POD
  const ward = r.ward ? `[${r.ward}] ` : '';
  const ageSex = r.age != null ? `${r.age}${r.sex || ''}` : '';

  // 수술 정보 (POD#0=오늘, POD#1=어제 강조)
  const podLabel = (pod: number) =>
    pod === 0 ? 'POD #0 (오늘)' : pod === 1 ? 'POD #1 (어제)' : `POD #${pod}`;
  let surgeryText = '';
  if (r.surgeryName) {
    if (r.surgeryStatus === 'done' && r.pod != null) {
      surgeryText = `${r.surgeryName} · ${podLabel(r.pod)}`;
    } else if (r.surgeryStatus === 'planned' && r.surgeryDateNatural) {
      surgeryText = `${r.surgeryName} · ${r.surgeryDateNatural} 예정`;
    } else {
      surgeryText = r.surgeryName;
    }
  }
  // BMD는 수술명 옆이 아니라 아래 별도 줄로 (복용약 위)

  // 오늘 변화 (실제 ▲▼ 텍스트). reviewed 여부에 따라 미확인/변화없음/변화 표시
  const changeChips: { text: string; kind: 'up' | 'down' | 'other' }[] = [
    ...r.changeBits.improved.map((t) => ({ text: t, kind: 'up' as const })),
    ...r.changeBits.worsened.map((t) => ({ text: t, kind: 'down' as const })),
    ...r.changeBits.other.map((t) => ({ text: t, kind: 'other' as const })),
  ];

  // 항생제: "Cefa 3d (부터 05-23)"
  const abxText =
    r.ongoingAntibiotics.length > 0
      ? r.ongoingAntibiotics
          .map((a) => `${a.short} ${a.days}d (${a.startedAt.slice(5)}~)`)
          .join(', ')
      : null;

  return (
    <div
      className="mb-2 break-inside-avoid rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900 print:mb-3"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      {/* 헤더 */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
        {r.isConsult && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            협진 {r.consultDept || ''}
          </span>
        )}
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {ward}
          {r.ward && (
            <span className="mr-1 font-bold text-red-600 dark:text-red-400">
              {r.bedSeat != null ? r.bedSeat : '?'}
            </span>
          )}
          {r.alias}
        </span>
        {ageSex && <span className="text-xs text-slate-500 dark:text-slate-400">{ageSex}</span>}
        <span className="text-xs text-slate-500 dark:text-slate-400">· HD#{r.hospitalDay}</span>
        {r.pastOpHistory && (
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">· s/p {r.pastOpHistory}</span>
        )}
      </div>

      {/* 본문 — 라벨/값 그리드 (모바일/PC 일관) */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-xs">
        {surgeryText && (
          <Row label="수술">
            <span className="font-bold text-slate-800 dark:text-slate-100">{surgeryText}</span>
          </Row>
        )}
        {r.drainsActive > 0 && (
          <Row label="Drain">
            <span className="text-slate-800 dark:text-slate-100">
              {r.drainsText
                ? r.drainsText.split(/(\(<[^)]*\))/).map((seg, i) =>
                    seg.startsWith('(<') ? (
                      <span key={i} className="font-normal text-slate-500 dark:text-slate-400">
                        {seg}
                      </span>
                    ) : (
                      <span key={i} className="font-bold">
                        {seg}
                      </span>
                    ),
                  )
                : `활성 ${r.drainsActive}개`}
            </span>
          </Row>
        )}
        {r.fever && (
          <Row label="발열">
            <span className="font-medium text-red-600 dark:text-red-400">
              발열 {r.feverTemp ? `${r.feverTemp}°C` : '있음'}
            </span>
          </Row>
        )}

        {/* 입원시 증상/Physical/변화 → 맨 아래로 이동 (매일 보는 정보 아님) */}

        {abxText && <Row label="항생제">{abxText}</Row>}

        {r.consults.length > 0 && (
          <Row label="협진">
            <span className="inline-flex flex-col gap-0.5">
              {r.consults.map((c) => (
                <span key={c.id}>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{c.dept}</span>
                  <span className="text-[10px] text-slate-400"> {c.date.slice(5)}</span>{' '}
                  {c.answer ? (
                    <span className="text-emerald-700 dark:text-emerald-300">
                      ✓{c.answered_at ? ` ${c.answered_at.slice(5)}` : ''}: {c.answer}
                    </span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">대기중</span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400"> · {c.content}</span>
                </span>
              ))}
            </span>
          </Row>
        )}

        {r.imaging.length > 0 && (
          <Row label="영상">
            <span className="inline-flex flex-col gap-0.5">
              {r.imaging.map((img, i) => (
                <span key={i} className="text-slate-600 dark:text-slate-300">{img}</span>
              ))}
            </span>
          </Row>
        )}

        {r.dailyNote && (
          <Row label="오늘 소견">
            <span className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{r.dailyNote}</span>
          </Row>
        )}

        {r.patientMemo && (
          <Row label="메모">
            <span className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{r.patientMemo}</span>
          </Row>
        )}

        {r.roundingNotes.length > 0 && (
          <Row label="회진 메모">
            <span className="inline-flex flex-col gap-0.5">
              {r.roundingNotes.map((n, i) => (
                <span key={i} className="text-slate-700 dark:text-slate-200">
                  • {n}
                </span>
              ))}
            </span>
          </Row>
        )}

        {r.bmd && (
          <Row label="BMD">
            <span className="text-slate-700 dark:text-slate-200">{r.bmd}</span>
          </Row>
        )}

        {r.medicationsText && (
          <Row label="복용약">
            <span className="text-slate-700 dark:text-slate-200">{r.medicationsText}</span>
          </Row>
        )}

        {r.labsText && (
          <Row label="lab">
            <span className="font-medium text-slate-700 dark:text-slate-200">{r.labsText}</span>
          </Row>
        )}

        {r.crpTrend && (
          <Row label="CRP 추이">
            <span className="text-slate-600 dark:text-slate-300">
              {r.crpTrendPoints && r.crpTrendPoints.length > 0
                ? r.crpTrendPoints.map((pt, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      <span className="font-bold">{pt.crp}</span>
                      <span className="text-[9px] text-slate-400"> {pt.label}</span>
                    </span>
                  ))
                : r.crpTrend}
            </span>
          </Row>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="font-medium text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-slate-700 dark:text-slate-200">{children}</span>
    </>
  );
}
