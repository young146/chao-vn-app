import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Keyboard,
  Vibration,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../firebase/config';
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
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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

  const [chatRoomId, setChatRoomId] = useState(initialChatRoomId);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const currentUserId = auth.currentUser?.uid;
  const currentUserName = auth.currentUser?.email?.split('@')[0] || '사용자';
  const flatListRef = useRef(null);
  const prevMessageCountRef = useRef(0);

  // 알림 권한 요청
  useEffect(() => {
    requestNotificationPermissions();
    setupNotificationChannels();
  }, []);

  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.log('⚠️ 알림 권한 거부됨');
    }
  };

  const setupNotificationChannels = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('chat_default', {
        name: '기본 알림음',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default.wav',
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('chat_chime', {
        name: '차임벨',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'chime.wav',
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('chat_bell', {
        name: '종소리',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'bell.wav',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  };

  // 키보드 높이 감지 (Android 대응)
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // 채팅방 생성 또는 가져오기
  useEffect(() => {
    const initChatRoom = async () => {
      if (chatRoomId) return;

      const userIds = [sellerId, currentUserId].sort();
      const newChatRoomId = `${itemId}_${userIds[0]}_${userIds[1]}`;
      
      console.log('📌 채팅방 ID:', newChatRoomId);

      const chatRoomRef = doc(db, 'chatRooms', newChatRoomId);
      const chatRoomSnap = await getDoc(chatRoomRef);

      if (!chatRoomSnap.exists()) {
        console.log('✅ 새 채팅방 생성');
        await setDoc(chatRoomRef, {
          participants: [sellerId, currentUserId],
          itemId,
          itemTitle,
          itemImage: itemImage || '',
          sellerId,
          sellerName: sellerId === currentUserId ? currentUserName : otherUserName,
          buyerId: sellerId === currentUserId ? otherUserId : currentUserId,
          buyerName: sellerId === currentUserId ? otherUserName : currentUserName,
          lastMessage: '',
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: '',
          unreadCount: 0,
          sellerRead: true,
          buyerRead: true,
        });
      } else {
        console.log('✅ 기존 채팅방 사용');
      }

      setChatRoomId(newChatRoomId);
    };

    initChatRoom();
  }, []);

  // 알림 재생 함수
  const playNotification = async (messageText) => {
    try {
      // 설정 확인
      const notificationEnabled = await AsyncStorage.getItem('chatNotificationEnabled');
      if (notificationEnabled === 'false') {
        console.log('🔇 알림 OFF 상태');
        return;
      }

      // 사용자가 선택한 알림음 가져오기
      const soundData = await AsyncStorage.getItem('notification_sound');
      const selectedSound = soundData 
        ? JSON.parse(soundData) 
        : { id: 'default', file: 'default.wav', channel: 'chat_default' };

      // 로컬 알림 발생
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '새 메시지',
          body: messageText,
          sound: selectedSound.file,
          data: { screen: 'ChatRoom' },
        },
        trigger: Platform.OS === 'android' 
          ? { seconds: 1, channelId: selectedSound.channel }
          : { seconds: 1 },
      });

      // 진동
      Vibration.vibrate([0, 200, 100, 200]);

      console.log('🔔 알림 재생 완료!', selectedSound.id);
    } catch (error) {
      console.log('알림 재생 실패:', error);
    }
  };

  // 메시지 실시간 수신
  useEffect(() => {
    if (!chatRoomId) return;

    console.log('👂 메시지 수신 대기:', chatRoomId);

    const q = query(
      collection(db, 'chatRooms', chatRoomId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log('📨 받은 메시지:', msgs.length, '개');
      
      // ✅ 새 메시지 알림 (상대방이 보낸 경우만)
      if (prevMessageCountRef.current > 0 && msgs.length > prevMessageCountRef.current) {
        const newMessage = msgs[msgs.length - 1];
        if (newMessage.senderId !== currentUserId) {
          console.log('🔔 새 메시지 도착!', newMessage.text);
          playNotification(newMessage.text);
        }
      }
      
      prevMessageCountRef.current = msgs.length;
      setMessages(msgs);

      // 읽음 표시
      if (msgs.length > 0) {
        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
        const isSeller = currentUserId === sellerId;
        updateDoc(chatRoomRef, {
          [isSeller ? 'sellerRead' : 'buyerRead']: true,
          unreadCount: 0,
        });
      }
    });

    return () => unsubscribe();
  }, [chatRoomId]);

  const sendMessage = async () => {
    if (!messageText.trim() || !chatRoomId) {
      console.log('❌ 전송 불가:', { messageText, chatRoomId });
      return;
    }

    console.log('📤 메시지 전송:', messageText);

    try {
      const docRef = await addDoc(collection(db, 'chatRooms', chatRoomId, 'messages'), {
        text: messageText.trim(),
        senderId: currentUserId,
        senderName: currentUserName,
        timestamp: serverTimestamp(),
      });

      console.log('✅ 메시지 저장 성공!', docRef.id);

      const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
      const isSeller = currentUserId === sellerId;
      
      await updateDoc(chatRoomRef, {
        lastMessage: messageText.trim(),
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: currentUserId,
        [isSeller ? 'sellerRead' : 'buyerRead']: true,
        [isSeller ? 'buyerRead' : 'sellerRead']: false,
        unreadCount: 1,
      });

      console.log('✅ 채팅방 업데이트 성공!');
      setMessageText('');
      
    } catch (error) {
      console.error('❌❌❌ 메시지 전송 실패:', error);
      alert('전송 실패: ' + error.message);
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.senderId === currentUserId;
    const messageTime = item.timestamp
      ? format(item.timestamp.toDate(), 'HH:mm', { locale: ko })
      : '';

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
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>
        </View>
        <Text style={styles.messageTime}>{messageTime}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View style={styles.itemHeader}>
        {itemImage && (
          <Image source={{ uri: itemImage }} style={styles.headerImage} />
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {itemTitle}
        </Text>
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
          Platform.OS === 'android' && keyboardHeight > 0 && {
            marginBottom: keyboardHeight - 20,
          }
        ]}
      >
        <TextInput
          style={styles.input}
          value={messageText}
          onChangeText={setMessageText}
          placeholder="메시지를 입력하세요"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!messageText.trim()}
        >
          <Text style={styles.sendButtonText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  messageList: {
    padding: 15,
    paddingBottom: 30,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '75%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 4,
  },
  myBubble: {
    backgroundColor: '#FF6B35',
  },
  otherBubble: {
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});