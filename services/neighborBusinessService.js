import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { db, storage } from '../firebase/config';

/**
 * 이웃사업 (우리 이웃 제품/업소) 서비스
 * 관련 문서: directives/NEIGHBOR_BUSINESSES_PLAN.md
 *
 * Firestore 컬렉션: NeighborBusinesses
 * Firebase Storage 경로: neighbor_businesses/{businessId}/{index}.jpg
 */

const COLLECTION_NAME = 'NeighborBusinesses';
const STORAGE_BASE = 'neighbor_businesses';

// ==============================================
// 조회
// ==============================================

/**
 * 공개용 활성 업소 목록 (비로그인도 가능)
 *
 * @param {Object} opts
 * @param {string} [opts.city] - VIETNAM_LOCATIONS key (예: "호치민")
 * @param {string} [opts.district] - 도시 내 구/군
 * @param {string} [opts.category] - food | service | ...
 * @param {number} [opts.limit=50]
 * @returns {Promise<Array>}
 */
export async function fetchActiveBusinesses({ city, district, category, limit: max = 50 } = {}) {
  try {
    if (!db) return [];
    const nowIso = new Date().toISOString().slice(0, 10);

    // Firestore는 복합 where에 제약이 있어 서버쿼리는 간단히, 세부 필터는 클라이언트에서
    const filters = [
      where('active', '==', true),
      where('approvalStatus', '==', 'approved'),
    ];
    if (city) filters.push(where('city', '==', city));
    if (category) filters.push(where('category', '==', category));

    const q = query(
      collection(db, COLLECTION_NAME),
      ...filters,
      orderBy('priority', 'desc'),
      limit(max)
    );

    const snap = await getDocs(q);
    const items = [];
    for (const d of snap.docs) {
      const data = { id: d.id, ...d.data() };

      // 기간 만료 필터 (클라이언트)
      if (data.endDate && data.endDate < nowIso) continue;
      if (data.startDate && data.startDate > nowIso) continue;

      // 구/군 필터 (클라이언트)
      if (district && data.district !== district) continue;

      items.push(data);
    }
    return items;
  } catch (err) {
    console.warn('[neighborBusinessService] fetchActiveBusinesses error:', err?.message);
    return [];
  }
}

/**
 * 최근 등록된 업소 (최근 N일 이내)
 *
 * @param {number} days - 기준 일수 (기본 7일)
 * @param {number} max - 최대 개수 (기본 5)
 */
export async function fetchRecentBusinesses(days = 7, max = 5) {
  try {
    if (!db) return [];
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const cutoffTs = Timestamp.fromMillis(cutoffMs);

    const q = query(
      collection(db, COLLECTION_NAME),
      where('active', '==', true),
      where('approvalStatus', '==', 'approved'),
      where('createdAt', '>=', cutoffTs),
      orderBy('createdAt', 'desc'),
      limit(max)
    );

    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[neighborBusinessService] fetchRecentBusinesses error:', err?.message);
    return [];
  }
}

/**
 * 단일 업소 조회
 */
