/**
 * 카카오 공유 with 폴백 전략:
 *  1. KAKAO_APP_KEY 환경변수 있으면 Kakao SDK 동적 로드 → 카톡 공유
 *  2. SDK 실패 / 키 미설정 → Web Share API
 *  3. 그것도 안 되면 클립보드 복사
 *
 * Kakao Developers 콘솔에서 JavaScript 키를 발급받고 도메인 등록 필요.
 * https://developers.kakao.com → 내 애플리케이션 → 플랫폼 → Web → 사이트 도메인에 배포 URL 추가
 */

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.5/kakao.min.js';
const KAKAO_SDK_INTEGRITY = 'sha384-dok87au0gKqJdxs7msEdBPNnKSRT+/mhTVzq+qOhcL464zXwvcrpjeWvyj1kCdq6';

interface ShareInput {
  title: string;
  text: string;
  url?: string;
}

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    sendDefault(options: unknown): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let sdkLoadingPromise: Promise<KakaoSdk | null> | null = null;

function loadKakaoSdk(): Promise<KakaoSdk | null> {
  if (sdkLoadingPromise) return sdkLoadingPromise;

  const key = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  if (!key) return Promise.resolve(null);

  sdkLoadingPromise = new Promise<KakaoSdk | null>((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.Kakao?.isInitialized()) return resolve(window.Kakao);

    const script = document.createElement('script');
    script.src = KAKAO_SDK_URL;
    script.integrity = KAKAO_SDK_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      const k = window.Kakao;
      if (!k) return resolve(null);
      try {
        if (!k.isInitialized()) k.init(key);
        resolve(k);
      } catch {
        resolve(null);
      }
    };
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });

  return sdkLoadingPromise;
}

export async function shareNote(input: ShareInput): Promise<'kakao' | 'web' | 'clipboard'> {
  // 1) 카카오 SDK 시도
  const sdk = await loadKakaoSdk();
  if (sdk) {
    try {
      sdk.Share.sendDefault({
        objectType: 'text',
        text: `[${input.title}]\n\n${input.text}`,
        link: {
          mobileWebUrl: input.url ?? window.location.href,
          webUrl: input.url ?? window.location.href,
        },
      });
      return 'kakao';
    } catch {
      // fall through
    }
  }

  // 2) Web Share API
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({
        title: input.title,
        text: input.text,
        url: input.url,
      });
      return 'web';
    } catch {
      // 사용자 취소거나 미지원
    }
  }

  // 3) 클립보드 폴백
  await navigator.clipboard.writeText(`${input.title}\n\n${input.text}`);
  return 'clipboard';
}
