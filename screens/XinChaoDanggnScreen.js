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
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  limit,
  doc,
  getDoc,
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
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

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

  // 사용자 프로필 로드
  useEffect(() => {
    const loadUserProfile = async () => {
      if (user) {
        try {
          console.log("👤 사용자 프로필 로딩 시작... UID:", user.uid);
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const profileData = userDoc.data();
            setUserProfile(profileData);
            console.log("✅ 프로필 로드 완료:", profileData);
            console.log("📍 주소 정보:", {
              city: profileData.city || "없음",
              district: profileData.district || "없음",
              apartment: profileData.apartment || "없음",
            });
          } else {
            console.log("⚠️ 프로필 문서가 존재하지 않음");
            setUserProfile({});
          }
        } catch (error) {
          console.error("❌ 프로필 로드 실패:", error);
        }
      }
    };

    loadUserProfile();
  }, [user]);

  // 지역 필터 사용 시 프로필 미작성 확인
  useEffect(() => {
    console.log("🔍 배너 표시 조건 확인:");
    console.log("  - user:", user ? "로그인됨" : "로그인 안됨");
    console.log("  - userProfile:", userProfile);
    console.log("  - selectedCity:", selectedCity);

    if (user && userProfile && selectedCity !== "전체") {
      const isProfileIncomplete = !userProfile.city || !userProfile.district;
      console.log("  - userProfile.city:", userProfile.city || "없음");
      console.log("  - userProfile.district:", userProfile.district || "없음");
      console.log("  - isProfileIncomplete:", isProfileIncomplete);
      console.log("  ➡️ 배너 표시:", isProfileIncomplete ? "YES" : "NO");
      setShowProfilePrompt(isProfileIncomplete);
    } else {
      console.log("  ➡️ 배너 표시: NO (조건 미충족)");
      setShowProfilePrompt(false);
    }
  }, [user, userProfile, selectedCity]);

  useEffect(() => {
    let q = query(
      collection(db, "XinChaoDanggn"),
      orderBy("createdAt", "desc")
    );

    if (!user) {
      q = query(q, limit(8));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemsData);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, [user, refreshing]);

  const onRefresh = () => {
    setRefreshing(true);
    setRefreshKey(Date.now());
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

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

  const getStatusColor = (status) => {
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
      // createdAt을 문자열로 변환하여 navigation params에 전달
      const serializableItem = {
        ...item,
        createdAt: item.createdAt?.toDate?.()?.toISOString() || item.createdAt,
      };
      navigation.navigate("물품 상세", { item: serializableItem });
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

  const handleProfilePrompt = () => {
    Alert.alert(
      "프로필 작성 📝",
      "주소를 등록하면 내 주변 새 상품이 등록될 때마다 자동으로 알림을 받을 수 있습니다.\n\n지금 프로필을 작성하시겠어요?",
      [
        {
          text: "나중에",
          style: "cancel",
          onPress: () => setShowProfilePrompt(false),
        },
        {
          text: "작성하기",
          onPress: () => {
            setShowProfilePrompt(false);
            // ✅ 수정: 탭을 "더보기"로 바꾸고, "프로필" 화면으로 이동
            navigation.navigate("더보기", {
              screen: "프로필",
            });
          },
        },
      ]
    );
  };

  const districts = getDistrictsByCity(
    selectedCity === "전체" ? "호치민" : selectedCity
  );
  const apartments =
    selectedDistrict && selectedDistrict !== "전체"
      ? getApartmentsByDistrict(
        selectedCity === "전체" ? "호치민" : selectedCity,
        selectedDistrict
      )
      : [];

  const renderItem = ({ item }) => {
    const status = item.status || "판매중";

    return (
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

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(status) },
            ]}
          >
            <Text style={styles.statusText}>{status}</Text>
          </View>
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
  };

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }}>
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

        {/* 프로필 미작성 안내 배너 */}
        {showProfilePrompt && (
          <TouchableOpacity
            style={styles.profilePromptBanner}
            onPress={handleProfilePrompt}
          >
            <Ionicons name="notifications" size={20} color="#2196F3" />
            <Text style={styles.profilePromptText}>
              프로필을 작성하시면 자동으로 귀하의 주변 새상품 등록을 확인할 수
              있습니다
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#2196F3" />
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
            placeholderTextColor="rgba(0, 0, 0, 0.38)"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* 지역 필터 */}
        <View style={styles.filterSection}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={(value) => {
                setSelectedCity(value);
                setSelectedDistrict("전체");
                setSelectedApartment("전체");
              }}
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
                onValueChange={(value) => {
                  setSelectedDistrict(value);
                  setSelectedApartment("전체");
                }}
                style={styles.picker}
              >
                <Picker.Item label="전체 구/군" value="전체" />
                {districts.map((district) => (
                  <Picker.Item
                    key={district}
                    label={district}
                    value={district}
                  />
                ))}
              </Picker>
            </View>
          )}

          {selectedDistrict !== "전체" && apartments.length > 0 && (
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedApartment}
                onValueChange={setSelectedApartment}
                style={styles.picker}
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
          scrollEnabled={false}
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={
            filteredItems.length === 0 ? { flex: 1 } : styles.listContainer
          }
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
      </ScrollView>

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
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  picker: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    color: "#333",
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
    resizeMode: "cover",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
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
  emptyLoginButton: {
    marginTop: 16,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyLoginButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
});
