const { onDocumentCreated, onDocumentWritten, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { Expo } = require("expo-server-sdk");
const sharp = require("sharp");

initializeApp();
setGlobalOptions({ region: "asia-northeast3" });
const db = getFirestore();
const expo = new Expo();

// ============================================================
// 🌐 viewItem - 카카오톡 링크 카드용 SSR (og:image 포함)
// ============================================================
exports.viewItem = onRequest({ cors: true }, async (req, res) => {
  const id = req.query.id;
  const baseUrl = "https://chaovietnam-login.web.app";

  let title = "씬짜오 (Xin Chao)";
  let description = "베트남 한인 커뮤니티";
  let image = `${baseUrl}/icon.png`;
  let itemType = "danggn"; // 기본값: 당근/나눔

  if (id) {
    try {
      const doc = await db.collection("form_items").doc(id).get();
      if (doc.exists) {
        const data = doc.data();
        title = data.itemName || data.propName || data.jobTitle || "씬짜오 게시글";
        const priceText = data.price || data.propPrice || data.salary || "";
        const loc = [data.city, data.district].filter(Boolean).join(" ");
        description = [priceText, loc, data.description || data.desc || ""].filter(Boolean).join(" · ").substring(0, 200);
        if (data.imageUrls && data.imageUrls.length > 0) {
          image = data.imageUrls[0];
        }
        // category 필드로 type 결정
        const cat = data.category || "secondhand";
        if (cat === "realestate") itemType = "realestate";
        else if (cat === "jobs") itemType = "job";
        else itemType = "danggn";
      }
    } catch (e) {
      console.error("viewItem Firestore read error:", e);
    }
  }

  // view/index.html로 직접 이동 (download.html 중간 단계 제거)
  const redirectUrl = `${baseUrl}/view/?type=${itemType}&id=${id || ""}`;

  res.set("Cache-Control", "public, max-age=300, s-maxage=300");
  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | 씬짜오</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="씬짜오 (Xin Chao)">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${escapeHtml(redirectUrl)}">
  <script>
    // 상세 페이지로 바로 이동 (중간 단계 없음)
    window.location.replace("${redirectUrl}");
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
  </noscript>
</head>
<body style="background:#FF6B35;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="width:36px;height:36px;border:3px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:s 0.8s linear infinite;"></div>
  <style>@keyframes s{to{transform:rotate(360deg)}}</style>
</body>
</html>`);
});

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

exports.sendChatNotification = onDocumentCreated(
  "chatRooms/{roomId}/messages/{messageId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event");
      return;
    }
    const messageData = snap.data();
    const roomId = event.params.roomId;

    console.log("New message detected in room:", roomId);

    try {
      // 1. 채팅방 정보 가져오기
      const chatRoomDoc = await db.collection("chatRooms").doc(roomId).get();

      if (!chatRoomDoc.exists) {
        console.log("Chat room not found");
        return;
      }

      const chatRoomData = chatRoomDoc.data();
      const participants = chatRoomData.participants || [];
      const senderId = messageData.senderId;

      // 2. 수신자 확인
      const receiverId = participants.find((uid) => uid !== senderId);

      if (!receiverId) {
        console.log("No receiver found");
        return;
      }

      console.log("Sender:", senderId, "Receiver:", receiverId);

      // 3. 수신자의 푸시 토큰 가져오기
      const userDoc = await db.collection("users").doc(receiverId).get();

      if (!userDoc.exists) {
        console.log("Receiver user doc not found");
        return;
      }

      const userData = userDoc.data();

      // 토큰 배열에서 가져오기 (배열이 없으면 기존 방식으로 fallback)
      const expoPushTokens = Array.isArray(userData.expoPushTokens)
        ? userData.expoPushTokens
        : [
          userData.expoPushToken,
          userData.expoPushTokenDev,
          userData.expoPushTokenProd,
        ].filter(Boolean);

      const fcmTokens = Array.isArray(userData.fcmTokens)
        ? userData.fcmTokens
        : [
          userData.fcmToken,
          userData.fcmTokenDev,
          userData.fcmTokenProd,
        ].filter(Boolean);

      const platform = userData.platform || "android";

      console.log("📱 수신자 토큰 정보:");
      console.log("  - Expo 토큰 배열:", expoPushTokens.length, "개");
      console.log("  - FCM 토큰 배열:", fcmTokens.length, "개");
      console.log("  - platform:", platform);

      // 3-1. 수신자의 알림 설정 확인 (Updated upstream에서 가져옴)
      const notificationSettingsDoc = await db
        .collection("notificationSettings")
        .doc(receiverId)
        .get();

      if (notificationSettingsDoc.exists) {
        const notificationSettings = notificationSettingsDoc.data();
        if (notificationSettings.chat === false) {
          console.log("Receiver has disabled chat notifications");
          return;
        }
      }

      // 4. 발신자 정보 가져오기 (알림에 표시용 - Updated upstream에서 가져옴)
      const senderDoc = await db.collection("users").doc(senderId).get();
      const senderName = senderDoc.exists
        ? senderDoc.data().displayName || "사용자"
        : "사용자";

      // 5. 알림 메시지 구성
      const bodyText = messageData.image
        ? `${senderName}님이 사진을 보냈습니다.`
        : messageData.text;
      const titleText = chatRoomData.itemTitle || "새 메시지";

      // === FCM 직접 전송 (Force Alarm - 앱이 꺼져도 작동) ===
      // 모든 FCM 토큰에 알림 전송 (다중 기기 지원)
      const fcmSendPromises = fcmTokens.map(async (token) => {
        try {
          const fcmMessage = {
            token: token,
            notification: {
              title: `${titleText} - ${senderName}`,
              body: bodyText,
            },
            data: {
              roomId: roomId,
              screen: "ChatRoom",
              click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
            android: {
              priority: "high",
              notification: {
                channelId: "chat",
                sound: "default",
                visibility: "public", // 잠금화면에도 메시지 표시
                defaultSound: true,
                defaultVibrateTimings: true,
                defaultLightSettings: true,
              },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: `${titleText} - ${senderName}`,
                    body: bodyText,
                  },
                  sound: "default",
                  badge: 1,
                  "content-available": 1,
                  "mutable-content": 1,
                },
              },
              headers: {
                "apns-priority": "10",
                "apns-push-type": "alert",
              },
            },
          };

          const fcmResult = await getMessaging().send(fcmMessage);
          console.log(
            "✅ FCM 직접 전송 성공 (토큰:",
            token.substring(0, 20) + "...):",
            fcmResult,
          );
          return { success: true, token };
        } catch (fcmError) {
          console.error(
            "❌ FCM 전송 실패 (토큰:",
            token.substring(0, 20) + "...):",
            fcmError.message,
          );
          return { success: false, token, error: fcmError.message };
        }
      });

      // 모든 FCM 전송을 병렬로 실행
      if (fcmSendPromises.length > 0) {
        await Promise.allSettled(fcmSendPromises);
      }

      // === Expo Push 전송 (백업 / 호환성) ===
      // 모든 Expo 토큰에 알림 전송
      const validExpoTokens = expoPushTokens.filter((token) =>
        Expo.isExpoPushToken(token),
      );
      if (validExpoTokens.length > 0) {
        const messages = validExpoTokens.map((token) => ({
          to: token,
          sound: "default",
          title: `${titleText} - ${senderName}`,
          body: bodyText,
          data: {
            roomId: roomId,
            screen: "ChatRoom",
          },
          channelId: "chat",
          priority: "high",
        }));

        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log("✅ Expo Push 전송 성공:", ticketChunk);
          } catch (error) {
            console.error("❌ Expo Push 전송 실패:", error);
          }
        }
      }

      if (fcmTokens.length === 0 && expoPushTokens.length === 0) {
        console.log("❌ 수신자에게 푸시 토큰이 없습니다.");
        console.log("  - 수신자 ID:", receiverId);
        console.log(
          "  - 사용자 문서 데이터:",
          JSON.stringify(userData, null, 2),
        );
      } else {
        console.log(
          `✅ 푸시 토큰 확인 완료 - FCM ${fcmTokens.length}개, Expo ${expoPushTokens.length}개 알림 전송 시도`,
        );
      }
    } catch (error) {
      console.error("Error in sendChatNotification:", error);
    }
  },
);

// ============================================================
// 🛍️ 새 나눔/중고 물품 등록 → FCM 푸시 (같은 도시 유저)
// ============================================================
exports.onNewItemCreated = onDocumentCreated(
  "XinChaoDanggn/{itemId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const item = snap.data();
    const itemId = event.params.itemId;

    console.log("🛍️ 새 물품 등록 알림:", item.title, "도시:", item.city);

    // 주변 유저 알림 (주변 유저 없어도 관리자 알림은 반드시 전송)
    try {
      const tokens = await getUserTokensByCity(item.city, item.userId, "nearbyItems");
      if (tokens.length > 0) {
        const priceText = item.price > 0 ? `${Number(item.price).toLocaleString()}₫` : "무료나눔";
        const locationText = [item.city, item.district, item.apartment].filter(Boolean).join(" ");
        await sendMulticastFCM(tokens, {
          title: `🛍️ 새 물품: ${item.title}`,
          body: `${priceText} · ${locationText}`,
          data: { screen: "당근/나눔 상세", itemId, type: "new_item" },
          imageUrl: (item.images && item.images[0]) ? item.images[0] : null,
        });
        console.log(`✅ ${tokens.length}명에게 물품 알림 전송 완료`);
      } else {
        console.log("📭 주변 알림 대상 없음");
      }
    } catch (error) {
      console.error("❌ 물품 알림 실패:", error);
    }

    // 같은 건물(city+district+apartment) 유저 in-app 알림 레코드 생성
    await createNearbyItemNotifications({
      itemId,
      itemTitle: item.title || "",
      itemImage: (item.images && item.images[0]) || "",
      itemPrice: item.price || "",
      city: item.city,
      district: item.district,
      apartment: item.apartment,
      excludeUserId: item.userId,
    });

    // 관리자 알림 (항상 전송)
    await sendAdminPush(
      `🥕 당근/나눔 새 등록`,
      item.title || "새 물품",
      { type: "new_item_danggn", itemId },
      { itemTitle: item.title || "", itemImage: (item.images && item.images[0]) || "" }
    );
  }
);

// ============================================================
// 💰 당근/나눔 가격 인하 → 찜한 유저에 in-app 알림 생성
// ============================================================
exports.onItemPriceChanged = onDocumentUpdated(
  "XinChaoDanggn/{itemId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const itemId = event.params.itemId;

    const oldPrice = Number(before.price) || 0;
    const newPrice = Number(after.price) || 0;

    // 가격 인하만 알림 (인상/무효 변경은 무시)
    if (oldPrice <= 0 || newPrice <= 0 || newPrice >= oldPrice) return;

    const discount = oldPrice - newPrice;
    console.log(`💰 가격 인하 감지 (${itemId}): ${oldPrice} → ${newPrice} (-${discount})`);

    try {
      const favSnap = await db.collection("favorites").where("itemId", "==", itemId).get();
      if (favSnap.empty) {
        console.log("📭 찜한 사용자 없음");
        return;
      }

      const tasks = favSnap.docs.map(async (favDoc) => {
        const uid = favDoc.data().userId;
        if (!uid || uid === after.userId) return; // 본인 제외

        // priceChange 설정 확인 (명시적으로 false인 경우만 제외)
        try {
          const settingsDoc = await db.collection("notificationSettings").doc(uid).get();
          if (settingsDoc.exists && settingsDoc.data().priceChange === false) return;
        } catch (e) { /* 설정 없으면 기본 허용 */ }

        await db.collection("notifications").add({
          userId: uid,
          type: "priceChange",
          itemId,
          itemTitle: after.title || "",
          itemImage: (after.images && after.images[0]) || "",
          oldPrice,
          newPrice,
          discount,
          message: `찜한 물품 "${after.title}"의 가격이 ${discount.toLocaleString()}₫ 할인되었습니다!`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      const results = await Promise.allSettled(tasks);
      const success = results.filter(r => r.status === "fulfilled").length;
      console.log(`✅ 가격 인하 알림 ${success}/${favSnap.size}건 생성`);
    } catch (e) {
      console.error("❌ 가격 인하 알림 실패:", e.message);
    }
  }
);

// ============================================================
// 🏘️ 공통 유틸: 같은 건물(city+district+apartment) 유저 in-app 알림 생성
// ============================================================
async function createNearbyItemNotifications({
  itemId, itemTitle, itemImage, itemPrice,
  city, district, apartment, excludeUserId,
}) {
  if (!city || !district || !apartment) {
    console.log("📭 위치 정보 부족 — 같은 건물 in-app 알림 건너뜀");
    return 0;
  }

  try {
    const usersSnap = await db.collection("users")
      .where("city", "==", city)
      .where("district", "==", district)
      .where("apartment", "==", apartment)
      .get();

    if (usersSnap.empty) {
      console.log("📭 같은 건물 사용자 없음");
      return 0;
    }

    const location = [city, district, apartment].filter(Boolean).join(" ");
    let count = 0;

    const tasks = usersSnap.docs.map(async (userDoc) => {
      const uid = userDoc.id;
      if (uid === excludeUserId) return;

      // notificationSettings 확인 (명시적으로 false인 경우만 제외)
      try {
        const settingsDoc = await db.collection("notificationSettings").doc(uid).get();
        if (settingsDoc.exists && settingsDoc.data().nearbyItems === false) return;
      } catch (e) { /* 설정 없으면 기본 허용 */ }

      await db.collection("notifications").add({
        userId: uid,
        type: "nearby_item",
        itemId,
        itemTitle,
        itemImage,
        itemPrice,
        itemLocation: location,
        message: `내 주변에 새 상품이 등록되었습니다: ${itemTitle}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      count++;
    });

    await Promise.allSettled(tasks);
    console.log(`✅ 같은 건물 유저 ${count}명에게 in-app 알림 생성`);
    return count;
  } catch (e) {
    console.error("❌ 같은 건물 in-app 알림 실패:", e.message);
    return 0;
  }
}

