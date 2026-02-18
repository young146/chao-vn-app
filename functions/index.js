const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { Expo } = require("expo-server-sdk");

initializeApp();
setGlobalOptions({ region: "asia-northeast3" });
const db = getFirestore();
const expo = new Expo();

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
