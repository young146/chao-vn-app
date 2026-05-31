// services/FirebaseAdService.js
// daily-news-final 어드민(Firestore "app_ads")의 광고 데이터를
// 앱 AdBanner.js가 기대하는 슬롯별 dict로 변환해 제공합니다.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where, updateDoc, doc, increment } from 'firebase/firestore';
import { getDb } from '../firebase/config';

const CACHE_DURATION = 5 * 60 * 1000; // 5분 (세션 내 화면별 결과 캐시)

// 광고 디스크 캐시 (stale-while-revalidate).
// - 디스크 캐시는 만료시키지 않는다 → 콜드 스타트에서 며칠 지난 캐시라도 즉시 노출(노출 공백 0).
// - 다만 캐시가 REFRESH_INTERVAL보다 오래됐으면 백그라운드에서 1회 갱신해 최신 광고를 받아온다.
//   (표시는 캐시로 즉시, 최신화는 뒤에서 → 노출과 최신성을 분리)
const PERSIST_KEY = 'app_ads_raw_cache_v1';
const REFRESH_INTERVAL = 60 * 60 * 1000; // 1시간: 이보다 오래된 캐시면 백그라운드 갱신

// 화면별 결과 캐시 (screen → { config, time })
const screenCache = {};

// raw Firestore 문서는 한 번만 fetch. 동시 호출 dedup용 promise 보관.
let rawDocsCache = null;      // 이번 세션 메모리에 올라온 문서
let rawDocsStoredAt = 0;      // 그 문서가 디스크에 저장/네트워크 fetch된 시각
let rawFetchPromise = null;   // 동시 호출 dedup
let bgRefreshing = false;     // 백그라운드 갱신 중복 방지

// daily-news-final position → main AdBanner 슬롯 매핑
const POSITION_TO_SLOTS = {
  head: ['home_banner', 'header', 'detail_top'],
  inner: ['home_inline', 'inline', 'detail_middle'],
  bottom: ['fixed_bottom', 'detail_bottom'],
  popup: ['popup'],
};

// daily-news-final targetPages → main screen 키 매핑 (한 항목이 여러 screen에 대응 가능)
const TARGETPAGE_TO_SCREENS = {
  home: ['home'],
  magazine: ['news'],
  'magazine-detail': ['news'],
  jobs: ['job'],
  'jobs-detail': ['job'],
  realestate: ['realestate'],
  'realestate-detail': ['realestate'],
  danggn: ['danggn'],
  'danggn-detail': ['danggn'],
  neighbor: ['neighbor'], // NeighborBusinessesScreen이 screen="neighbor"로 호출함
};

const EMPTY_CONFIG = () => ({
  home_banner: [],
  home_inline: [],
  header: [],
  inline: [],
  detail_top: [],
  detail_middle: [],
  detail_bottom: [],
  fixed_bottom: [],
  fixed_top: [],
  popup: [],
});

const todayStr = () => new Date().toISOString().slice(0, 10);

// 광고가 호출자 screen에 노출되어야 하는지 판단
const matchesScreen = (ad, callerScreen) => {
  const targets = ad.targetPages;
  // targetPages 비어있거나 없으면 전체 노출
  if (!targets || targets.length === 0) return true;
  if (callerScreen === 'all') return true;

  const allowedScreens = new Set();
  for (const t of targets) {
    const mapped = TARGETPAGE_TO_SCREENS[t];
    if (mapped) mapped.forEach((s) => allowedScreens.add(s));
  }
  return allowedScreens.has(callerScreen);
};

// daily-news-final 광고 1건 → main 형식 ad 객체 배열 (이미지 다중일 때 펼침)
const expandAdToMainFormat = (ad) => {
  const images = Array.isArray(ad.images) ? ad.images : [];
  if (images.length === 0) return [];

  const base = {
    linkUrl: ad.linkUrl || '',
    priority: Number(ad.priority) || 10,
    _campaignId: ad.id,
    _title: ad.title,
  };

  if (ad.type === 'video') {
    return [{
      ...base,
      id: ad.id,
      videoUrl: images[0],
    }];
  }

  // image: 각 이미지를 별개 ad로 (AdSlider 자동 슬라이딩 활용)
  return images.map((img, idx) => ({
    ...base,
    id: idx === 0 ? ad.id : `${ad.id}__${idx}`,
    imageUrl: img,
  }));
};

