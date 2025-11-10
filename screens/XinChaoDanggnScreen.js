import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  Alert,
  RefreshControl,  // ✅ 추가!
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  VIETNAM_LOCATIONS,
  getDistrictsByCity,
  getApartmentsByDistrict,
} from "../utils/vietnamLocations";
import { useAuth } from "../contexts/AuthContext";

export default function XinChaoDanggnScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedCity, setSelectedCity] = useState("전체");
  const [selectedDistrict, setSelectedDistrict] = useState("전체");
  const [selectedApartment, setSelectedApartment] = useState("전체");
  const [refreshing, setRefreshing] = useState(false);  // ✅ 추가!
  const [refreshKey, setRefreshKey] = useState(0);  // ✅ 추가!
  const categories = [
    "전체",
    "가전/가구",
    "의류/잡화",
    "디지털",
    "생활용품",
    "도서/티켓",
    "기타",
  ];

  useEffect(() => {
    let q = query(
      collection(db, "XinChaoDanggn"),
      orderBy("createdAt", "desc")
    );

    // 로그인하지 않은 경우 최신 8개만
    if (!user) {
      q = query(q, limit(8));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemsData);
      setRefreshing(false);  // ✅ 데이터 로드 완료 시 refreshing 해제
    });

    return () => unsubscribe();
  }, [user, refreshing]);

    // ✅ 새로고침 함수
  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey(Date.now());  // 강제 리렌더링
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // 3단계 필터링
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  };

  const handleItemPress = (item) => {
    if (!user) {
      Alert.alert(
        "로그인 필요 🔒",
        "상품 상세 정보를 보려면 로그인이 필요합니다.\n지금 로그인하시겠어요?",
        [
          { text: "나중에", style: "cancel" },
          {
            text: "로그인",
            onPress: () => navigation.navigate("로그인"),
          },
        ]
      );
    } else {
      navigation.navigate("물품 상세", { item });
    }
  };

  const handleAddItem = () => {
    if (!user) {
      Alert.alert(
        "로그인 필요 🔒",
        "상품을 등록하려면 로그인이 필요합니다.\n지금 로그인하시겠어요?",
        [
          { text: "나중에", style: "cancel" },
          {
            text: "로그인",
            onPress: () => navigation.navigate("로그인"),
          },
        ]
      );
    } else {
      navigation.navigate("물품 등록");
    }
  };

  // AddItemScreen과 동일한 방식
  const districts = getDistrictsByCity(selectedCity === "전체" ? "호치민" : selectedCity);
  const apartments =
    selectedDistrict && selectedDistrict !== "전체"
      ? getApartmentsByDistrict(
          selectedCity === "전체" ? "호치민" : selectedCity,
          selectedDistrict
        )
      : [];

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.imagePlaceholder}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.itemImage} />
        ) : item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={styles.itemImage} />
        ) : (
          <Ionicons name="image-outline" size={40} color="#ccc" />
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location-outline" size={12} color="#999" />
          <Text style={styles.itemLocation} numberOfLines={1}>
            {item.city} · {item.district}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 로그인 안내 배너 */}
      {!user && (
        <TouchableOpacity
          style={styles.loginBanner}
          onPress={() => navigation.navigate("로그인")}
        >
          <Ionicons name="lock-closed" size={20} color="#FF6B35" />
          <Text style={styles.loginBannerText}>
            로그인하고 더 많은 상품을 확인하세요!
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
        </TouchableOpacity>
      )}

      {/* 검색바 */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#999"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="물품 검색..."
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      {/* 지역 필터 - AddItemScreen과 동일한 Picker 방식 */}
      <View style={styles.filterSection}>
        {/* 도시 */}
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(value) => {
              setSelectedCity(value);
              setSelectedDistrict("전체");
              setSelectedApartment("전체");
            }}
          >
            <Picker.Item label="전체 도시" value="전체" />
            <Picker.Item label="호치민" value="호치민" />
            <Picker.Item label="하노이" value="하노이" />
            <Picker.Item label="다낭" value="다낭" />
            <Picker.Item label="냐짱" value="냐짱" />
          </Picker>
        </View>

        {/* 구/군 */}
        {selectedCity !== "전체" && (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedDistrict}
              onValueChange={(value) => {
                setSelectedDistrict(value);
                setSelectedApartment("전체");
              }}
            >
              <Picker.Item label="전체 구/군" value="전체" />
              {districts.map((district) => (
                <Picker.Item key={district} label={district} value={district} />
              ))}
            </Picker>
          </View>
        )}

        {/* 아파트/지역 */}
        {selectedDistrict !== "전체" && apartments.length > 0 && (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedApartment}
              onValueChange={setSelectedApartment}
            >
              <Picker.Item label="전체 아파트" value="전체" />
              {apartments.map((apartment) => (
                <Picker.Item
                  key={apartment}
                  label={apartment}
                  value={apartment}
                />
              ))}
            </Picker>
          </View>
        )}
      </View>

      {/* 카테고리 */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                selectedCategory === item && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 물품 목록 */}
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={filteredItems.length === 0 ? { flex: 1 } : styles.listContainer}  // ✅ 수정!
        refreshControl={  
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>등록된 물품이 없습니다</Text>
            {!user && (
              <TouchableOpacity
                style={styles.emptyLoginButton}
                onPress={() => navigation.navigate("로그인")}
              >
                <Text style={styles.emptyLoginButtonText}>
                  로그인하고 상품 보기
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
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
  filterLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  categoriesContainer: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
    borderRadius: 8,
    margin: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imagePlaceholder: {
    width: "100%",
    height: 140,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemInfo: {
    padding: 12,
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
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemLocation: {
    fontSize: 12,
    color: "#999",
    marginLeft: 2,
    flex: 1,
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
  emptyLoginButton: {
    marginTop: 20,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyLoginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});