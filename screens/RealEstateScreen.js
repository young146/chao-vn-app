import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
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
import AdBanner, { InlineAdBanner, DetailAdBanner } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { formatRentPrice, formatSalePrice as formatSalePriceUtil } from "../utils/priceFormatter";
import { translateCity } from "../utils/vietnamLocations";
import { translatePropertyType, translateDealType } from "../utils/optionTranslations";

// 검색바 컴포넌트
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

// 부동산 카드 컴포넌트
const RealEstateCard = memo(({ item, onPress, index, t, language }) => {
  const status = item.status || t('available');
  const originalImage = item.images?.[0] || item.imageUrls?.[0];

  const getStatusColor = (status) => {
    switch (status) {
      case "거래가능":
      case t('available'):
        return "#4CAF50";
      case "예약중":
      case t('reserved'):
        return "#FF9800";
      case "거래완료":
      case t('completed'):
        return "#9E9E9E";
      default:
        return "#4CAF50";
    }
  };

  const getTypeBadge = (type) => {
    const isRent = type === "임대" || type === t('rent');
    return isRent
      ? { bg: "#E3F2FD", color: "#1976D2", text: t('rent') }
      : { bg: "#FFF3E0", color: "#E65100", text: t('sale') };
  };

  const badge = getTypeBadge(item.dealType);

  // 가격 표시: 텍스트 그대로, 숫자면 코마 포맷
  const displayPrice = (value) => {
    if (!value) return '-';
    if (!isNaN(Number(value)) && String(value).trim() !== '') {
      return Number(value).toLocaleString() + ' ₫';
    }
    return String(value);
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
        <TranslatedText style={styles.cardTitle} numberOfLines={2}>{item.title}</TranslatedText>

        {/* 가격 */}
        <View style={styles.priceRow}>
          <Ionicons name="pricetag" size={14} color="#E91E63" />
          <Text style={styles.priceText}>
            {item.dealType === "임대"
              ? `${displayPrice(item.deposit)} / ${displayPrice(item.monthlyRent)}월`
              : displayPrice(item.price)
            }
          </Text>
        </View>

        {/* 위치 */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <TranslatedText style={styles.locationText} numberOfLines={1}>
            {item.city}{item.district ? ` · ${item.district}` : ''}
          </TranslatedText>
        </View>

        {/* 면적/방 정보 */}
        {(item.area || item.rooms) && (
          <View style={styles.detailRow}>
            {item.area && (
              <>
                <Ionicons name="resize-outline" size={14} color="#666" />
                <TranslatedText style={styles.detailText}>{item.area}㎡</TranslatedText>
              </>
            )}
            {item.rooms && (
              <>
                <Ionicons name="bed-outline" size={14} color="#666" style={{ marginLeft: 8 }} />
                <TranslatedText style={styles.detailText}>{item.rooms}</TranslatedText>
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
  const { t, i18n } = useTranslation('realEstate');
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

  // 거래 유형 (데이터 저장용은 한국어, 표시용은 번역)
  const dealTypes = ["전체", "임대", "매매"];
  const dealTypeLabels = [t('common:all'), t('rent'), t('sale')];

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

  // 화면 포커스될 때 자동 재로드 (수정 후 목록 자동 갱신)
  useFocusEffect(
    useCallback(() => {
      fetchItems(true);
    }, [])
  );

  // 재시도 없이 한 번만 실행 (이제 useFocusEffect로 대체됨)

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
        t('common:loginRequired') + " 🔒",
        t('loginMessage'),
        [
          { text: t('common:later'), style: "cancel" },
          { text: t('common:login'), onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      navigation.navigate("부동산 등록");
    }
  }, [user, navigation, t]);

  const handleItemPress = useCallback((item) => {
    navigation.navigate("부동산 상세", { item });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <View>
      <RealEstateCard
        item={item}
        onPress={handleItemPress}
        index={index}
        t={t}
        language={i18n.language}
      />
      {/* 2개마다 광고 삽입 */}
      {(index + 1) % 2 === 0 && (
        <InlineAdBanner screen="realestate" />
      )}
    </View>
  ), [handleItemPress, t, i18n.language]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#E91E63" />
      </View>
    );
  }, [loadingMore]);

  // 리스트 헤더 (FlatList 안) — 광고/로그인배너/필터만
  const renderListHeader = () => (
    <View>
      {/* 광고 배너 */}
      <AdBanner screen="realestate" style={{ marginTop: 8 }} />

      {/* 로그인 유도 배너 */}
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#E91E63" />
          <Text style={styles.loginBannerText}>{t('loginMessage').split('\n')[0]}</Text>
          <Ionicons name="chevron-forward" size={20} color="#E91E63" />
        </TouchableOpacity>
      )}

      {/* 필터 */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={setSelectedCity}
              style={styles.picker}
            >
              {cities.map((city) => (
                <Picker.Item key={city} label={city === "전체" ? `📍 ${t('allCities')}` : translateCity(city, i18n.language)} value={city} />
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
                <Picker.Item key={type} label={type === "전체" ? `🏠 ${t('allTypes')}` : translatePropertyType(type, i18n.language)} value={type} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ─── FlatList 바깥 고정 영역: 서브탭 ─── */}
      <View style={styles.dealTypeTabContainer}>
        {dealTypes.map((type, index) => (
          <Pressable
            key={type}
            style={({ pressed }) => [
              styles.dealTypeTab,
              selectedDealType === type && styles.dealTypeTabActive,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => setSelectedDealType(type)}
            hitSlop={8}
          >
            <Text style={[
              styles.dealTypeTabText,
              selectedDealType === type && styles.dealTypeTabTextActive
            ]}>
              {dealTypeLabels[index]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
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
              <Text style={styles.emptyText}>{t('noProperties')}</Text>
              <Text style={styles.emptySubText}>{t('beFirst')}</Text>
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
    height: Platform.OS === "ios" ? 120 : undefined,
  },
  picker: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 0 : 8,
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
    bottom: 105,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E91E63",
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
