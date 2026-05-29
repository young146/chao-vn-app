# 빌드 미수 변경 추적표 (Pending Native Changes)

> **목적**: 운영 앱 (스토어 배포본) 에 *아직 도달하지 못한* 네이티브 변경을 추적한다.
> 다음 EAS Build 시점을 결정할 때 이 파일을 본다.
>
> 시작: 2026-05-21
> 최종 갱신: 2026-05-29

---

## 🧭 빠른 의사결정

**지금 EAS Build 가 필요한가?** → 아래 "🔧 미빌드 네이티브 변경" 표를 본다.

- 표에 *Priority: 🔴 critical* 항목이 있으면 → **즉시 빌드**
- *Priority: 🟡 medium* 항목만 있으면 → **2~3주 안에 빌드** (다른 변경 모아서)
- 표가 비어있으면 → **빌드 불필요**. OTA 만으로 모든 변경 전달됨

**OTA (eas update) 는 언제든 안전한가?** → [[#OTA 안전성 보장]] 항목 참고. 아래 정책 지켜진다면 *항상 안전*.

---

## 🚢 마지막 운영 빌드 (스토어 배포본 기준)

| 항목 | iOS | Android |
|---|---|---|
| **EAS Build ID** | `d7c6858d-ba29-40d8-91f3-1015ce18a217` | `3d3d8442-63f1-4e56-9f52-cc153f61d84f` |
| **빌드일** | 2026-05-21 | 2026-05-21 |
| **Profile** | production | production |
| **Build number / versionCode** | 73 | 106 |
| **Version** | 2.4.2 | 2.4.2 |
| **Runtime Version** | 2.4.2 | 2.4.2 |
| **Commit** | `3cb729e` (version bump 2.4.1 → 2.4.2) | 동일 |
| **현재 상태** | 🟡 스토어 심사 중 (~1~3일) | 🟢 **출시 완료 — 사용자 자동 업데이트 시작** (2026-05-21) |

이전 운영 빌드 (5/4): iOS build 72 / 2.4.1 / rv 2.4.0. 심사 통과 후 자동 교체.

확인 명령:
```bash
cd c:/chao-vn-app/chao-vn-app
eas build:list --status finished --limit 5
eas submit:list --limit 3
```

---

## 🔧 미빌드 네이티브 변경

> 마지막 운영 빌드 이후 *네이티브 모듈/설정* 에 영향을 주는 변경들.

**현재**: 모든 미빌드 네이티브 변경이 5/21 빌드(2.4.2)에 포함되어 *스토어 심사 통과 시 운영 반영 예정*. 새 누적 항목 없음.

| 커밋 | 날짜 | 변경 | 영향 | Priority | 상태 |
|---|---|---|---|---|---|
| ~~`5714bdc`~~ | ~~2026-05-20~~ | ~~`@react-native-firebase/analytics@21.14.0` 추가~~ | ~~앱 내 측정 데이터 흐름~~ | ~~🟡 medium~~ | ✅ 5/21 빌드 포함. 심사 통과 후 활성 |

---

## 🎨 OTA 만으로 충분한 변경 (참고용)

> 위 빌드 미수 변경과 *섞여 있는* JS-only 변경들. OTA 발송 시 같이 나간다.

| 커밋 | 날짜 | 변경 | 영향 |
|---|---|---|---|
| `791c3af` | 2026-05-21 | SignupScreen 닉네임 우선 + App.js 가입 후 환영 메시지 | OTA 즉시 활성. 가입 흐름 개선 |
| `c0c8b05` | 2026-05-21 | `public_html/go/app` GA4 태그 추가 | Firebase Hosting 배포 작업 (앱 무관). 이미 deploy 완료 |
| `f94294d` | 2026-05-29 | 헤더 광고 로딩 지연 해소 — Firestore 읽기 dedup + 화면별 캐시 분리 (`FirebaseAdService.js`, `AdBanner.js`) | OTA 발송 완료 (runtime 2.4.2 양 플랫폼). iOS 정상 수신 확인. 상세는 ↓ 2026-05-29 섹션 |

---

## 🛡️ OTA 안전성 보장

운영 앱 (5/4 빌드본) 에 OTA 만 보내도 안전하려면 *반드시* 지켜야 할 정책:

1. **새 네이티브 모듈을 추가하는 코드는 반드시 *defensive load* 패턴으로** —
   `import` 대신 `try { require(...) } catch`. `lib/analytics.js` 가 모범 사례.
2. **새 모듈의 사용처는 *모두* 단일 wrapper 파일을 거치게** — 직접 `import '@react-native-firebase/...'` 하지 말 것.
3. **앱 부팅 경로에 새 모듈 의존성 추가 시 *각별히 주의*** — 부팅 실패 = 모든 사용자 crash.
4. **이 파일(PROGRESS_BUILD_PENDING.md)을 *매 native 변경 시 갱신*** — 빌드 후 해당 항목 제거.

---

## 📋 빌드 시점 결정 체크리스트

EAS Build 를 *지금* 실행할지 결정할 때 자문할 것:

- [ ] 🔴 critical 항목이 있는가? (보안, 부팅 실패, 측정 손실 임계 등)
- [ ] 🟡 medium 항목이 *3개 이상* 누적되었는가? (모아서 빌드가 효율적)
- [ ] 마지막 빌드 이후 *4주 이상* 지났는가? (장기 미빌드는 OTA-native gap 위험 증가)
- [ ] 곧 마케팅/광고 등으로 *신규 사용자 유입* 예정인가? (신규 사용자는 *현재* 빌드를 받음 → 측정 인프라가 빌드되어야 신규 측정 가능)

위 중 하나라도 ✅ 면 → **빌드 추진**.

---

## ✅ 2026-05-21 — 빌드 + Submit + Android 출시 완료

iOS build 73 + Android versionCode 106 모두 EAS Build 완료(17분). `--auto-submit` 으로 스토어 업로드 처리.

- **Android**: 🟢 **출시 완료** — 사용자 자동 업데이트 시작. Firebase Analytics 데이터 흐름 개시 예정.
- **iOS**: 🟡 심사 대기 (~1~3일).

추가 OTA 발송:
- `d16b0ae3-...` (5/21) — 액션 14 v1 (비회원 뉴스 탭 가치 카드) + 이메일 3채널 동기화. runtime 2.4.2 빌드만 수신.

**다음 액션 (Android 출시 직후)**:
- Firebase Console → Analytics → Realtime 에서 *지금* 이벤트 흐름 확인 가능
- 주요 이벤트: `screen_view`, `welcome_screen_shown` (신규 가입 시), `visitor_value_card_shown`, `job_view`, `realestate_view`, `news_read`, `share_clicked`
- iOS 심사 통과 후 양쪽 데이터 통합 분석
- 1주 후 GA4 + Firebase Analytics 데이터로 깔때기 단계 2·3 효과 진단

---

## ✅ 2026-05-29 — 헤더 광고 로딩 지연 수정 + 안드로이드 업데이트 오류 진단

**1) 헤더 광고 로딩 지연 수정 (커밋 `f94294d`, OTA 발송 완료)**

- **증상**: iOS에서 헤더 광고가 매우 느리게/불규칙하게 뜨고(빈 화면), 첫 로드 시 깨진 이미지가 잠깐 번쩍임. (하단 광고는 정상)
- **원인**: 탭 5개(news/job/realestate/danggn/neighbor)가 부팅 시 `lazy:false`로 동시에 mount되는데, 각 탭 헤더가 서로 다른 `screen` 값으로 *단일 슬롯 캐시*를 번갈아 무효화 → Firestore를 5~6번 동시에 읽음. 하단은 `screen="all"` 하나뿐이라 멀쩡했던 것. (사용자가 "하단도 같은 현상이어야 하지 않나"로 정확히 지적 → 검증으로 확인됨)
- **수정**:
  - `FirebaseAdService.js`: raw 문서를 *공유 Promise*로 1번만 fetch(`getRawDocs`, 동시 호출 dedup) + 화면별 결과 캐시(`screenCache`) 분리 → 동시 6개 호출이 Firestore 읽기 1번으로 수렴
  - `AdBanner.js`: 모듈 캐시도 화면별 분리, 이미지 `onLoad` 게이팅(깨짐 번쩍임 제거), 보이는/다음 슬롯만 blur 계산(`isVisible`)으로 blur storm 완화
- **검증**: dedup 독립 테스트(`.tmp/adcache-dedup-test.js` — 6동시→읽기1, 탭별 광고 안 섞임) + babel 파싱 + orphan 참조 grep + diff 리뷰. iOS 실기기에서 광고 정상 표시 확인 → 동일 JS가 양 플랫폼 동작이므로 코드 정상 입증.

**2) 안드로이드 "업데이트 확인" 버튼 오류 진단 (코드 변경 없음)**

