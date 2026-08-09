// ============================================================
// 측정 인프라 (Quick Win #5) — Firebase Analytics 래퍼
// 작성: 2026-05-20 / OTA-safe defensive load 추가: 2026-05-21
// SOP: directives/MEASUREMENT_INFRA_SETUP.md
// 빌드 미수 상태 추적: PROGRESS_BUILD_PENDING.md
// ============================================================
//
// 모든 이벤트는 여기를 통해 발생시킨다. 직접 analytics().logEvent를 호출하지 말 것.
// 이유:
//   1. Firebase 미초기화 시점에 호출되어도 크래시 없이 무시되도록 가드 처리
//   2. 이벤트명/파라미터 명명 규칙을 한 곳에서 관리 (GA4 규약: 소문자 + 언더스코어)
//   3. __DEV__ 환경에서는 콘솔로 흐름 확인 가능
//
// ⚠️ OTA-safe defensive load 패턴 (다른 개발자 인수인계용 설명)
// ----------------------------------------------------------------
// `@react-native-firebase/analytics` 는 *네이티브 모듈* 이다. 즉 EAS Build 로
// 새 앱 바이너리에 박혀야만 동작한다. OTA(`eas update`) 로는 *JS 만* 전달되며
// 네이티브 모듈은 전달되지 않는다.
//
// 이 코드를 추가한 시점(5714bdc, 2026-05-20)에 EAS Build 는 *미실행*. 즉:
//   - 운영 앱(앱스토어 배포본) 에는 analytics 네이티브 모듈이 *없다*
//   - 그런데 이후 OTA 로 이 lib/analytics.js 가 전달되면, import 시도가
//     "Cannot find native module 'RNFBAnalytics'" 같은 에러를 던질 수 있다
//   - 그러면 *앱 자체가 부팅 시 또는 첫 사용 시 crash*
//
// 그래서 정적 `import` 대신 동적 `require` + try/catch 로 감싼다.
// 네이티브 모듈이 없으면 `analyticsModule = null` 이 되고, 아래의 getInstance()
// 가 그걸 감지해서 모든 logEvent 호출을 무해한 no-op 으로 변환한다.
//
// ✅ 다음 EAS Build 가 실행되어 운영 앱에 analytics 네이티브 모듈이 박히면,
//    이 코드는 *변경 없이* 자동으로 측정을 시작한다. (require 가 모듈 반환)
//
// 🗑️ 이 defensive load 패턴은 *유지하는 게 안전*. 미래에 또다른 빌드 미수
//    상황이 와도 같은 보호가 동작한다. 굳이 제거하지 말 것.

let analyticsModule = null;
try {
  // .default 는 ES module default export. 일부 RN bundler 환경에서 require 결과가
  // 이 형태로 노출됨. 미존재 환경에서는 require 자체가 throw 한다 → catch 로 swallow
  analyticsModule = require('@react-native-firebase/analytics').default;
} catch (e) {
  if (__DEV__) console.log('[analytics] native module not available — pre-build app일 가능성. no-op 모드.');
}

// 이벤트명 사전 — 화면에서 import해서 사용
export const EVENTS = {
  MAGAZINE_OPEN: 'magazine_open',
  NEWS_READ: 'news_read',
  JOB_VIEW: 'job_view',
  REALESTATE_VIEW: 'realestate_view',
  SIGNUP_COMPLETE: 'signup_complete',
  SHARE_CLICKED: 'share_clicked',
  PUSH_RECEIVED: 'push_received',
  PUSH_CLICKED: 'push_clicked',
  // 자체 판매 광고(직접 광고) 성과 — 광고주 월간 리포트의 원천 데이터.
  // ⚠️ GA4 예약어인 `ad_impression`·`ad_click` 을 쓰면 안 된다. 그건 AdMob 자동수집
  //    이벤트라 우리가 보내는 파라미터와 의미가 충돌한다. 그래서 `promo_` 접두어를 쓴다.
  PROMO_IMPRESSION: 'promo_impression',
  PROMO_CLICK: 'promo_click',
};

