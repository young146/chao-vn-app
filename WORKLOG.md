# 작업 현황 로그 (WORKLOG)

> **목적**: 세션·작업자가 바뀌어도 작업을 *이어서* 할 수 있도록, 모든 작업의 현황을 한 곳에 시간순으로 남긴다.
>
> **읽기 규칙**: 새 작업을 시작하기 전, 이 파일 맨 위(최신 항목)부터 읽어 직전 작업의 맥락과 "다음 단계"를 파악한다.
>
> **쓰기 규칙**: 작업을 완료하거나 중단할 때마다 맨 위에 새 항목을 추가한다. 깊은 기술 추적은 주제별 `PROGRESS_*.md`로 링크하고, 이 파일에는 **"무엇을 · 어디까지 · 다음은"** 요약만 남긴다.
>
> 최종 갱신: 2026-06-22

---

## ✍️ 항목 템플릿 (복사해서 맨 위에 붙여넣기)

```md
## YYYY-MM-DD — (작업 제목 한 줄)
- **한 일**: 무엇을 왜 바꿨는지 1~3줄
- **배포**: (앱 OTA / 웹 Vercel / 미배포) + 커밋 해시
- **상태**: ✅ 완료 / 🟡 진행중 / ⏳ 검증·승인 대기
- **다음 단계**: 다음 작업자가 이어서 할 일 (없으면 "없음")
- **관련 파일/문서**: 링크
```

---

## 2026-06-22 — 이웃사업 리스트 카드 가로 배너형 전환

- **한 일**: 앱 리스트 카드를 "왼쪽 정사각(100×100) 썸네일 + 텍스트" 가로줄 → "상단 가로 전체폭 4:3 이미지 + 하단 텍스트" 세로 배너로 변경. 정사각 틀에서 가로 사진 좌우가 잘리던 문제 해결. 스타일 2개만 변경(`card` 가로→세로, `cardThumb` 100×100→너비100%·4:3).
- **배포**: 앱 OTA `production` (이 항목 커밋과 함께)
- **상태**: ✅ 완료
- **다음 단계**: 등록폼 도움말에 "권장 업로드 이미지 = 가로 4:3 (1200×900)" 안내 한 줄 추가 검토. 그러면 리스트·상세 둘 다 무잘림.
- **관련 파일**: [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js) (styles card/cardThumb). 웹 리스트(`SimpleCards.tsx`)는 이미 5:4 배너형이라 변경 없음.

---

## 2026-06-22 — 이웃사업 정렬·이미지·앱웹 통일

- **한 일**:
  1. 이웃사업 목록을 `priority 높은순 → 최신 등록순`으로 정렬 (앱). 빈 지역 검색 시 캐시 복원 무한루프(화면 흔들림) 제거.
  2. 웹(vnkorlife-web) 목록 정렬을 앱과 동일하게 통일(priority 무시하던 문제 해결). 앱 등록폼 우선순위 라벨 거꾸로 표기 정정("작을수록"→"클수록 위로").
  3. 앱·웹 상세 큰 이미지 `cover→contain`으로 변경 — 어떤 비율도 잘리지 않고 전체 표시. (목록 썸네일은 `cover` 유지)
- **배포**: 앱 OTA `production` 2회 발행(커밋 `2687544`, `19a8330`) / 웹 Vercel 자동배포(커밋 `1a35b00`)
- **상태**: ✅ 완료
- **다음 단계**: 실기기에서 6군 등 빈 지역 검색 + 이미지 표시 정상 확인. 이상적 업로드 이미지 = **가로 4:3 (1200×900)** 안내를 등록폼 도움말에 넣을지 검토.
- **관련 파일**: [services/neighborBusinessService.js](services/neighborBusinessService.js), [screens/NeighborBusinessesScreen.js](screens/NeighborBusinessesScreen.js), [screens/NeighborBusinessDetailScreen.js](screens/NeighborBusinessDetailScreen.js), `vnkorlife-web/src/components/pages/NeighborBusinessPageClient.tsx`, `vnkorlife-web/src/components/detail/ImageGallery.tsx`
- **메모**: 이웃사업 웹 = `vnkorlife-web`(GitHub young146/vnkorlife-web → Vercel 자동배포). 앱과 Firestore `NeighborBusinesses` 컬렉션 공유.

---

## 📚 주제별 심화 추적 (이 로그에서 갈라지는 문서)

- [PROGRESS_BUILD_PENDING.md](PROGRESS_BUILD_PENDING.md) — 미빌드 네이티브 변경 / 빌드 시점 결정
- [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) — 측정 인프라 (Analytics)
- [PROGRESS_PUSH_SYSTEM.md](PROGRESS_PUSH_SYSTEM.md) — 푸시 알림 시스템
- [PROGRESS_MARKETING_FUNNEL.md](../../daily-news-final/daily-news-final/PROGRESS_MARKETING_FUNNEL.md) — 마케팅 깔때기
