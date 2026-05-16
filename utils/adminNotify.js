import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

const ADMIN_EMAILS = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];

const TYPE_LABELS = {
  new_item_danggn: "🥕 당근/나눔",
  new_item_job: "💼 구인구직",
  new_item_realestate: "🏠 부동산",
};

const sendExpoPush = async (token, title, body, data = {}) => {
  if (!token || !token.startsWith("ExponentPushToken")) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: token, sound: "default", title, body, data }),
    });
  } catch (e) {
    console.warn("[adminNotify] push 전송 실패", e?.message);
  }
};

/**
 * 관리자에게 Firestore 알림 기록 + 실제 Expo 푸시 전송
 * @param {object} opts
 * @param {string} opts.type - 'new_item_danggn' | 'new_item_job' | 'new_item_realestate'
 * @param {string} opts.itemId
 * @param {string} opts.itemTitle
 * @param {string} [opts.itemImage]
 * @param {string|number} [opts.itemPrice]
 * @param {string} [opts.sellerEmail]
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

      const adminDoc = snap.docs[0];
      const adminUserId = adminDoc.id;
      const { expoPushToken } = adminDoc.data();

      await addDoc(collection(db, "notifications"), {
        userId: adminUserId,
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

      if (expoPushToken) {
        await sendExpoPush(expoPushToken, `${label} 새 등록`, itemTitle, {
          type,
          itemId,
        });
      }
    }
  } catch (e) {
    console.error("[adminNotify] 오류:", e);
  }
};
