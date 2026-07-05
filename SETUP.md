# 셋업 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 가입 (무료)
2. New Project. Region: `Northeast Asia (Seoul)` 권장
3. `Settings → API`에서 세 값 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ 절대 클라이언트 노출 금지

## 2. DB 스키마 적용

`SQL Editor`에서 순서대로 실행:
- `supabase/migrations/20261123000000_init.sql` (테이블)
- `supabase/migrations/20261123000001_rls.sql` (RLS)
- `supabase/migrations/20261123000002_profiles.sql` (계정 역할 + PIN)
- `supabase/migrations/20261123000003_realtime.sql` (실시간 동기화)

## 3. 첫 사용자 등록 (관리자)

`Authentication → Users → Add user → Create new user`
- 이메일과 비밀번호 입력, Auto Confirm User 체크
- **이 첫 사용자는 자동으로 admin 권한 부여** (트리거가 처리)

추가 사용자는 앱 내 `계정 관리` 페이지에서 admin이 등록.

`Authentication → Providers → Email`에서 "Confirm email" 토글 OFF (관리자가 직접 만든 계정은 즉시 사용 가능).

## 4. 로컬 개발

```bash
cd neuro-report-web
npm install
cp .env.example .env.local
# .env.local 채우기 (Supabase 3개 키)
npm run dev
```

브라우저 → http://localhost:3000 → 로그인 → PIN 설정 → 보드.

## 5. Vercel 배포

1. GitHub private repo 생성 후 push
2. https://vercel.com → Add New Project → repo 연결
3. **Environment Variables**에 `.env.local`의 3개 변수 입력:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ← **"Sensitive" 체크**
4. Deploy

## 6. PWA 설치 (모바일 홈화면)

배포된 URL을 모바일 브라우저에서 열고:
- iOS Safari: 공유 → 홈 화면에 추가
- Android Chrome: 메뉴 → 홈 화면에 추가

앱 아이콘이 생기고 풀스크린으로 동작. 오프라인에서 정적 자산은 캐시되지만 데이터 조회는 인터넷 필요 (의료정보 보안상 환자 데이터는 캐시하지 않음).

## 완성된 기능

- ✅ **멀티 사용자 + 역할** (admin / user). 첫 가입자가 자동 admin
- ✅ **계정 관리 페이지** (`/admin/users`) — admin만 접근. 등록/삭제/PIN 리셋/역할 변경
- ✅ **PIN 잠금** — bcrypt 해시 저장, 4-6자리, 서버 검증. PIN 분실 시 admin이 리셋
- ✅ **30분 idle 자동 잠금** — 백그라운드 갔다 돌아오면 PIN 재입력
- ✅ **PWA** — 홈화면 추가, 앱처럼 동작, 정적 자산 오프라인 캐시
- ✅ **데이터 격리** — RLS로 각 사용자가 본인 환자만 보도록 DB 레벨 강제
- ✅ 4부위 검사 입력 폼 — Brain / Cervical / Thoracic / Lumbar
- ✅ 어제값 자동 복사 + 변화 감지 + 호전/악화 표시 + 자동 저장
- ✅ SOAP 환자일보 자동 생성 + 클립보드 복사
- ✅ **한글 PDF 출력** — NotoSansKR 동적 임베드, 헤더/푸터, 페이지 자동 분할
- ✅ **카카오 공유** — Kakao SDK + Web Share API + 클립보드 3단계 폴백
- ✅ **실시간 동기화 (Realtime)** — PC ↔ 모바일 동시 사용 시 다른 기기 변경 자동 반영. dirty 필드 보호 머지로 입력 중인 항목은 안전
- ✅ **백업 / 복원** — JSON 한 파일로 export, 머지/덮어쓰기/완전교체 3가지 모드로 import. 새 폰/계정 이전 시 사용
- ✅ **Dermatome 시각화** — 인체 도식 위 영역을 탭하여 색칠. 한 영역이 여러 dermatome에 매핑되면 "L5+S1"처럼 합쳐 표시되며 동시 변경. 리스트/맵 토글 가능
- ✅ VAS 및 Motor 추이 그래프 (Recharts)
- ✅ TypeScript strict 통과 + 프로덕션 빌드 통과

## 카카오 공유 키 발급 (선택사항)

키 미설정 시에도 Web Share API (모바일 시스템 공유 시트)로 동작합니다. 카톡 전용 깊은 통합이 필요하면 다음을 진행:

1. https://developers.kakao.com 로그인
2. 내 애플리케이션 → 애플리케이션 추가하기
3. 앱 이름: "Neuro Report" (자유), 사업자명: 본인 이름
4. 생성된 앱 → **JavaScript 키** 복사
5. 플랫폼 → Web → 사이트 도메인 등록:
   - `http://localhost:3000` (로컬 개발)
   - `https://your-app.vercel.app` (배포)
6. `.env.local` 및 Vercel 환경변수에 `NEXT_PUBLIC_KAKAO_APP_KEY=복사한 키` 추가

## 다음 작업

1. 자동 백업 (주 1회 클라이언트에서 백그라운드로 JSON 다운로드)
2. 백업 파일 암호화 옵션 (passphrase 입력 → AES)
3. Dermatome 영역 좌표 정밀화 (실제 임상 도식에 가깝게 vector 데이터 확장)

## 인증 흐름

```
브라우저 접속
  │
  ▼
Supabase 세션 있나? ── No ──► /login (이메일/비번)
  │ Yes
  ▼
PIN 쿠키 valid? ──── No ──► /pin (PIN 입력 또는 신규 설정)
  │ Yes
  ▼
앱 진입 (/board)
  │
  ├─ 30분 idle ──► /pin (PIN 재입력)
  ├─ "잠금" 클릭 ──► /pin
  └─ "로그아웃" 클릭 ──► /login
```

## 보안 모델

- **세션**: Supabase JWT 토큰, httpOnly 쿠키. 수일~수주 유지
- **PIN**: bcrypt 해시(salt rounds 8)로 DB 저장. 클라이언트는 절대 해시를 받지 않음. RPC에서만 검증
- **PIN 쿠키**: httpOnly, sameSite=lax, secure(prod), 30분 TTL
- **데이터 격리**: RLS 정책으로 본인 user_id 데이터만 접근. admin도 데이터 자체는 못 봄 (관리만 가능)
- **Service Role 키**: 서버 전용, 절대 클라이언트 노출 금지. 관리자 액션 시에만 사용, 호출 전 admin 검증
