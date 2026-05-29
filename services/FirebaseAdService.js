// services/FirebaseAdService.js
// daily-news-final 어드민(Firestore "app_ads")의 광고 데이터를
// 앱 AdBanner.js가 기대하는 슬롯별 dict로 변환해 제공합니다.

import { collection, getDocs, query, where, updateDoc, doc, increment } from 'firebase/firestore';
import { getDb } from '../firebase/config';

const CACHE_DURATION = 5 * 60 * 1000; // 5분

// 화면별 결과 캐시 (screen → { config, time })
const screenCache = {};

// raw Firestore 문서는 한 번만 fetch. 동시 호출 dedup용 promise 보관.
let rawDocsCache = null;
let rawFetchTime = 0;
let rawFetchPromise = null;

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

// Firestore raw 문서를 1번만 가져온다.
// 동시에 여러 screen이 호출해도 Promise를 공유하므로 네트워크 요청은 1회만 발생.
const getRawDocs = async () => {
  const now = Date.now();
  if (rawDocsCache && now - rawFetchTime < CACHE_DURATION) return rawDocsCache;
  if (rawFetchPromise) return rawFetchPromise;

  rawFetchPromise = (async () => {
    const db = await getDb();
    const snapshot = await getDocs(
      query(collection(db, 'app_ads'), where('isActive', '==', true)),
    );
    const docs = [];
    snapshot.forEach((docSnap) => docs.push({ id: docSnap.id, ...docSnap.data() }));
    rawDocsCache = docs;
    rawFetchTime = Date.now();
    return docs;
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
export const fetchAppAdsConfig = async (callerScreen = 'all') => {
  const now = Date.now();
  const cached = screenCache[callerScreen];
  if (cached && now - cached.time < CACHE_DURATION) return cached.config;

  try {
    console.log(`📢 Firebase 광고 로드: screen=${callerScreen}`);
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

// 캐시 강제 무효화 (개발/디버깅용)
export const invalidateAppAdsCache = () => {
  Object.keys(screenCache).forEach((k) => delete screenCache[k]);
  rawDocsCache = null;
  rawFetchTime = 0;
  rawFetchPromise = null;
};