// ============================================================
// 💼 새 구인구직 등록 → FCM 푸시 (같은 도시 유저)
// ============================================================
exports.onNewJobCreated = onDocumentCreated(
  "Jobs/{jobId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    const jobId = event.params.jobId;

    console.log("💼 새 구인구직 등록 알림:", job.title, "도시:", job.city);

    // 주변 유저 알림
    try {
      const tokens = await getUserTokensByCity(job.city, job.userId, "jobs");
      if (tokens.length > 0) {
        const typeLabel = job.jobType === "구인" ? "구인" : "구직";
        await sendMulticastFCM(tokens, {
          title: `💼 새 ${typeLabel}: ${job.title}`,
          body: `${job.industry} · ${job.salary || "급여 협의"} · ${job.city}`,
          data: { screen: "Jobs", jobId, type: "new_job" },
          imageUrl: (job.images && job.images[0]) ? job.images[0] : null,
        });
        console.log(`✅ ${tokens.length}명에게 구인구직 알림 전송 완료`);
      } else {
        console.log("📭 주변 알림 대상 없음");
      }
    } catch (error) {
      console.error("❌ 구인구직 알림 실패:", error);
    }

    // 관리자 알림 (항상 전송)
    await sendAdminPush(
      `💼 구인구직 새 등록`,
      job.title || "새 공고",
      { type: "new_item_job", itemId: jobId },
      { itemTitle: job.title || "", itemImage: (job.images && job.images[0]) || "" }
    );
  }
);

