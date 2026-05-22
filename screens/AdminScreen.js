import React, { useState, useEffect, useCallback } from "react";
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

// 관리 가능한 카테고리 정의
const CATEGORIES = [
  {
    key: "danggn",
    label: "당근/나눔",
    collection: "XinChaoDanggn",
    color: "#FF6B35",
    tab: "당근/나눔",
    detailScreen: "당근/나눔 상세",
    paramKey: "item",
    notifType: "item_rejected",
  },
  {
    key: "realestate",
    label: "부동산",
    collection: "RealEstate",
    color: "#E91E63",
    tab: "부동산",
    detailScreen: "부동산 상세",
    paramKey: "item",
    notifType: "item_rejected",
  },
  {
    key: "job",
    label: "일자리",
    collection: "Jobs",
    color: "#2196F3",
    tab: "구인구직",
    detailScreen: "구인구직 상세",
    paramKey: "job",
    notifType: "item_rejected",
  },
  {
    key: "neighbor",
    label: "이웃사업",
    collection: "NeighborBusinesses",
    color: "#7C3AED",
    tab: "이웃사업",
    detailScreen: "이웃사업 상세",
    paramKey: "id", // NeighborBusinessDetail은 id 만 받음
    notifType: "business_rejected",
  },
];

function getItemTitle(item) {
  return item.title || item.name || "(제목 없음)";
}

function getItemSubLine(item, catKey) {
  if (catKey === "job") {
    return item.salary
      ? `${item.jobType || item.industry || ""} · ${item.salaryType || ""} ${item.salary}`
      : item.jobType || item.industry || "";
  }
  if (catKey === "realestate") {
    return item.dealType === "임대"
      ? `임대 · 보증금 ${item.deposit || "-"} / 월 ${item.monthlyRent || "-"}`
      : `${item.dealType || "매매"} ${item.price || ""}`;
  }
  if (catKey === "danggn") {
    return item.priceText || (item.price ? String(item.price) : "");
  }
  if (catKey === "neighbor") {
    return item.category || "";
  }
  return "";
}

export default function AdminScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeCat, setActiveCat] = useState("danggn");

  const cat = CATEGORIES.find((c) => c.key === activeCat) || CATEGORIES[0];

  // ✅ 관리자 확인
  useEffect(() => {
    if (user && user.email) {
      const adminEmails = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];
      const admin = adminEmails.includes(user.email);
      setIsAdmin(admin);

      if (!admin) {
        Alert.alert("권한 없음", "관리자만 접근할 수 있습니다.");
        navigation.goBack();
      }
    }
  }, [user]);

  const loadItems = useCallback(async () => {
    try {
      const q = query(
        collection(db, cat.collection),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(data);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
      Alert.alert("오류", `${cat.label} 데이터를 불러올 수 없습니다.`);
      setItems([]);
    }
  }, [cat]);

  useEffect(() => {
    if (isAdmin) loadItems();
  }, [isAdmin, loadItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  // ✅ 물품 삭제 + 등록자에게 알림
  const handleDeleteItem = (item) => {
    const title = getItemTitle(item);
    Alert.alert(
      `${cat.label} 삭제`,
      `"${title}"\n\n이 항목을 삭제하시겠습니까?\n등록자에게 거부 알림이 전송됩니다.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, cat.collection, item.id));

              if (item.userId) {
                await addDoc(collection(db, "notifications"), {
                  userId: item.userId,
                  type: cat.notifType,
                  itemTitle: title,
                  itemImage: item.images?.[0] || "",
                  message: `귀하의 등록 "${title}"은 당사의 규정에 의해 등록이 거부되었습니다.`,
                  read: false,
                  createdAt: serverTimestamp(),
                });
              }

              Alert.alert("완료", "삭제되었습니다.");
              loadItems();
            } catch (error) {
              console.error("삭제 실패:", error);
              Alert.alert("오류", `삭제에 실패했습니다.\n\n${error.message}`);
            }
          },
        },
      ]
    );
  };

  const handleViewDetail = (item) => {
    // createdAt 직렬화
    const serializableItem = {
      ...item,
      createdAt:
        item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
    };

    // 탭별로 param 키가 다름
    const params =
      cat.paramKey === "id"
        ? { id: item.id }
        : { [cat.paramKey]: serializableItem };

    navigation.navigate(cat.tab, {
      screen: cat.detailScreen,
      params,
    });
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
            {getItemTitle(item)}
          </Text>
          <Text style={[styles.itemPrice, { color: cat.color }]} numberOfLines={1}>
            {getItemSubLine(item, cat.key)}
          </Text>
          <Text style={styles.itemLocation} numberOfLines={1}>
            {(item.city || "") + (item.district ? ` · ${item.district}` : "")}
          </Text>
          <Text style={styles.itemUser} numberOfLines={1}>
            👤 {item.userEmail || "이메일 없음"}
          </Text>
          {item.createdAt && (
            <Text style={styles.itemDate}>
              📅{" "}
              {item.createdAt.toDate
                ? item.createdAt.toDate().toLocaleDateString("ko-KR")
                : new Date(item.createdAt).toLocaleDateString("ko-KR")}
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
      {/* 컴팩트 헤더 — 이메일만 1줄 */}
      <View style={styles.compactHeader}>
        <Ionicons name="shield-checkmark" size={18} color="#dc3545" />
        <Text style={styles.compactHeaderText} numberOfLines={1}>
          {user?.email}
        </Text>
      </View>

      {/* 카테고리 세그먼트 — 가로 4분할 */}
      <View style={styles.segmentRow}>
        {CATEGORIES.map((c) => {
          const active = c.key === activeCat;
          return (
            <TouchableOpacity
              key={c.key}
              style={[
                styles.segmentBtn,
                active && {
                  backgroundColor: c.color,
                  borderColor: c.color,
                },
              ]}
              onPress={() => setActiveCat(c.key)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentText,
                  active && styles.segmentTextActive,
                ]}
                numberOfLines={1}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 카운트 줄 — 한 줄, 컴팩트 */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>
          <Text style={{ fontWeight: "700", color: cat.color }}>
            {items.length}
          </Text>
          개 · 항목 클릭 시 상세 이동, 우측 삭제 가능
        </Text>
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
            colors={[cat.color]}
            tintColor={cat.color}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>등록된 항목이 없습니다</Text>
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
  // ── 컴팩트 헤더 (기존 큰 헤더 대체) ──
  compactHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  compactHeaderText: {
    marginLeft: 6,
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  // ── 4분할 세그먼트 ──
  segmentRow: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#fff",
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
  },
  segmentTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  // ── 카운트 줄 ──
  countRow: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  countText: {
    fontSize: 12,
    color: "#777",
  },
  // ── 리스트 ──
  listContent: {
    paddingBottom: 20,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginTop: 10,
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
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  itemLocation: {
    fontSize: 12,
    color: "#999",
    marginBottom: 2,
  },
  itemUser: {
    fontSize: 11,
    color: "#999",
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
});
