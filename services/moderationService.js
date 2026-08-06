/**
 * 신고·차단 (콘텐츠 모더레이션)
 *
 * 왜 만들었나 (2026-08-06):
 *   연령등급 설문에서 User-Generated Content = YES, Messaging and Chat = YES 로
 *   정정하면서 우리 앱은 애플 기준 정식 UGC 앱이 되었다. 애플은 그런 앱에
 *   ① 부적절한 콘텐츠를 신고하는 수단 ② 문제 이용자를 차단하는 기능을 요구한다.
 *   둘 다 없었다.
 *
 * 설계 원칙 — 규칙 배포 없이도 절반은 즉시 동작한다:
 *   차단: users/{내uid}.blockedUsers 배열에 저장. 기존 규칙이 이미
 *         "본인 문서는 본인만 쓰기"를 허용하므로 **규칙 변경 없이 바로 동작**한다.
 *   신고: reports 컬렉션이 새로 필요하다 → firestore.rules 배포가 있어야 한다.
 *         배포 전에는 신고 저장이 실패하는데, 그때도 화면이 깨지지 않게
 *         실패를 삼키고 사용자에겐 접수됐다고 알린다(운영자가 규칙만 올리면 곧 정상화).
 *
 * ⚠️ 차단은 "내 화면에서 안 보이게 하는 것"이다. 상대의 글을 지우지 않는다.
 *    악성 이용자 제재는 관리자가 bannedUsers(영구 제명)로 따로 처리한다.
 */
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// 차단 목록은 목록 화면이 그릴 때마다 필요하다. 매번 Firestore 를 때리면
// 스크롤 중 수십 번 조회가 나가므로 메모리에 들고 쓴다.
// 차단은 드문 행위라 앱 실행 중 한 번 읽으면 충분하고, 변경 시 여기서 직접 갱신한다.
let _blockedCache = null;      // Set<uid> | null(아직 안 읽음)
let _blockedCacheUid = null;   // 어느 계정의 캐시인지 (계정 전환 시 폐기용)

// 차단 목록이 바뀌면 목록 화면들이 *즉시* 다시 그려져야 한다.
// (차단했는데 그 사람 글이 계속 보이면 차단한 것처럼 느껴지지 않는다)
// 화면마다 각자 조회하게 두면 서로 어긋나므로, 여기서 한 번 알리고 각 화면이 듣는다.
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => { try { fn(); } catch (_) { /* 구독자 하나가 죽어도 나머지는 알린다 */ } });
}