// analytics 인스턴스 가져오기 (네이티브 모듈 부재 또는 Firebase 미초기화 시 null 반환)
// 위의 defensive load 와 결합되어 *어떤 환경에서도 crash 안 함* 을 보장한다.
const getInstance = () => {
  if (!analyticsModule) return null; // 빌드 미수 상태 보호
  try {
    return analyticsModule();
  } catch (e) {
    return null;
  }
};

// 공통 이벤트 로거 — 모든 헬퍼가 이걸 통과한다
export const logEvent = async (eventName, params = {}) => {
  // DEV 빌드에서는 Firebase Analytics 네이티브 호출 생략.
  // 이유: Firebase Android 네이티브 모듈이 파라미터 타입 불일치 시
  //       Java에서 ClassCastException을 던지는데, 이건 JS try-catch로 못 잡히고
  //       앱 전체를 크래시시킴. 운영(production) 빌드에서는 정상 동작하므로
  //       개발 중에는 console.log로 대체하는 것으로 충분함.
  if (__DEV__) {
    console.log(`[analytics] DEV skip → ${eventName}`, params);
    return;
  }
  const inst = getInstance();
  if (!inst) return;
  try {
    // GA4 파라미터 값은 100자 이내, 25개 이내로 제한 — 안전하게 직렬화
    const safe = {};
    for (const k of Object.keys(params)) {
      const v = params[k];
      if (v == null) continue;
      safe[k] = typeof v === 'string' ? v.slice(0, 100) : v;
    }
    await inst.logEvent(eventName, safe);
  } catch (e) {
    // 운영에서 혹시 발생할 경우 조용히 무시
  }
};

// 화면 추적 — NavigationContainer onStateChange에서 호출
export const logScreenView = async (screenName, screenClass) => {
  if (__DEV__) {
    console.log(`[analytics] DEV skip → screen_view: ${screenName}`);
    return;
  }
  const inst = getInstance();
  if (!inst) return;
  try {
    await inst.logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  } catch (e) { /* 운영에서 혹시 발생할 경우 조용히 무시 */ }
};

// 사용자 식별 — 로그인 시 호출, 로그아웃 시 null
export const setUserId = async (uid) => {
  const inst = getInstance();
  if (!inst) return;
  try {
    await inst.setUserId(uid ? String(uid) : null);
  } catch (e) {
    if (__DEV__) console.log('[analytics] setUserId failed:', e?.message);
  }
};

export const setUserProperty = async (name, value) => {
  const inst = getInstance();
  if (!inst) return;
  try {
    await inst.setUserProperty(name, value == null ? null : String(value));
  } catch (e) {
    if (__DEV__) console.log('[analytics] setUserProperty failed:', e?.message);
  }
};

// ============================================================
// 도메인 이벤트 헬퍼 — 화면에서 이걸 호출하자
// ============================================================

export const logMagazineOpen = (magazineId, magazineTitle) =>
  logEvent(EVENTS.MAGAZINE_OPEN, {
    magazine_id: String(magazineId ?? ''),
    magazine_title: magazineTitle,
  });

export const logNewsRead = (newsId, newsTitle, source) =>
  logEvent(EVENTS.NEWS_READ, {
    news_id: String(newsId ?? ''),
    news_title: newsTitle,
    source,
  });

export const logJobView = (jobId, jobTitle, company) =>
  logEvent(EVENTS.JOB_VIEW, {
    job_id: String(jobId ?? ''),
    job_title: jobTitle,
    company,
  });

export const logRealEstateView = (listingId, location) =>
  logEvent(EVENTS.REALESTATE_VIEW, {
    listing_id: String(listingId ?? ''),
    location,
  });

export const logSignupComplete = (method) =>
  logEvent(EVENTS.SIGNUP_COMPLETE, { method });

export const logShareClicked = (contentType, contentId) =>
  logEvent(EVENTS.SHARE_CLICKED, {
    content_type: contentType,
    content_id: String(contentId ?? ''),
  });

