import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  query,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase/config";

export default function AdminScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    categories: {},
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      Alert.alert("권한 없음", "관리자만 접근할 수 있습니다.");
      navigation.goBack();
      return;
    }
    loadItems();
  }, []);

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

  const handleDeleteItem = (item) => {
    Alert.alert(
      "물품 삭제",
      `"${item.title}"\n이 물품을 삭제하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "XinChaoDanggn", item.id));
              Alert.alert("완료", "물품이 삭제되었습니다.");
              loadItems();
            } catch (error) {
              console.error("삭제 실패:", error);
              Alert.alert("오류", "삭제에 실패했습니다.");
            }
          },
        },
      ]
    );
  };

  const handleViewDetail = (item) => {
    navigation.navigate("물품 상세", { item });
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
            <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
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
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <Text style={styles.itemLocation}>
              {item.city} · {item.district}
            </Text>
          </View>
          <Text style={styles.itemUser} numberOfLines={1}>
            👤 {item.userEmail}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteItem(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#dc3545" />
      </TouchableOpacity>
    </View>
  );

  if (!isAdmin()) {
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

      {/* 통계 */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stats.totalItems}</Text>
          <Text style={styles.statLabel}>전체 물품</Text>
        </View>
        {Object.entries(stats.categories).slice(0, 3).map(([cat, count]) => (
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
  },
  deleteButton: {
    width: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF0F0",
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
});