import { installKoreanFont } from './pdfFont';

interface BuildPdfInput {
  note: string;
  patientAlias: string;
  examDate: string;
  diagnosis?: string | null;
  hospitalDay?: number | null;
  authorName?: string;
}

/**
 * 환자일보 텍스트를 PDF로 변환.
 * - A4 세로
 * - 한글 NotoSansKR 임베드
 * - 헤더(환자/일자/POD) + 푸터(페이지 / 작성자)
 * - 자동 페이지 분할
 */
export async function buildNotePdf(input: BuildPdfInput): Promise<Blob> {
  // 동적 import — jsPDF는 큰 라이브러리라 PDF 버튼 누르기 전까지 로드 안 함
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

  await installKoreanFont(doc);
  doc.setFont('NotoSansKR', 'normal');

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginTop = 56;
  const marginBottom = 56;
  const lineHeight = 14;
  const headerY = 36;
  const footerY = pageH - 24;

  function drawHeader() {
    doc.setFontSize(10);
    doc.setTextColor(120);
    const left = `${input.patientAlias}${input.diagnosis ? ' · ' + input.diagnosis : ''}`;
    const right = `${input.examDate}${input.hospitalDay != null ? ' · HD#' + input.hospitalDay : ''}`;
    doc.text(left, marginX, headerY);
    doc.text(right, pageW - marginX, headerY, { align: 'right' });
    doc.setDrawColor(220);
    doc.line(marginX, headerY + 6, pageW - marginX, headerY + 6);
  }

  function drawFooter(pageNum: number, totalPages: number) {
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(input.authorName ?? '', marginX, footerY);
    doc.text(`${pageNum} / ${totalPages}`, pageW - marginX, footerY, { align: 'right' });
  }

  // 본문 라인을 일단 wrap하고 페이지 수 계산
  doc.setFontSize(11);
  doc.setTextColor(20);
  const usableWidth = pageW - marginX * 2;
  const wrapped: string[] = [];
  for (const rawLine of input.note.split('\n')) {
    if (rawLine === '') {
      wrapped.push('');
      continue;
    }
    const parts = doc.splitTextToSize(rawLine, usableWidth) as string[];
    wrapped.push(...parts);
  }

  // 페이지당 라인 수
  const usableHeight = pageH - marginTop - marginBottom;
  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const totalPages = Math.max(1, Math.ceil(wrapped.length / linesPerPage));

  // 페이지별 그리기
  for (let p = 0; p < totalPages; p++) {
    if (p > 0) doc.addPage();
    drawHeader();

    const start = p * linesPerPage;
    const end = Math.min(start + linesPerPage, wrapped.length);
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.setFont('NotoSansKR', 'normal');
    for (let i = start; i < end; i++) {
      const y = marginTop + (i - start) * lineHeight;
      doc.text(wrapped[i], marginX, y);
    }

    drawFooter(p + 1, totalPages);
  }

  return doc.output('blob');
}
