import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

const ADMIN_EMAILS = ["younghan146@gmail.com", "info@chaovietnam.co.kr"];

const TYPE_LABELS = {
  new_item_danggn: "🥕 당근/나눔",
  new_item_job: "💼 구인구직",
  new_item_realestate: "🏠 부동산",
};

/**
 * 관리자 Firestore 알림 기록 (뱃지 + 알림 목록용)
 * 실제 푸시는 Firebase Cloud Functions(onNewItemCreated 등)에서 처리
 */
export const notifyAdmins = async ({
  type,
  itemId,
  itemTitle,
  itemImage = "",
  itemPrice = "",
  sellerEmail = "",
}) => {
  const label = TYPE_LABELS[type] || "새 게시물";

  try {
    for (const adminEmail of ADMIN_EMAILS) {
      const snap = await getDocs(
        query(collection(db, "users"), where("email", "==", adminEmail))
      );
      if (snap.empty) continue;

      await addDoc(collection(db, "notifications"), {
        userId: snap.docs[0].id,
        type,
        itemId,
        itemTitle,
        itemImage,
        itemPrice,
        sellerEmail,
        message: `${label} 새 게시물: ${itemTitle}`,
        read: false,
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error("[adminNotify] 오류:", e);
  }
};
