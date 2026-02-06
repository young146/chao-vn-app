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
import { useTranslation } from "react-i18next";
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
import {
  getDistrictsByCity,
  getApartmentsByDistrict,
} from "../utils/vietnamLocations";
import AdBanner, { InlineAdBanner, DetailAdBanner } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { formatPrice } from "../utils/priceFormatter";
import { translateCity, translateOther } from "../utils/vietnamLocations";

// 검색바 컴포넌트 분리 (입력 시 전체 헤더 재렌더링 방지)
const SearchBar = memo(({ value, onChangeText, placeholder }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
    <TextInput
      style={styles.searchInput}
      placeholder={placeholder}
      placeholderTextColor="rgba(0, 0, 0, 0.38)"
      value={value}
      onChangeText={onChangeText}
    />
  </View>
));

// 별도 컴포넌트로 분리하여 메모이제이션 적용
const ItemCard = memo(({ item, onPress, formatPrice, getStatusColor, index }) => {
  const { t } = useTranslation('danggn');
  const status = item.status || "판매중";
  const originalImage = item.images?.[0] || item.imageUri;

  // 상태 번역
  const getTranslatedStatus = (s) => {
    switch(s) {
      case "판매중": return t('selling');
      case "가격 조정됨": return t('priceChanged');
      case "판매완료": return t('sold');
      default: return s;
    }
  };

  // const getThumbnail = (url) => { ... } // 일단 비활성화
  const imageSource = originalImage; // 안전한 원본 이미지 사용 (사진 안 나오는 문제 해결)

  return (
    <TouchableOpacity style={styles.itemCard} onPress={() => onPress(item)}>
      <View style={styles.imagePlaceholder}>
        {imageSource ? (
          <Image
            source={{ uri: imageSource }}
            style={styles.itemImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            priority={index < 4 ? "high" : "normal"}
          />
        ) : (
          <Ionicons name="image-outline" size={40} color="#ccc" />
        )}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{getTranslatedStatus(status)}</Text>
        </View>
      </View>
      <View style={styles.itemInfo}>
        <TranslatedText style={styles.itemTitle} numberOfLines={1}>{item.title}</TranslatedText>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <TranslatedText style={styles.itemLocation} numberOfLines={2}>
            {item.city} · {item.district}
            {item.apartment && item.apartment !== "기타" ? `\n${item.apartment}` : ''}
          </TranslatedText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function XinChaoDanggnScreen({ navigation }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('danggn');
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  
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

  // 카테고리 키 목록 (데이터 저장용 - 한국어로 저장)
  const categoryKeys = [
    { key: 'all', value: '전체' },
    { key: 'free', value: '무료나눔' },
    { key: 'hiring', value: '구인' },
    { key: 'seeking', value: '구직' },
    { key: 'rentProperty', value: '부동산 임대' },
    { key: 'sellProperty', value: '부동산 판매' },
    { key: 'electronics', value: '전자제품' },
    { key: 'furniture', value: '가구/인테리어' },
    { key: 'clothing', value: '의류/잡화' },
    { key: 'household', value: '생활용품' },
    { key: 'books', value: '도서/문구' },
    { key: 'baby', value: '유아용품' },
    { key: 'pet', value: '펫 용품' },
    { key: 'other', value: '기타' },
  ];
  
  // 번역된 카테고리 배열 (UI 표시용)
  const categories = categoryKeys.map(cat => ({
    label: t(`categories.${cat.key}`),
    value: cat.value
  }));

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
      // 1. 먼저 프리페치된 데이터가 있는지 확인하여 즉시 표시 (0초 로딩 체감)
      if (items.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem("prefetched_danggn_items");
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setItems(parsedData);
            console.log("⚡ [Cache] 프리페치된 데이터를 즉시 표시합니다.");
            // 이미 데이터가 있으므로 새로고침 로더를 일단 띄우지 않거나 짧게 유지
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
      // 인덱스 에러 방지를 위해 orderBy를 제거하고 조건문만 사용하여 쿼리
      let q = query(
        collection(db, "XinChaoDanggn"),
        limit(isFirstFetch ? 60 : ITEMS_PER_PAGE) // 충분한 양을 가져와서 앱에서 정렬
      );

      if (!isFirstFetch && lastVisible) {
        // 커서 기반 페이지네이션을 사용하기 위해 기본 쿼리에 orderBy를 다시 넣어야 할 수 있으나,
        // 인덱스 에러 방지를 위해 일단 모든 데이터를 가져오거나 limit을 늘립니다.
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      
      const fetchedItems = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // 직렬화 가능한 형태로 변환
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      }));

      // 클라이언트 사이드 정렬 (인덱스 없이도 날짜순으로 정렬되도록 함)
      fetchedItems.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (isFirstFetch) {
        // 중복 방지를 위해 Map 사용
        const uniqueItems = Array.from(new Map(fetchedItems.map(item => [item.id, item])).values());
        setItems(uniqueItems);
        // 최신 데이터를 다시 캐시에 저장
        await AsyncStorage.setItem("prefetched_danggn_items", JSON.stringify(uniqueItems));
        
        // 데이터가 없는데 필터링 중이 아닐 때만 "등록된 물품이 없습니다" 표시를 위해 상태 관리
        if (uniqueItems.length === 0) {
          console.log("ℹ️ 데이터가 하나도 없습니다.");
        }
      } else {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const uniqueNewItems = fetchedItems.filter((i) => !existingIds.has(i.id));
          return [...prev, ...uniqueNewItems];
        });
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      // limit을 60으로 늘렸으므로, ITEMS_PER_PAGE 대신 실제 가져온 개수로 비교
      setHasMore(snapshot.docs.length >= (isFirstFetch ? 60 : ITEMS_PER_PAGE));
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
      // ✅ 판매완료된 물품은 리스트에서 제외
      if (item.status === "판매완료") return false;

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

  // 아이템을 2개씩 묶어서 행(row) 단위로 변환 + 광고 삽입
  const rowsWithAds = useMemo(() => {
    const result = [];
    const AD_ROW_INTERVAL = 2; // 2행(4개 아이템)마다 광고
    let rowCount = 0;
    
    for (let i = 0; i < filteredItems.length; i += 2) {
      // 2개씩 묶어서 행 생성
      const row = {
        type: 'row',
        items: filteredItems.slice(i, i + 2),
        key: `row-${i}`,
      };
      result.push(row);
      rowCount++;
      
      // 2행(4개 아이템)마다 광고 삽입
      if (rowCount % AD_ROW_INTERVAL === 0 && i + 2 < filteredItems.length) {
        result.push({ type: 'ad', key: `ad-${rowCount}` });
      }
    }
    
    return result;
  }, [filteredItems]);

  const formatPriceLocal = useCallback((price) => {
    return formatPrice(price, i18n.language);
  }, [i18n.language]);

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
        t('common:loginRequired') + " 🔒",
        t('loginMessage'),
        [
          { text: t('common:later'), style: "cancel" },
          { text: t('common:login'), onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      navigation.navigate("물품 등록");
    }
  }, [user, navigation, t]);

  const handleProfilePrompt = useCallback(() => {
    Alert.alert(
      t('profilePromptTitle') + " 📝",
      t('profilePromptMessage'),
      [
        { text: t('common:later'), style: "cancel", onPress: () => setShowProfilePrompt(false) },
        {
          text: t('writeProfile'),
          onPress: () => {
            setShowProfilePrompt(false);
            navigation.navigate("Menu", { screen: "프로필" });
          },
        },
      ]
    );
  }, [navigation, t]);

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

  // 행(row) 또는 광고(ad) 렌더링
  const renderRowOrAd = useCallback(({ item }) => {
    if (item.type === 'ad') {
      // 인라인 광고 (전체 너비)
      return <InlineAdBanner screen="danggn" style={{ marginVertical: 8 }} />;
    }
    
    // 아이템 행 (2개씩)
    return (
      <View style={styles.itemRow}>
        {item.items.map((rowItem, idx) => (
          <ItemCard
            key={rowItem.id}
            item={rowItem}
            onPress={handleItemPress}
            formatPrice={formatPriceLocal}
            getStatusColor={getStatusColor}
            index={idx}
          />
        ))}
        {/* 홀수 개일 때 빈 공간 채우기 */}
        {item.items.length === 1 && <View style={styles.emptyCard} />}
      </View>
    );
  }, [handleItemPress, formatPriceLocal, getStatusColor]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#FF6B35" />
      </View>
    );
  }, [loadingMore]);

  // 헤더 구성 요소들을 각각 memoize 하여 불필요한 재렌더링 방지
  const headerBanners = useMemo(() => (
    <>
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#FF6B35" />
          <Text style={styles.loginBannerText}>{t('loginBanner')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
        </TouchableOpacity>
      )}
      {showProfilePrompt && (
        <TouchableOpacity style={styles.profilePromptBanner} onPress={handleProfilePrompt}>
          <Ionicons name="notifications" size={20} color="#2196F3" />
          <Text style={styles.profilePromptText}>{t('profilePrompt')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#2196F3" />
        </TouchableOpacity>
      )}
    </>
  ), [user, showProfilePrompt, navigation, handleProfilePrompt, t]);

  const headerFilters = useMemo(() => (
    <View style={styles.filterSection}>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedCity}
          onValueChange={(v) => { setSelectedCity(v); setSelectedDistrict("전체"); setSelectedApartment("전체"); }}
          style={styles.picker}
          dropdownIconColor="#333"
        >
          <Picker.Item label={t('allCities')} value="전체" />
          <Picker.Item label={translateCity("호치민", i18n.language)} value="호치민" />
          <Picker.Item label={translateCity("하노이", i18n.language)} value="하노이" />
          <Picker.Item label={translateCity("다낭", i18n.language)} value="다낭" />
          <Picker.Item label={translateCity("냐짱", i18n.language)} value="냐짱" />
        </Picker>
      </View>
      {selectedCity !== "전체" && (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedDistrict}
            onValueChange={(v) => { setSelectedDistrict(v); setSelectedApartment("전체"); }}
            style={styles.picker}
            dropdownIconColor="#333"
          >
            <Picker.Item label={t('allDistricts')} value="전체" />
            {districts.map((d) => <Picker.Item key={d} label={translateOther(d, i18n.language)} value={d} />)}
          </Picker>
        </View>
      )}
      {selectedDistrict !== "전체" && apartments.length > 0 && (
        <View style={styles.pickerContainer}>
          <Picker selectedValue={selectedApartment} onValueChange={setSelectedApartment} style={styles.picker} dropdownIconColor="#333">
            <Picker.Item label={t('allApartments')} value="전체" />
            {apartments.map((a) => <Picker.Item key={a} label={translateOther(a, i18n.language)} value={a} />)}
          </Picker>
        </View>
      )}
    </View>
  ), [selectedCity, selectedDistrict, selectedApartment, districts, apartments, t, i18n.language, colors.text]);

  const headerCategories = useMemo(() => (
    <View style={styles.categoriesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.categoryButton, selectedCategory === cat.value && styles.categoryButtonActive]}
            onPress={() => setSelectedCategory(cat.value)}
          >
            <Text style={[styles.categoryText, selectedCategory === cat.value && styles.categoryTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ), [selectedCategory, categories]);

  const listHeader = useMemo(() => (
    <View>
      {/* 🔥 메인 헤더 광고 */}
      <AdBanner screen="danggn" style={{ marginTop: 8 }} />
      {headerBanners}
      <SearchBar value={searchText} onChangeText={setSearchText} placeholder={t('searchPlaceholder')} />
      {headerFilters}
      {headerCategories}
    </View>
  ), [headerBanners, searchText, headerFilters, headerCategories]);

  return (
    <View style={styles.container}>
      <FlatList
        data={rowsWithAds}
        renderItem={renderRowOrAd}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={listHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#FF6B35"]} tintColor="#FF6B35" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>{t('noItems')}</Text>
            </View>
          )
        }
        // 성능 최적화 옵션들
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddItem}>
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.floatingButtonText}>{t('common:register')}</Text>
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
    color: "#000", // ✅ 다크모드 대응: 텍스트 색상 명시
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
  // 아이템 행 (2개씩 가로 배치)
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
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
  // 홀수 개일 때 빈 공간
  emptyCard: {
    flex: 1,
    margin: 4,
    maxWidth: "48%",
  },
  imagePlaceholder: {
    width: "100%",
    height: 210,
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
    alignItems: "flex-start",
    marginTop: 4,
  },
  itemLocation: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
    marginLeft: 4,
    lineHeight: 18,
    flex: 1,
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  floatingButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
