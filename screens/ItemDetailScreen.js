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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import ImageViewing from "react-native-image-viewing";
import { useTranslation } from "react-i18next";
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
  getDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { DetailAdBanner, PopupAd } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { formatPrice as formatPriceUtil } from "../utils/priceFormatter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ItemDetailScreen({ route, navigation }) {
  const { item: initialItem, id: deepLinkId } = route.params || {};
  const { user, isAdmin } = useAuth();
  const { t, i18n } = useTranslation(['danggn', 'common']);

  const [item, setItem] = useState(initialItem || null);
  const [loadingItem, setLoadingItem] = useState(!initialItem);
  const [itemNotFound, setItemNotFound] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(initialItem?.status || "판매중"); // ✅ 상태 관리
  const [showPopup, setShowPopup] = useState(true); // 🎯 상세 진입 시 바로 팝업 표시
  const [isImageViewVisible, setIsImageViewVisible] = useState(false); // 🔍 이미지 확대 뷰어

  // ✅ 딥링크를 통해 ID만 전달된 경우 데이터 패치
  useEffect(() => {
    if (!initialItem && deepLinkId) {
      const fetchItem = async () => {
        try {
          const docRef = doc(db, "XinChaoDanggn", deepLinkId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setItem(data);
            setCurrentStatus(data.status || "판매중");
          } else {
            setItemNotFound(true);
          }
        } catch (error) {
          console.error("아이템 불러오기 실패:", error);
          setItemNotFound(true);
        } finally {
          setLoadingItem(false);
        }
      };
      fetchItem();
    } else if (!initialItem && !deepLinkId) {
      setItemNotFound(true);
      setLoadingItem(false);
    }
  }, [initialItem, deepLinkId]);

  const images = item ? (item.images || (item.imageUri ? [item.imageUri] : [])) : [];
  const isMyItem = item?.userId === user?.uid;
  const canDelete = isMyItem || isAdmin();

  // ✅ 리뷰 데이터 불러오기
  useEffect(() => {
    if (!item) return;
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
  }, [item?.id]);

  // ✅ 찜 상태 확인
  useEffect(() => {
    if (!item) return;
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
  }, [user, item?.id]);

  // ✅ useCallback/useLayoutEffect을 early return 위에 배치 (Rules of Hooks 준수)
  const handleChat = useCallback(() => {
    if (!user || !item) return;
    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: images[0] || null,
      otherUserId: item.userId,
      otherUserName: item.userEmail ? item.userEmail.split("@")[0] : t('detail.seller'),
      sellerId: item.userId,
    });
  }, [user, item, images, navigation, t]);

  // 📤 SNS 공유 핸들러
  const handleShare = useCallback(async (platform = 'more') => {
    if (!item) return;
    const { shareItem } = require('../utils/deepLinkUtils');
    try {
      const result = await shareItem('danggn', item.id, item, platform);
      if (result && !result.success) {
        if (result.error === 'kakao_not_installed') {
          Alert.alert('KakaoTalk', t('detail.installKakao'));
        } else if (result.error === 'zalo_not_installed') {
          Alert.alert('Zalo', t('detail.zaloNotInstalled'));
        }
      }
    } catch (error) {
      console.error("공유 실패:", error);
      Alert.alert(t('common:error'), t('detail.shareFailed'));
    }
  }, [item, t]);

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
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* 공유 버튼 (항상 표시) */}
          <TouchableOpacity
            onPress={handleShare}
            style={{ marginRight: !isMyItem && user ? 8 : 12 }}
          >
            <Ionicons name="share-social-outline" size={24} color="#fff" />
          </TouchableOpacity>

          {/* 채팅 버튼 (내 물건이 아닐 때만) */}
          {!isMyItem && user && (
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
                {t('detail.chatWithSeller')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [isMyItem, user, navigation, handleChat, handleShare, t]);

  // ── 여기서부터 early return (모든 Hook 호출이 위에서 완료됨) ──

  if (loadingItem) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (itemNotFound || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, color: "#666" }}>{t('common:notFound', '해당 게시물을 찾을 수 없습니다.')}</Text>
        <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: "#FF6B35", borderRadius: 8 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── item이 확실히 있을 때만 실행되는 유틸 함수들 ──

  const formatPrice = (price) => {
    return formatPriceUtil(price, i18n.language);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    let date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp);
    } else if (timestamp.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('detail.justNow');
    if (minutes < 60) return t('detail.minutesAgo', { count: minutes });
    if (hours < 24) return t('detail.hoursAgo', { count: hours });
    if (days < 7) return t('detail.daysAgo', { count: days });
    return date.toLocaleDateString("ko-KR");
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "판매중": return "#4CAF50";
      case "가격 조정됨": return "#FF9800";
      case "판매완료": return "#9E9E9E";
      default: return "#4CAF50";
    }
  };

  const handleMarkAsSold = async () => {
    Alert.alert(t('detail.markAsSold'), t('detail.markAsSoldConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:confirm'),
        onPress: async () => {
          try {
            const itemRef = doc(db, "XinChaoDanggn", item.id);
            await updateDoc(itemRef, { status: "판매완료" });
            setCurrentStatus("판매완료");
            Alert.alert(t('detail.complete'), t('detail.markedAsSold'));
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert(t('common:error'), t('detail.statusChangeFailed'));
          }
        },
      },
    ]);
  };

  const handleContactOption = (type, value) => {
    if (!value) return;

    switch (type) {
      case "phone":
        Alert.alert(t('detail.contact'), `${t('detail.phoneNumber')}: ${value}`, [
          { text: t('common:cancel'), style: "cancel" },
          {
            text: t('detail.makeCall'),
            onPress: () => {
              const phoneNumber = value.replace(/[^0-9+]/g, "");
              Linking.openURL(`tel:${phoneNumber}`);
            },
          },
        ]);
        break;
      case "kakao":
        Alert.alert(t('detail.kakaoId'), value, [{ text: t('common:confirm') }]);
        break;
      case "other":
        Alert.alert(t('detail.otherContact'), value, [{ text: t('common:confirm') }]);
        break;
    }
  };

  const handleContact = () => {
    const contact = item.contact || {};
    const hasContact = contact.phone || contact.kakaoId || contact.other;

    if (!user) {
      Alert.alert(t('common:notice'), t('detail.loginRequired'), [
        { text: t('common:confirm') },
        { text: t('detail.goToLogin'), onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    if (!hasContact) {
      Alert.alert(t('detail.noContact'), t('detail.noContactMessage'));
      return;
    }

    const options = [];
    if (contact.phone) {
      options.push({
        text: `📞 ${t('detail.phoneNumber')}: ${contact.phone}`,
        onPress: () => handleContactOption("phone", contact.phone),
      });
    }
    if (contact.kakaoId) {
      options.push({
        text: `💬 ${t('detail.kakaoId')}: ${contact.kakaoId}`,
        onPress: () => handleContactOption("kakao", contact.kakaoId),
      });
    }
    if (contact.other) {
      options.push({
        text: `📱 ${t('detail.otherContact')}: ${contact.other}`,
        onPress: () => handleContactOption("other", contact.other),
      });
    }
    options.push({ text: t('common:cancel'), style: "cancel" });

    Alert.alert(t('detail.contactSeller'), t('detail.contact'), options);
  };

  const handleEdit = () => {
    navigation.navigate("당근/나눔 수정", { item });
  };

  const handleDelete = () => {
    Alert.alert(t('common:delete'), t('detail.deleteConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:delete'),
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

            Alert.alert(t('detail.complete'), t('detail.deleteSuccess'), [
              { text: t('common:confirm'), onPress: () => navigation.goBack() },
            ]);
          } catch (error) {
            console.error("삭제 실패:", error);
            Alert.alert(t('common:error'), t('detail.deleteFailed'));
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
      Alert.alert(t('common:notice'), t('detail.loginRequired'), [
        { text: t('common:confirm') },
        { text: t('detail.goToLogin'), onPress: () => navigation.navigate("로그인") },
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
        Alert.alert(t('detail.complete'), t('detail.favoriteRemoved'));
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
            message: `${user.email?.split("@")[0] || t('detail.seller')}님이 "${item.title
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
        Alert.alert(t('detail.complete'), t('detail.favoriteAdded'));
      }
    } catch (error) {
      console.error("찜하기 실패:", error);
      Alert.alert(t('common:error'), t('detail.deleteFailed'));
    }
  };

  const handleWriteReview = () => {
    if (!user) {
      Alert.alert(t('common:notice'), t('detail.loginRequired'), [
        { text: t('common:confirm') },
        { text: t('detail.goToLogin'), onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    if (isMyItem) {
      Alert.alert(t('common:notice'), t('detail.noReviews'));
      return;
    }

    navigation.navigate("리뷰 작성", { item });
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* 상단 광고 */}
        <DetailAdBanner position="top" screen="danggn" />

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
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.9}
                    onPress={() => {
                      setCurrentImageIndex(index);
                      setIsImageViewVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.image}
                      contentFit="cover"
                      transition={300}
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
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

              {/* 🔍 이미지 확대 뷰어 */}
              <ImageViewing
                images={images.map((uri) => ({ uri }))}
                imageIndex={currentImageIndex}
                visible={isImageViewVisible}
                onRequestClose={() => setIsImageViewVisible(false)}
              />
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image-outline" size={80} color="#ccc" />
              <Text style={styles.imagePlaceholder}>{t('detail.noPhoto')}</Text>
            </View>
          )}
        </View>

        {/* 물품 정보 */}
        <View style={styles.contentContainer}>
          {/* 제목 & 가격 & 상태 */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <TranslatedText style={styles.title}>{item.title}</TranslatedText>
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
            <Text style={styles.price}>{item.priceText || String(item.price || '가격 문의')}</Text>
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
              <Text style={styles.sectionTitle}>{t('detail.tradeArea')}</Text>
            </View>
            <View style={styles.locationDetails}>
              <TranslatedText style={styles.locationText}>
                📍 {item.city} · {item.district}
                {item.apartment && item.apartment !== "기타" ? ` · ${item.apartment}` : ''}
              </TranslatedText>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 상세 설명 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>{t('detail.description')}</Text>
            </View>
            <TranslatedText style={styles.description}>
              {item.description || t('detail.noDescription')}
            </TranslatedText>
          </View>

          <View style={styles.divider} />

          {/* 판매자 정보 */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>{t('detail.sellerInfo')}</Text>
            </View>
            <View style={styles.sellerInfo}>
              <View style={styles.sellerAvatar}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
              <Text style={styles.sellerName}>
                {item.userEmail ? item.userEmail.split("@")[0] : t('detail.anonymous')}
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
                    <Text style={styles.sectionTitle}>{t('detail.contactInfo')}</Text>
                  </View>

                  {user ? (
                    <View style={styles.contactInfo}>
                      {item.contact.phone && (
                        <View style={styles.contactItem}>
                          <Ionicons name="call-outline" size={18} color="#666" />
                          <TranslatedText style={styles.contactText}>
                            {item.contact.phone}
                          </TranslatedText>
                        </View>
                      )}
                      {item.contact.kakaoId && (
                        <View style={styles.contactItem}>
                          <Ionicons
                            name="chatbubble-outline"
                            size={18}
                            color="#666"
                          />
                          <TranslatedText style={styles.contactText}>
                            {t('detail.kakaoPrefix')}: {item.contact.kakaoId}
                          </TranslatedText>
                        </View>
                      )}
                      {item.contact.other && (
                        <View style={styles.contactItem}>
                          <Ionicons
                            name="share-social-outline"
                            size={18}
                            color="#666"
                          />
                          <TranslatedText style={styles.contactText}>
                            {item.contact.other}
                          </TranslatedText>
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
                        {t('detail.loginToViewContact')}
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
              <Text style={styles.sectionTitle}>{t('detail.reviewSection')}</Text>
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
                <Text style={styles.noReviewsText}>{t('detail.noReviews')}</Text>
                <Text style={styles.noReviewsSubtext}>
                  {t('detail.writeFirstReview')}
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
                          {review.userEmail?.split("@")[0] || t('detail.anonymous')}
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
                    <TranslatedText style={styles.reviewContent}>{review.content}</TranslatedText>
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

        {/* 하단 광고 */}
        <DetailAdBanner position="bottom" screen="danggn" />

        <View style={{ height: 200 }} />
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
                  <Text style={styles.buttonText}>{t('detail.markAsSold')}</Text>
                </TouchableOpacity>
                <View style={{ width: 8 }} />
              </>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>{t('detail.edit')}</Text>
            </TouchableOpacity>
            <View style={{ width: 8 }} />
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>{t('detail.delete')}</Text>
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
              <Text style={styles.buttonText}>{t('detail.reviewBtn')}</Text>
            </TouchableOpacity>

            {/* Admin 수정 버튼 */}
            {isAdmin() && (
              <>
                <View style={{ width: 8 }} />
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                  onPress={handleEdit}
                >
                  <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>관리자 수정</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Admin 삭제 버튼 */}
            {isAdmin() && (
              <>
                <View style={{ width: 8 }} />
                <TouchableOpacity
                  style={[styles.actionButton, styles.adminDeleteButton]}
                  onPress={handleDelete}
                >
                  <Ionicons name="shield-outline" size={20} color="#fff" />
                  <Text style={styles.buttonText}>{t('common:adminDelete')}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </View>

      {/* 🎯 상세 페이지 진입 시 전면 팝업 광고 (10초 후 자동 닫힘) */}
      <PopupAd
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        screen="danggn"
        autoCloseSeconds={10}
      />
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
    fontSize: 16,
    color: "#222",
    fontWeight: "600",
    lineHeight: 24,
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