- **증상**: 안드로이드에서 수동 업데이트 버튼이 계속 "오류가 발생했습니다". iOS는 반복하니 사라짐. 안드로이드 폰은 v2.4.2 확인됨.
- **진단**: EAS manifest endpoint를 양 플랫폼 직접 curl —
  - Android: **HTTP 200** 정상 manifest(업데이트 서버에 *존재함*), 응답 9.6초
  - iOS: HTTP 503(서버 일시 오류), 18.7초
- **결론**: "업데이트 없음"이 아니라 **번들(5.4MB) 다운로드 단계(`fetchUpdateAsync`)의 일시적 실패 + EAS 서버 응답 지연**. iOS가 재시도로 통과한 점이 일시적 현상의 증거. **광고 코드 수정과 무관**(동일 JS가 iOS에서 정상 동작).
- **표면 원인 가림**: [MoreScreen.js:107](screens/MoreScreen.js#L107)이 모든 실패를 제목·본문 동일한 `오류가 발생했습니다`로 덮어 진짜 원인이 안 보임.
- **상태**: 🟡 보류 — 내일 재확인. 안드로이드 자동 백그라운드 업데이트(`ON_LOAD`)가 돌고 있어 앱 재시작 반복 시 결국 수신됨.
- **후속 제안(미승인)**: 수동 버튼을 "확인만 + 백그라운드 적용 안내"로 변경 + 오류 문구 부드럽게. 단 이 수정 자체가 OTA로 나가야 해서 안드로이드가 현재 OTA를 먼저 1회 받아야 하는 catch-22 존재.

---

## 🪵 빌드 이력

- `2026-05-21` — iOS build 73 / Android versionCode 106 / v2.4.2 / rv 2.4.2 (`3cb729e`). analytics 측정 모듈 + 가입 흐름 보강 8 사이클 + 작업 C 5차 통일 통합. **스토어 심사 중**. 통과 후 자동 출시.
- `2026-05-04` — iOS build 72 / v2.4.1 / rv 2.4.0 (`b9671162`). 이전 운영 빌드. 5/21 빌드 통과 시 자동 교체.

---

## 📚 관련 문서

- [PROGRESS_MARKETING_FUNNEL.md](../../daily-news-final/daily-news-final/PROGRESS_MARKETING_FUNNEL.md) — 마케팅 깔때기 진행 상황
- [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) — 측정 인프라 세부 (Phase 1-5)
- [directives/MEASUREMENT_INFRA_SETUP.md](directives/MEASUREMENT_INFRA_SETUP.md) — 측정 인프라 SOP
- [CLAUDE.md](CLAUDE.md) — 에이전트 작업 지침 (빌드/배포 규칙 포함)
