import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * 공지 배너 서비스
 * 관련 문서: directives/ANNOUNCEMENTS_PLAN.md
 *
 * Firestore 컬렉션: Announcements
 */

const COLLECTION_NAME = 'Announcements';
const DISMISS_KEY_PREFIX = 'announcement_dismissed_';

/**
 * 특정 화면용 활성 공지 하나 조회 (최상위 priority 1개)
 *
 * @param {Object} opts
 * @param {string} opts.targetScreen - "News" | "Home" | "Danggn" | ...
 * @param {string} opts.language - "ko" | "vi" | "en"
 * @returns {Promise<Object|null>} 공지 문서 또는 null
 */
export async function fetchActiveAnnouncement({ targetScreen, language = 'ko' }) {
  try {
    if (!db) {
      console.warn('[announcementService] Firestore not ready');
      return null;
    }

    const nowIso = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

    const q = query(
      collection(db, COLLECTION_NAME),
      where('active', '==', true),
      where('targetScreens', 'array-contains', targetScreen),
      where('endDate', '>=', nowIso),
      orderBy('endDate'),
      orderBy('priority', 'desc'),
      limit(5) // 여유있게 가져오고 클라이언트에서 언어/dismiss 필터
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    // 시작일/언어 필터링 + dismiss 체크는 클라이언트에서
    for (const docSnap of snapshot.docs) {
      const data = { id: docSnap.id, ...docSnap.data() };

      // 시작일 도래 여부
      if (data.startDate && data.startDate > nowIso) continue;

      // 언어 타겟팅 (비어있으면 전체)
      if (Array.isArray(data.targetLanguages) && data.targetLanguages.length > 0) {
        if (!data.targetLanguages.includes(language)) continue;
      }

      // 닫은 배너 건너뛰기
      if (data.showOnce) {
        const dismissed = await isDismissed(data.id);
        if (dismissed) continue;
      }

      return data;
    }

    return null;
  } catch (err) {
    console.warn('[announcementService] fetchActiveAnnouncement error:', err?.message);
    return null;
  }
}

/**
 * 다국어 텍스트 객체에서 현재 언어 텍스트 반환 (폴백: ko → 첫 번째 값)
 *
 * @param {Object|string} textObj - { ko, vi, en } 또는 문자열
 * @param {string} language
 * @returns {string}
 */
export function pickLocalizedText(textObj, language = 'ko') {
  if (!textObj) return '';
  if (typeof textObj === 'string') return textObj;
  if (textObj[language]) return textObj[language];
  if (textObj.ko) return textObj.ko;
  const keys = Object.keys(textObj);
  return keys.length > 0 ? textObj[keys[0]] : '';
}

/**
 * 배너를 닫았는지 확인 (showOnce 배너용)
 */
export async function isDismissed(announcementId) {
  try {
    const v = await AsyncStorage.getItem(DISMISS_KEY_PREFIX + announcementId);
    return v === 'true';
  } catch {
    return false;
  }
}

/**
 * 배너 닫음 처리 (로컬 저장 + Firestore 카운터 증가)
 */
export async function dismissAnnouncement(announcementId) {
  try {
    await AsyncStorage.setItem(DISMISS_KEY_PREFIX + announcementId, 'true');
  } catch (err) {
    console.warn('[announcementService] AsyncStorage save error:', err?.message);
  }
  // Firestore 통계
  trackDismiss(announcementId);
}

/**
 * 노출 카운트 +1 (컴포넌트 마운트 시 1회만 호출)
 */
export async function trackImpression(announcementId) {
  try {
    if (!db) return;
    await updateDoc(doc(db, COLLECTION_NAME, announcementId), {
      impressionsCount: increment(1),
    });
  } catch (err) {
    // 보안 규칙이 카운터 증가를 허용하지 않으면 조용히 무시
    // (나중에 Cloud Function으로 중계하거나 규칙 조정)
  }
}

/**
 * 클릭 카운트 +1
 */
export async function trackClick(announcementId) {
  try {
    if (!db) return;
    await updateDoc(doc(db, COLLECTION_NAME, announcementId), {
      clicksCount: increment(1),
    });
  } catch (err) {
    // 조용히 무시
  }
}

/**
 * 닫기 카운트 +1
 */
export async function trackDismiss(announcementId) {
  try {
    if (!db) return;
    await updateDoc(doc(db, COLLECTION_NAME, announcementId), {
      dismissCount: increment(1),
    });
  } catch (err) {
    // 조용히 무시
  }
}

/**
 * (테스트/디버그용) 특정 공지 dismiss 상태 초기화
 */
export async function resetDismissed(announcementId) {
  try {
    await AsyncStorage.removeItem(DISMISS_KEY_PREFIX + announcementId);
  } catch {}
}
