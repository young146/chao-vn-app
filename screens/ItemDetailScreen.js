import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, deleteDoc } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ItemDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const { user, isAdmin } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = item.images || (item.imageUri ? [item.imageUri] : []);

  const formatPrice = (price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString("ko-KR");
  };

  const handleContactOption = (type, value) => {
    if (!value) return;

    switch (type) {
      case "phone":
        Alert.alert("연락하기", `전화번호: ${value}`, [
          { text: "취소", style: "cancel" },
          {
            text: "전화하기",
            onPress: () => {
              const phoneNumber = value.replace(/[^0-9+]/g, "");
              Linking.openURL(`tel:${phoneNumber}`);
            },
          },
        ]);
        break;
      case "kakao":
        Alert.alert("카카오톡 ID", value, [{ text: "확인" }]);
        break;
      case "other":
        Alert.alert("기타 연락처", value, [{ text: "확인" }]);
        break;
    }
  };

  const handleContact = () => {
    const contact = item.contact || {};
    const hasContact = contact.phone || contact.kakaoId || contact.other;

    if (!hasContact) {
      Alert.alert("알림", "판매자가 연락처를 등록하지 않았습니다.");
      return;
    }

    const options = [];
    if (contact.phone) {
      options.push({
        text: `📞 전화: ${contact.phone}`,
        onPress: () => handleContactOption("phone", contact.phone),
      });
    }
    if (contact.kakaoId) {
      options.push({
        text: `💬 카카오톡: ${contact.kakaoId}`,
        onPress: () => handleContactOption("kakao", contact.kakaoId),
      });
    }
    if (contact.other) {
      options.push({
        text: `📱 기타: ${contact.other}`,
        onPress: () => handleContactOption("other", contact.other),
      });
    }
    options.push({ text: "취소", style: "cancel" });

    Alert.alert("판매자 연락처", "연락 방법을 선택하세요", options);
  };

  const handleEdit = () => {
    navigation.navigate("물품 수정", { item });
  };

  const handleDelete = () => {
  const message = isAdmin() && !isMyItem
    ? "관리자 권한으로 이 물품을 삭제하시겠습니까?"
    : "정말 삭제하시겠습니까?";

  Alert.alert("물품 삭제", message, [
    { text: "취소", style: "cancel" },
    {
      text: "삭제",
      style: "destructive",
      onPress: async () => {
        try {
          // 1️⃣ Storage에서 이미지 먼저 삭제
          if (images && images.length > 0) {
            for (const imageUrl of images) {
              try {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
                console.log('이미지 삭제 성공:', imageUrl);
              } catch (imgError) {
                console.log('이미지 삭제 실패 (이미 없을 수 있음):', imgError);
              }
            }
          }

          // 2️⃣ Firestore에서 데이터 삭제
          await deleteDoc(doc(db, "XinChaoDanggn", item.id));
          
          Alert.alert("삭제 완료", "물품이 삭제되었습니다.", [
            { text: "확인", onPress: () => navigation.goBack() },
          ]);
        } catch (error) {
          console.error("삭제 실패:", error);
          Alert.alert("오류", "삭제에 실패했습니다.");
        }
      },
    },
  ]);
};

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  const isMyItem = item.userId === user?.uid;
  const canDelete = isMyItem || isAdmin();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 이미지 갤러리 */}
        <View style={styles.imageContainer}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
              >
                {images.map((uri, index) => (
                  <Image key={index} source={{ uri }} style={styles.image} />
                ))}
              </ScrollView>

              {/* 이미지 인디케이터 */}
              {images.length > 1 && (
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    {currentImageIndex + 1} / {images.length}
                  </Text>
                </View>
              )}

              {/* 페이지 도트 */}
              {images.length > 1 && (
                <View style={styles.dotContainer}>
                  {images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.dot,
                        index === currentImageIndex && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={80} color="#ccc" />
              <Text style={styles.imagePlaceholder}>사진 없음</Text>
            </View>
          )}
        </View>

        {/* 물품 정보 */}
        <View style={styles.contentContainer}>
          {/* 제목 & 가격 */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{formatPrice(item.price)}</Text>
            <View style={styles.metaInfo}>
              <Text style={styles.category}>{item.category}</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 위치 정보 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>거래 지역</Text>
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationText}>📍 {item.city}</Text>
              <Text style={styles.locationText}>   {item.district}</Text>
              {item.apartment && item.apartment !== "기타" && (
                <Text style={styles.locationText}>   {item.apartment}</Text>
              )}
            </View>
          </View>

          <View style={styles.divider} />

          {/* 상세 설명 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>상세 설명</Text>
            </View>
            <Text style={styles.description}>
              {item.description || "상세 설명이 없습니다."}
            </Text>
          </View>

          <View style={styles.divider} />

          {/* 판매자 정보 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>판매자 정보</Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <Text style={styles.sellerName}>
                {item.userEmail ? item.userEmail.split("@")[0] : "익명"}
              </Text>
            </View>
          </View>

          {/* 연락처 정보 */}
          {item.contact &&
            (item.contact.phone ||
              item.contact.kakaoId ||
              item.contact.other) && (
              <>
                <View style={styles.divider} />
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="call" size={20} color="#FF6B35" />
                    <Text style={styles.sectionTitle}>연락처</Text>
                  </View>
                  <View style={styles.contactInfo}>
                    {item.contact.phone && (
                      <View style={styles.contactItem}>
                        <Ionicons name="call-outline" size={18} color="#666" />
                        <Text style={styles.contactText}>
                          {item.contact.phone}
                        </Text>
                      </View>
                    )}
                    {item.contact.kakaoId && (
                      <View style={styles.contactItem}>
                        <Ionicons
                          name="chatbubble-outline"
                          size={18}
                          color="#666"
                        />
                        <Text style={styles.contactText}>
                          카톡: {item.contact.kakaoId}
                        </Text>
                      </View>
                    )}
                    {item.contact.other && (
                      <View style={styles.contactItem}>
                        <Ionicons
                          name="share-social-outline"
                          size={18}
                          color="#666"
                        />
                        <Text style={styles.contactText}>
                          {item.contact.other}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.bottomBar}>
        {isMyItem ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>수정하기</Text>
            </TouchableOpacity>
            <View style={{ width: 8 }} />
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>삭제하기</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.heartButton}>
              <Ionicons name="heart-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.contactButton]}
              onPress={handleContact}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>연락하기</Text>
            </TouchableOpacity>
            {/* Admin 삭제 버튼 */}
            {isAdmin() && (
              <>
                <View style={{ width: 8 }} />
                <TouchableOpacity
                  style={[styles.actionButton, styles.adminDeleteButton]}
                  onPress={handleDelete}
                >
                  <Ionicons name="shield-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>관리자 삭제</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: 300,
    backgroundColor: "#f0f0f0",
    position: "relative",
  },
  image: {
    width: SCREEN_WIDTH,
    height: 300,
    resizeMode: "cover",
  },
  noImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    marginTop: 12,
    fontSize: 14,
    color: "#999",
  },
  imageIndicator: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageIndicatorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  dotContainer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  contentContainer: {
    padding: 16,
  },
  headerSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  price: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 8,
  },
  metaInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  category: {
    fontSize: 14,
    color: "#666",
  },
  metaDot: {
    marginHorizontal: 6,
    fontSize: 14,
    color: "#666",
  },
  date: {
    fontSize: 14,
    color: "#999",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  locationDetails: {
    paddingLeft: 28,
  },
  locationText: {
    fontSize: 15,
    color: "#333",
    marginBottom: 4,
    lineHeight: 22,
  },
  description: {
    fontSize: 15,
    color: "#333",
    lineHeight: 24,
    paddingLeft: 28,
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 28,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  contactInfo: {
    paddingLeft: 28,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  contactText: {
    fontSize: 15,
    color: "#333",
    marginLeft: 8,
  },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#4CAF50",
  },
  contactButton: {
    backgroundColor: "#FF6B35",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
  },
  adminDeleteButton: {
    backgroundColor: "#6c757d",
    flex: 0,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 6,
  },
});