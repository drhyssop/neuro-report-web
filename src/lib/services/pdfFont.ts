import type { jsPDF } from 'jspdf';

/**
 * NotoSansKR TTF를 fetch → base64 → jsPDF에 등록.
 * - 결과는 메모리에 캐시되어 두 번째 호출부터는 즉시 반환
 * - 첫 호출은 ~1-2MB 다운로드라 환자일보 PDF 버튼 누른 직후 1-2초 지연 발생 가능
 *
 * 폰트 출처: jsdelivr CDN. 자체 호스팅하려면 public/fonts에 두고 fetch path를 '/fonts/...'로 변경
 */

const FONT_URL =
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf';

let cachedBase64: string | null = null;

async function loadFontBase64(): Promise<string> {
  if (cachedBase64) return cachedBase64;

  const res = await fetch(FONT_URL);
  if (!res.ok) throw new Error(`폰트 로드 실패: ${res.status}`);
  const buf = await res.arrayBuffer();

  // ArrayBuffer → base64 (브라우저 호환 방식)
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  cachedBase64 = btoa(binary);
  return cachedBase64;
}

/**
 * jsPDF 인스턴스에 NotoSansKR 폰트를 등록하고 활성화.
 * 등록 후 doc.setFont('NotoSansKR') 호출 가능.
 */
export async function installKoreanFont(doc: jsPDF): Promise<void> {
  const base64 = await loadFontBase64();
  doc.addFileToVFS('NotoSansKR.ttf', base64);
  doc.addFont('NotoSansKR.ttf', 'NotoSansKR', 'normal');
}
