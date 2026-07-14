'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PatientReportData } from '@/lib/services/reportBuilder';
import { formatConsultLine } from '@/lib/services/reportBuilder';
import { applyReportOrder, loadReportOrder } from '@/lib/utils/reportOrder';
import { loadMViewOrders, applyMViewOrder } from '@/lib/utils/mviewOrder';
import { RoundingTable } from './RoundingTable';
import type { MViewSection, MViewPatient } from '@/app/(app)/mview/page';
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';

interface Props {
  sections: MViewSection[];
  reports: PatientReportData[];
  date: string;
}

export function PrintClient({ sections, reports, date }: Props) {
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  // m-view 화면에서 저장한 섹션별 순서를 회진문서에도 적용 (localStorage 공유)
  const [orderedSections, setOrderedSections] = useState<MViewSection[]>(sections);
  useEffect(() => {
    const orders = loadMViewOrders();
    setOrderedSections(
      sections.map((s) => ({
        ...s,
        patients: applyMViewOrder(s.patients, orders[s.title], (p) => p.patientId),
      })),
    );
  }, [sections]);
  const nonEmptySections = orderedSections.filter((s) => s.patients.length > 0);

  // 환자일보 수동 순서 적용 (환자일보 화면에서 드래그로 저장한 순서를 인쇄에도 반영)
  const [orderedReports, setOrderedReports] = useState<PatientReportData[]>(reports);
  useEffect(() => {
    setOrderedReports(applyReportOrder(reports, loadReportOrder()));
  }, [reports]);

  // PDF 저장 시 파일명 자동화 — "YYMMDDHHmm회진" (브라우저가 document.title을 파일명으로 제안)
  useEffect(() => {
    const prev = document.title;
    const setTitle = () => {
      const n = new Date();
      const p = (x: number) => String(x).padStart(2, '0');
      const stamp = `${p(n.getFullYear() % 100)}${p(n.getMonth() + 1)}${p(n.getDate())}${p(n.getHours())}${p(n.getMinutes())}`;
      document.title = `${stamp}회진`;
    };
    setTitle();
    window.addEventListener('beforeprint', setTitle);
    return () => {
      window.removeEventListener('beforeprint', setTitle);
      document.title = prev;
    };
  }, []);

  async function exportWord() {
    setExporting(true);
    try {
      const children: Paragraph[] = [];

      // ===== m-view 섹션 =====
      children.push(
        new Paragraph({
          text: '■ m-view 리스트',
          heading: HeadingLevel.HEADING_2,
        }),
      );

      if (nonEmptySections.length === 0) {
        children.push(new Paragraph({ text: '대상 환자 없음.' }));
      }

      for (const s of nonEmptySections) {
        children.push(new Paragraph({ text: '' }));
        children.push(
          new Paragraph({
            text: `▷ ${s.title} (${s.patients.length})`,
            heading: HeadingLevel.HEADING_3,
          }),
        );
        s.patients.forEach((p) => {
          children.push(...mviewPatientToParagraphs(p, s.title === 'F/U 검사 환자'));
        });
      }

      children.push(new Paragraph({ text: '' }));
      children.push(new Paragraph({ text: '' }));

      // ===== 환자일보 =====
      children.push(
        new Paragraph({
          text: `■ 환자일보 (${reports.length}명)`,
          heading: HeadingLevel.HEADING_2,
        }),
      );

      reports.forEach((r) => {
        // 헤더: [병동] 이름 나이성별 · HD
        const seat = r.ward ? `${r.bedSeat != null ? r.bedSeat : '?'} ` : '';
        const ward = r.ward ? `[${r.ward}] ` : '';
        const ageSex = r.age != null ? ` ${r.age}${r.sex || ''}` : '';
        const consult = r.isConsult ? `[협진 ${r.consultDept || ''}] ` : '';
        const pastOp = r.pastOpHistory ? ` · s/p ${r.pastOpHistory}` : '';
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${consult}${ward}${seat}${r.alias}${ageSex} · HD#${r.hospitalDay}${pastOp}`, bold: true }),
            ],
          }),
        );

        // 세부 라인들 ({text, bold?})
        const lines: { text: string; bold?: boolean }[] = [];
        if (r.surgeryName) {
          if (r.surgeryStatus === 'done' && r.pod != null) {
            const pl = r.pod === 0 ? 'POD #0 (오늘)' : r.pod === 1 ? 'POD #1 (어제)' : `POD #${r.pod}`;
            lines.push({ text: `수술: ${r.surgeryName} · ${pl}`, bold: true });
          } else if (r.surgeryStatus === 'planned' && r.surgeryDateNatural)
            lines.push({ text: `수술: ${r.surgeryName} · ${r.surgeryDateNatural} 예정`, bold: true });
          else lines.push({ text: `수술: ${r.surgeryName}`, bold: true });
        }
        if (r.drainsActive > 0)
          lines.push({ text: `Drain: ${r.drainsText || `활성 ${r.drainsActive}개`}`, bold: true });
        if (r.fever) lines.push({ text: `발열: ${r.feverTemp ? `${r.feverTemp}°C` : '있음'}` });
        lines.push({
          text: `입원시 증상: ${r.baselineSymptoms.length > 0 ? r.baselineSymptoms.join(', ') : '특이사항 없음'}`,
        });
        lines.push({
          text: `입원시 Physical: ${
            r.baselinePhysicalGroups.length > 0
              ? r.baselinePhysicalGroups.map((g) => `${g.label}: ${g.items.join(', ')}`).join(' / ')
              : 'intact'
          }`,
        });
        if (r.reviewed) {
          const cps: string[] = [];
          for (const t of r.changeBits.improved) cps.push(`▲${t}`);
          for (const t of r.changeBits.worsened) cps.push(`▼${t}`);
          for (const t of r.changeBits.other) cps.push(t);
          if (cps.length > 0) lines.push({ text: `입원 대비: ${cps.join(', ')}` });
        }
        if (r.ongoingAntibiotics.length > 0) {
          lines.push({
            text: `항생제: ${r.ongoingAntibiotics.map((a) => `${a.short} ${a.days}d (${a.startedAt.slice(5)}~)`).join(', ')}`,
          });
        }
        if (r.dailyNote) lines.push({ text: `오늘 소견: ${r.dailyNote.replace(/\n/g, ' ')}` });
        if (r.patientMemo) lines.push({ text: `메모: ${r.patientMemo.replace(/\n/g, ' ')}` });
        for (const c of r.consults) lines.push({ text: `협진: ${formatConsultLine(c)}` });
        for (const n of r.roundingNotes) lines.push({ text: `회진 메모: ${n}` });
        if (r.bmd) lines.push({ text: `BMD: ${r.bmd}` });
        if (r.medicationsText) lines.push({ text: `복용약: ${r.medicationsText}` });
        if (r.labsText) lines.push({ text: `lab: ${r.labsText}` });
        if (r.crpTrend) lines.push({ text: `CRP 추이: ${r.crpTrend}` });

        for (const line of lines) {
          children.push(
            new Paragraph({ children: [new TextRun({ text: `    ${line.text}`, bold: line.bold })] }),
          );
        }
        children.push(new Paragraph({ text: '' }));
      });

      const doc = new Document({
        sections: [{ properties: {}, children }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `회진문서_${date}.docx`);
    } catch (err) {
      console.error('Word 내보내기 오류:', err);
      alert('Word 내보내기 실패. 콘솔을 확인하세요.');
    } finally {
      setExporting(false);
    }
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* 액션 버튼들 - 인쇄 시 숨김 */}
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-700 dark:text-slate-300"
          title="현재 시점 데이터로 다시 불러오기"
        >
          ↻ 새로고침
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white dark:bg-slate-100 dark:text-slate-900"
        >
          PDF로 저장 (인쇄)
        </button>
        <button
          type="button"
          onClick={exportWord}
          disabled={exporting}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        >
          {exporting ? '생성 중…' : 'Word로 내보내기'}
        </button>
      </div>

      {/* 인쇄용 본문 */}
      <div className="print-document space-y-6">
        {/* m-view — 용지 효율을 위해 2단 (좌: 수술/수술예정/Drain, 우: F/U/협진/수동) */}
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100 print:text-black">
            ■ m-view 리스트
          </h3>
          {nonEmptySections.length === 0 ? (
            <p className="text-xs text-slate-500 print:text-black">대상 환자 없음.</p>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 print:grid-cols-2">
              {[
                nonEmptySections.filter(
                  (s) =>
                    s.title === '오늘 수술' ||
                    s.title.startsWith('수술 예정') ||
                    s.title === 'Drain 제거',
                ),
                nonEmptySections.filter(
                  (s) =>
                    !(
                      s.title === '오늘 수술' ||
                      s.title.startsWith('수술 예정') ||
                      s.title === 'Drain 제거'
                    ),
                ),
              ].map((colSections, col) => (
                <div key={col} className="space-y-3">
                  {colSections.map((s) => (
                    <div key={s.title} className="break-inside-avoid">
                      <h4 className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300 print:text-black">
                        ▷ {s.title} ({s.patients.length})
                      </h4>
                      <div className="space-y-1.5 pl-3">
                        {s.patients.map((p) => (
                          <MViewPrintRow
                            key={p.patientId}
                            patient={p}
                            isFollowup={s.title === 'F/U 검사 환자'}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 환자일보 — 표 형식 */}
        <section className="print-page-break">
          <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-slate-100 print:text-black">
            ■ 환자일보 ({reports.length}명)
          </h3>
          <RoundingTable reports={orderedReports} />
        </section>
      </div>

      {/* 인쇄 스타일 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm 12mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-document {
            color: black !important;
          }
          .print-document * {
            color: black !important;
            background: white !important;
            border-color: #aaa !important;
          }
          .print-page-break {
            page-break-before: auto;
          }
          /* 모든 a 태그 밑줄 제거 */
          a {
            text-decoration: none !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

function MViewPrintRow({ patient: p, isFollowup }: { patient: MViewPatient; isFollowup?: boolean }) {
  const head = p.ward ? `[${p.ward}] ${p.alias}` : p.alias;
  const ageStr = p.age != null ? `${p.age}${p.sex || ''}` : '';
  return (
    <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 print:text-black">
      <span className="font-medium">{head}</span>
      {ageStr && <span className="ml-1 text-slate-600 dark:text-slate-400">{ageStr}</span>}
      {p.pastOpHistory && <span className="ml-1 font-semibold">· s/p {p.pastOpHistory}</span>}
      {p.isConsult && (
        <span className="ml-1 text-slate-700 dark:text-slate-300">· 협진({p.consultDept || ''})</span>
      )}
      <div className="ml-4 space-y-0.5 text-[11px]">
        {isFollowup ? (
          <>
            {/* F/U: 수술명(볼드) 먼저 → 그 다음 영상 */}
            {(p.surgeryName || p.surgeryLabel) && (
              <div>
                <span className="font-medium">수술:</span>{' '}
                {p.surgeryType === 'local' && (
                  <span className="mr-0.5 rounded bg-amber-500 px-1 text-[9px] font-bold text-white">L</span>
                )}
                <span className="font-bold">{p.surgeryName}</span>
                {p.surgeryLabel && <span className="ml-1">({p.surgeryLabel})</span>}
              </div>
            )}
            {p.followupFindings.length > 0 && (
              <div>
                <span className="font-medium">영상:</span>
                <ul className="ml-3 list-disc">
                  {p.followupFindings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {(p.surgeryName || p.surgeryLabel) && (
              <div>
                <span className="font-medium">수술:</span>{' '}
                {p.surgeryType === 'local' && (
                  <span className="mr-0.5 rounded bg-amber-500 px-1 text-[9px] font-bold text-white">L</span>
                )}
                <span className="font-bold">{p.surgeryName}</span>
                {p.surgeryLabel && <span className="ml-1">({p.surgeryLabel})</span>}
              </div>
            )}
            {p.historyHx && (
              <div>
                <span className="font-medium">hx:</span> {p.historyHx}
              </div>
            )}
            {p.symptoms.length > 0 && (
              <div>
                <span className="font-medium">증상:</span> {p.symptoms.join(', ')}
              </div>
            )}
            {p.physical.length > 0 && (
              <div>
                <span className="font-medium">피지컬:</span> {p.physical.join(', ')}
              </div>
            )}
            {p.patientMemo && (
              <div>
                <span className="font-medium">메모:</span> {p.patientMemo}
              </div>
            )}
            {p.ongoingAbx.length > 0 && (
              <div>
                <span className="font-medium">abx:</span> {p.ongoingAbx.join(', ')}
              </div>
            )}
            {p.imagingFindings.length > 0 && (
              <div>
                <span className="font-medium">영상:</span>
                <ul className="ml-3 list-disc">
                  {p.imagingFindings.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {p.consultHistory && (
              <div>
                <span className="font-medium">협진 메모:</span> {p.consultHistory}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function mviewPatientToParagraphs(p: MViewPatient, isFollowup?: boolean): Paragraph[] {
  const ps: Paragraph[] = [];
  const head = p.ward ? `[${p.ward}] ${p.alias}` : p.alias;
  const ageStr = p.age != null ? `${p.age}${p.sex || ''}` : '';
  const sp = p.pastOpHistory ? ` · s/p ${p.pastOpHistory}` : '';
  const consult = p.isConsult ? ` · 협진(${p.consultDept || ''})` : '';

  ps.push(
    new Paragraph({
      children: [
        new TextRun({ text: head, bold: true }),
        new TextRun({ text: `${ageStr ? ` ${ageStr}` : ''}${sp}${consult}` }),
      ],
    }),
  );

  const indent = '    ';
  const surgery = () => {
    if (p.surgeryName || p.surgeryLabel)
      ps.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${indent}수술: ${p.surgeryType === 'local' ? '[L] ' : ''}` }),
            new TextRun({ text: `${p.surgeryName ?? ''}`, bold: true }),
            new TextRun({ text: `${p.surgeryLabel ? ` (${p.surgeryLabel})` : ''}` }),
          ],
        }),
      );
  };

  if (isFollowup) {
    // F/U: 수술명(볼드) 먼저 → 그 다음 영상
    surgery();
    if (p.followupFindings.length > 0) {
      ps.push(new Paragraph({ text: `${indent}영상:` }));
      for (const f of p.followupFindings) ps.push(new Paragraph({ text: `${indent}  - ${f}` }));
    }
  } else {
    surgery();
    if (p.historyHx) ps.push(new Paragraph({ text: `${indent}hx: ${p.historyHx}` }));
    if (p.symptoms.length > 0) ps.push(new Paragraph({ text: `${indent}증상: ${p.symptoms.join(', ')}` }));
    if (p.physical.length > 0) ps.push(new Paragraph({ text: `${indent}피지컬: ${p.physical.join(', ')}` }));
    if (p.patientMemo) ps.push(new Paragraph({ text: `${indent}메모: ${p.patientMemo.replace(/\n/g, ' ')}` }));
    if (p.ongoingAbx.length > 0) ps.push(new Paragraph({ text: `${indent}abx: ${p.ongoingAbx.join(', ')}` }));
    if (p.imagingFindings.length > 0) {
      ps.push(new Paragraph({ text: `${indent}영상:` }));
      for (const f of p.imagingFindings) ps.push(new Paragraph({ text: `${indent}  - ${f}` }));
    }
    if (p.consultHistory) ps.push(new Paragraph({ text: `${indent}협진 메모: ${p.consultHistory}` }));
  }

  return ps;
}
