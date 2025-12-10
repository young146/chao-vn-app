const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { Expo } = require("expo-server-sdk");

initializeApp();
setGlobalOptions({ region: "asia-northeast3" });
const db = getFirestore();
const expo = new Expo();

exports.sendChatNotification = onDocumentCreated("chatRooms/{roomId}/messages/{messageId}", async (event) => {
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
        const pushToken = userData.expoPushToken;

        if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
            console.log("Invalid or missing push token for receiver:", pushToken);
            return;
        }

        // 4. 알림 메시지 구성
        const messages = [];
        const bodyText = messageData.image ? "사진을 보냈습니다." : messageData.text;
        const titleText = chatRoomData.itemTitle || "새 메시지";

        messages.push({
            to: pushToken,
            sound: "default",
            title: titleText,
            body: bodyText,
            data: {
                roomId: roomId,
                screen: "ChatRoom"
            },
            channelId: "chat_default_v2",
            priority: "high",
        });

        // 5. Expo로 전송
        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                console.log("Notification sent:", ticketChunk);
            } catch (error) {
                console.error("Error sending chunk:", error);
            }
        }

    } catch (error) {
        console.error("Error in sendChatNotification:", error);
    }
});
