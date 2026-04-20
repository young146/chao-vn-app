import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

export default function AdminScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    categories: {},
  });
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // ✅ 관리자 확인
  useEffect(() => {
    if (user && user.email) {
      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];
      const admin = adminEmails.includes(user.email);
      setIsAdmin(admin);

      if (!admin) {
        Alert.alert("권한 없음", "관리자만 접근할 수 있습니다.");
        navigation.goBack();
        return;
      }

      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    try {
      const q = query(
        collection(db, "XinChaoDanggn"),
        orderBy("createdAt", "desc")
      );
      const itemsSnapshot = await getDocs(q);
      const itemsData = itemsSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setItems(itemsData);

      // 통계 계산
      const categoryCount = {};
      itemsData.forEach((item) => {
        const cat = item.category || "기타";
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });

      setStats({
        totalItems: itemsData.length,
        categories: categoryCount,
      });
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      Alert.alert("오류", "데이터를 불러올 수 없습니다.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  // ✅ 물품 삭제 + 판매자에게 알림 (수정됨!)
  const handleDeleteItem = (item) => {
    Alert.alert(
      "물품 삭제",
      `"${item.title}"\n\n이 물품을 삭제하시겠습니까?\n판매자에게 거부 알림이 전송됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              console.log("🗑️ 물품 삭제 시작:", item.id);
              console.log("📧 판매자 userId:", item.userId);

              // 1. 물품 삭제
              await deleteDoc(doc(db, "XinChaoDanggn", item.id));
              console.log("✅ 물품 삭제 완료");

              // 2. 판매자에게 알림 생성 (간단하게!)
              if (item.userId) {
                console.log("📨 알림 생성 중...");

                await addDoc(collection(db, "notifications"), {
                  userId: item.userId, // ✅ 직접 사용!
                  type: "item_rejected",
                  itemTitle: item.title,
                  itemImage: item.images?.[0] || "",
                  message: `귀하의 등록물품 "${item.title}"은 당사의 규정에 의해 등록이 거부되었습니다.`,
                  read: false,
                  createdAt: serverTimestamp(),
                });

                console.log("✅ 알림 생성 완료!");
              } else {
                console.log("⚠️ userId가 없어서 알림을 생성할 수 없습니다.");
              }

              Alert.alert(
                "완료",
                "물품이 삭제되고 판매자에게 알림이 전송되었습니다."
              );
              loadItems();
            } catch (error) {
              console.error("❌ 삭제 실패:", error);
              console.error("❌ 에러 상세:", error.message);
              Alert.alert("오류", `삭제에 실패했습니다.\n\n${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleViewDetail = (item) => {
    // createdAt을 문자열로 변환하여 navigation params에 전달
    const serializableItem = {
      ...item,
      createdAt: item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
    };
    navigation.navigate("당근/나눔 상세", { item: serializableItem });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => handleViewDetail(item)}
      >
        <View style={styles.itemImageContainer}>
          {item.images && item.images.length > 0 ? (
            <Image
              source={{ uri: item.images[0] }}
              style={styles.itemImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="image-outline" size={32} color="#ccc" />
            </View>
          )}
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemPrice}>{item.priceText || String(item.price || '-')}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <Text style={styles.itemLocation}>
              {item.city} · {item.district}
            </Text>
          </View>
          <Text style={styles.itemUser} numberOfLines={1}>
            👤 {item.userEmail || "이메일 없음"}
          </Text>
          <Text style={styles.itemUserId} numberOfLines={1}>
            🆔 {item.userId || "userId 없음"}
          </Text>
          {item.createdAt && (
            <Text style={styles.itemDate}>
              📅 {item.createdAt.toDate().toLocaleDateString("ko-KR")}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteItem(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#dc3545" />
        <Text style={styles.deleteButtonText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={32} color="#dc3545" />
        <Text style={styles.title}>관리자 페이지</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      {/* 빠른 작업 */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => navigation.navigate('이웃사업', { screen: '이웃사업 메인' })}
          activeOpacity={0.8}
        >
          <Ionicons name="storefront" size={20} color="#FF6B35" />
          <Text style={styles.quickActionText}>이웃사업 관리</Text>
          <Ionicons name="chevron-forward" size={16} color="#999" />
        </TouchableOpacity>
      </View>

      {/* 통계 */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>전체 물품</Text>
        </View>
        {Object.entries(stats.categories)
          .slice(0, 3)
          .map(([cat, count]) => (
            <View key={cat} style={styles.statBox}>
              <Text style={styles.statNumber}>{count}</Text>
              <Text style={styles.statLabel}>{cat}</Text>
            </View>
          ))}
      </View>

      {/* 물품 목록 */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>📦 등록된 물품</Text>
        <Text style={styles.listSubtitle}>삭제할 물품을 선택하세요</Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#dc3545"]}
            tintColor="#dc3545"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>등록된 물품이 없습니다</Text>
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
  header: {
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
    justifyContent: "space-around",
  },
  statBox: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#dc3545",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  listHeader: {
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  listSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  itemContent: {
    flex: 1,
    flexDirection: "row",
    padding: 12,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  noImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 12,
    color: "#666",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  itemLocation: {
    fontSize: 12,
    color: "#999",
  },
  itemUser: {
    fontSize: 11,
    color: "#999",
    marginBottom: 2,
  },
  itemUserId: {
    fontSize: 10,
    color: "#ccc",
    marginBottom: 2,
  },
  itemDate: {
    fontSize: 11,
    color: "#999",
  },
  deleteButton: {
    width: 70,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF0F0",
  },
  deleteButtonText: {
    marginTop: 4,
    fontSize: 11,
    color: "#dc3545",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
  },
  quickActionsRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F0",
    borderWidth: 1,
    borderColor: "#FFE0D0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginLeft: 10,
  },
});
