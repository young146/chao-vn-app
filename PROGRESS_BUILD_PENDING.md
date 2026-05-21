# 빌드 미수 변경 추적표 (Pending Native Changes)

> **목적**: 운영 앱 (스토어 배포본) 에 *아직 도달하지 못한* 네이티브 변경을 추적한다.
> 다음 EAS Build 시점을 결정할 때 이 파일을 본다.
>
> 시작: 2026-05-21
> 최종 갱신: 2026-05-21

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
| **현재 상태** | 🟡 스토어 심사 중 | 🟡 스토어 심사 중 |

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

## ✅ 2026-05-21 — 빌드 + Submit 완료

iOS build 73 + Android versionCode 106 모두 EAS Build 완료(17분). `--auto-submit` 으로 App Store Connect + Google Play Console 업로드까지 처리. 스토어 심사 대기 중 (iOS ~1~3일, Android ~수 시간~1일).

**다음 액션**:
- 심사 통과 알림 수신 → 사용자 자동 업데이트 시작
- Firebase Analytics 데이터 흐름 확인 (Firebase Console → Analytics → Events)
- 1주 후 GA4 + Firebase Analytics 통합 데이터로 깔때기 단계 2·3 효과 진단

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