// ============================================================
// 🏠 새 부동산 등록 → FCM 푸시 (같은 도시 유저)
// ============================================================
exports.onNewRealEstateCreated = onDocumentCreated(
  "RealEstate/{itemId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const item = snap.data();
    const itemId = event.params.itemId;

    console.log("🏠 새 부동산 등록 알림:", item.title, "도시:", item.city);

    // 주변 유저 알림
    try {
      const tokens = await getUserTokensByCity(item.city, item.userId, "realEstate");
      if (tokens.length > 0) {
        const locationText = [item.city, item.district, item.apartment].filter(Boolean).join(" ");
        await sendMulticastFCM(tokens, {
          title: `🏠 새 부동산: ${item.title}`,
          body: `${item.dealType || ""} · ${item.price || "가격 협의"} · ${locationText}`,
          data: { screen: "부동산", itemId, type: "new_realestate" },
          imageUrl: (item.images && item.images[0]) ? item.images[0] : null,
        });
        console.log(`✅ ${tokens.length}명에게 부동산 알림 전송 완료`);
      } else {
        console.log("📭 주변 알림 대상 없음");
      }
    } catch (error) {
      console.error("❌ 부동산 알림 실패:", error);
    }

    // 관리자 알림 (항상 전송)
    await sendAdminPush(
      `🏠 부동산 새 등록`,
      item.title || "새 매물",
      { type: "new_item_realestate", itemId },
      { itemTitle: item.title || "", itemImage: (item.images && item.images[0]) || "" }
    );
  }
);

// ============================================================
// 🔔 공통 유틸: 관리자 FCM 토큰 수집 + 푸시 전송
// ============================================================
const ADMIN_EMAILS = ["younghan146@gmail.com", "info@chaovietnam.co.kr"];

