// ============================================================
// 블랙리스트(영구 제명) 핵심 로직 — 한 곳에 모음
//
// [설계 원칙]
// 1. 차단 키 = "Firebase 토큰 이메일". 재가입해도 같은 계정이면 이메일이 같으므로
//    uid(매번 바뀜)가 아니라 이메일로 키잉해야 재가입이 막힌다.
// 2. 카카오는 Firebase 계정 이메일이 합성값(kakao_{id}@chaovietnam.co.kr)이다.
//    users 문서의 email(진짜 카카오 이메일)과 다르므로, 카카오는 kakaoId로 키를 만든다.
// 3. 진짜 강제는 Firestore 보안 규칙(isBanned)이 한다. 여기 클라 검사는 UX(즉시 안내)용.
//    그래서 조회 실패 시 false(통과)로 둬도 안전하다 — 서버 규칙이 최종 방어.
// ============================================================
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

const KAKAO_EMAIL_DOMAIN = "chaovietnam.co.kr";

export const BANNED_MESSAGE =
  "이 계정은 이용약관 위반으로 영구 제한되었습니다.\n\n문의: info@chaovietnam.co.kr";

// users 문서(또는 회원목록 항목)로부터 차단 키 생성 (관리자 = 제명할 때 사용)
export function banKeyFromUserDoc(u) {
  if (!u) return null;
  // 카카오: 합성 이메일이 토큰 이메일이므로 kakaoId로 재구성해야 규칙과 일치
  if (u.kakaoId) return `kakao_${u.kakaoId}@${KAKAO_EMAIL_DOMAIN}`;
  return u.email || null;
}

// 로그인된 Firebase user 객체로부터 차단 키 (검사할 때 사용)
// 토큰 이메일을 그대로 쓴다 — 카카오도 currentUser.email = 합성 이메일이라 자동 일치
export function banKeyFromAuthUser(authUser) {
  return authUser && authUser.email ? authUser.email : null;
}

// 차단 여부 조회 (단일 getDoc). 실패·지연 시 false (서버 규칙이 최종 방어)
export async function isBanned(banKey) {
  if (!banKey) return false;
  try {
    const timeout = new Promise((resolve) => setTimeout(() => resolve("__timeout__"), 4000));
    const result = await Promise.race([
      getDoc(doc(db, "bannedUsers", banKey)),
      timeout,
    ]);
    if (result === "__timeout__") {
      console.log("블랙리스트 조회 타임아웃(통과 처리, 서버규칙이 방어)");
      return false;
    }
    return result.exists();
  } catch (e) {
    console.log("블랙리스트 조회 실패(통과 처리, 서버규칙이 방어):", e?.message);
    return false;
  }
}

// 블랙리스트 등록 (관리자)
export async function addToBlacklist(userDoc, reason, bannedByEmail) {
  const key = banKeyFromUserDoc(userDoc);
  if (!key) {
    throw new Error("차단 키를 만들 수 없습니다 (이메일·카카오ID 둘 다 없음).");
  }
  await setDoc(doc(db, "bannedUsers", key), {
    banKey: key,
    uid: userDoc.uid || userDoc.id || null,
    email: userDoc.email || null,
    kakaoId: userDoc.kakaoId ? String(userDoc.kakaoId) : null,
    phone: userDoc.phone || null,
    name: userDoc.name || null,
    reason: reason || "",
    bannedAt: serverTimestamp(),
    bannedBy: bannedByEmail || "admin",
  });
  return key;
}

// 블랙리스트 해제 (관리자) — userDoc 또는 banKey 문자열을 받음
export async function removeFromBlacklist(userDocOrKey) {
  const key =
    typeof userDocOrKey === "string"
      ? userDocOrKey
      : banKeyFromUserDoc(userDocOrKey);
  if (!key) return;
  await deleteDoc(doc(db, "bannedUsers", key));
}
