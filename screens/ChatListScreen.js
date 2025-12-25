import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy, // 추가
  limit,   // 추가
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage"; // 추가

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState([]);

  useEffect(() => {
    if (!user) return;

    // 1. 프리페치된 데이터 먼저 로드 (0초 로딩)
    const loadCachedRooms = async () => {
      if (chatRooms.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem("prefetched_chat_rooms");
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setChatRooms(parsedData);
            console.log("⚡ [Cache] 프리페치된 채팅방 목록을 즉시 표시합니다.");
          }
        } catch (e) {
          console.error("채팅 캐시 로드 실패:", e);
        }
      }
    };
    loadCachedRooms();

    const q = query(
      collection(db, "chatRooms"),
      where("participants", "array-contains", user.uid),
      orderBy("lastMessageAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rooms = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 중복 방지를 위해 Map을 사용하여 ID 기준 유일값 추출
      const uniqueRooms = Array.from(new Map(rooms.map(room => [room.id, room])).values());

      setChatRooms(uniqueRooms);
      // 최신 데이터 캐시 업데이트
      AsyncStorage.setItem("prefetched_chat_rooms", JSON.stringify(uniqueRooms));
    });

    return () => unsubscribe();
  }, [user]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString("ko-KR");
  };

  const getOtherUserInfo = (room) => {
    const otherUserId = room.participants.find((id) => id !== user.uid);
    const isBuyer = room.buyerId === user.uid;

    return {
      name: isBuyer ? room.sellerName : room.buyerName,
      userId: otherUserId,
    };
  };

  const renderChatRoom = ({ item }) => {
    const otherUser = getOtherUserInfo(item);
    const hasUnread = item.lastMessageSenderId !== user.uid && item.unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          navigation.navigate("ChatRoom", {
            chatRoomId: item.id,
            itemId: item.itemId,
            itemTitle: item.itemTitle,
            itemImage: item.itemImage,
            otherUserId: otherUser.userId,
            otherUserName: otherUser.name,
            sellerId: item.sellerId,
          })
        }
      >
        {/* 상품 이미지 */}
        <View style={styles.imageContainer}>
          {item.itemImage ? (
            <Image
              source={{ uri: item.itemImage }}
              style={styles.itemImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={30} color="#ccc" />
            </View>
          )}
        </View>

        {/* 채팅 정보 */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.itemTitle || "삭제된 상품"}
            </Text>
            <Text style={styles.timestamp}>
              {formatDate(item.lastMessageAt)}
            </Text>
          </View>

          <Text style={styles.otherUserName}>{otherUser.name}</Text>

          <View style={styles.lastMessageContainer}>
            <Text
              style={[
                styles.lastMessage,
                hasUnread && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage || "메시지 없음"}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>로그인이 필요합니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chatRooms}
        renderItem={renderChatRoom}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>채팅 내역이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  chatItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  imageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  noImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  chatInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
  },
  otherUserName: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  lastMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: "#999",
  },
  lastMessageUnread: {
    color: "#333",
    fontWeight: "500",
  },
  unreadBadge: {
    backgroundColor: "#FF6B35",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#999",
  },
});