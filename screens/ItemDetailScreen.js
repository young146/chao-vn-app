import React, {
  useState,
  useLayoutEffect,
  useCallback,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ItemDetailScreen({ route, navigation }) {
  const { item } = route.params;
  const { user, isAdmin } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(item.status || "판매중"); // ✅ 상태 관리

  const images = item.images || (item.imageUri ? [item.imageUri] : []);
  const isMyItem = item.userId === user?.uid;
  const canDelete = isMyItem || isAdmin();

  // ✅ 리뷰 데이터 불러오기
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const reviewsRef = collection(db, "reviews");
        const q = query(reviewsRef, where("itemId", "==", item.id));
        const snapshot = await getDocs(q);
        const reviewData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // ✅ JavaScript로 정렬 (최신순)
        reviewData.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setReviews(reviewData);

        // 평균 별점 계산
        if (reviewData.length > 0) {
          const sum = reviewData.reduce(
            (acc, review) => acc + review.rating,
            0
          );
          setAverageRating((sum / reviewData.length).toFixed(1));
        } else {
          setAverageRating(0);
        }
      } catch (error) {
        console.error("리뷰 불러오기 실패:", error);
      }
    };

    fetchReviews();
  }, [item.id]);

  // ✅ 찜 상태 확인
  useEffect(() => {
    const checkFavorite = async () => {
      if (!user) return;

      try {
        const favoritesRef = collection(db, "favorites");
        const q = query(
          favoritesRef,
          where("userId", "==", user.uid),
          where("itemId", "==", item.id)
        );
        const snapshot = await getDocs(q);
        setIsFavorited(!snapshot.empty);
      } catch (error) {
        console.error("찜 상태 확인 실패:", error);
      }
    };

    checkFavorite();
  }, [user, item.id]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat("ko-KR").format(price) + "₫";
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      // ISO 문자열인 경우
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      // Firestore Timestamp인 경우
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
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

  // ✅ 상태 배지 색상 결정
  const getStatusColor = (status) => {
    switch (status) {
      case "판매중":
        return "#4CAF50"; // 초록색
      case "가격 조정됨":
        return "#FF9800"; // 주황색
      case "판매완료":
        return "#9E9E9E"; // 회색
      default:
        return "#4CAF50";
    }
  };

  // ✅ 판매완료 처리
  const handleMarkAsSold = async () => {
    Alert.alert("판매완료", "이 물품을 판매완료로 표시하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        onPress: async () => {
          try {
            const itemRef = doc(db, "XinChaoDanggn", item.id);
            await updateDoc(itemRef, {
              status: "판매완료",
            });

            setCurrentStatus("판매완료");
            Alert.alert("완료", "판매완료로 표시되었습니다!");
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert("오류", "상태 변경에 실패했습니다.");
          }
        },
      },
    ]);
  };

  const handleChat = useCallback(() => {
    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다.", [
        { text: "확인" },
        { text: "로그인하기", onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: images[0] || null,
      otherUserId: item.userId,
      otherUserName: item.userEmail ? item.userEmail.split("@")[0] : "판매자",
      sellerId: item.userId,
    });
  }, [user, item, images, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ marginLeft: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });

    if (!isMyItem && user) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity
            onPress={handleChat}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              판매자와 채팅
            </Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: undefined,
      });
    }
  }, [isMyItem, user, navigation, handleChat]);

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

    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다.", [
        { text: "확인" },
        { text: "로그인하기", onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

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
    const message =
      isAdmin() && !isMyItem
        ? "관리자 권한으로 이 물품을 삭제하시겠습니까?"
        : "정말 삭제하시겠습니까?";

    Alert.alert("물품 삭제", message, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            if (images && images.length > 0) {
              for (const imageUrl of images) {
                try {
                  const imageRef = ref(storage, imageUrl);
                  await deleteObject(imageRef);
                  console.log("이미지 삭제 성공:", imageUrl);
                } catch (imgError) {
                  console.log(
                    "이미지 삭제 실패 (이미 없을 수 있음):",
                    imgError
                  );
                }
              }
            }

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
  // ✅ 찜하기 핸들러 (알림 추가!)
  const handleFavorite = async () => {
    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다.", [
        { text: "확인" },
        { text: "로그인하기", onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    try {
      if (isFavorited) {
        // 찜 취소
        const favoritesRef = collection(db, "favorites");
        const q = query(
          favoritesRef,
          where("userId", "==", user.uid),
          where("itemId", "==", item.id)
        );
        const snapshot = await getDocs(q);

        for (const docSnap of snapshot.docs) {
          await deleteDoc(docSnap.ref);
        }

        setIsFavorited(false);
        Alert.alert("완료", "찜 목록에서 제거되었습니다.");
      } else {
        // 찜 추가
        await addDoc(collection(db, "favorites"), {
          userId: user.uid,
          itemId: item.id,
          itemTitle: item.title,
          itemPrice: item.price,
          itemCategory: item.category,
          itemImage: images[0] || null,
          createdAt: serverTimestamp(),
        });

        // ✅ 판매자에게 알림 전송 (자기 물품은 제외)
        if (item.userId !== user.uid) {
          await addDoc(collection(db, "notifications"), {
            userId: item.userId, // 판매자
            type: "favorite",
            message: `${user.email?.split("@")[0] || "사용자"}님이 "${item.title
              }" 물품을 찜했습니다! ❤️`,
            itemId: item.id,
            itemTitle: item.title,
            itemImage: images[0] || null,
            read: false,
            createdAt: serverTimestamp(),
          });

          console.log("✅ 찜 알림 전송 완료:", item.userId);
        }

        setIsFavorited(true);
        Alert.alert("완료", "찜 목록에 추가되었습니다! ❤️");
      }
    } catch (error) {
      console.error("찜하기 실패:", error);
      Alert.alert("오류", "찜하기에 실패했습니다.");
    }
  };

  const handleWriteReview = () => {
    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다.", [
        { text: "확인" },
        { text: "로그인하기", onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    if (isMyItem) {
      Alert.alert("알림", "자신의 물품에는 리뷰를 작성할 수 없습니다.");
      return;
    }

    navigation.navigate("리뷰 작성", { item });
  };

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
                  <Image
                    key={index}
                    source={{ uri }}
                    style={styles.image}
                    contentFit="cover"
                    transition={300}
                    cachePolicy="memory-disk"
                  />
                ))}
              </ScrollView>

              {images.length > 1 && (
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    {currentImageIndex + 1} / {images.length}
                  </Text>
                </View>
              )}

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
          {/* 제목 & 가격 & 상태 */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.title}</Text>
              {/* ✅ 상태 배지 */}
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(currentStatus) },
                ]}
              >
                <Text style={styles.statusText}>{currentStatus}</Text>
              </View>
            </View>
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
              <Text style={styles.locationText}> {item.district}</Text>
              {item.apartment && item.apartment !== "기타" && (
                <Text style={styles.locationText}> {item.apartment}</Text>
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

                  {user ? (
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
                  ) : (
                    <TouchableOpacity
                      style={styles.loginToViewContact}
                      onPress={() => navigation.navigate("로그인")}
                    >
                      <Ionicons name="lock-closed-outline" size={20} color="#666" />
                      <Text style={styles.loginToViewContactText}>
                        로그인하고 연락처 보기
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

          {/* ✅ 리뷰/후기 섹션 */}
          <View style={styles.divider} />
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.sectionTitle}>리뷰/후기</Text>
              {reviews.length > 0 && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>{averageRating}</Text>
                  <Text style={styles.reviewCount}>({reviews.length})</Text>
                </View>
              )}
            </View>

            {reviews.length === 0 ? (
              <View style={styles.noReviews}>
                <Ionicons name="chatbubble-outline" size={40} color="#ccc" />
                <Text style={styles.noReviewsText}>아직 리뷰가 없습니다</Text>
                <Text style={styles.noReviewsSubtext}>
                  첫 번째 리뷰를 남겨주세요!
                </Text>
              </View>
            ) : (
              <View style={styles.reviewList}>
                {reviews.slice(0, 3).map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewerInfo}>
                        <View style={styles.reviewerAvatar}>
                          <Ionicons name="person" size={16} color="#fff" />
                        </View>
                        <Text style={styles.reviewerName}>
                          {review.userEmail?.split("@")[0] || "익명"}
                        </Text>
                      </View>
                      <View style={styles.reviewRating}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={
                              star <= review.rating ? "star" : "star-outline"
                            }
                            size={14}
                            color="#FFD700"
                          />
                        ))}
                      </View>
                    </View>
                    <Text style={styles.reviewContent}>{review.content}</Text>
                    <Text style={styles.reviewDate}>
                      {formatDate(review.createdAt)}
                    </Text>
                  </View>
                ))}

                {reviews.length > 3 && (
                  <Text style={styles.moreReviews}>
                    외 {reviews.length - 3}개의 리뷰
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* 하단 버튼 */}
      <View style={styles.bottomBar}>
        {isMyItem ? (
          <>
            {/* ✅ 판매완료 버튼 (판매중일 때만) */}
            {currentStatus !== "판매완료" && (
              <>
                <TouchableOpacity
                  style={[styles.actionButton, styles.soldButton]}
                  onPress={handleMarkAsSold}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.buttonText}>판매완료</Text>
                </TouchableOpacity>
                <View style={{ width: 8 }} />
              </>
            )}
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
            {/* ✅ 찜하기 버튼 */}
            <TouchableOpacity
              style={styles.heartButton}
              onPress={handleFavorite}
            >
              <Ionicons
                name={isFavorited ? "heart" : "heart-outline"}
                size={24}
                color={isFavorited ? "#FF6B35" : "#333"}
              />
            </TouchableOpacity>

            {/* ✅ 리뷰 작성 버튼 */}
            <TouchableOpacity
              style={[styles.actionButton, styles.reviewButton]}
              onPress={handleWriteReview}
            >
              <Ionicons name="star-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>리뷰 작성</Text>
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
    marginTop: 10,
    fontSize: 16,
    color: "#999",
  },
  imageIndicator: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageIndicatorText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  dotContainer: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#fff",
  },
  contentContainer: {
    paddingBottom: 100,
  },
  headerSection: {
    padding: 16,
    backgroundColor: "#fff",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
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
    textDecorationLine: "underline",
  },
  metaDot: {
    marginHorizontal: 6,
    color: "#ccc",
  },
  date: {
    fontSize: 13,
    color: "#999",
  },
  divider: {
    height: 8,
    backgroundColor: "#f5f5f5",
  },
  section: {
    padding: 16,
    backgroundColor: "#fff",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
  },
  locationDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  locationText: {
    fontSize: 15,
    color: "#333",
  },
  description: {
    fontSize: 15,
    color: "#333",
    lineHeight: 24,
  },
  sellerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  contactInfo: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
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
  loginToViewContact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  loginToViewContactText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    fontWeight: "500",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9C4",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FBC02D",
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: "#666",
    marginLeft: 2,
  },
  noReviews: {
    alignItems: "center",
    paddingVertical: 20,
  },
  noReviewsText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#999",
    marginTop: 8,
  },
  noReviewsSubtext: {
    fontSize: 12,
    color: "#bbb",
    marginTop: 4,
  },
  reviewList: {
    marginTop: 8,
  },
  reviewItem: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 12,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  reviewerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },
  reviewRating: {
    flexDirection: "row",
  },
  reviewContent: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 11,
    color: "#999",
  },
  moreReviews: {
    textAlign: "center",
    color: "#FF6B35",
    fontSize: 13,
    marginTop: 8,
  },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
    paddingBottom: 30,
  },
  heartButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    height: 48,
  },
  reviewButton: {
    backgroundColor: "#FF6B35",
  },
  editButton: {
    backgroundColor: "#2196F3",
  },
  deleteButton: {
    backgroundColor: "#F44336",
  },
  soldButton: {
    backgroundColor: "#4CAF50",
  },
  adminDeleteButton: {
    backgroundColor: "#333",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 4,
  },
});
