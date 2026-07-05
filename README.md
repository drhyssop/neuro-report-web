# Neuro Report Web

기존 `Neuro Report` 안드로이드 앱을 웹앱으로 리비전한 버전입니다.

## 핵심 차이점

- **환자 보드 중심**: 입원 환자가 카드로 나열되며, 매일 회진하며 갱신
- **어제 값 자동 유지**: 환자 상세 진입 시 가장 최근 검사값을 복사하여 시작 → 변경된 항목만 수정
- **퇴원 버튼**: 누르기 전까지 메인 보드에 유지, 누르면 아카이브로 이동
- **구조화 저장**: motor power, sensory 등을 JSONB 필드로 구조화 → 추이 그래프 / 검색 가능
- **자동 SOAP 노트**: 검사 결과를 진료기록 형식 텍스트로 자동 생성
- **다기기 동기화**: PC ↔ 모바일 실시간 동기화 (Supabase Realtime)
- **본인 접근만**: Supabase 인증 + PIN 잠금

## ⚠️ 환자정보 운영 원칙

본인 메모용으로만 사용하세요. **실명, 주민번호, 실제 차트번호 등 환자 식별정보는 절대 입력하지 마세요.**
- ✅ 환자별칭: "201호-A", "월요일첫번째" 등 본인만 아는 약어
- ❌ 입력 금지: 환자 실명, 주민번호, 실제 차트번호, 연락처

## 기술 스택

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Form | react-hook-form + zod |
| Chart | Recharts |
| PDF | jsPDF |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Hosting | Vercel |

## 로컬 개발 시작

```bash
npm install
cp .env.example .env.local
# .env.local 채우기
npm run dev
```

## 배포

1. Supabase 프로젝트 생성 → URL, anon key 복사
2. `supabase/migrations/*.sql` Supabase SQL Editor에서 실행
3. Supabase Auth → 본인 계정 1개 수동 생성
4. GitHub repo 생성 → push
5. Vercel에서 import → 환경변수 입력 → Deploy

## 디렉토리 구조

`src/app/` 파일 기반 라우팅, `src/lib/` 도메인 로직 (Spring의 service/repository 패턴), `src/components/` 재사용 UI.