async function sendAdminPush(title, body, data = {}, extra = {}) {
  try {
    const fcmTokens = [];
    const expoTokens = [];

    for (const email of ADMIN_EMAILS) {
      const snap = await db.collection("users").where("email", "==", email).get();
      if (snap.empty) { console.log(`⚠️ 관리자 계정 없음: ${email}`); continue; }

      // 한 이메일에 여러 user 문서가 존재할 수 있음 (Google/이메일/Apple 등 다른 로그인 방식 → 다른 UID)
      // → 모든 문서에 알림 레코드 생성 + 모든 토큰으로 푸시 발송 (현재 어느 UID로 로그인했든 알림이 도달하도록)
      for (const adminDoc of snap.docs) {
        const adminUid = adminDoc.id;
        const u = adminDoc.data();
        const fcm = Array.isArray(u.fcmTokens) ? u.fcmTokens : [u.fcmToken, u.fcmTokenDev, u.fcmTokenProd].filter(Boolean);
        const expoPush = Array.isArray(u.expoPushTokens) ? u.expoPushTokens : [u.expoPushToken].filter(Boolean);
        fcmTokens.push(...fcm);
        expoTokens.push(...expoPush);

        // 알림 화면용 Firestore 레코드 생성
        await db.collection("notifications").add({
          userId: adminUid,
          type: data.type || "admin_notification",
          itemId: data.itemId || "",
          itemTitle: extra.itemTitle || "",
          itemImage: extra.itemImage || "",
          message: body,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
        console.log(`📝 알림 레코드 생성: ${email} (${adminUid})`);
      }
    }

    // 토큰 중복 제거
    const uniqueFcm = [...new Set(fcmTokens)];
    const uniqueExpo = [...new Set(expoTokens)].filter(t => Expo.isExpoPushToken(t));

    console.log(`📬 관리자 토큰: FCM ${uniqueFcm.length}개, Expo ${uniqueExpo.length}개`);

    if (uniqueFcm.length > 0) {
      await sendMulticastFCM(uniqueFcm, { title, body, data });
    }

    if (uniqueExpo.length > 0) {
      await expo.sendPushNotificationsAsync(uniqueExpo.map(t => ({
        to: t, sound: "default", title, body, data, channelId: "default", priority: "high",
      })));
    }
  } catch (e) {
    console.error("❌ 관리자 푸시 실패:", e.message);
  }
}

// ============================================================
// 📦 공통 유틸: 같은 도시 유저 FCM 토큰 수집
// ============================================================
async function getUserTokensByCity(city, excludeUserId, notificationKey) {
  const tokens = [];
  try {
    let query = db.collection("users");
    if (city) query = query.where("city", "==", city);
    const usersSnap = await query.get();

    const checks = usersSnap.docs.map(async (userDoc) => {
      const uid = userDoc.id;
      if (uid === excludeUserId) return;

      const userData = userDoc.data();
      const fcmTokens = Array.isArray(userData.fcmTokens)
        ? userData.fcmTokens
        : [userData.fcmToken, userData.fcmTokenDev, userData.fcmTokenProd].filter(Boolean);

      if (fcmTokens.length === 0) return;

      // 알림 설정 확인 (명시적으로 false인 경우만 제외)
      try {
        const settingsDoc = await db.collection("notificationSettings").doc(uid).get();
        if (settingsDoc.exists && settingsDoc.data()[notificationKey] === false) return;
      } catch (e) { /* 설정 없으면 기본 허용 */ }

      tokens.push(...fcmTokens);
    });

    await Promise.allSettled(checks);
  } catch (e) {
    console.error("유저 토큰 조회 실패:", e);
  }
  return [...new Set(tokens)]; // 중복 제거
}

// ============================================================
// 📦 공통 유틸: FCM 멀티캐스트 발송 (500개씩 배치)
// ============================================================
async function sendMulticastFCM(tokens, { title, body, data, imageUrl }) {
  const messaging = getMessaging();
  const BATCH_SIZE = 500;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const message = {
      tokens: batch,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "default",
          sound: "default",
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
        headers: { "apns-priority": "10" },
        ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
      },
    };

    try {
      const response = await messaging.sendEachForMulticast(message);
      console.log(`📤 배치 ${Math.floor(i / BATCH_SIZE) + 1}: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
    } catch (err) {
      console.error("❌ 멀티캐스트 실패:", err);
    }
  }
}

// ============================================================
// 🌅 일일 새 소식 푸시 (Daily Digest) — 단계 3 retention 무기
// 매일 베트남 시간 18시: 24h 신규 채용/부동산/당근 count → 전 사용자 푸시
// 토글: notificationSettings.dailyDigest === false 인 사용자만 제외
// ============================================================

const TZ_VN = "Asia/Ho_Chi_Minh";

/** 메시지 톤 로테이션 — 평일은 간결 정보형, 주말은 호기심 유발형 */
function buildDailyDigestMessage(jobs, realestate, danggn, dayOfWeek) {
  const parts = [];
  if (jobs > 0) parts.push(`채용 ${jobs}`);
  if (realestate > 0) parts.push(`부동산 ${realestate}`);
  if (danggn > 0) parts.push(`당근/나눔 ${danggn}`);
  const counts = parts.join(" · ");

  // dayOfWeek: 0=일, 1=월, ... 6=토
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    return {
      title: "🌟 씬짜오 주말 새 소식",
      body: `${counts}건이 올라왔어요. 주말에 둘러보세요!`,
    };
  }
  return {
    title: "🌅 씬짜오 오늘의 새 소식",
    body: `${counts}건이 새로 올라왔어요. 탭해서 확인하세요!`,
  };
}

/** 24h 신규 콘텐츠 카운트 (Jobs/RealEstate/XinChaoDanggn) */
async function countNewItemsLast24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const safeCount = async (col) => {
    try {
      const snap = await db.collection(col).where("createdAt", ">=", since).limit(500).get();
      return snap.size;
    } catch (e) {
      console.warn(`⚠️ ${col} count 실패:`, e.message);
      return 0;
    }
  };
  const [jobs, realestate, danggn] = await Promise.all([
    safeCount("Jobs"),
    safeCount("RealEstate"),
    safeCount("XinChaoDanggn"),
  ]);
  return { jobs, realestate, danggn };
}

/** 공통 발송 헬퍼 — all_users 토픽으로 발송 (비로그인 설치자 포함) */
async function sendBroadcastPush({ title, body, data, logType, dryRun = false, imageUrl = null }) {
  console.log(`📬 ${logType} → all_users 토픽 발송`);

  if (dryRun) {
    console.log("🧪 dryRun — 실발송 없음");
    return { dryRun: true, title, body, channel: "topic/all_users" };
  }

  const message = {
    topic: "all_users",
    notification: { title, body },
    data: data ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])) : {},
    android: {
      priority: "high",
      notification: {
        channelId: "default",
        sound: "default",
        ...(imageUrl ? { imageUrl } : {}),
      },
    },
    apns: {
      payload: { aps: { sound: "default", badge: 1, "mutable-content": 1 } },
      headers: { "apns-priority": "10", "apns-push-type": "alert" },
    },
  };

  try {
    const result = await getMessaging().send(message);
    console.log(`✅ ${logType} 토픽 발송 완료:`, result);
  } catch (e) {
    console.error(`❌ ${logType} 토픽 발송 실패:`, e.message);
    throw e;
  }

  await db.collection("broadcastLogs").add({
    type: logType,
    campaign: data?.campaign || null,
    title, body,
    channel: "topic/all_users",
    sentAt: FieldValue.serverTimestamp(),
    ...(imageUrl ? { imageUrl } : {}),
    ...(data?.url ? { url: data.url } : {}),
  });

  return { channel: "topic/all_users", title, body };
}

/** 저녁 6시 — 새 등록 물품 푸시 (월요일은 지난주 인기 매물 top 10) */
async function runNewItemsPush({ dryRun = false } = {}) {
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: TZ_VN }));
  const dayOfWeek = nowVN.getDay(); // 0=일, 1=월

  // 월요일: 지난주(월~일) 조회수 top 10 매물
  if (dayOfWeek === 1) {
    return await runWeeklyItemsPush({ dryRun });
  }

  const { jobs, realestate, danggn } = await countNewItemsLast24h();
  console.log(`📊 24h 신규: 채용 ${jobs} · 부동산 ${realestate} · 당근 ${danggn}`);

  if (jobs + realestate + danggn === 0) {
    console.log("⏭️ 신규 콘텐츠 0건 — skip");
    await db.collection("broadcastLogs").add({
      type: "daily_new_items_push",
      status: "skipped_no_content",
      sentAt: FieldValue.serverTimestamp(),
    });
    return { skipped: true };
  }

  const { title, body } = buildDailyDigestMessage(jobs, realestate, danggn, dayOfWeek);
  const campaign = `new_items_${new Date().toISOString().slice(0, 10)}`;
  const data = { type: "new_items", campaign, screen: "뉴스" };

  return await sendBroadcastPush({ title, body, data, logType: "daily_new_items_push", dryRun });
}

/** 월요일 18시 전용 — 지난주 조회수 top 매물 */
async function runWeeklyItemsPush({ dryRun = false } = {}) {
  // 지난주 월~일 범위 (베트남 기준)
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: TZ_VN }));
  const todayStart = new Date(nowVN.getFullYear(), nowVN.getMonth(), nowVN.getDate());
  const lastMonday = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastSunday = new Date(todayStart.getTime() - 1);

  const COLS = ["XinChaoDanggn", "Jobs", "RealEstate"];
  const COL_LABELS = { XinChaoDanggn: "당근", Jobs: "채용", RealEstate: "부동산" };
  const allItems = [];

  for (const col of COLS) {
    try {
      const snap = await db.collection(col)
        .where("createdAt", ">=", lastMonday)
        .where("createdAt", "<=", lastSunday)
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();
      snap.forEach(doc => {
        const d = doc.data();
        if ((d.viewCount || 0) > 0) {
          allItems.push({
            col, label: COL_LABELS[col],
            title: d.title || d.jobTitle || "제목 없음",
            viewCount: d.viewCount || 0,
          });
        }
      });
    } catch (e) {
      console.warn(`⚠️ ${col} 조회 실패:`, e.message);
    }
  }

  allItems.sort((a, b) => b.viewCount - a.viewCount);
  const top = allItems.slice(0, 10);
  console.log(`📊 지난주 매물 top ${top.length}건 (전체 ${allItems.length}건 중)`);

  if (top.length === 0) {
    console.log("⏭️ 지난주 조회된 매물 없음 — skip");
    return { skipped: true };
  }

  const topItem = top[0];
  const title = "🏆 지난주 인기 매물 TOP";
  const body = top.length > 1
    ? `${topItem.label} · ${topItem.title} 외 ${top.length - 1}건`
    : `${topItem.label} · ${topItem.title}`;

  const campaign = `weekly_items_${new Date().toISOString().slice(0, 10)}`;
  const data = { type: "new_items", campaign, screen: "뉴스" };

  return await sendBroadcastPush({ title, body, data, logType: "weekly_items_push", dryRun });
}

/** 월요일 10시 전용 — GA4로 지난주 인기 뉴스 top 10 */
async function runWeeklyNewsPush({ dryRun = false } = {}) {
  const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID;
  const SA_JSON = process.env.GCP_SERVICE_ACCOUNT_JSON;

  if (!GA4_PROPERTY_ID || !SA_JSON) {
    console.warn("⚠️ GA4_PROPERTY_ID 또는 서비스계정 없음 — 일반 뉴스 푸시로 대체");
    return await runRegularNewsPush({ dryRun });
  }

  let posts = [];
  try {
    const { BetaAnalyticsDataClient } = require("@google-analytics/data");
    const svc = JSON.parse(SA_JSON);
    const client = new BetaAnalyticsDataClient({
      credentials: { client_email: svc.client_email, private_key: svc.private_key },
      projectId: svc.project_id,
    });

    const [report] = await client.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: "7daysAgo", endDate: "1daysAgo" }],
      dimensions: [{ name: "pageTitle" }, { name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: {
        filter: {
          fieldName: "pagePath",
          stringFilter: { matchType: "CONTAINS", value: "chaovietnam.co.kr" },
        },
      },
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    });

    posts = (report.rows || [])
      .map(r => ({
        title: r.dimensionValues[0].value.replace(/\s*[-–|].*$/, "").trim(),
        path: r.dimensionValues[1].value,
        views: +r.metricValues[0].value,
      }))
      .filter(p => p.title && !p.title.includes("씬짜오베트남") && p.views > 1)
      .slice(0, 10);
  } catch (e) {
    console.error("❌ GA4 조회 실패:", e.message, "— 일반 뉴스 푸시로 대체");
    return await runRegularNewsPush({ dryRun });
  }

  if (posts.length === 0) {
    console.log("⏭️ GA4 인기 뉴스 없음 — 일반 뉴스 푸시로 대체");
    return await runRegularNewsPush({ dryRun });
  }

  console.log(`📊 지난주 인기 뉴스 top ${posts.length}건`);
  const title = "📰 지난주 가장 많이 읽은 뉴스";
  const body = posts.length > 1
    ? `${posts[0].title} 외 ${posts.length - 1}건`
    : posts[0].title;

  const campaign = `weekly_news_${new Date().toISOString().slice(0, 10)}`;
  const data = { type: "daily_news", campaign, screen: "뉴스" };

  return await sendBroadcastPush({ title, body, data, logType: "weekly_news_push", dryRun });
}

/** 아침 10시 — 뉴스 헤드라인 푸시 (월요일은 GA4 기반 지난주 인기 뉴스 top 10) */
async function runNewsPush({ dryRun = false } = {}) {
  const dayOfWeekVN = new Date(new Date().toLocaleString("en-US", { timeZone: TZ_VN })).getDay();

  if (dayOfWeekVN === 1) return await runWeeklyNewsPush({ dryRun });

  return await runRegularNewsPush({ dryRun });
}

/** 화~토 — 당일 뉴스 헤드라인 푸시 */
async function runRegularNewsPush({ dryRun = false } = {}) {
  const dayOfWeekVN = new Date(new Date().toLocaleString("en-US", { timeZone: TZ_VN })).getDay();

  // 일요일이면 skip
  if (dayOfWeekVN === 0) {
    console.log("⏭️ 일요일 — 뉴스 발행 안 함, skip");
    await db.collection("broadcastLogs").add({
      type: "daily_news_push",
      status: "skipped_sunday",
      sentAt: FieldValue.serverTimestamp(),
    });
    return { skipped: true, reason: "sunday" };
  }

  // 베트남 한국 뉴스 카테고리 (id=31) — chaovietnam.co.kr 뉴스
  const NEWS_CATEGORY_ID = 31;
  const PER_PAGE = 5;

  // 오늘 베트남 시간 자정 이후 발행된 뉴스만 (UTC+7)
  const nowVN = new Date(new Date().toLocaleString("en-US", { timeZone: TZ_VN }));
  const todayStartVN = new Date(nowVN.getFullYear(), nowVN.getMonth(), nowVN.getDate());
  const afterIso = new Date(todayStartVN.getTime() - 7 * 60 * 60 * 1000).toISOString(); // VN 자정 = UTC 전날 17:00

  const url = `https://chaovietnam.co.kr/wp-json/wp/v2/posts?categories=${NEWS_CATEGORY_ID}&per_page=${PER_PAGE}&after=${encodeURIComponent(afterIso)}&_fields=id,title,link,date`;

  let posts = [];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WP API ${res.status}`);
    posts = await res.json();
  } catch (e) {
    console.error("❌ WP 뉴스 가져오기 실패:", e.message);
    await db.collection("broadcastLogs").add({
      type: "daily_news_push",
      status: "skipped_wp_fail",
      error: e.message,
      sentAt: FieldValue.serverTimestamp(),
    });
    return { skipped: true, error: e.message };
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    console.log("⏭️ 오늘 발행된 뉴스 0건 — skip");
    await db.collection("broadcastLogs").add({
      type: "daily_news_push",
      status: "skipped_no_news",
      sentAt: FieldValue.serverTimestamp(),
    });
    return { skipped: true };
  }

  // 메시지 빌드 — 첫 헤드라인 + 외 N건
  const decode = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, "").trim();
  const headline1 = decode(posts[0].title?.rendered);
  const title = "📰 씬짜오 오늘의 뉴스";
  const body = posts.length > 1
    ? `${headline1} · 외 ${posts.length - 1}건`
    : headline1;

  const campaign = `news_${new Date().toISOString().slice(0, 10)}`;
  const data = { type: "daily_news", campaign, screen: "뉴스" };

  return await sendBroadcastPush({ title, body, data, logType: "daily_news_push", dryRun });
}

/** FCM 토큰을 all_users 토픽에 구독 — 비로그인 설치자 포함 전체 도달 */
exports.subscribeToAllUsers = onRequest(
  { cors: true, region: "asia-northeast3" },
  async (req, res) => {
    const token = req.body?.token || req.query?.token;
    if (!token) { res.status(400).json({ error: "token required" }); return; }
    try {
      await getMessaging().subscribeToTopic([token], "all_users");
      console.log("✅ all_users 토픽 구독:", token.substring(0, 20) + "...");
      res.json({ success: true });
    } catch (e) {
      console.error("❌ 토픽 구독 실패:", e.message);
      res.status(500).json({ error: e.message });
    }
  }
);

/** 매일 베트남 시간 18시 — 새 등록 물품 푸시 */
exports.dailyDigestPush = onSchedule(
  { schedule: "0 18 * * *", timeZone: TZ_VN, region: "asia-northeast3", memory: "512MiB" },
  async () => { await runNewItemsPush(); }
);

/** 베트남 시간 10시 — 뉴스 헤드라인 푸시 (월~토, 일요일은 뉴스 발행 X) */
exports.dailyNewsPush = onSchedule(
  { schedule: "0 10 * * 1-6", timeZone: TZ_VN, region: "asia-northeast3", memory: "512MiB" },
  async () => { await runNewsPush(); }
);

/** 테스트/수동 트리거 — admin만 호출. ?dryRun=1 지원. ?which=news|items 로 종류 선택 */
exports.runDailyDigestNow = onRequest(
  { cors: true, region: "asia-northeast3" },
  async (req, res) => {
    const adminKey = req.query.key || req.headers["x-admin-key"];
    if (adminKey !== "xinchao_2026_dailydigest") {
      res.status(401).send("Unauthorized");
      return;
    }
    const dryRun = req.query.dryRun === "1";
    const which = req.query.which || "items";
    try {
      const result = which === "news"
        ? await runNewsPush({ dryRun })
        : await runNewItemsPush({ dryRun });
      res.json({ success: true, which, ...result });
    } catch (e) {
      console.error("❌ runDailyDigestNow 실패:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

/** 관리자 커스텀 푸시 발송 — 특별 이벤트·공지용
 * POST body: { title, body, dryRun? }
 * Header: x-admin-key: xinchao_2026_dailydigest */
exports.sendCustomPush = onRequest(
  { cors: true, region: "asia-northeast3" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const adminKey = req.headers["x-admin-key"] || req.query.key;
    if (adminKey !== "xinchao_2026_dailydigest") {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const { title, body, url = null, imageUrl = null, dryRun = false } = req.body || {};
    if (!title || !body) {
      res.status(400).json({ success: false, error: "title과 body는 필수입니다." });
      return;
    }
    if (title.length > 50) {
      res.status(400).json({ success: false, error: "제목은 50자 이하로 입력하세요." });
      return;
    }
    if (body.length > 150) {
      res.status(400).json({ success: false, error: "내용은 150자 이하로 입력하세요." });
      return;
    }
    if (url && !/^https?:\/\/.+/.test(url)) {
      res.status(400).json({ success: false, error: "링크는 http(s)://로 시작해야 합니다." });
      return;
    }
    if (imageUrl && !/^https?:\/\/.+/.test(imageUrl)) {
      res.status(400).json({ success: false, error: "이미지 URL은 http(s)://로 시작해야 합니다." });
      return;
    }
    try {
      const today = new Date().toISOString().slice(0, 10);

      // announcements 문서 먼저 생성 — 댓글 스레드의 루트
      let announcementId = null;
      if (!dryRun) {
        const announcementRef = await db.collection("announcements").add({
          title,
          body,
          imageUrl: imageUrl || null,
          url: url || null,
          commentCount: 0,
          sentAt: FieldValue.serverTimestamp(),
        });
        announcementId = announcementRef.id;
      }

      const result = await sendBroadcastPush({
        title,
        body,
        data: {
          type: "custom",
          campaign: `custom_${today}`,
          screen: "뉴스",
          ...(url ? { url } : {}),
          ...(announcementId ? { announcementId } : {}),
        },
        logType: "custom_push",
        imageUrl: imageUrl || null,
        dryRun: !!dryRun,
      });
      res.json({ success: true, announcementId, ...result });
    } catch (e) {
      console.error("❌ sendCustomPush 실패:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ============================================================
// ⏰ 예약 발송 체크 — 5분마다 pushDrafts 컬렉션 확인
// ============================================================
exports.scheduledPushCheck = onSchedule(
  { schedule: "every 5 minutes", timeZone: TZ_VN, region: "asia-northeast3", memory: "512MiB" },
  async () => {
    const now = new Date();
    let snap;
    try {
      snap = await db.collection("pushDrafts")
        .where("status", "==", "scheduled")
        .where("scheduledAt", "<=", now)
        .get();
    } catch (e) {
      console.error("❌ pushDrafts 조회 실패:", e.message);
      return;
    }

    if (snap.empty) return;
    console.log(`⏰ scheduledPushCheck: ${snap.size}건 발송 시작`);

    for (const draftDoc of snap.docs) {
      const d = draftDoc.data();
      try {
        await draftDoc.ref.update({ status: "sending" });

        const announcementRef = await db.collection("announcements").add({
          title: d.title,
          body: d.body,
          imageUrl: d.imageUrl || null,
          url: d.url || null,
          commentCount: 0,
          sentAt: FieldValue.serverTimestamp(),
        });

        const today = new Date().toISOString().slice(0, 10);
        const result = await sendBroadcastPush({
          title: d.title,
          body: d.body,
          data: {
            type: "custom",
            campaign: `scheduled_${today}`,
            screen: "뉴스",
            ...(d.url ? { url: d.url } : {}),
            announcementId: announcementRef.id,
          },
          logType: "custom_push",
          imageUrl: d.imageUrl || null,
          dryRun: false,
        });

        await draftDoc.ref.update({
          status: "sent",
          announcementId: announcementRef.id,
          sentAt: FieldValue.serverTimestamp(),
        });
        console.log(`✅ 예약 발송 완료: ${draftDoc.id} (${d.title}) — FCM ${result.fcmCount} + Expo ${result.expoCount}`);
      } catch (e) {
        console.error(`❌ 예약 발송 실패: ${draftDoc.id}`, e.message);
        await draftDoc.ref.update({ status: "failed", error: e.message }).catch(() => {});
      }
    }
  }
);

// ============================================================
// 📋 어드민 데이터 읽기 — Vercel admin SDK 자격증명 우회
// ============================================================
exports.adminRead = onRequest(
  { cors: true, region: "asia-northeast3" },
  async (req, res) => {
    const adminKey = req.headers["x-admin-key"] || req.query.key;
    if (adminKey !== "xinchao_2026_dailydigest") {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const col = req.query.collection;
    const announcementId = req.query.announcementId;

    const toJS = (v) => (v && typeof v.toDate === "function" ? v.toDate().toISOString() : v);
    const docToObj = (d) => {
      const out = { id: d.id };
      for (const [k, v] of Object.entries(d.data())) out[k] = toJS(v);
      return out;
    };

    try {
      // 댓글 조회
      if (col === "announcements" && announcementId) {
        const snap = await db.collection("announcements").doc(announcementId)
          .collection("comments").orderBy("createdAt", "asc").get();
        return res.json({ success: true, comments: snap.docs.map(docToObj) });
      }

      // broadcastLogs
      if (col === "broadcastLogs") {
        const snap = await db.collection("broadcastLogs")
          .orderBy("sentAt", "desc").limit(50).get();

        // commentCount 병합
        const annSnap = await db.collection("announcements")
          .orderBy("sentAt", "desc").limit(50).get();
        const ccMap = {};
        annSnap.docs.forEach(d => { ccMap[d.id] = d.data().commentCount || 0; });

        const logs = snap.docs.map(d => {
          const obj = docToObj(d);
          obj.commentCount = obj.announcementId ? (ccMap[obj.announcementId] ?? 0) : null;
          return obj;
        });
        return res.json({ success: true, logs });
      }

      // pushDrafts
      if (col === "pushDrafts") {
        const snap = await db.collection("pushDrafts")
          .where("status", "in", ["draft", "scheduled"])
          .orderBy("createdAt", "desc").limit(100).get();
        return res.json({ success: true, drafts: snap.docs.map(docToObj) });
      }

      res.status(400).json({ success: false, error: "Unknown collection" });
    } catch (e) {
      console.error("❌ adminRead 실패:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ============================================================
// ✏️ 어드민 데이터 쓰기 — pushDrafts CRUD
// ============================================================
exports.adminWrite = onRequest(
  { cors: true, region: "asia-northeast3" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).end(); return; }
    const adminKey = req.headers["x-admin-key"] || req.query.key;
    if (adminKey !== "xinchao_2026_dailydigest") {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    const { action, collection: col, docId, data } = req.body || {};
    if (!["pushDrafts"].includes(col)) {
      res.status(400).json({ success: false, error: "Invalid collection" });
      return;
    }

    try {
      if (action === "add") {
        const toSave = { ...data };
        if (toSave.scheduledAt) toSave.scheduledAt = new Date(toSave.scheduledAt);
        toSave.createdAt = FieldValue.serverTimestamp();
        toSave.updatedAt = FieldValue.serverTimestamp();
        const ref = await db.collection(col).add(toSave);
        return res.json({ success: true, id: ref.id });
      }
      if (action === "update") {
        if (!docId) return res.status(400).json({ success: false, error: "docId required" });
        const toUpdate = { ...data, updatedAt: FieldValue.serverTimestamp() };
        if (toUpdate.scheduledAt) toUpdate.scheduledAt = new Date(toUpdate.scheduledAt);
        await db.collection(col).doc(docId).update(toUpdate);
        return res.json({ success: true });
      }
      if (action === "delete") {
        if (!docId) return res.status(400).json({ success: false, error: "docId required" });
        await db.collection(col).doc(docId).delete();
        return res.json({ success: true });
      }
      res.status(400).json({ success: false, error: "Unknown action" });
    } catch (e) {
      console.error("❌ adminWrite 실패:", e.message);
      res.status(500).json({ success: false, error: e.message });
    }
  }
);

// ============================================================
// 🗂️ Jobs/{jobId} onWrite → Notion 구인 DB 업서트
// (기존 onNewJobCreated FCM 함수와 별개 - 건드리지 않음)
// ============================================================
const { upsertJobToNotion, upsertCandidateToNotion } = require("./notion-sync");

exports.onJobWritten = onDocumentWritten(
  "Jobs/{jobId}",
  async (event) => {
    // 삭제 이벤트는 무시
    if (!event.data.after.exists) return;

    const jobId = event.params.jobId;
    const jobData = event.data.after.data();

    try {
      await upsertJobToNotion(jobId, jobData);
    } catch (err) {
      console.error(`❌ [JobSync] ${jobId} Notion 업서트 실패:`, err.message);
    }
  }
);

// ============================================================
// 👤 candidates/{candidateId} onWrite → Notion 구직자 DB 업서트
// ============================================================
exports.onCandidateWritten = onDocumentWritten(
  "candidates/{candidateId}",
  async (event) => {
    // 삭제 이벤트는 무시
    if (!event.data.after.exists) return;

    const candidateId = event.params.candidateId;
    const candidateData = event.data.after.data();

    try {
      await upsertCandidateToNotion(candidateId, candidateData);
    } catch (err) {
      console.error(`❌ [CandidateSync] ${candidateId} Notion 업서트 실패:`, err.message);
    }
  }
);

// ============================================================
// 📘 publishToFacebookPage - 씬짜오베트남 페이지 자동 게시
// daily-news-final 앱에서 카드 생성 직후 호출
//
// 동작 (v3, 2026-05-22 — 원본 비율 + 메인 2장 + 광고 댓글):
//  1) 메인 게시물: 뉴스 카드 1장 + 첫 광고 카드 1장 (있을 경우) — 원본 비율 유지
//     → 페이스북 2장 multi-photo 자동 레이아웃 (가로형은 위아래 풀폭, 정사각형은 좌우)
//  2) 나머지 광고 카드는 게시 후 댓글로 첨부 (attachment_url + 광고주 링크 메시지)
//  → 메인이 작게 그리드로 깨지던 v2 문제 해결. Lê Huy Khoa 같은 일반 게시물 형태.
//
// 입력 body:
// {
//   news:   { imageUrl, caption, link? }
//   promos: [ { imageUrl, title?, linkUrl? }, ... ]
// }
// 하위호환: { imageUrl, caption, link } 단일 형식도 지원 (광고 없는 단순 게시)
// ============================================================

async function downloadImage(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Image download failed (${url}): HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// 원본 비율 유지 + 최대 너비 1080 제한 (페북 업로드 효율).
// v2에서 1:1 강제 → 흰 여백 letterbox + grid 작아짐 자해 문제로 제거.
async function toMaxWidth(buffer, maxWidth = 1080) {
  return sharp(buffer)
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 92 })
    .toBuffer();
}

// 페북 안전 비율(1200x630, 1.91:1) — 블러 확장 방식.
// 원본을 contain으로 가운데 그대로 두고, 비는 영역은 같은 사진을 cover+blur한
// 흐릿한 배경으로 채움 (Instagram/Twitter 흔한 패턴).
// 결과: 광고 콘텐츠 잘림 X + 흰 여백 어색함 X + 페북 multi-photo 비율 통일됨.
// 광고 카드의 원본 디자인(이메일 등 다른 채널에서도 사용)은 그대로 보존.
async function toFacebookSafe(buffer, w = 1200, h = 630) {
  // 1. 블러 배경 — 원본을 1200x630에 cover 크롭 + 강한 블러
  const bg = await sharp(buffer)
    .resize({ width: w, height: h, fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.85 }) // 약간 어둡게 → 전경 부각
    .toBuffer();

  // 2. 전경 — 원본을 1200x630 박스 안에 contain (비율 유지, 잘림 없음)
  const fg = await sharp(buffer)
    .resize({ width: w, height: h, fit: "inside" })
    .toBuffer();

  // 3. 배경 위에 전경 가운데 합성
  return sharp(bg)
    .composite([{ input: fg, gravity: "center" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function uploadPhotoUnpublished(pageId, pageToken, buffer) {
  const form = new FormData();
  form.append("published", "false");
  form.append("access_token", pageToken);
  form.append("source", new Blob([buffer], { type: "image/jpeg" }), "card.jpg");
  const r = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, { method: "POST", body: form });
  return await r.json();
}

// 광고 정보 한 줄 — "title → linkUrl" / title만 / url만 / 빈 줄
function formatPromoLine(p) {
  const title = (p?.title || "").toString().trim();
  const url = (p?.linkUrl || "").toString().trim();
  if (title && url) return `${title} → ${url}`;
  if (title) return title;
  if (url) return url;
  return "";
}

// ============================================================
// publishToFacebookPage — Multi-Page v4 (2026-05-22 본문 carousel 일원화)
// ============================================================
//
// 변경 사항 vs v3 (어제):
//   - v3: 본문 2장(뉴스+첫 광고) + 나머지 광고 댓글 → 광고 사진 댓글 펴봐야 보임
//   - v4: 본문 carousel 에 뉴스 + 모든 광고 일원화. 댓글 첨부 제거.
//
// 왜 본문 일원화가 우월:
//   - 본문 그리드: 사진은 작아 보여도 모두 일목요연하게 노출.
//   - 페북 갤러리: carousel 안 모든 사진을 클릭 시 풀스크린 좌우 슬라이드로
//     하나씩 큰 사이즈 표시 → 본문 작은 그리드 + 갤러리 = 노출 손실 없음.
//   - 댓글: 자동 펴짐 X, 사용자가 펼쳐야 보임 → 노출도 낮음.
//   - 광고주 노출은 본문 캡션 텍스트(이름+링크 나열) 가 보장 (변경 없음).
//
// 시스템 사용자 토큰 (FB_SYSTEM_USER_TOKEN) 기반은 v2~v3 와 동일.
//
// 광고 4장 제한 (PROMO_PHOTO_LIMIT = 3):
//   - 페북 4장 게시 = "큰 위 1장 + 작은 아래 3장" 그리드 → 뉴스 풀폭 노출 거의 확정
//   - 5장+ 게시 = 2:3 비대칭 그리드 → 뉴스가 좌상단 1/4 영역으로 작아짐 (자해)
//   - 5번째+ 광고는 사진 미첨부, 캡션 텍스트의 광고주 이름·링크는 그대로 (노출 부분 보장)
//
// 게시 흐름:
//   1. 인증 (Bearer PUBLISH_API_KEY)
//   2. 시스템 사용자 토큰으로 /me/accounts 호출 → 페이지 + 토큰 동적 발견
//   3. 뉴스(1080 폭) + 광고 최대 3개(toFacebookSafe 로 1200x630 통일) 1회 변환
//   4. 각 페이지에:
//      a) 사진 unpublished 업로드 (병렬) → photo IDs
//      b) /feed 에 attached_media 로 묶어 carousel 게시 (총 최대 4장)
//   5. broadcastLogs 에 페이지별 결과 기록
//
// 응답 호환성:
//   - { ok, postId, permalink, pageResults: [...] } — v2~v3 과 동일

// 페북 attached_media 사진 개수 정책 — 뉴스(1) + 광고(최대 PROMO_PHOTO_LIMIT) = 총 3장.
// 3장 게시 그리드는 "큰 위 1장 + 작은 아래 2장" → 뉴스 풀폭, 광고 2장 좌우 균등.
// 4장 이상 게시는 뉴스가 1/4 또는 1/6 영역으로 축소되므로 회피.
const PROMO_PHOTO_LIMIT = 2;

exports.publishToFacebookPage = onRequest(
  {
    cors: false,
    invoker: "public",
    memory: "1GiB", // 512MiB → 1GiB — sharp 블러 합성 + 4페이지 병렬 처리 가속
    timeoutSeconds: 300, // 4 페이지 × ~30초 마진
    secrets: ["FB_SYSTEM_USER_TOKEN", "PUBLISH_API_KEY"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const auth = req.get("Authorization") || "";
    const incomingToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (incomingToken !== process.env.PUBLISH_API_KEY) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 입력 정규화
    const body = req.body || {};
    const news = body.news
      || (body.imageUrl ? { imageUrl: body.imageUrl, caption: body.caption || "", link: body.link } : null);
    const promos = Array.isArray(body.promos) ? body.promos.filter(p => p && p.imageUrl) : [];

    if (!news || !news.imageUrl || !news.caption) {
      return res.status(400).json({ ok: false, error: "news.imageUrl and news.caption are required" });
    }

    const systemToken = (process.env.FB_SYSTEM_USER_TOKEN || "").trim();
    if (!systemToken) {
      return res.status(500).json({ ok: false, error: "FB_SYSTEM_USER_TOKEN not configured" });
    }

    const logBase = { channel: "facebook", news, promos };

    // 메인 캡션 — 뉴스 본문 + 광고주 전원 텍스트 나열.
    // 페북 댓글은 자동 펼침이 불가(접혀 표시)하므로, 광고주 노출 보장 위해
    // 모든 광고주의 이름·링크를 메인 캡션에 표기. 댓글의 광고 사진은 보너스.
    const mainLines = [news.caption];
    if (news.link) mainLines.push("", news.link);
    if (promos.length > 0) {
      mainLines.push("", "━━━━━━━━━━", "📌 오늘의 협찬");
      for (const p of promos) {
        const line = formatPromoLine(p);
        if (line) mainLines.push(`• ${line}`);
      }
    }
    const message = mainLines.join("\n");

    try {
      // ── 1. 시스템 사용자 토큰으로 페이지 목록 + 페이지별 토큰 발견
      const accountsRes = await fetch(
        `https://graph.facebook.com/v25.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(systemToken)}`
      );
      const accountsData = await accountsRes.json();
      if (!accountsRes.ok || accountsData.error) {
        console.error("❌ [FBPublish v2] /me/accounts 실패:", accountsData.error);
        await db.collection("broadcastLogs").add({
          ...logBase, ok: false, mode: "multi-page-album-v2", stage: "me_accounts",
          error: accountsData.error || accountsData, at: new Date(),
        });
        return res.status(502).json({ ok: false, error: accountsData.error || accountsData });
      }
      const pages = Array.isArray(accountsData.data) ? accountsData.data : [];
      if (pages.length === 0) {
        await db.collection("broadcastLogs").add({
          ...logBase, ok: false, mode: "multi-page-album-v2", stage: "me_accounts",
          error: { message: "시스템 사용자가 접근 가능한 페이지가 없습니다" }, at: new Date(),
        });
        return res.status(502).json({ ok: false, error: "no_accessible_pages" });
      }
      console.log(`[FBPublish v2] 접근 가능 페이지 ${pages.length}개: ${pages.map(p => p.name).join(", ")}`);

      // ── 2. 사진(뉴스 + 광고 최대 3개) 다운로드 + 페북 안전 비율 정규화
      //    - 뉴스 카드는 이미 1200x630 (1.91:1) 비율로 생성됨 → toMaxWidth(1080) 로 OK
      //    - 광고 카드는 원본이 와이드/정사각형 등 다양 → toFacebookSafe (블러 확장)
      //      으로 1200x630 통일 → 페북 carousel 그리드 박스 잘림 방지
      //    - 광고는 입력 순서 기준 첫 PROMO_PHOTO_LIMIT 개만 사진 첨부.
      //      나머지는 캡션 텍스트의 광고주 이름·링크로만 노출.
      //    - 변환/다운로드 실패 광고는 skip (나머지로 게시 진행)
      const newsBuf = await toMaxWidth(await downloadImage(news.imageUrl), 1080);

      const promoBufs = [];
      for (const p of promos.slice(0, PROMO_PHOTO_LIMIT)) {
        try {
          const buf = await toFacebookSafe(await downloadImage(p.imageUrl));
          promoBufs.push(buf);
        } catch (e) {
          console.warn(`[FBPublish v4] 광고 이미지 다운로드/변환 실패 (skip): ${p.imageUrl}`, e.message);
        }
      }

      // ── 3. 각 페이지에 동일 콘텐츠 게시 (실패 시 1회 자동 재시도)
      const pageResults = [];

      async function tryPostToPage(page) {
        const pageToken = page.access_token;
        if (!pageToken) throw new Error("page access_token missing");

        // 3-a. 모든 사진 unpublished 업로드 (뉴스 + 모든 광고 동시 → 직렬 대비 1/N 시간)
        const uploadPromises = [
          uploadPhotoUnpublished(page.id, pageToken, newsBuf),
          ...promoBufs.map(buf => uploadPhotoUnpublished(page.id, pageToken, buf)),
        ];
        const uploadResults = await Promise.all(uploadPromises);

        const newsUp = uploadResults[0];
        if (newsUp.error) throw new Error(`news photo upload: ${JSON.stringify(newsUp.error)}`);

        // mainPhotoIds: 뉴스 + 업로드 성공한 광고들 (개별 실패는 그 사진만 skip)
        const mainPhotoIds = [newsUp.id];
        for (let i = 1; i < uploadResults.length; i++) {
          const r = uploadResults[i];
          if (r.error) {
            console.warn(`[FBPublish v4] ${page.name} 광고 사진 업로드 실패 (skip): ${JSON.stringify(r.error)}`);
          } else if (r.id) {
            mainPhotoIds.push(r.id);
          }
        }

        // 3-b. 메인 게시 — 모든 사진을 attached_media 로 carousel 묶음.
        //      페북 본문은 그리드(작게)로 표시하지만, 사용자가 사진 클릭 시
        //      갤러리에서 풀사이즈로 하나씩 노출 → 댓글 분리 불필요.
        const feedParams = new URLSearchParams({
          message,
          attached_media: JSON.stringify(mainPhotoIds.map(id => ({ media_fbid: id }))),
          access_token: pageToken,
        });
        const feedRes = await fetch(
          `https://graph.facebook.com/v25.0/${page.id}/feed`,
          { method: "POST", body: feedParams }
        );
        const feedData = await feedRes.json();
        if (!feedRes.ok || feedData.error) {
          throw new Error(`feed: ${JSON.stringify(feedData.error || feedData)}`);
        }
        const postId = feedData.id;

        return { postId, photoIds: mainPhotoIds };
      }

      // 페이지 4개 병렬 처리 — 페이지마다 토큰이 다르므로 rate limit 독립.
      // v2 직렬(40~60초) → v3 병렬(10~15초) 약 4배 단축.
      // 단일 페이지 내부 (메인 업로드/feed/댓글)는 직렬 유지 — 같은 토큰 동시 호출 회피.
      const pageOps = pages.map(async (page) => {
        let result = null;
        let lastError = null;
        let attempts = 0;
        for (attempts = 1; attempts <= 2; attempts++) {
          try {
            result = await tryPostToPage(page);
            break;
          } catch (err) {
            lastError = err;
            if (attempts < 2) {
              console.warn(`⚠️ [FBPublish v4] ${page.name} 1차 실패 (재시도 예정 8초 후): ${err.message}`);
              await new Promise(r => setTimeout(r, 8000));
            }
          }
        }

        if (result) {
          console.log(`✅ [FBPublish v4] ${page.name} 게시 성공 (${attempts}회차): ${result.postId} / 사진 ${result.photoIds.length}장`);
          return {
            pageId: page.id, name: page.name, ok: true, attempts,
            postId: result.postId,
            photoIds: result.photoIds,
            permalink: `https://www.facebook.com/${result.postId}`,
          };
        } else {
          console.error(`❌ [FBPublish v4] ${page.name} 게시 실패 (2회 시도 모두): ${lastError?.message}`);
          return {
            pageId: page.id, name: page.name, ok: false, attempts: 2,
            error: String(lastError?.message || lastError),
          };
        }
      });

      pageResults.push(...(await Promise.all(pageOps)));

      // ── 4. 결과 로그 + 응답
      const anyOk = pageResults.some(r => r.ok);
      const allOk = pageResults.every(r => r.ok);
      const firstSuccess = pageResults.find(r => r.ok);

      await db.collection("broadcastLogs").add({
        ...logBase,
        ok: allOk,
        mode: "multi-page-carousel-v4",
        pageResults,
        successCount: pageResults.filter(r => r.ok).length,
        failureCount: pageResults.filter(r => !r.ok).length,
        at: new Date(),
      });

      return res.json({
        ok: anyOk, // 하나라도 성공하면 ok (호환성)
        postId: firstSuccess?.postId || null,
        permalink: firstSuccess?.permalink || null,
        pageResults, // 페이지별 결과 추적
      });
    } catch (err) {
      console.error("❌ [FBPublish v4] 호출 실패:", err);
      await db.collection("broadcastLogs").add({
        ...logBase, ok: false, mode: "multi-page-carousel-v4",
        error: String(err.message || err), at: new Date(),
      });
      return res.status(500).json({ ok: false, error: String(err.message || err) });
    }
  }
);
