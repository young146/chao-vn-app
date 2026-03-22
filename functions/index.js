const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { Expo } = require("expo-server-sdk");

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

    try {
      const tokens = await getUserTokensByCity(item.city, item.userId, "nearbyItems");
      if (tokens.length === 0) { console.log("📭 알림 대상 없음"); return; }

      const priceText = item.price > 0 ? `${Number(item.price).toLocaleString()}₫` : "무료나눔";
      const locationText = [item.city, item.district, item.apartment].filter(Boolean).join(" ");

      await sendMulticastFCM(tokens, {
        title: `🛍️ 새 물품: ${item.title}`,
        body: `${priceText} · ${locationText}`,
        data: { screen: "당근/나눔 상세", itemId, type: "new_item" },
        imageUrl: (item.images && item.images[0]) ? item.images[0] : null,
      });
      console.log(`✅ ${tokens.length}명에게 물품 알림 전송 완료`);
    } catch (error) {
      console.error("❌ 물품 알림 실패:", error);
    }
  }
);

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

    try {
      const tokens = await getUserTokensByCity(job.city, job.userId, "jobs");
      if (tokens.length === 0) { console.log("📭 알림 대상 없음"); return; }

      const typeLabel = job.jobType === "구인" ? "구인" : "구직";

      await sendMulticastFCM(tokens, {
        title: `💼 새 ${typeLabel}: ${job.title}`,
        body: `${job.industry} · ${job.salary || "급여 협의"} · ${job.city}`,
        data: { screen: "Jobs", jobId, type: "new_job" },
        imageUrl: (job.images && job.images[0]) ? job.images[0] : null,
      });
      console.log(`✅ ${tokens.length}명에게 구인구직 알림 전송 완료`);
    } catch (error) {
      console.error("❌ 구인구직 알림 실패:", error);
    }
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

    try {
      const tokens = await getUserTokensByCity(item.city, item.userId, "realEstate");
      if (tokens.length === 0) { console.log("📭 알림 대상 없음"); return; }

      const locationText = [item.city, item.district, item.apartment].filter(Boolean).join(" ");

      await sendMulticastFCM(tokens, {
        title: `🏠 새 부동산: ${item.title}`,
        body: `${item.dealType || ""} · ${item.price || "가격 협의"} · ${locationText}`,
        data: { screen: "부동산", itemId, type: "new_realestate" },
        imageUrl: (item.images && item.images[0]) ? item.images[0] : null,
      });
      console.log(`✅ ${tokens.length}명에게 부동산 알림 전송 완료`);
    } catch (error) {
      console.error("❌ 부동산 알림 실패:", error);
    }
  }
);

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
