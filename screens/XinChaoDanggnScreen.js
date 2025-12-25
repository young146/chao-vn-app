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
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../contexts/AuthContext";
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
import {
  getDistrictsByCity,
  getApartmentsByDistrict,
} from "../utils/vietnamLocations";

// 별도 컴포넌트로 분리하여 메모이제이션 적용
const ItemCard = memo(({ item, onPress, formatPrice, getStatusColor, index }) => {
  const status = item.status || "판매중";
  const originalImage = item.images?.[0] || item.imageUri;

  // 🔥 Firebase Resize Images 확장 프로그램 규칙에 따른 썸네일 URL 생성
  // 200x200 설정 기준: 원본파일명_200x200.확장자
  const getThumbnail = (url) => {
    if (!url || !url.includes("firebasestorage")) return url;
    
    try {
      // URL에서 경로 부분만 추출 (쿼리 파라미터 제외)
      const baseUrl = url.split("?")[0];
      const params = url.split("?")[1] || "alt=media";
      
      // 파일 경로와 확장자 분리
      const lastDotIndex = baseUrl.lastIndexOf(".");
      if (lastDotIndex === -1) return url;
      
      const pathWithoutExt = baseUrl.substring(0, lastDotIndex);
      const extension = baseUrl.substring(lastDotIndex);
      
      // 썸네일 경로 조합 (_200x200 접미사 추가)
      return `${pathWithoutExt}_200x200${extension}?${params}`;
    } catch (e) {
      return url;
    }
  };

  const imageSource = getThumbnail(originalImage);

  return (
    <TouchableOpacity style={styles.itemCard} onPress={() => onPress(item)}>
      <View style={styles.imagePlaceholder}>
        {imageSource ? (
          <Image
            source={{ uri: imageSource }}
            style={styles.itemImage}
            contentFit="cover"
            transition={index < 10 ? 0 : 150}
            cachePolicy="disk"
            priority={index < 10 ? "high" : "low"}
            recyclingKey={item.id}
          />
        ) : (
          <Ionicons name="image-outline" size={40} color="#ccc" />
        )}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={12} color="#999" />
          <Text style={styles.itemLocation} numberOfLines={1}>{item.city} · {item.district}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function XinChaoDanggnScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedCity, setSelectedCity] = useState("전체");
  const [selectedDistrict, setSelectedDistrict] = useState("전체");
  const [selectedApartment, setSelectedApartment] = useState("전체");
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  // 페이지네이션 관련 state
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 10;

  const categories = [
    "전체",
    "무료나눔",
    "구인",
    "구직",
    "부동산 임대",
    "부동산 판매",
    "전자제품",
    "가구/인테리어",
    "의류/잡화",
    "생활용품",
    "도서/티켓",
    "유아용품",
    "펫용품",
    "기타",
  ];

  // 사용자 프로필 로드 (비차단 방식으로 수정)
  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then(userDoc => {
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      }).catch(error => {
        console.error("❌ 프로필 로드 실패:", error);
      });
    }
  }, [user]);

  // 지역 필터 사용 시 프로필 미작성 확인
  useEffect(() => {
    if (user && userProfile && selectedCity !== "전체") {
      const isProfileIncomplete = !userProfile.city || !userProfile.district;
      setShowProfilePrompt(isProfileIncomplete);
    } else {
      setShowProfilePrompt(false);
    }
  }, [user, userProfile, selectedCity]);

  // 데이터 페칭 함수
  const fetchItems = async (isFirstFetch = true) => {
    if (!isFirstFetch && (loadingMore || !hasMore)) return;

    if (isFirstFetch) {
      setRefreshing(true);
      setLastVisible(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(
        collection(db, "XinChaoDanggn"),
        orderBy("createdAt", "desc"),
        limit(ITEMS_PER_PAGE)
      );

      if (!isFirstFetch && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      
      const newItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (isFirstFetch) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error("❌ 데이터 페칭 실패:", error);
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchItems(true);
  }, [user]);

  const onRefresh = () => {
    fetchItems(true);
  };

  const loadMore = () => {
    fetchItems(false);
  };

  // 필터링 로직에 useMemo 적용 (성능 최적화)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = !searchText || item.title
        ?.toLowerCase()
        .includes(searchText.toLowerCase());
      const matchesCategory =
        selectedCategory === "전체" || item.category === selectedCategory;
      const matchesCity = selectedCity === "전체" || item.city === selectedCity;
      const matchesDistrict =
        selectedDistrict === "전체" || item.district === selectedDistrict;
      const matchesApartment =
        selectedApartment === "전체" || item.apartment === selectedApartment;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesCity &&
        matchesDistrict &&
        matchesApartment
      );
    });
  }, [items, searchText, selectedCategory, selectedCity, selectedDistrict, selectedApartment]);

  const formatPrice = useCallback((price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  }, []);

  const getStatusColor = useCallback((status) => {
    switch (status) {
      case "판매중":
        return "#4CAF50";
      case "가격 조정됨":
        return "#FF9800";
      case "판매완료":
        return "#9E9E9E";
      default:
        return "#4CAF50";
    }
  }, []);

  const handleAddItem = useCallback(() => {
    if (!user) {
      Alert.alert(
        "로그인 필요 🔒",
        "상품을 등록하려면 로그인이 필요합니다.\n지금 로그인하시겠어요?",
        [
          { text: "나중에", style: "cancel" },
          { text: "로그인", onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      navigation.navigate("물품 등록");
    }
  }, [user, navigation]);

  const handleProfilePrompt = useCallback(() => {
    Alert.alert(
      "프로필 작성 📝",
      "주소를 등록하면 내 주변 새 상품이 등록될 때마다 자동으로 알림을 받을 수 있습니다.\n\n지금 프로필을 작성하시겠어요?",
      [
        { text: "나중에", style: "cancel", onPress: () => setShowProfilePrompt(false) },
        {
          text: "작성하기",
          onPress: () => {
            setShowProfilePrompt(false);
            navigation.navigate("Menu", { screen: "프로필" });
          },
        },
      ]
    );
  }, [navigation]);

  const districts = useMemo(() => 
    getDistrictsByCity(selectedCity === "전체" ? "호치민" : selectedCity),
    [selectedCity]
  );

  const apartments = useMemo(() => 
    selectedDistrict && selectedDistrict !== "전체"
      ? getApartmentsByDistrict(selectedCity === "전체" ? "호치민" : selectedCity, selectedDistrict)
      : [],
    [selectedCity, selectedDistrict]
  );

  const handleItemPress = useCallback((item) => {
    const serializableItem = {
      ...item,
      createdAt: item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
    };
    navigation.navigate("물품 상세", { item: serializableItem });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <ItemCard
      item={item}
      onPress={handleItemPress}
      formatPrice={formatPrice}
      getStatusColor={getStatusColor}
      index={index}
    />
  ), [handleItemPress, formatPrice, getStatusColor]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#FF6B35" />
      </View>
    );
  }, [loadingMore]);

  const renderHeader = useCallback(() => {
    return (
      <View>
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#FF6B35" />
          <Text style={styles.loginBannerText}>로그인하고 더 많은 상품을 확인하세요!</Text>
          <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
        </TouchableOpacity>
      )}
      {showProfilePrompt && (
        <TouchableOpacity style={styles.profilePromptBanner} onPress={handleProfilePrompt}>
          <Ionicons name="notifications" size={20} color="#2196F3" />
          <Text style={styles.profilePromptText}>프로필을 작성하시면 자동으로 귀하의 주변 새상품 등록을 확인할 수 있습니다</Text>
          <Ionicons name="chevron-forward" size={20} color="#2196F3" />
        </TouchableOpacity>
      )}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="물품 검색..."
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>
      <View style={styles.filterSection}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(v) => { setSelectedCity(v); setSelectedDistrict("전체"); setSelectedApartment("전체"); }}
            style={styles.picker}
          >
            <Picker.Item label="전체 도시" value="전체" />
            <Picker.Item label="호치민" value="호치민" />
            <Picker.Item label="하노이" value="하노이" />
            <Picker.Item label="다낭" value="다낭" />
            <Picker.Item label="냐짱" value="냐짱" />
          </Picker>
        </View>
        {selectedCity !== "전체" && (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedDistrict}
              onValueChange={(v) => { setSelectedDistrict(v); setSelectedApartment("전체"); }}
              style={styles.picker}
            >
              <Picker.Item label="전체 구/군" value="전체" />
              {districts.map((d) => <Picker.Item key={d} label={d} value={d} />)}
            </Picker>
          </View>
        )}
        {selectedDistrict !== "전체" && apartments.length > 0 && (
          <View style={styles.pickerContainer}>
            <Picker selectedValue={selectedApartment} onValueChange={setSelectedApartment} style={styles.picker}>
              <Picker.Item label="전체 아파트" value="전체" />
              {apartments.map((a) => <Picker.Item key={a} label={a} value={a} />)}
            </Picker>
          </View>
        )}
      </View>
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.categoryButton, selectedCategory === item && styles.categoryButtonActive]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
    );
  }, [user, navigation, showProfilePrompt, handleProfilePrompt, searchText, selectedCity, selectedDistrict, districts, apartments, selectedApartment, categories, selectedCategory]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#FF6B35"]} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        // 🔥 아이템 높이를 미리 알려주어 스크롤 성능을 획기적으로 개선
        getItemLayout={(data, index) => ({
          length: 220, // 아이템 카드 대략의 높이
          offset: 220 * Math.floor(index / 2),
          index,
        })}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>등록된 물품이 없습니다</Text>
            </View>
          )
        }
        // 성능 최적화 옵션들 (극한의 튜닝)
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={8} // 4줄 정도 미리 로드
        maxToRenderPerBatch={2} // 한 줄씩만 추가 (CPU 부하 분산)
        windowSize={5} // 메모리 점유 최소화
        updateCellsBatchingPeriod={100} 
        scrollEventThrottle={16}
        legacyImplementation={false}
      />
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
    backgroundColor: "#FFF8F3",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE0CC",
  },
  loginBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#FF6B35",
  },
  profilePromptBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#90CAF9",
  },
  profilePromptText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
    color: "#1976D2",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
  },
  filterSection: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  picker: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
  },
  categoriesContainer: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 4,
  },
  categoryButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
  },
  categoryButtonActive: {
    backgroundColor: "#FF6B35",
  },
  categoryText: {
    fontSize: 12,
    color: "#666",
  },
  categoryTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  listContainer: {
    padding: 8,
  },
  itemCard: {
    flex: 1,
    backgroundColor: "#fff",
    margin: 4,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    maxWidth: "48%",
  },
  imagePlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    elevation: 3,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  itemInfo: {
    padding: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemLocation: {
    fontSize: 11,
    color: "#999",
    marginLeft: 2,
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
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
