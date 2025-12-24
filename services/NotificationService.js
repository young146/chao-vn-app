import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, auth } from "../firebase/config";
import { doc, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import Constants from "expo-constants";

// 네비게이션 참조 (App.js에서 설정)
let navigationRef = null;

/**
 * NotificationService - 알림 관련 모든 기능을 중앙화한 서비스
 */
class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.chatRoomsUnsubscribe = null;
    this.currentChatRoomId = null; // 현재 보고 있는 채팅방 ID
  }

  /**
   * 네비게이션 참조 설정 (App.js에서 호출)
   */
  setNavigationRef(ref) {
    navigationRef = ref;
  }

  /**
   * 현재 채팅방 ID 설정 (ChatRoomScreen에서 호출)
   */
  setCurrentChatRoom(chatRoomId) {
    this.currentChatRoomId = chatRoomId;
  }

  /**
   * 현재 채팅방 ID 초기화 (ChatRoomScreen에서 나갈 때 호출)
   */
  clearCurrentChatRoom() {
    this.currentChatRoomId = null;
  }

  /**
   * 알림 핸들러 설정 (포그라운드 알림 처리)
   */
  setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        const chatRoomId = data?.roomId;

        // 현재 보고 있는 채팅방이면 알림 표시 안 함
        if (chatRoomId && this.currentChatRoomId === chatRoomId) {
          console.log("🔇 현재 채팅방이므로 알림 표시 안 함");
          return {
            shouldShowAlert: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }

        // 알림 설정 확인
        try {
          const notificationEnabled = await AsyncStorage.getItem("chatNotificationEnabled");
          if (notificationEnabled === "false") {
            console.log("🔇 알림 OFF 상태");
            return {
              shouldShowAlert: false,
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
        } catch (error) {
          console.error("알림 설정 확인 실패:", error);
        }

        // 알림 표시
        console.log("✅ 알림 표시:", notification.request.content.title);
        return {
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        };
      },
    });
  }

  /**
   * Android 알림 채널 생성
   */
  async setupChannels() {
    if (Platform.OS !== "android") return;

    try {
      // 기본 채널
      await Notifications.setNotificationChannelAsync("default", {
        name: "기본 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // 채팅 알림 채널 (강제 알람용 - 최고 우선순위)
      await Notifications.setNotificationChannelAsync("chat", {
        name: "채팅 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true, // 방해금지 모드 우회
      });

      // 사용자 선택 알림음용 채널들
      await Notifications.setNotificationChannelAsync("chat_chime", {
        name: "차임벨",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync("chat_bell", {
        name: "종소리",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        enableVibrate: true,
        showBadge: true,
      });

      console.log("✅ 알림 채널 생성 완료");
    } catch (error) {
      console.error("❌ 알림 채널 생성 실패:", error);
    }
  }

  /**
   * 알림 권한 요청
   */
  async requestPermissions() {
    if (!Device.isDevice) {
      console.log("⚠️ 실물 기기에서만 푸시 알림이 작동합니다.");
      return false;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("🔇 알림 권한이 거부되었습니다.");
        return false;
      }

      return true;
    } catch (error) {
      console.error("❌ 권한 요청 실패:", error);
      return false;
    }
  }

  /**
   * 푸시 토큰 등록 (Expo + FCM)
   */
  async registerTokens(user) {
    if (!user?.uid) {
      console.log("⚠️ 사용자 정보가 없습니다.");
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    try {
      // Expo Push Token
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId ||
        Constants?.expoConfig?.projectId;

      if (!projectId) {
        console.log("⚠️ projectId 없음. app.json > extra.eas.projectId 확인 필요");
        return;
      }

      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      // FCM/APNS Device Token (강제 알람용 - 앱이 꺼져도 작동)
      let fcmToken = null;
      try {
        const tokenConfig =
          Platform.OS === "android" ? { gcmSenderId: "249390849714" } : {};
        const devicePushToken = await Notifications.getDevicePushTokenAsync(tokenConfig);
        fcmToken = devicePushToken.data;
        console.log("🔥 FCM/APNS Device Token:", fcmToken);
        console.log("📱 Token Type:", devicePushToken.type);
      } catch (e) {
        console.log("⚠️ FCM Token 획득 실패:", e);
      }

      // Firestore에 저장
      const tokenData = {
        expoPushToken: expoPushToken || null,
        ...(fcmToken && {
          fcmToken: fcmToken,
          fcmTokenUpdatedAt: serverTimestamp(),
          platform: Platform.OS,
        }),
        pushTokenUpdatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "users", user.uid), tokenData, { merge: true });
      console.log("✅ 푸시 토큰 저장 완료");
      console.log("  - Expo Token:", expoPushToken ? "있음" : "없음");
      console.log("  - FCM Token:", fcmToken ? "있음" : "없음");
      console.log("  - Platform:", Platform.OS);
      
      // 토큰이 없으면 경고
      if (!expoPushToken && !fcmToken) {
        console.warn("⚠️ 경고: 푸시 토큰이 모두 없습니다. 알림을 받을 수 없습니다!");
      }
    } catch (error) {
      console.error("❌ 푸시 토큰 등록 실패:", error);
    }
  }

  /**
   * 알림 수신 리스너 설정 (앱이 포그라운드/백그라운드에 있을 때)
   * 주의: 이 리스너는 알림이 이미 표시된 후에 호출됨
   */
  setupNotificationReceivedListener() {
    return Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      console.log("🔔 푸시 알림 수신됨:", {
        title: notification.request.content.title,
        body: notification.request.content.body,
        roomId: data?.roomId,
        currentChatRoom: this.currentChatRoomId,
      });
      
      // 알림이 이미 표시되었으므로 여기서는 로그만 남김
      // 실제 알림 표시 제어는 setupNotificationHandler에서 처리됨
    });
  }

  /**
   * 알림 탭 리스너 설정 (사용자가 알림을 탭했을 때)
   */
  setupNotificationResponseListener() {
    return Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log("👆 알림 탭됨:", response);
      
      const data = response.notification.request.content.data;
      
      // 채팅방으로 이동
      if (data?.screen === "ChatRoom" && data?.roomId && navigationRef?.isReady()) {
        try {
          // 채팅방 정보 가져오기
          const chatRoomDoc = await db.collection("chatRooms").doc(data.roomId).get();
          
          if (chatRoomDoc.exists) {
            const chatRoomData = chatRoomDoc.data();
            const currentUserId = auth.currentUser?.uid;
            
            if (currentUserId) {
              // 상대방 정보 찾기
              const otherUserId = chatRoomData.participants.find((id) => id !== currentUserId);
              const isBuyer = chatRoomData.buyerId === currentUserId;
              const otherUserName = isBuyer ? chatRoomData.sellerName : chatRoomData.buyerName;
              
              // 채팅방으로 이동
              navigationRef.navigate("ChatRoom", {
                chatRoomId: data.roomId,
                itemId: chatRoomData.itemId,
                itemTitle: chatRoomData.itemTitle,
                itemImage: chatRoomData.itemImage,
                otherUserId: otherUserId,
                otherUserName: otherUserName,
                sellerId: chatRoomData.sellerId,
              });
            }
          } else {
            console.log("⚠️ 채팅방을 찾을 수 없습니다:", data.roomId);
          }
        } catch (error) {
          console.error("❌ 알림 탭 처리 실패:", error);
        }
      }
    });
  }

  /**
   * 전역 채팅 알림 리스너 시작 (Firestore 실시간 감지)
   */
  startChatRoomsListener(userId) {
    // 기존 리스너가 있으면 제거
    if (this.chatRoomsUnsubscribe) {
      this.chatRoomsUnsubscribe();
    }

    if (!userId) return;

    console.log("🔔 전역 채팅 알림 리스너 시작:", userId);

    const chatRoomsRef = collection(db, "chatRooms");
    const q = query(chatRoomsRef, where("participants", "array-contains", userId));

    this.chatRoomsUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const chatData = change.doc.data();
          const chatRoomId = change.doc.id;

          // 새 메시지가 있고, 내가 보낸 메시지가 아닌 경우
          if (
            chatData.lastMessageSenderId &&
            chatData.lastMessageSenderId !== userId
          ) {
            // 현재 보고 있는 채팅방이면 로컬 알림 재생 안 함 (ChatRoomScreen에서 처리)
            if (this.currentChatRoomId === chatRoomId) {
              console.log("🔇 현재 채팅방이므로 전역 알림 스킵");
              return;
            }

            const isSeller = userId === chatData.sellerId;
            const hasUnread = isSeller ? !chatData.sellerRead : !chatData.buyerRead;

            if (hasUnread) {
              console.log("🔔 새 메시지 감지! (전역 리스너)", chatData.lastMessage);
              // 포그라운드에서만 로컬 알림 재생 (백그라운드/종료 상태는 FCM이 처리)
              this.playLocalNotification(
                chatData.lastMessage,
                chatData.itemTitle
              );
            }
          }
        }
      });
    });
  }

  /**
   * 전역 채팅 알림 리스너 중지
   */
  stopChatRoomsListener() {
    if (this.chatRoomsUnsubscribe) {
      this.chatRoomsUnsubscribe();
      this.chatRoomsUnsubscribe = null;
      console.log("🔇 전역 채팅 알림 리스너 중지");
    }
  }

  /**
   * 로컬 알림 재생 (포그라운드에서 새 메시지 감지 시)
   */
  async playLocalNotification(messageText, itemTitle) {
    try {
      // 알림 설정 확인
      const notificationEnabled = await AsyncStorage.getItem("chatNotificationEnabled");
      if (notificationEnabled === "false") {
        console.log("🔇 알림 OFF 상태");
        return;
      }

      // 사용자가 선택한 알림음 가져오기
      const soundData = await AsyncStorage.getItem("notification_sound");
      const selectedSound = soundData
        ? JSON.parse(soundData)
        : { id: "default", file: "default", channel: "chat" };

      // 로컬 알림 발생
      await Notifications.scheduleNotificationAsync({
        content: {
          title: itemTitle || "새 메시지",
          body: messageText,
          sound: selectedSound.file || "default",
          data: { screen: "ChatRoom" },
        },
        trigger:
          Platform.OS === "android"
            ? { seconds: 1, channelId: selectedSound.channel || "chat" }
            : { seconds: 1 },
      });

      console.log("🔔 로컬 알림 재생 완료!");
    } catch (error) {
      console.error("❌ 로컬 알림 재생 실패:", error);
    }
  }

  /**
   * 초기화 (앱 시작 시 한 번만 호출)
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("⚠️ NotificationService는 이미 초기화되었습니다.");
      return;
    }

    try {
      // 1. 알림 핸들러 설정
      this.setupNotificationHandler();

      // 2. 알림 채널 생성 (Android)
      await this.setupChannels();

      // 3. 알림 수신 리스너 설정
      const receivedListener = this.setupNotificationReceivedListener();

      // 4. 알림 탭 리스너 설정
      const responseListener = this.setupNotificationResponseListener();

      // 5. 사용자 로그인 상태 감지하여 채팅 리스너 시작
      auth.onAuthStateChanged((user) => {
        if (user) {
          this.registerTokens(user);
          this.startChatRoomsListener(user.uid);
        } else {
          this.stopChatRoomsListener();
        }
      });

      this.isInitialized = true;
      console.log("✅ NotificationService 초기화 완료");

      // 리스너 정리 함수 반환 (필요시 사용)
      return () => {
        receivedListener.remove();
        responseListener.remove();
        this.stopChatRoomsListener();
      };
    } catch (error) {
      console.error("❌ NotificationService 초기화 실패:", error);
    }
  }
}

// 싱글톤 인스턴스 생성 및 export
const notificationService = new NotificationService();
export default notificationService;