export async function fetchBusinessById(id) {
  try {
    if (!db || !id) return null;
    const snap = await getDoc(doc(db, COLLECTION_NAME, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.warn('[neighborBusinessService] fetchBusinessById error:', err?.message);
    return null;
  }
}

/**
 * 관리자 전체 목록 (비활성/만료 포함)
 */
export async function fetchAllForAdmin({ max = 200 } = {}) {
  try {
    if (!db) return [];
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[neighborBusinessService] fetchAllForAdmin error:', err?.message);
    return [];
  }
}

// ==============================================
// 이미지 업로드 (Firebase Storage)
// ==============================================

async function resizeImage(uri, maxWidth = 1600) {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch (err) {
    console.warn('[neighborBusinessService] resizeImage fallback:', err?.message);
    return uri;
  }
}

/**
 * 이미지 1장 업로드 (이미 https URL이면 그대로 반환)
 *
 * @param {string} uri - 로컬 파일 URI 또는 https URL
 * @param {string} businessId - 문서 ID (신규면 "new_{timestamp}" 같은 임시값 OK)
 * @param {number} index
 * @returns {Promise<string>} 업로드된 download URL
 */
export async function uploadBusinessImage(uri, businessId, index) {
  if (!uri) throw new Error('uri required');
  if (uri.startsWith('https://')) return uri;

  const resized = await resizeImage(uri);
  const response = await fetch(resized);
  const blob = await response.blob();

  const filename = `${STORAGE_BASE}/${businessId}/${Date.now()}_${index}.jpg`;
  const storageRef = ref(storage, filename);
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  return url;
}

/**
 * 여러 이미지 순차 업로드
 */
export async function uploadBusinessImages(uris, businessId) {
  const urls = [];
  for (let i = 0; i < uris.length; i++) {
    const url = await uploadBusinessImage(uris[i], businessId, i);
    urls.push(url);
  }
  return urls;
}

/**
 * 이미지 삭제 (URL로부터 Storage path 추출해서 삭제)
 * 실패 시 조용히 무시 (이미 삭제됐거나 등)
 */
export async function deleteBusinessImage(url) {
  try {
    if (!url || !url.startsWith('https://')) return;
    // URL에서 path 추출 (Firebase Storage URL 형식)
    // e.g. .../o/neighbor_businesses%2Fabc%2F123.jpg?...
    const m = url.match(/\/o\/([^?]+)/);
    if (!m) return;
    const path = decodeURIComponent(m[1]);
    await deleteObject(ref(storage, path));
  } catch (err) {
    // 조용히 무시
  }
}

// ==============================================
// 쓰기 (관리자)
// ==============================================

/**
 * 업소 생성
 *
 * @param {Object} data - NeighborBusinesses 스키마 (이미지는 이미 업로드된 URL 배열)
 * @param {string} userId - createdBy
 * @returns {Promise<string>} 새 문서 ID
 */
export async function createBusiness(data, userId = 'admin') {
  const doc = {
    name: data.name || '',
    description: data.description || '',
    listingType: data.listingType || 'business',
    category: data.category || 'other',
    tags: data.tags || [],

    city: data.city || '',
    district: data.district || '',
    address: data.address || '',
    location: data.location || null,

    contacts: data.contacts || {},

    businessHours: data.businessHours || null,
    holidayNote: data.holidayNote || '',

    images: data.images || [],
    thumbnailIndex: data.thumbnailIndex || 0,

    externalLink: data.externalLink || null,

    active: data.active !== false,
    priority: data.priority ?? 10,
    startDate: data.startDate || null,
    endDate: data.endDate || null,

    viewsCount: 0,
    clicksCount: 0,
    favoritesCount: 0,
    contactClicks: { phone: 0, kakao: 0, email: 0, website: 0 },

    submittedBy: data.submittedBy || null,
    paymentStatus: data.paymentStatus || null,
    paymentInfo: data.paymentInfo || null,
    approvalStatus: data.approvalStatus || 'approved',

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  };

  const ref_ = await addDoc(collection(db, COLLECTION_NAME), doc);
  return ref_.id;
}

/**
 * 업소 수정 (부분 업데이트)
 */
export async function updateBusiness(id, patch) {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 업소 삭제
 */
export async function deleteBusiness(id) {
  // 이미지도 함께 삭제하려면 먼저 조회
  try {
    const existing = await fetchBusinessById(id);
    if (existing?.images?.length) {
      for (const url of existing.images) {
        await deleteBusinessImage(url);
      }
    }
  } catch {}
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

// ==============================================
// 통계
// ==============================================

export async function incrementViews(id) {
  try {
    if (!db || !id) return;
    await updateDoc(doc(db, COLLECTION_NAME, id), {
      viewsCount: increment(1),
    });
  } catch {}
}

/**
 * @param {string} id
 * @param {'view'|'contact_phone'|'contact_kakao'|'contact_email'|'contact_website'|'external_link'} type
 */
export async function incrementClick(id, type = 'view') {
  try {
    if (!db || !id) return;
    const patch = { clicksCount: increment(1) };
    if (type.startsWith('contact_')) {
      const key = type.replace('contact_', '');
      patch[`contactClicks.${key}`] = increment(1);
    }
    await updateDoc(doc(db, COLLECTION_NAME, id), patch);
  } catch {}
}
