import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
import { db } from "../firebase/config";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  getDoc,
  doc,
} from "firebase/firestore";
import AdBanner from "../components/AdBanner";

// 검색바 컴포넌트
const SearchBar = memo(({ value, onChangeText }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
    <TextInput
      style={styles.searchInput}
      placeholder="원하는 부동산을 검색하세요"
      placeholderTextColor="rgba(0, 0, 0, 0.38)"
      value={value}
      onChangeText={onChangeText}
    />
  </View>
));

// 부동산 카드 컴포넌트
const RealEstateCard = memo(({ item, onPress, index }) => {
  const status = item.status || "거래가능";
  const originalImage = item.images?.[0];

  const getStatusColor = (status) => {
    switch (status) {
      case "거래가능":
        return "#4CAF50";
      case "예약중":
        return "#FF9800";
      case "거래완료":
        return "#9E9E9E";
      default:
        return "#4CAF50";
    }
  };

  const getTypeBadge = (type) => {
    return type === "임대"
      ? { bg: "#E3F2FD", color: "#1976D2", text: "임대" }
      : { bg: "#FFF3E0", color: "#E65100", text: "매매" };
  };

  const badge = getTypeBadge(item.dealType);

  // 임대용: 만동 단위로 입력된 가격 포맷
  const formatPrice = (price, unit) => {
    if (!price) return "가격 협의";
    const num = parseInt(price);
    if (num >= 10000) {
      return `${(num / 10000).toFixed(1)}억 ${unit || ''}`.trim();
    }
    return `${num.toLocaleString()}만 ${unit || ''}`.trim();
  };

  // 매매용: 억동 단위로 입력된 가격 포맷
  const formatSalePrice = (price) => {
    if (!price) return "가격 협의";
    const num = parseFloat(price);
    return `💰 ${num}억`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(item)}>
      {/* 이미지 영역 */}
      <View style={styles.imageContainer}>
        {originalImage ? (
          <Image
            source={{ uri: originalImage }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            priority={index < 4 ? "high" : "normal"}
          />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="home-outline" size={40} color="#ccc" />
          </View>
        )}
        {/* 상태 배지 */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {/* 정보 영역 */}
      <View style={styles.cardInfo}>
        {/* 임대/매매 + 유형 태그 */}
        <View style={styles.tagRow}>
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.typeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
          {item.propertyType && (
            <View style={styles.propertyTypeBadge}>
              <Text style={styles.propertyTypeText}>{item.propertyType}</Text>
            </View>
          )}
        </View>

        {/* 제목 */}
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        {/* 가격 */}
        <View style={styles.priceRow}>
          <Ionicons name="pricetag" size={14} color="#E91E63" />
          <Text style={styles.priceText}>
            {item.dealType === "임대" 
              ? `${formatPrice(item.deposit, '')} / ${formatPrice(item.monthlyRent, '월')}`
              : formatSalePrice(item.price)
            }
          </Text>
        </View>

        {/* 위치 */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.city}{item.district ? ` · ${item.district}` : ''}
          </Text>
        </View>

        {/* 면적/방 정보 */}
        {(item.area || item.rooms) && (
          <View style={styles.detailRow}>
            {item.area && (
              <>
                <Ionicons name="resize-outline" size={14} color="#666" />
                <Text style={styles.detailText}>{item.area}㎡</Text>
              </>
            )}
            {item.rooms && (
              <>
                <Ionicons name="bed-outline" size={14} color="#666" style={{ marginLeft: 8 }} />
                <Text style={styles.detailText}>{item.rooms}</Text>
              </>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function RealEstateScreen({ navigation }) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedDealType, setSelectedDealType] = useState("전체");
  const [selectedPropertyType, setSelectedPropertyType] = useState("전체");
  const [selectedCity, setSelectedCity] = useState("전체");
  const [refreshing, setRefreshing] = useState(false);

  // 페이지네이션 관련 state
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  // 거래 유형
  const dealTypes = ["전체", "임대", "매매"];

  // 매물 유형
  const propertyTypes = [
    "전체",
    "아파트",
    "빌라/연립",
    "오피스텔",
    "사무실",
    "상가/점포",
    "공장/창고",
    "토지",
    "기타",
  ];

  // 도시 목록
  const cities = ["전체", "호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "기타"];

  // 데이터 페칭
  const fetchItems = async (isFirstFetch = true) => {
    if (!isFirstFetch && (loadingMore || !hasMore)) return;

    if (isFirstFetch) {
      // 캐시된 데이터 먼저 표시
      if (items.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem("cached_realestate");
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setItems(parsedData);
            console.log("⚡ [Cache] 부동산 캐시 데이터 표시");
          }
        } catch (e) {
          console.error("캐시 로드 실패:", e);
        }
      }

      setRefreshing(true);
      setLastVisible(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(
        collection(db, "RealEstate"),
        limit(isFirstFetch ? 60 : ITEMS_PER_PAGE)
      );

      if (!isFirstFetch && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      }));

      // 최신순 정렬
      fetchedItems.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (isFirstFetch) {
        const uniqueItems = Array.from(new Map(fetchedItems.map(item => [item.id, item])).values());
        setItems(uniqueItems);
        await AsyncStorage.setItem("cached_realestate", JSON.stringify(uniqueItems));
      } else {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const uniqueNewItems = fetchedItems.filter((i) => !existingIds.has(i.id));
          return [...prev, ...uniqueNewItems];
        });
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length >= (isFirstFetch ? 60 : ITEMS_PER_PAGE));
    } catch (error) {
      console.error("❌ 부동산 데이터 페칭 실패:", error);
      // 권한 오류 등의 경우 더 이상 시도하지 않음
      setHasMore(false);
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // 한 번만 실행
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchItems(true);
    }
    return () => { isMounted = false; };
  }, []);

  const onRefresh = () => {
    fetchItems(true);
  };

  const loadMore = () => {
    fetchItems(false);
  };

  // 필터링
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = !searchText || 
        item.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText.toLowerCase());
      const matchesDealType = selectedDealType === "전체" || item.dealType === selectedDealType;
      const matchesPropertyType = selectedPropertyType === "전체" || item.propertyType === selectedPropertyType;
      const matchesCity = selectedCity === "전체" || item.city === selectedCity;

      return matchesSearch && matchesDealType && matchesPropertyType && matchesCity;
    }).sort((a, b) => {
      // 거래완료는 맨 아래로
      if (a.status === "거래완료" && b.status !== "거래완료") return 1;
      if (a.status !== "거래완료" && b.status === "거래완료") return -1;
      return 0;
    });
  }, [items, searchText, selectedDealType, selectedPropertyType, selectedCity]);

  const handleAddItem = useCallback(() => {
    if (!user) {
      Alert.alert(
        "로그인 필요 🔒",
        "부동산 매물을 등록하려면 로그인이 필요합니다.\n지금 로그인하시겠어요?",
        [
          { text: "나중에", style: "cancel" },
          { text: "로그인", onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      navigation.navigate("부동산등록");
    }
  }, [user, navigation]);

  const handleItemPress = useCallback((item) => {
    navigation.navigate("부동산상세", { item });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <RealEstateCard
      item={item}
      onPress={handleItemPress}
      index={index}
    />
  ), [handleItemPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#E91E63" />
      </View>
    );
  }, [loadingMore]);

  // 임대/매매 탭 버튼
  const DealTypeTab = useMemo(() => (
    <View style={styles.dealTypeTabContainer}>
      {dealTypes.map((type) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.dealTypeTab,
            selectedDealType === type && styles.dealTypeTabActive
          ]}
          onPress={() => setSelectedDealType(type)}
        >
          <Text style={[
            styles.dealTypeTabText,
            selectedDealType === type && styles.dealTypeTabTextActive
          ]}>
            {type}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [selectedDealType]);

  // 필터 영역
  const FilterSection = useMemo(() => (
    <View style={styles.filterSection}>
      <View style={styles.filterRow}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={setSelectedCity}
            style={styles.picker}
          >
            {cities.map((city) => (
              <Picker.Item key={city} label={city === "전체" ? "📍 전체 지역" : city} value={city} color="#333" />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedPropertyType}
            onValueChange={setSelectedPropertyType}
            style={styles.picker}
          >
            {propertyTypes.map((type) => (
              <Picker.Item key={type} label={type === "전체" ? "🏠 전체 유형" : type} value={type} color="#333" />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  ), [selectedCity, selectedPropertyType]);

  // 리스트 헤더
  const ListHeader = useMemo(() => (
    <View>
      {/* 광고 배너 */}
      <AdBanner position="realestate_header" style={{ marginHorizontal: 12, marginTop: 8, borderRadius: 8 }} />
      
      {/* 로그인 유도 배너 */}
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#E91E63" />
          <Text style={styles.loginBannerText}>로그인하고 매물을 등록하세요!</Text>
          <Ionicons name="chevron-forward" size={20} color="#E91E63" />
        </TouchableOpacity>
      )}

      {/* 검색바 */}
      <SearchBar value={searchText} onChangeText={setSearchText} />

      {/* 임대/매매 탭 */}
      {DealTypeTab}

      {/* 필터 */}
      {FilterSection}
    </View>
  ), [user, searchText, DealTypeTab, FilterSection, navigation]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#E91E63"]} tintColor="#E91E63" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="home-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>등록된 부동산 매물이 없습니다</Text>
              <Text style={styles.emptySubText}>첫 번째로 등록해보세요!</Text>
            </View>
          )
        }
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      
      {/* 플로팅 등록 버튼 */}
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddItem}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loginBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE4EC",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  loginBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#C2185B",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  dealTypeTabContainer: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 4,
  },
  dealTypeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  dealTypeTabActive: {
    backgroundColor: "#E91E63",
  },
  dealTypeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  dealTypeTabTextActive: {
    color: "#fff",
  },
  filterSection: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickerContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  picker: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
  },
  listContainer: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  imageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#f0f0f0",
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  cardInfo: {
    padding: 12,
  },
  tagRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  propertyTypeBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  propertyTypeText: {
    fontSize: 11,
    color: "#666",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    lineHeight: 22,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#E91E63",
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 12,
    color: "#888",
    marginLeft: 4,
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
  emptySubText: {
    marginTop: 4,
    fontSize: 14,
    color: "#bbb",
  },
  loaderFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  floatingButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E91E63",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