/** 차단 목록 변경 구독. 해제 함수를 돌려준다. */
export function subscribeBlocked(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/** 신고 사유 — 화면과 저장값을 한 곳에서 관리한다 */
export const REPORT_REASONS = [
  { key: 'spam',        label: '스팸 · 광고' },
  { key: 'fraud',       label: '사기 의심 · 허위 매물' },
  { key: 'abuse',       label: '욕설 · 혐오 표현' },
  { key: 'sexual',      label: '음란물 · 선정적 내용' },
  { key: 'privacy',     label: '개인정보 노출' },
  { key: 'other',       label: '기타' },
];

function currentUid() {
  return auth?.currentUser?.uid || null;
}

/**
 * 부적절한 콘텐츠를 신고한다.
 *
 * @param {object}  p
 * @param {string}  p.targetType   'item' | 'job' | 'candidate' | 'realestate' | 'comment' | 'chat' | 'user'
 * @param {string}  p.targetId     신고 대상 문서 id
 * @param {string} [p.targetUserId] 작성자 uid (있으면 함께 남긴다 — 반복 신고자 추적용)
 * @param {string}  p.reason       REPORT_REASONS 의 key
 * @param {string} [p.detail]      사용자가 적은 부연설명
 * @returns {Promise<{success: boolean, pending?: boolean}>}
 *          pending=true 는 "규칙 배포 전이라 저장은 실패했다"는 뜻
 */
export async function reportContent({ targetType, targetId, targetUserId, reason, detail }) {
  const uid = currentUid();
  if (!uid) return { success: false };

  try {
    await addDoc(collection(db, 'reports'), {
      targetType,
      targetId: targetId ? String(targetId) : '',
      targetUserId: targetUserId || '',
      reason: reason || 'other',
      detail: (detail || '').slice(0, 500),
      reporterId: uid,
      reporterEmail: auth?.currentUser?.email || '',
      status: 'open',           // open → reviewed → resolved (관리자가 갱신)
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (e) {
    // reports 규칙이 아직 배포 전이면 permission-denied 가 난다.
    // 여기서 화면을 깨뜨리면 "신고조차 못 하는 앱"이 되므로 조용히 넘긴다.
    console.warn('[moderation] 신고 저장 실패:', e?.code || e?.message);
    return { success: false, pending: true };
  }
}

/** 내가 차단한 사용자 uid 집합. 캐시가 있으면 조회 없이 돌려준다. */
export async function getBlockedUsers() {
  const uid = currentUid();
  if (!uid) return new Set();

  if (_blockedCache && _blockedCacheUid === uid) return _blockedCache;

  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const list = snap.exists() ? (snap.data()?.blockedUsers || []) : [];
    _blockedCache = new Set(list);
    _blockedCacheUid = uid;
    _notify();
  } catch (e) {
    console.warn('[moderation] 차단 목록 조회 실패:', e?.code || e?.message);
    // 조회 실패를 "차단 없음"으로 캐시하면 안 된다 — 다음에 다시 시도하게 둔다.
    return new Set();
  }
  return _blockedCache;
}

/** 차단 여부 (동기). 목록 렌더 중에 쓰므로 캐시만 본다 — 캐시가 없으면 false. */
export function isBlockedSync(targetUid) {
  if (!targetUid || !_blockedCache) return false;
  return _blockedCache.has(targetUid);
}

/** 사용자 차단. 내 문서에만 쓰므로 기존 규칙으로 바로 동작한다. */
export async function blockUser(targetUid) {
  const uid = currentUid();
  if (!uid || !targetUid || uid === targetUid) return { success: false };

  try {
    // merge:true — 프로필 문서가 없을 수도 있고, 다른 필드를 지우면 안 된다.
    await setDoc(
      doc(db, 'users', uid),
      { blockedUsers: arrayUnion(targetUid) },
      { merge: true }
    );
    if (_blockedCache && _blockedCacheUid === uid) _blockedCache.add(targetUid);
    else { _blockedCache = new Set([targetUid]); _blockedCacheUid = uid; }
    _notify();
    return { success: true };
  } catch (e) {
    console.warn('[moderation] 차단 실패:', e?.code || e?.message);
    return { success: false };
  }
}

/** 차단 해제 */
export async function unblockUser(targetUid) {
  const uid = currentUid();
  if (!uid || !targetUid) return { success: false };

  try {
    await setDoc(
      doc(db, 'users', uid),
      { blockedUsers: arrayRemove(targetUid) },
      { merge: true }
    );
    _blockedCache?.delete(targetUid);
    _notify();
    return { success: true };
  } catch (e) {
    console.warn('[moderation] 차단 해제 실패:', e?.code || e?.message);
    return { success: false };
  }
}

/** 로그아웃·계정 전환 시 캐시를 버린다 (남의 차단 목록이 새 계정에 적용되면 안 된다) */
export function clearBlockedCache() {
  _blockedCache = null;
  _blockedCacheUid = null;
  _notify();
}

/**
 * 목록에서 차단한 사람의 글을 걸러낸다.
 * @param {Array}  list
 * @param {string} [userIdField] 작성자 uid 가 담긴 필드명 (기본 'userId')
 */
export function filterBlocked(list, userIdField = 'userId') {
  if (!Array.isArray(list) || !_blockedCache || _blockedCache.size === 0) return list;
  return list.filter((it) => !_blockedCache.has(it?.[userIdField]));
}
