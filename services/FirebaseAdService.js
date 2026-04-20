import { collection, getDocs, query, where, updateDoc, doc, increment } from 'firebase/firestore';
import { getDb } from '../firebase/config';

let cachedAds = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시

/**
 * 활성화된 모든 광고를 Firestore app_ads 컬렉션에서 가져옴
 * Admin(daily-news-final)에서 등록된 슬롯/페이지 이름 기준:
 *   position: head | inner | bottom
 *   targetPages: home | danggn | danggn-detail | realestate | realestate-detail
 *                jobs | jobs-detail | magazine | magazine-detail | neighbor
 */
export const fetchFirebaseAds = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedAds && (now - lastFetchTime) < CACHE_DURATION) {
    return cachedAds;
  }

  try {
    const db = await getDb();
    const adsRef = collection(db, 'app_ads');
    const q = query(adsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);

    const currentDate = new Date().toISOString().split('T')[0];
    const ads = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // 날짜 유효성 검사 (클라이언트 측)
      if (data.startDate && data.endDate) {
        if (currentDate >= data.startDate && currentDate <= data.endDate) {
          ads.push({ id: docSnap.id, ...data });
        }
      } else {
        ads.push({ id: docSnap.id, ...data });
      }
    });

    cachedAds = ads;
    lastFetchTime = now;
    console.log(`✅ Firebase 앱 광고 로드 완료: 총 ${ads.length}개 활성`);
    return cachedAds;

  } catch (error) {
    console.error('❌ Firebase 광고 로드 실패:', error);
    return [];
  }
};

/**
 * position과 targetPage로 필터링된 광고 목록 반환
 * @param {string} position - 'head' | 'inner' | 'bottom'
 * @param {string} targetPage - 'home' | 'danggn' | 'danggn-detail' | 'realestate' | ...
 */
export const getFilteredAds = async (position, targetPage) => {
  const allAds = await fetchFirebaseAds();
  if (!allAds || allAds.length === 0) return [];

  return allAds.filter(ad => {
    if (ad.position !== position) return false;
    // targetPages 없거나 빈 배열이면 전체 노출
    if (!ad.targetPages || ad.targetPages.length === 0) return true;
    return ad.targetPages.includes(targetPage);
  }).sort((a, b) => (Number(b.priority) || 10) - (Number(a.priority) || 10));
};

/**
 * 광고 노출수 1 증가
 */
export const trackFirebaseAdImpression = async (adId) => {
  if (!adId) return;
  try {
    const db = await getDb();
    await updateDoc(doc(db, 'app_ads', adId), { impressions: increment(1) });
  } catch (error) {
    console.warn('광고 노출수 업데이트 실패:', error);
  }
};

/**
 * 광고 클릭수 1 증가
 */
export const trackFirebaseAdClick = async (adId) => {
  if (!adId) return;
  try {
    const db = await getDb();
    await updateDoc(doc(db, 'app_ads', adId), { clicks: increment(1) });
  } catch (error) {
    console.warn('광고 클릭수 업데이트 실패:', error);
  }
};
