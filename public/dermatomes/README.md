# Dermatome 참고 이미지

Radicular pain location 입력 섹션에서 참고용으로 표시되는 dermatome 분포도.

## 필요한 파일

이 폴더에 다음 3개 파일을 넣어주세요:

- `cervical.png` — Cervical (C3~T1) dermatome 분포도
- `thoracic.png` — Thoracic (C2~S5) dermatome 분포도
- `lumbar.png` — Lumbar/Sacral (L1~S5) dermatome 분포도

## 동작

- 파일이 있으면: Radicular pain location 섹션 우측 상단에 작게 표시되고, 클릭하면 새 탭에서 크게 열림
- 파일이 없으면: 자동으로 숨겨짐 (에러 없음)

이미지 형식은 `.png` / `.jpg` 모두 가능하지만, 코드는 `.png` 기준입니다.
다른 형식을 쓰려면 `DermatomePain.tsx`의 `src` 경로를 수정하세요.
