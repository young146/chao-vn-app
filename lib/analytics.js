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
  const inst = getInstance();
  if (!inst) {
    if (__DEV__) console.log(`[analytics] (skip, no instance) ${eventName}`, params);
    return;
  }
  try {
    // GA4 파라미터 값은 100자 이내, 25개 이내로 제한 — 안전하게 직렬화
    const safe = {};
    for (const k of Object.keys(params)) {
      const v = params[k];
      if (v == null) continue;
      safe[k] = typeof v === 'string' ? v.slice(0, 100) : v;
    }
    await inst.logEvent(eventName, safe);
    if (__DEV__) console.log(`[analytics] ${eventName}`, safe);
  } catch (e) {
    if (__DEV__) console.log('[analytics] logEvent failed:', eventName, e?.message);
  }
};

// 화면 추적 — NavigationContainer onStateChange에서 호출
export const logScreenView = async (screenName, screenClass) => {
  const inst = getInstance();
  if (!inst) return;
  try {
    await inst.logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
    if (__DEV__) console.log(`[analytics] screen_view: ${screenName}`);
  } catch (e) {
    if (__DEV__) console.log('[analytics] screen_view failed:', e?.message);
  }
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
