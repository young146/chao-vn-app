import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { formatDistanceToNow } from "date-fns";
import { ko, vi, enUS } from "date-fns/locale";
import TranslatedText from "../components/TranslatedText";

export default function NotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('menu');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'vi': return vi;
      case 'en': return enUS;
      default: return ko;
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    try {
      console.log("📬 알림 불러오는 중... userId:", user.uid);

      const notificationsRef = collection(db, "notifications");
      const q = query(notificationsRef, where("userId", "==", user.uid));

      const snapshot = await getDocs(q);

      const notificationsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 날짜 정렬 (최신순)
      notificationsList.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || new Date(0);
        const timeB = b.createdAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });

      console.log(`✅ 알림 ${notificationsList.length}개 로드 완료`);
      console.log(
        "📋 알림 타입들:",
        notificationsList.map((n) => n.type)
      );
      setNotifications(notificationsList);
      setLoading(false);
    } catch (error) {
      console.error("알림 로드 실패:", error);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  // 알림 읽음 처리 및 물품으로 이동
  const handleNotificationPress = async (notification) => {
    try {
      // 읽지 않은 알림이면 읽음 처리
      if (!notification.read) {
        const notificationRef = doc(db, "notifications", notification.id);
        await updateDoc(notificationRef, {
          read: true,
        });

        // 로컬 상태 업데이트
        setNotifications((prevNotifications) =>
          prevNotifications.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      }

      if (notification.itemId) {
        const type = notification.type;

        const serializeTimestamps = (data) => {
          const result = { ...data };
          for (const key of Object.keys(result)) {
            if (result[key]?.toDate) {
              result[key] = result[key].toDate().toISOString();
            }
          }
          return result;
        };

        if (type === "new_item_job") {
          const snap = await getDocs(query(collection(db, "Jobs"), where("__name__", "==", notification.itemId)));
          if (!snap.empty) {
            const d = serializeTimestamps(snap.docs[0].data());
            navigation.navigate("구인구직 상세", { job: { id: snap.docs[0].id, ...d } });
          }
        } else if (type === "new_item_realestate") {
          const snap = await getDocs(query(collection(db, "RealEstate"), where("__name__", "==", notification.itemId)));
          if (!snap.empty) {
            const d = serializeTimestamps(snap.docs[0].data());
            navigation.navigate("부동산 상세", { item: { id: snap.docs[0].id, ...d } });
          }
        } else {
          // 당근/나눔 (new_item_danggn 또는 기존 new_item)
          const snap = await getDocs(query(collection(db, "XinChaoDanggn"), where("__name__", "==", notification.itemId)));
          if (!snap.empty) {
            const d = snap.docs[0].data();
            navigation.navigate("당근/나눔 상세", {
              item: {
                id: snap.docs[0].id,
                ...d,
                createdAt: d.createdAt?.toDate?.()?.toISOString() || d.createdAt,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("알림 처리 실패:", error);
    }
  };

  // 알림 아이콘 선택
  // 알림 아이콘 선택
  const getNotificationIcon = (type) => {
    switch (type) {
      case "priceChange":
        return { name: "pricetag", color: "#FF9800" };
      case "review":
        return { name: "star", color: "#FFD700" };
      case "new_review":
        return { name: "star", color: "#FFD700" };
      case "favorite":
        return { name: "heart", color: "#FF6B6B" };
      case "chat":
        return { name: "chatbubble-ellipses", color: "#4CAF50" };
      case "new_item":
      case "new_item_danggn":
        return { name: "add-circle", color: "#FF6B35" };
      case "new_item_job":
        return { name: "briefcase", color: "#1976D2" };
      case "new_item_realestate":
        return { name: "home", color: "#E91E63" };
      case "item_rejected":
        return { name: "close-circle", color: "#dc3545" };
      default:
        return { name: "notifications", color: "#2196F3" };
    }
  };

  const renderNotification = ({ item }) => {
    const icon = getNotificationIcon(item.type);
    const timeAgo = item.createdAt
      ? formatDistanceToNow(item.createdAt.toDate(), {
          addSuffix: true,
          locale: getDateLocale(),
        })
      : "";

    return (
      <TouchableOpacity
        style={[styles.notificationCard, !item.read && styles.unreadCard]}
        onPress={() => handleNotificationPress(item)}
      >
        {/* 읽지 않음 표시 */}
        {!item.read && <View style={styles.unreadDot} />}

        <View style={styles.notificationContent}>
          {/* 아이콘 */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: icon.color + "20" },
            ]}
          >
            <Ionicons name={icon.name} size={24} color={icon.color} />
          </View>

          <View style={styles.textContainer}>
            {/* 제목 */}
            <Text style={[styles.title, !item.read && styles.unreadTitle]}>
              {item.type === "priceChange" && <Text>🏷️ {t('priceDiscount')}</Text>}
              {item.type === "review" && <Text>⭐ {t('newReview')}</Text>}
              {item.type === "new_review" && <Text>⭐ {t('newReview')}</Text>}
              {item.type === "favorite" && <Text>❤️ {t('newFavorite')}</Text>}
              {item.type === "chat" && <Text>💬 {t('newMessage')}</Text>}
              {item.type === "new_item" && <Text>📦 {t('newItemRegistered')}</Text>}
              {item.type === "new_item_danggn" && <Text>🥕 당근/나눔 새 등록</Text>}
              {item.type === "new_item_job" && <Text>💼 구인구직 새 등록</Text>}
              {item.type === "new_item_realestate" && <Text>🏠 부동산 새 등록</Text>}
              {item.type === "item_rejected" && <Text>🚫 {t('itemRejected')}</Text>}
            </Text>
            {/* ✅ 메시지 (numberOfLines 제거!) */}
            <Text style={styles.message}>{item.message}</Text>

            {/* 가격 정보 (가격 변동 알림만) */}
            {item.type === "priceChange" && (
              <View style={styles.priceInfo}>
                <Text style={styles.oldPrice}>
                  {item.oldPrice?.toLocaleString()}₫
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#999" />
                <Text style={styles.newPrice}>
                  {item.newPrice?.toLocaleString()}₫
                </Text>
<Text style={styles.discount}>
                      ({t('discount', { amount: item.discount?.toLocaleString() })})
                    </Text>
              </View>
            )}

            {/* 물품 제목 표시 */}
            {(item.type === "new_item" || item.type === "new_item_danggn" || item.type === "new_item_job" || item.type === "new_item_realestate" || item.type === "item_rejected") &&
              item.itemTitle && (
                <TranslatedText style={styles.itemTitle} numberOfLines={1}>
                  {item.itemTitle}
                </TranslatedText>
              )}

            {/* 시간 */}
            <Text style={styles.time}>{timeAgo}</Text>
          </View>

          {/* 물품 이미지 */}
          {item.itemImage && (
            <Image
              source={{ uri: item.itemImage }}
              style={styles.itemImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>{t('loadingNotifications')}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="log-in-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>{t('loginRequired')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          notifications.length === 0
            ? styles.emptyContainer
            : styles.listContainer
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={["#FF6B35"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={80} color="#ddd" />
            <Text style={styles.emptyText}>{t('notificationEmpty')}</Text>
            <Text style={styles.emptySubText}>
              {t('notificationEmptyDesc')}
            </Text>
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
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    fontWeight: "600",
  },
  emptySubText: {
    fontSize: 14,
    color: "#ccc",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  notificationCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    position: "relative",
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B35",
    backgroundColor: "#FFFAF8",
  },
  unreadDot: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF6B35",
  },
  notificationContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  unreadTitle: {
    color: "#FF6B35",
  },
  message: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 8,
  },
  priceInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  oldPrice: {
    fontSize: 14,
    color: "#999",
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  newPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginLeft: 8,
    marginRight: 8,
  },
  discount: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF6B35",
    marginBottom: 8,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginLeft: 12,
  },
});
