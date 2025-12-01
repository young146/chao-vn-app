import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

export default function MyItemsScreen({ navigation }) {
  const { user } = useAuth();
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, selling, sold

  useEffect(() => {
    loadMyItems();
  }, []);

  // 화면 포커스될 때마다 새로고침
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadMyItems();
    });
    return unsubscribe;
  }, [navigation]);

  const loadMyItems = async () => {
    if (!user) {
      setMyItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const itemsRef = collection(db, "XinChaoDanggn");
      const q = query(
        itemsRef,
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // 클라이언트에서 날짜순 정렬 (최신순)
      items.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });
      
      setMyItems(items);
    } catch (error) {
      console.error("내 물품 로드 실패:", error);
      Alert.alert("오류", "내 물품을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = (itemId, itemTitle) => {
    Alert.alert(
      "물품 삭제",
      `"${itemTitle}"을(를) 삭제하시겠습니까?`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "XinChaoDanggn", itemId));
              setMyItems(prev => prev.filter(item => item.id !== itemId));
              Alert.alert("삭제 완료", "물품이 삭제되었습니다");
            } catch (error) {
              console.error("물품 삭제 실패:", error);
              Alert.alert("오류", "삭제에 실패했습니다.");
            }
          }
        }
      ]
    );
  };

  const handleItemPress = (item) => {
    // createdAt을 문자열로 변환하여 navigation params에 전달
    const serializableItem = {
      ...item,
      createdAt: item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
    };
    navigation.navigate("물품 상세", { item: serializableItem });
  };

  const handleEditItem = (item) => {
    navigation.navigate("물품 수정", { item });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("ko-KR");
  };

  const getFilteredItems = () => {
    if (filter === "all") return myItems;
    if (filter === "selling") return myItems.filter(item => item.status === "판매중");
    if (filter === "sold") return myItems.filter(item => item.status === "판매완료");
    return myItems;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      {/* 물품 이미지 */}
<View style={styles.imageContainer}>
  {item.images && item.images.length > 0 ? (
    <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
  ) : item.imageUri ? (
    <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
  ) : (
    <View style={styles.noImage}>
      <Ionicons name="image-outline" size={40} color="#ccc" />
    </View>
  )}
        
        {/* 판매완료 오버레이 */}
        {item.status === "판매완료" && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>판매완료</Text>
          </View>
        )}
      </View>

      {/* 물품 정보 */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemCategory}>{item.category}</Text>
          <Text style={styles.itemDot}>•</Text>
          <Text style={styles.itemDate}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      {/* 액션 버튼 */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleEditItem(item);
          }}
        >
          <Ionicons name="create-outline" size={20} color="#FF6B35" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={(e) => {
            e.stopPropagation();
            handleDeleteItem(item.id, item.title);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#dc3545" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={80} color="#ccc" />
        <Text style={styles.emptyTitle}>로그인이 필요합니다</Text>
        <Text style={styles.emptyMessage}>
          내 물품을 보려면 로그인해주세요
        </Text>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => navigation.navigate("로그인")}
        >
          <Text style={styles.loginButtonText}>로그인하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const filteredItems = getFilteredItems();

  return (
    <View style={styles.container}>
      {/* 필터 버튼 */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            전체 ({myItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "selling" && styles.filterButtonActive]}
          onPress={() => setFilter("selling")}
        >
          <Text style={[styles.filterText, filter === "selling" && styles.filterTextActive]}>
            판매중 ({myItems.filter(i => i.status === "판매중").length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "sold" && styles.filterButtonActive]}
          onPress={() => setFilter("sold")}
        >
          <Text style={[styles.filterText, filter === "sold" && styles.filterTextActive]}>
            판매완료 ({myItems.filter(i => i.status === "판매완료").length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyMessage}>로딩 중...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cube-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>
            {filter === "all" ? "등록한 물품이 없습니다" :
             filter === "selling" ? "판매중인 물품이 없습니다" :
             "판매완료된 물품이 없습니다"}
          </Text>
          <Text style={styles.emptyMessage}>
            물품을 등록해보세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#FF6B35",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  listContainer: {
    padding: 12,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  noImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  soldOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  soldText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 6,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemCategory: {
    fontSize: 13,
    color: "#666",
  },
  itemDot: {
    fontSize: 13,
    color: "#666",
    marginHorizontal: 4,
  },
  itemDate: {
    fontSize: 13,
    color: "#999",
  },
  actionButtons: {
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  actionButton: {
    padding: 8,
    marginVertical: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});