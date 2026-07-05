import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware는 비활성화 상태.
 * 인증 체크는 (app)/layout.tsx와 각 page에서 처리.
 *
 * matcher가 절대 매칭 안 되는 경로라 어떤 요청도 잡지 않음.
 * (Next.js 15.5 Node middleware 빌드 이슈 회피)
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/this-path-never-matches-xyz'],
};
