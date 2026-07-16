'use client';

import { useState, useMemo, useEffect } from 'react';
import type { PatientReportData } from '@/lib/services/reportBuilder';
import { formatConsultLine } from '@/lib/services/reportBuilder';
import { RoundingTable } from './RoundingTable';
import { loadReportOrder, saveReportOrder, applyReportOrder } from '@/lib/utils/reportOrder';

interface Props {
  reports: PatientReportData[];
  date: string;
}

export function BoardReportClient({ reports, date }: Props) {
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    setOrder(loadReportOrder());
  }, []);
  const orderedReports = useMemo(() => applyReportOrder(reports, order), [reports, order]);

  function handleReorder(ids: string[]) {
    setOrder(ids);
    saveReportOrder(ids);
  }

  // 복사용 텍스트 — 넘버링 없이 [병동] 이름 형식, baseline 포함
  const fullText = useMemo(() => {
    const header = `■ 환자일보 (${date}) — ${reports.length}명`;
    const lines: string[] = [header, ''];
    for (const r of orderedReports) {
      const seat = r.ward ? `${r.bedSeat != null ? r.bedSeat : '?'} ` : '';
      const ward = r.ward ? `[${r.ward}] ` : '';
      const ageSex = r.age != null ? ` ${r.age}${r.sex || ''}` : '';
      const consult = r.isConsult ? `[협진 ${r.consultDept || ''}] ` : '';
      const sp = r.pastOpHistory ? ` · s/p ${r.pastOpHistory}` : '';
      lines.push(`${consult}${ward}${seat}${r.alias}${ageSex} · HD#${r.hospitalDay}${sp}`);

      if (r.surgeryName) {
        if (r.surgeryStatus === 'done' && r.pod != null) {
          const pl = r.pod === 0 ? 'POD #0 (오늘)' : r.pod === 1 ? 'POD #1 (어제)' : `POD #${r.pod}`;
          lines.push(`  수술: ${r.surgeryName} · ${pl}`);
        } else if (r.surgeryStatus === 'planned' && r.surgeryDateNatural)
          lines.push(`  수술: ${r.surgeryName} · ${r.surgeryDateNatural} 예정`);
        else lines.push(`  수술: ${r.surgeryName}`);
      }
      if (r.drainsActive > 0) lines.push(`  Drain: ${r.drainsText || `활성 ${r.drainsActive}개`}`);
      if (r.fever) lines.push(`  발열: ${r.feverTemp ? `${r.feverTemp}°C` : '있음'}`);
      if (r.ongoingAntibiotics.length > 0) {
        lines.push(
          `  항생제: ${r.ongoingAntibiotics.map((a) => `${a.short} ${a.days}d (${a.startedAt.slice(5)}~)`).join(', ')}`,
        );
      }
      if (r.dailyNote) lines.push(`  오늘 소견: ${r.dailyNote.replace(/\n/g, ' ')}`);
      if (r.patientMemo) lines.push(`  메모: ${r.patientMemo.replace(/\n/g, ' ')}`);
      for (const c of r.consults) lines.push(`  협진: ${formatConsultLine(c)}`);
      for (const img of r.imaging) lines.push(`  영상: ${img}`);
      for (const n of r.roundingNotes) lines.push(`  회진 메모: ${n}`);
      if (r.bmd) lines.push(`  BMD: ${r.bmd}`);
      if (r.medicationsText) lines.push(`  복용약: ${r.medicationsText}`);
      if (r.labsText) lines.push(`  lab: ${r.labsText}`);
      if (r.crpTrend) lines.push(`  CRP 추이: ${r.crpTrend}`);
      // ── 매일 보는 정보 아님: 입원시 증상/Physical/변화는 맨 아래 ──
      lines.push(
        `  입원시 증상: ${r.baselineSymptoms.length > 0 ? r.baselineSymptoms.join(', ') : '특이사항 없음'}`,
      );
      lines.push(
        `  입원시 Physical: ${
          r.baselinePhysicalGroups.length > 0
            ? r.baselinePhysicalGroups.map((g) => `${g.label}: ${g.items.join(', ')}`).join(' / ')
            : 'intact'
        }`,
      );
      if (r.reviewed) {
        const cps: string[] = [];
        for (const t of r.changeBits.improved) cps.push(`▲${t}`);
        for (const t of r.changeBits.worsened) cps.push(`▼${t}`);
        for (const t of r.changeBits.other) cps.push(t);
        if (cps.length > 0) lines.push(`  입원 대비: ${cps.join(', ')}`);
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }, [orderedReports, date]);

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

  if (reports.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        입원 환자가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={copyAll}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
        >
          {copied ? '복사됨 ✓' : '전체 복사'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        카드 우상단 ⠿ 를 드래그하면 회진 순서를 바꿀 수 있어요. 변경한 순서는 이 기기에 저장되고 회진문서 출력에도 반영됩니다.
      </p>
      <RoundingTable reports={orderedReports} onReorder={handleReorder} />

      <details className="rounded-md border border-slate-200 p-3 text-xs dark:border-slate-700">
        <summary className="cursor-pointer text-slate-600 dark:text-slate-300">
          텍스트 형식 (복사용)
        </summary>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
          {fullText}
        </pre>
      </details>
    </div>
  );
}
