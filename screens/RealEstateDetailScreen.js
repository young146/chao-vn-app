import React, {
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Dimensions,
  Share,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import ImageViewing from "react-native-image-viewing";
import { useTranslation } from "react-i18next";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { DetailAdBanner, PopupAd } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { formatRentPrice, formatSalePrice as formatSalePriceUtil } from "../utils/priceFormatter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RealEstateDetailScreen({ route, navigation }) {
  const { item: routeItem, id: deepLinkId } = route.params || {};
  const { user, isAdmin } = useAuth();
  const { t, i18n } = useTranslation(['realEstate', 'common']);

  const [item, setItem] = useState(routeItem || null);
  const [loadingItem, setLoadingItem] = useState(!routeItem);
  const [itemNotFound, setItemNotFound] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentStatus, setCurrentStatus] = useState(routeItem?.status || "거래가능");
  const [showPopup, setShowPopup] = useState(true);
  const [isImageViewVisible, setIsImageViewVisible] = useState(false);

  // ✅ 딥링크를 통해 ID만 전달된 경우 데이터 패치
  useEffect(() => {
    if (!routeItem && deepLinkId) {
      const fetchItem = async () => {
        try {
          const docRef = doc(db, "RealEstate", deepLinkId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setItem(data);
            setCurrentStatus(data.status || "거래가능");
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
    } else if (!routeItem && !deepLinkId) {
      setItemNotFound(true);
      setLoadingItem(false);
    }
  }, [routeItem, deepLinkId]);

  // 화면이 포커스될 때마다 최신 데이터 재로드 (수정 후 자동 갱신)
  useFocusEffect(
    useCallback(() => {
      const fetchLatest = async () => {
        if (!item?.id) return;
        try {
          const docRef = doc(db, "RealEstate", item.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const fresh = { id: docSnap.id, ...docSnap.data() };
            setItem(fresh);
            setCurrentStatus(fresh.status || "거래가능");
          }
        } catch (e) {
          // 네트워크 오류 등은 무시하고 기존 데이터 유지
        }
      };
      fetchLatest();
    }, [item?.id])
  );

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

  const images = item.images || [];
  const isMyItem = item.userId === user?.uid;
  const canDelete = isMyItem || isAdmin();
  const canEdit = isMyItem || isAdmin();

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

  // 임대용: 만동 단위로 입력된 가격 포맷
  const formatPrice = (price, unit) => {
    return formatRentPrice(price, i18n.language, unit);
  };

  // 가격 표시: 쿨자 입력한 텍스트 그대로 표시 (군 존재시 콤마 포맷)
  const displayPrice = (value) => {
    if (!value) return '-';
    // 숫자면 코마 포맷, 텍스트면 그대로 표시
    if (!isNaN(Number(value)) && String(value).trim() !== '') {
      return Number(value).toLocaleString() + ' ₫';
    }
    return String(value);
  };

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
    const isRent = type === "임대";
    return isRent
      ? { bg: "#E3F2FD", color: "#1976D2", text: t('rent') }
      : { bg: "#FFF3E0", color: "#E65100", text: t('sale') };
  };

  // 거래완료 처리
  const handleMarkAsComplete = async () => {
    Alert.alert(t('detail.markAsComplete'), t('detail.markAsCompleteConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:confirm'),
        onPress: async () => {
          try {
            const itemRef = doc(db, "RealEstate", item.id);
            await updateDoc(itemRef, {
              status: "거래완료",
            });
            setCurrentStatus("거래완료");
            Alert.alert(t('detail.complete'), t('detail.markedAsComplete'));
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert(t('common:error'), t('detail.deleteFailed'));
          }
        },
      },
    ]);
  };

  // 거래가능으로 재오픈
  const handleReopen = async () => {
    Alert.alert(t('detail.reopen'), t('detail.reopenConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:confirm'),
        onPress: async () => {
          try {
            const itemRef = doc(db, "RealEstate", item.id);
            await updateDoc(itemRef, {
              status: "거래가능",
            });
            setCurrentStatus("거래가능");
            Alert.alert(t('detail.complete'), t('detail.reopened'));
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert(t('common:error'), t('detail.deleteFailed'));
          }
        },
      },
    ]);
  };

  // 채팅하기
  const handleChat = useCallback(() => {
    if (!user) {
      Alert.alert(t('common:notice'), t('detail.loginRequired'), [
        { text: t('common:confirm') },
        { text: t('detail.goToLogin'), onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    if (isMyItem) {
      Alert.alert(t('common:notice'), t('detail.ownPost'));
      return;
    }

    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: images[0] || null,
      otherUserId: item.userId,
      otherUserName: item.userEmail ? item.userEmail.split("@")[0] : t('detail.poster'),
      sellerId: item.userId,
    });
  }, [user, item, images, navigation, isMyItem, t]);

  // 전화걸기
  const handleCall = () => {
    if (!item.contact) {
      Alert.alert(t('common:notice'), t('detail.noContact'));
      return;
    }

    const phoneNumber = item.contact.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // 📤 SNS 공유 핸들러
  const handleShare = useCallback(async (platform = 'more') => {
    const { shareItem } = require('../utils/deepLinkUtils');

    try {
      const result = await shareItem('realestate', item.id, item, platform);
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

  // 수정하기
  const handleEdit = () => {
    navigation.navigate("부동산 등록", { editItem: item });
  };

  // 삭제하기
  const handleDelete = () => {
    Alert.alert(
      t('common:delete'),
      t('detail.deleteConfirm'),
      [
        { text: t('common:cancel'), style: "cancel" },
        {
          text: t('common:delete'),
          style: "destructive",
          onPress: async () => {
            try {
              // 이미지 삭제
              if (item.images && item.images.length > 0) {
                for (const imageUrl of item.images) {
                  try {
                    if (imageUrl.includes("firebase")) {
                      const imageRef = ref(storage, imageUrl);
                      await deleteObject(imageRef);
                    }
                  } catch (imgError) {
                    console.log("이미지 삭제 실패 (무시):", imgError);
                  }
                }
              }

              await deleteDoc(doc(db, "RealEstate", item.id));

              Alert.alert(t('detail.complete'), t('detail.deleteSuccess'), [
                { text: t('common:confirm'), onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error("삭제 실패:", error);
              Alert.alert(t('common:error'), t('detail.deleteFailed'));
            }
          },
        },
      ]
    );
  };

  // 헤더 설정
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={handleShare} style={{ marginRight: 16 }}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, canDelete]);

  const badge = getTypeBadge(item.dealType);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 상단 광고 */}
        <DetailAdBanner position="top" screen="realestate" />

        {/* 이미지 영역 */}
        {images.length > 0 ? (
          <View style={styles.imageContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(index);
              }}
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
                    transition={200}
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
            {/* 🔍 이미지 확대 뷰어 */}
            <ImageViewing
              images={images.map((uri) => ({ uri }))}
              imageIndex={currentImageIndex}
              visible={isImageViewVisible}
              onRequestClose={() => setIsImageViewVisible(false)}
            />
          </View>
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="home-outline" size={80} color="#ddd" />
            <Text style={styles.noImageText}>{t('detail.noImage')}</Text>
          </View>
        )}

        {/* 광고 배너 */}
        <DetailAdBanner position="top" screen="realestate" style={{ marginTop: 12 }} />

        {/* 메인 정보 */}
        <View style={styles.mainInfo}>
          {/* 상태 + 임대/매매 배지 */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
              <Text style={styles.statusText}>{currentStatus}</Text>
            </View>
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
          <TranslatedText style={styles.title}>{item.title}</TranslatedText>

          {/* 가격 정보 */}
          <View style={styles.priceSection}>
            {item.dealType === "임대" ? (
              <>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('detail.deposit')}</Text>
                  <Text style={styles.priceValue}>{displayPrice(item.deposit)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('detail.monthlyRent')}</Text>
                  <Text style={styles.priceValue}>{displayPrice(item.monthlyRent)}</Text>
                </View>
              </>
            ) : (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('detail.salePrice')}</Text>
                <Text style={styles.priceValue}>{displayPrice(item.price)}</Text>
              </View>
            )}
          </View>

          {/* 등록 정보 */}
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#888" />
            <Text style={styles.metaText}>
              {item.userEmail ? item.userEmail.split("@")[0] : t('detail.anonymous')}
            </Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
          </View>
        </View>

        {/* 상세 정보 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>🏠 {t('detail.propertyInfo')}</Text>

          {/* 위치 */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="location-outline" size={18} color="#E91E63" />
              <Text style={styles.labelText}>{t('detail.location')}</Text>
            </View>
            <TranslatedText style={styles.infoValue}>
              {item.city}{item.district ? ` ${item.district}` : ''}
            </TranslatedText>
          </View>

          {/* 면적 */}
          {item.area && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="resize-outline" size={18} color="#2196F3" />
                <Text style={styles.labelText}>{t('detail.area')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{item.area}㎡</TranslatedText>
            </View>
          )}

          {/* 방/화장실 */}
          {item.rooms && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="bed-outline" size={18} color="#9C27B0" />
                <Text style={styles.labelText}>{t('detail.rooms')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{item.rooms}</TranslatedText>
            </View>
          )}

          {/* 층수 */}
          {item.floor && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="layers-outline" size={18} color="#FF9800" />
                <Text style={styles.labelText}>{t('detail.floor')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{item.floor}</TranslatedText>
            </View>
          )}

          {/* 입주 가능일 */}
          {item.availableDate && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="calendar-outline" size={18} color="#795548" />
                <Text style={styles.labelText}>{t('detail.availableDate')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{item.availableDate}</TranslatedText>
            </View>
          )}

          {/* 연락처 */}
          {item.contact && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="call-outline" size={18} color="#009688" />
                <Text style={styles.labelText}>{t('detail.contact')}</Text>
              </View>
              <TouchableOpacity onPress={handleCall}>
                <Text style={[styles.infoValue, styles.linkText]}>{item.contact}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 상세 설명 */}
        <View style={styles.descriptionCard}>
          <Text style={styles.cardTitle}>📝 {t('detail.description')}</Text>
          <TranslatedText style={styles.description}>
            {item.description || t('detail.noDescription')}
          </TranslatedText>
        </View>

        {/* 내 매물인 경우 관리 버튼 */}
        {isMyItem && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#E91E63" />
              <Text style={styles.editButtonText}>{t('detail.edit')}</Text>
            </TouchableOpacity>

            {currentStatus !== "거래완료" ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleMarkAsComplete}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                <Text style={styles.closeButtonText}>{t('detail.markAsComplete')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={handleReopen}
              >
                <Ionicons name="refresh-outline" size={20} color="#2196F3" />
                <Text style={styles.reopenButtonText}>{t('detail.reopen')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 관리자 수정 버튼 (내 매물이 아닐 때만) */}
        {!isMyItem && isAdmin() && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: '#FFF3E0', flex: 1 }]}
              onPress={handleEdit}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#FF9800" />
              <Text style={[styles.editButtonText, { color: '#FF9800' }]}>관리자 수정</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 하단 광고 */}
        <DetailAdBanner position="bottom" screen="realestate" />

        <View style={{ height: 200 }} />
      </ScrollView>

      {/* 하단 액션 바 */}
      {!isMyItem && (
        <View style={styles.bottomBar}>
          {item.contact && (
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Ionicons name="call" size={22} color="#fff" />
              <Text style={styles.callButtonText}>{t('detail.call')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.chatButton, !item.contact && { flex: 1 }]}
            onPress={handleChat}
          >
            <Ionicons name="chatbubble" size={22} color="#fff" />
            <Text style={styles.chatButtonText}>{t('detail.chat')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 🎯 상세 페이지 진입 시 전면 팝업 광고 (10초 후 자동 닫힘) */}
      <PopupAd
        visible={showPopup}
        onClose={() => setShowPopup(false)}
        screen="realestate"
        autoCloseSeconds={10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: "#f0f0f0",
  },
  image: {
    width: SCREEN_WIDTH,
    height: 280,
  },
  imageIndicator: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageIndicatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  noImageContainer: {
    width: SCREEN_WIDTH,
    height: 200,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    marginTop: 8,
    color: "#999",
    fontSize: 14,
  },
  mainInfo: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  propertyTypeBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  propertyTypeText: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 28,
    marginBottom: 12,
  },
  priceSection: {
    backgroundColor: "#FFF8F8",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#E91E63",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 13,
    color: "#888",
    marginLeft: 4,
  },
  metaDivider: {
    marginHorizontal: 8,
    color: "#ddd",
  },
  infoCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    maxWidth: "60%",
    textAlign: "right",
  },
  linkText: {
    color: "#E91E63",
    textDecorationLine: "underline",
  },
  descriptionCard: {
    backgroundColor: "#fff",
    padding: 16,
    marginTop: 8,
  },
  description: {
    fontSize: 15,
    color: "#444",
    lineHeight: 24,
  },
  ownerActions: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FCE4EC",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E91E63",
  },
  closeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
  },
  reopenButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  reopenButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  chatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E91E63",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
});