// 디스크(AsyncStorage)에서 광고 문서를 읽는다. 없거나 손상 시 null.
const loadPersistedDocs = async () => {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.docs)) return null;
    return parsed; // { docs, time }
  } catch (_) {
    return null;
  }
};

// 디스크에 광고 문서를 저장한다. 동기 직렬화/비동기 쓰기 모두 예외를 삼킨다(노출엔 영향 없음).
const persistDocs = (docs, time) => {
  try {
    AsyncStorage.setItem(PERSIST_KEY, JSON.stringify({ docs, time })).catch(() => {});
  } catch (_) {}
};

// 실제 Firestore fetch + 메모리/디스크 캐시 동시 갱신.
const fetchAndStoreRawDocs = async () => {
  const db = await getDb();
  const snapshot = await getDocs(
    query(collection(db, 'app_ads'), where('isActive', '==', true)),
  );
  const docs = [];
  snapshot.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
  rawDocsCache = docs;
  rawDocsStoredAt = Date.now();
  persistDocs(docs, rawDocsStoredAt); // fire-and-forget
  return docs;
};

// 캐시가 묵었을 때 백그라운드에서 1회만 갱신 (노출은 막지 않음, 중복 요청 방지).
const refreshInBackground = () => {
  if (bgRefreshing) return;
  bgRefreshing = true;
  fetchAndStoreRawDocs()
    .catch(() => {})
    .finally(() => { bgRefreshing = false; });
};

// Firestore raw 문서를 가져온다. 우선순위: 메모리 → 디스크 → 네트워크.
// 표시는 항상 캐시로 즉시. 캐시가 REFRESH_INTERVAL보다 오래됐을 때만 백그라운드 갱신.
// 동시에 여러 screen이 호출해도 Promise를 공유하므로 네트워크/디스크 읽기는 1회만 발생.
const getRawDocs = async () => {
  // 1) 메모리 캐시 — 이번 세션에서 이미 로드함. 항상 즉시 반환.
  if (rawDocsCache) {
    if (Date.now() - rawDocsStoredAt >= REFRESH_INTERVAL) refreshInBackground();
    return rawDocsCache;
  }
  if (rawFetchPromise) return rawFetchPromise;

  rawFetchPromise = (async () => {
    // 2) 디스크 캐시 — 콜드 스타트에서 네트워크 없이 즉시 노출.
    const persisted = await loadPersistedDocs();
    if (persisted) {
      rawDocsCache = persisted.docs;
      rawDocsStoredAt = persisted.time;
      // 묵은 캐시면 stale 즉시 반환 + 백그라운드 갱신.
      if (Date.now() - persisted.time >= REFRESH_INTERVAL) refreshInBackground();
      return persisted.docs;
    }
    // 3) 디스크에도 없음(최초 실행) → 네트워크에서 가져와 저장. (storedAt=now → 곧바로 또 갱신하지 않음)
    return fetchAndStoreRawDocs();
  })().finally(() => { rawFetchPromise = null; });

  return rawFetchPromise;
};

/**
 * Firestore "app_ads" 컬렉션에서 활성 광고를 가져와 슬롯별 dict로 변환합니다.
 * raw 문서는 한 번만 fetch 후 재사용. 화면별 결과는 개별 캐싱.
 *
 * @param {string} callerScreen - 'all' | 'home' | 'news' | 'job' | 'realestate' | 'danggn'
 * @returns {Promise<object>} 슬롯별 광고 배열 dict
 */