export const logPushReceived = (pushType, campaign) =>
  logEvent(EVENTS.PUSH_RECEIVED, {
    push_type: pushType,
    campaign: campaign || '',
  });

export const logPushClicked = (pushType, campaign) =>
  logEvent(EVENTS.PUSH_CLICKED, {
    push_type: pushType,
    campaign: campaign || '',
  });

// ============================================================
// 📊 자체 판매 광고 성과 — 광고주 월간 리포트용
// ------------------------------------------------------------
// 왜 필요한가 (2026-08-09):
//   광고를 팔면서 광고주에게 "몇 명이 봤고 몇 명이 눌렀다"를 못 주고 있었다.
//   Firestore 에 clicks 누적 카운터는 있지만 **평생 합계 하나**라 "7월 성과"를
//   뽑을 수 없고, 노출 카운터(trackAppAdImpression)는 만들어만 두고 아무도
//   호출하지 않아 영원히 0 이었다.
//
// 왜 Firestore 가 아니라 GA4 인가:
//   1) 날짜별 분해가 공짜다. Firestore 누적값은 월별로 자를 수 없다.
//   2) 노출은 클릭보다 수십 배 잦다. 같은 문서에 increment 를 몰아치면
//      Firestore 의 **문서당 초당 1회 쓰기 한계**에 걸려 경합이 난다.
//      (아마 이것이 노출 카운터가 연결되지 않은 채 남아 있던 이유다)
//   3) 웹·앱·메일을 한 자리에서 합칠 수 있다. 리포트 질의가 한 번으로 끝난다.
//
// 기존 Firestore clicks 카운터는 **그대로 둔다** — 어드민 화면이 그 값을 쓰고 있고,
// 낮은 빈도라 경합 위험도 없다. GA4 는 그 옆에 나란히 쌓는다.
// ============================================================

// 같은 광고가 리렌더로 여러 번 찍히는 것을 막는다.
// 60초: React 리렌더 폭주는 걸러내되, 몇 분 뒤 다시 본 것은 새 노출로 인정.
const PROMO_DEDUP_MS = 60 * 1000;
const _promoSeen = new Map(); // key → 마지막 기록 시각

const _promoKey = (ad, placement) =>
  `${ad?._campaignId || ad?.id || '?'}|${placement || ''}`;

// 광고 객체에서 리포트에 쓸 값만 뽑는다. 필드명은 FirebaseAdService 가 만드는 형태.
const _promoParams = (ad, placement) => ({
  promo_id: String(ad?._campaignId || ad?.id || ''),
  promo_name: ad?._title || ad?.title || '',
  promo_slot: placement || 'default',
});

// 노출 — 광고가 실제로 화면에 그려질 때 1회
export const logPromoImpression = (ad, placement) => {
  if (!ad) return;
  const key = _promoKey(ad, placement);
  const now = Date.now();
  const last = _promoSeen.get(key);
  if (last && now - last < PROMO_DEDUP_MS) return;
  _promoSeen.set(key, now);
  // 오래된 항목 정리 — 앱을 오래 켜둬도 Map 이 무한히 자라지 않게.
  if (_promoSeen.size > 200) {
    for (const [k, t] of _promoSeen) if (now - t > PROMO_DEDUP_MS) _promoSeen.delete(k);
  }
  return logEvent(EVENTS.PROMO_IMPRESSION, _promoParams(ad, placement));
};

// 클릭 — 광고를 눌러 링크가 열릴 때
export const logPromoClick = (ad, placement) =>
  ad ? logEvent(EVENTS.PROMO_CLICK, _promoParams(ad, placement)) : undefined;

// ============================================================
// Analytics collection ON/OFF (개인정보 보호 / 옵트아웃 대응)
// ============================================================

export const setAnalyticsEnabled = async (enabled) => {
  const inst = getInstance();
  if (!inst) return;
  try {
    await inst.setAnalyticsCollectionEnabled(!!enabled);
  } catch (e) {
    if (__DEV__) console.log('[analytics] setAnalyticsCollectionEnabled failed:', e?.message);
  }
};
