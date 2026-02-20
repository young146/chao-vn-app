import React, { useState, useEffect, useRef } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Vibration,
  Modal,
  Dimensions,
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { getColors } from "../utils/colors";
import { db, auth, storage } from "../firebase/config";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  limitToLast, // 추가
} from "firebase/firestore";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import TranslatedText from "../components/TranslatedText";

// 알림 핸들러 설정 (앱 시작 시 한 번만)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function ChatRoomScreen({ route, navigation }) {
  const {
    chatRoomId: initialChatRoomId,
    itemId,
    itemTitle,
    itemImage,
    otherUserId,
    otherUserName,
    sellerId,
  } = route.params;

  const { t } = useTranslation('menu');
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const isFocused = useIsFocused(); // 현재 화면이 활성화되어 있는지 확인
  const [chatRoomId, setChatRoomId] = useState(initialChatRoomId);
  const chatRoomCreatedRef = useRef(!!initialChatRoomId); // 채팅방이 이미 생성됐는지 추적
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null); // 이미지 뷰어용 상태
  const [previewImage, setPreviewImage] = useState(null); // 전송 전 이미지 미리보기 상태
  const [isUploading, setIsUploading] = useState(false); // 업로드 중 상태
  const currentUserId = auth.currentUser?.uid;
  const currentUserName = auth.currentUser?.email?.split("@")[0] || t('chatRoom.user');
  const flatListRef = useRef(null);
  const prevMessageCountRef = useRef(0);
  const sentMessageIdsRef = useRef(new Set()); // 발신자가 보낸 메시지 ID 추적

  // 알림 권한 요청
  useEffect(() => {
    requestNotificationPermissions();
    setupNotificationChannels();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("⚠️ 알림 권한 거부됨");
    }
  };

  const setupNotificationChannels = async () => {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("chat_default", {
        name: "기본 알림음",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default.wav",
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync("chat_chime", {
        name: "차임벨",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "chime.wav",
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync("chat_bell", {
        name: "종소리",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "bell.wav",
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  };

  // 키보드 높이 감지 (Android 대응)
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 채팅방 ID 계산 (새 채팅방은 문서를 즉시 생성하지 않음)
  useEffect(() => {
    const initChatRoom = async () => {
      if (chatRoomId) return;

      // 🛡️ 무결성 체크: 필수 값이 없으면 중단
      if (!sellerId || !currentUserId || !itemId) {
        console.error("❌ 채팅방 생성 불가: 필수 정보 누락", { sellerId, currentUserId, itemId });
        alert(t('chatRoom.chatRoomLoadFailed'));
        navigation.goBack();
        return;
      }

      const userIds = [sellerId, currentUserId].sort();
      const newChatRoomId = `${itemId}_${userIds[0]}_${userIds[1]}`;

      console.log("📌 채팅방 ID:", newChatRoomId);

      // 기존 채팅방인지 확인
      const chatRoomRef = doc(db, "chatRooms", newChatRoomId);
      const chatRoomSnap = await getDoc(chatRoomRef);

      if (chatRoomSnap.exists()) {
        console.log("✅ 기존 채팅방 사용");
        chatRoomCreatedRef.current = true;
      } else {
        console.log("📌 새 채팅방 - 첫 메시지 전송 시 생성됨");
        chatRoomCreatedRef.current = false;
      }

      setChatRoomId(newChatRoomId);
    };

    initChatRoom();
  }, []);

  // 채팅방 문서 생성 (첫 메시지 전송 시 호출)
  const ensureChatRoomExists = async (roomId) => {
    if (chatRoomCreatedRef.current) return;

    console.log("✅ 새 채팅방 문서 생성");
    const chatRoomRef = doc(db, "chatRooms", roomId);
    await setDoc(chatRoomRef, {
      participants: [sellerId, currentUserId],
      itemId,
      itemTitle,
      itemImage: itemImage || "",
      sellerId,
      sellerName: sellerId === currentUserId ? currentUserName : otherUserName,
      buyerId: sellerId === currentUserId ? otherUserId : currentUserId,
      buyerName: sellerId === currentUserId ? otherUserName : currentUserName,
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: "",
      unreadCount: 0,
      sellerRead: true,
      buyerRead: true,
    });
    chatRoomCreatedRef.current = true;
  };

  // 알림 재생 함수
  const playNotification = async (messageText) => {
    try {
      // 설정 확인
      const notificationEnabled = await AsyncStorage.getItem(
        "chatNotificationEnabled"
      );
      if (notificationEnabled === "false") {
        console.log("🔇 알림 OFF 상태");
        return;
      }

      // 사용자가 선택한 알림음 가져오기
      const soundData = await AsyncStorage.getItem("notification_sound");
      const selectedSound = soundData
        ? JSON.parse(soundData)
        : { id: "default", file: "default.wav", channel: "chat_default" };

      // 로컬 알림 발생
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('chatRoom.newMessage'),
          body: messageText,
          sound: selectedSound.file,
          data: { screen: "ChatRoom" },
        },
        trigger:
          Platform.OS === "android"
            ? { seconds: 1, channelId: selectedSound.channel }
            : { seconds: 1 },
      });

      // 진동
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 250, 250, 250]);
      }

      console.log("🔔 알림 재생 완료!", selectedSound.id);
    } catch (error) {
      console.log("알림 재생 실패:", error);
    }
  };

  // 메시지 실시간 수신
  useEffect(() => {
    if (!chatRoomId) return;

    console.log("👂 메시지 수신 대기:", chatRoomId);

    // 최근 50개의 메시지만 가져오도록 제한 (성능 최적화)
    const q = query(
      collection(db, "chatRooms", chatRoomId, "messages"),
      orderBy("timestamp", "asc"),
      limitToLast(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log("📨 받은 메시지:", msgs.length, "개");

      // ⚠️ 로컬 알림 완전히 비활성화 - Firebase Functions가 알림을 보내므로
      // 로컬 알림은 발신자에게도 알림이 가는 문제가 발생하므로 제거
      // Firebase Functions만 사용하여 수신자에게만 알림 전송

      prevMessageCountRef.current = msgs.length;
      setMessages(msgs);

      // 읽음 표시
      if (msgs.length > 0) {
        const chatRoomRef = doc(db, "chatRooms", chatRoomId);
        const isSeller = currentUserId === sellerId;
        updateDoc(chatRoomRef, {
          [isSeller ? "sellerRead" : "buyerRead"]: true,
          unreadCount: 0,
        });
      }
    });

    return () => unsubscribe();
  }, [chatRoomId]);

  const sendMessage = async () => {
    if ((!messageText.trim() && !previewImage) || !chatRoomId) {
      return;
    }

    if (isUploading) return;

    console.log("📤 메시지 전송 시작");
    setIsUploading(true);

    try {
      // 새 채팅방이면 첫 메시지 전송 시 문서 생성
      await ensureChatRoomExists(chatRoomId);

      let downloadURL = null;

      // 이미지가 있다면 업로드
      if (previewImage) {
        // 1. Resize
        const manipResult = await ImageManipulator.manipulateAsync(
          previewImage,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        const resizedUri = manipResult.uri;

        // 2. Upload
        const response = await fetch(resizedUri);
        const blob = await response.blob();
        const filename = `chat/${chatRoomId}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob);
        downloadURL = await getDownloadURL(storageRef);
      }

      // 3. Send Message
      const messageData = {
        text: messageText.trim() || (previewImage ? t('chatRoom.photo') : ""),
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: serverTimestamp(),
      };

      if (downloadURL) {
        messageData.image = downloadURL;
      }

      const docRef = await addDoc(
        collection(db, "chatRooms", chatRoomId, "messages"),
        messageData
      );

      console.log("✅ 메시지 저장 성공!", docRef.id);

      // 🔒 발신자가 보낸 메시지 ID를 추적하여 알림이 발생하지 않도록 함
      sentMessageIdsRef.current.add(docRef.id);

      // 발신자가 메시지를 보낼 때 prevMessageCountRef를 미리 증가시켜 알림이 발생하지 않도록 함
      prevMessageCountRef.current = messages.length + 1;

      // 4. Update ChatRoom
      const chatRoomRef = doc(db, "chatRooms", chatRoomId);
      const isSeller = currentUserId === sellerId;

      await updateDoc(chatRoomRef, {
        lastMessage: downloadURL ? t('chatRoom.sentPhoto') : messageText.trim(),
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: currentUserId,
        [isSeller ? "sellerRead" : "buyerRead"]: true,
        [isSeller ? "buyerRead" : "sellerRead"]: false,
        unreadCount: 1,
      });

      console.log("✅ 채팅방 업데이트 성공!");
      setMessageText("");
      setPreviewImage(null);
    } catch (error) {
      console.error("❌❌❌ 메시지 전송 실패:", error);
      alert(t('chatRoom.sendFailed') + ": " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert(t('chatRoom.galleryPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPreviewImage(result.assets[0].uri);
    }
  };



  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === currentUserId;

    let messageDate = null;
    if (item.timestamp) {
      if (item.timestamp.toDate) {
        messageDate = item.timestamp.toDate();
      } else {
        messageDate = new Date(item.timestamp);
      }
    }

    const messageTime = messageDate
      ? format(messageDate, "HH:mm", { locale: ko })
      : "";

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myBubble : styles.otherBubble,
            item.image && { padding: 4 }, // 이미지일 경우 패딩 줄임
          ]}
        >
          {item.image ? (
            <TouchableOpacity onPress={() => setSelectedImage(item.image)}>
              <Image
                source={{ uri: item.image }}
                style={{ width: 200, height: 200, borderRadius: 12 }}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            </TouchableOpacity>
          ) : (
            <TranslatedText
              style={[
                styles.messageText,
                isMyMessage ? styles.myMessageText : styles.otherMessageText,
              ]}
            >
              {item.text}
            </TranslatedText>
          )}
        </View>
        <Text style={styles.messageTime}>{messageTime}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <View style={styles.itemHeader}>
        {itemImage && (
          <Image
            source={{ uri: itemImage }}
            style={styles.headerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {itemTitle}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {t('chatRoom.me')}: {currentUserName} ↔ {t('chatRoom.other')}: {otherUserName}
          </Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      <View
        style={[
          styles.inputContainer,
          Platform.OS === "android" &&
          keyboardHeight > 0 && {
            marginBottom: keyboardHeight - 20,
          },
        ]}
      >
        {previewImage && (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: previewImage }}
              style={styles.previewImage}
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewImage(null)}
            >
              <Ionicons name="close-circle" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.attachButton} onPress={pickImage}>
            <Ionicons name="add" size={24} color="#666" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            value={messageText}
            onChangeText={setMessageText}
            placeholder={t('chatRoom.messagePlaceholder')}
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() && !previewImage) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={(!messageText.trim() && !previewImage) || isUploading}
          >
            <Text style={styles.sendButtonText}>
              {isUploading ? "..." : t('chatRoom.send')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 이미지 확대 보기 모달 */}
      <Modal
        visible={!!selectedImage}
        transparent={true}
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{ uri: selectedImage }}
            style={styles.fullImage}
            contentFit="contain"
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  messageList: {
    padding: 15,
    paddingBottom: 30,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: "75%",
  },
  myMessage: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  otherMessage: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myBubble: {
    backgroundColor: "#FF6B35",
  },
  otherBubble: {
    backgroundColor: "#fff",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#333",
  },
  messageTime: {
    fontSize: 11,
    color: "#999",
  },
  inputContainer: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  previewContainer: {
    flexDirection: "row",
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  previewCloseButton: {
    position: "absolute",
    top: -5,
    left: 75,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  input: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
    color: "#000", // ✅ 다크모드 대응: 텍스트 색상 명시
  },
  attachButton: {
    padding: 10,
    marginRight: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
  },
  fullImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
  },
});