export const fetchAppAdsConfig = async (callerScreen = 'all', _attempt = 0) => {
  const now = Date.now();
  const cached = screenCache[callerScreen];
  if (cached && now - cached.time < CACHE_DURATION) return cached.config;

  try {
    console.log(`📢 Firebase 광고 로드: screen=${callerScreen}${_attempt > 0 ? ` (재시도 ${_attempt})` : ''}`);
    const docs = await getRawDocs();

    const config = EMPTY_CONFIG();
    const today = todayStr();
    let total = 0;

    for (const data of docs) {
      if (data.startDate && data.startDate > today) continue;
      if (data.endDate && data.endDate < today) continue;
      if (!matchesScreen(data, callerScreen)) continue;

      const slots = POSITION_TO_SLOTS[data.position];
      if (!slots) continue;

      const adObjects = expandAdToMainFormat(data);
      if (adObjects.length === 0) continue;

      for (const slot of slots) {
        for (const adObj of adObjects) {
          config[slot].push(adObj);
        }
      }
      total += 1;
    }

    screenCache[callerScreen] = { config, time: Date.now() };

    const counts = Object.entries(config)
      .filter(([, arr]) => arr.length > 0)
      .map(([slot, arr]) => `${slot}:${arr.length}`)
      .join(', ') || '없음';
    console.log(`✅ Firebase 광고 ${total}건 로드 (${counts})`);

    return config;
  } catch (error) {
    console.log('❌ Firebase 광고 로드 실패:', error?.message || error);
    // Firebase 초기화 지연 등으로 실패 시 최대 2회 재시도 (2s, 4s 대기)
    if (_attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (_attempt + 1)));
      rawDocsCache = null; // 메모리 캐시 무효화 후 재시도 (디스크 캐시는 보존)
      rawDocsStoredAt = 0;
      return fetchAppAdsConfig(callerScreen, _attempt + 1);
    }
    return EMPTY_CONFIG();
  }
};

/**
 * 캠페인 단위 노출수 +1
 * 펼쳐진 ad 객체의 _campaignId(원본 docId)를 사용해야 합니다.
 */
export const trackAppAdImpression = async (campaignId) => {
  if (!campaignId) return;
  try {
    const db = await getDb();
    await updateDoc(doc(db, 'app_ads', campaignId), { impressions: increment(1) });
  } catch (error) {
    console.log('광고 노출수 업데이트 실패:', error?.message || error);
  }
};

/**
 * 캠페인 단위 클릭수 +1
 */
export const trackAppAdClick = async (campaignId) => {
  if (!campaignId) return;
  try {
    const db = await getDb();
    await updateDoc(doc(db, 'app_ads', campaignId), { clicks: increment(1) });
  } catch (error) {
    console.log('광고 클릭수 업데이트 실패:', error?.message || error);
  }
};

/**
 * 앱 시작(스플래시) 시점에 호출하는 광고 워밍업.
 * - 디스크 캐시를 메모리로 끌어올려, 첫 화면이 그려질 때 광고가 이미 준비되게 함(노출 공백 0).
 * - getRawDocs가 "캐시가 1시간 이상 묵었으면 백그라운드 갱신"까지 알아서 처리하므로
 *   여기서 별도 갱신 호출은 하지 않는다(중복 네트워크 방지).
 * 스플래시(약 5초) 유휴 시간을 쓰므로 체감 지연 없음. fire-and-forget — 절대 throw 안 함.
 */
export const prefetchAppAds = async () => {
  try {
    await getRawDocs(); // 디스크/메모리 워밍 + 필요 시 백그라운드 갱신
  } catch (_) {}
};

// 캐시 강제 무효화 (개발/디버깅용) — 메모리 + 디스크 모두 비움
export const invalidateAppAdsCache = () => {
  Object.keys(screenCache).forEach((k) => delete screenCache[k]);
  rawDocsCache = null;
  rawDocsStoredAt = 0;
  rawFetchPromise = null;
  AsyncStorage.removeItem(PERSIST_KEY).catch(() => {});
};
