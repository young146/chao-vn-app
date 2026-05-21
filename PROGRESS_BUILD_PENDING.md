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

| 항목 | 값 |
|---|---|
| **EAS Build ID** | `95127445-e488-4e6d-ac7f-ea2de2854568` |
| **빌드일** | 2026-05-04 |
| **Platform / Profile** | iOS / production |
| **Build number / Version** | 72 / 2.4.1 |
| **Runtime Version** | 2.4.0 |
| **빌드된 commit** | `b9671162` ("bump version 2.4.0 to 2.4.1 for iOS resubmission") |
| **Android 최근 빌드** | TODO — `eas build:list --platform android` 로 별도 확인 |

확인 명령:
```bash
cd c:/chao-vn-app/chao-vn-app
eas build:list --status finished --limit 5
```

---

## 🔧 미빌드 네이티브 변경

> 마지막 운영 빌드(`b9671162`) 이후 *네이티브 모듈/설정* 에 영향을 주는 변경들.
> OTA 로는 전달되지 않으므로 **다음 EAS Build + 스토어 제출** 까지 운영 앱에서 동작하지 않는다.

| 커밋 | 날짜 | 변경 | 영향 | Priority | 방어 상태 |
|---|---|---|---|---|---|
| `5714bdc` | 2026-05-20 | `@react-native-firebase/analytics@21.14.0` 추가 — 앱 내 화면/이벤트 측정 | 빌드 전까지 운영 앱에서 측정 데이터 0건 | 🟡 medium (측정 며칠 미뤄도 손해 적음) | ✅ `lib/analytics.js` 에 OTA-safe defensive load 박힘. 빌드 안 돼도 crash X |
| `5714bdc` | 2026-05-20 | `app.json` Android versionCode 104→105 수동 변경 | 다음 빌드 때 EAS autoIncrement 가 처리 — 별 문제 없음 | 🟢 info | n/a |

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

## 🚨 2026-05-21 현재 — 빌드 추진 권장

**상황 점검**:
- 어제(5/20) analytics 네이티브 추가 + 빌드 미룸 — 이유: "더 큰 native 변경 모아서"
- 오늘(5/21) 작업 7~8 사이클 진행 — 모두 OTA 가능 (JS 만)
- **더 모일 native 변경 없음** = 빌드 미룬 원래 의도 해소

**빌드 안 할 시 손실**:
- 메인 깔때기 단계 2 보강 효과 *앱 내 측정 0건* (analytics 없으니)
- welcome_screen_shown · signup_complete · 화면별 screen_view · job_view · realestate_view · news_read · share_clicked 등 핵심 이벤트 *전부 미수집*
- 1주 후 데이터 보고 보강 결정하려는데 *반쪽 데이터*

**권장**: 이번 주 안 EAS Build + 스토어 제출. 다음 빌드 사이클로 진입.

```bash
cd c:/chao-vn-app/chao-vn-app
eas build --platform all --profile production
# 빌드 완료 후
eas submit --platform ios
eas submit --platform android
```

---

## 🪵 빌드 이력

- `2026-05-04` — iOS build 72 / v2.4.1 (`b9671162`). 마지막 운영 빌드.
- *그 이후로 빌드 없음 (2026-05-21 기준)*.

---

## 📚 관련 문서

- [PROGRESS_MARKETING_FUNNEL.md](../../daily-news-final/daily-news-final/PROGRESS_MARKETING_FUNNEL.md) — 마케팅 깔때기 진행 상황
- [PROGRESS_MEASUREMENT_INFRA.md](PROGRESS_MEASUREMENT_INFRA.md) — 측정 인프라 세부 (Phase 1-5)
- [directives/MEASUREMENT_INFRA_SETUP.md](directives/MEASUREMENT_INFRA_SETUP.md) — 측정 인프라 SOP
- [CLAUDE.md](CLAUDE.md) — 에이전트 작업 지침 (빌드/배포 규칙 포함)
