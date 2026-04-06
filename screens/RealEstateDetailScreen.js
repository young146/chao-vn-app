import React, {
  useState,
  useLayoutEffect,
  useCallback,
  useEffect,
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
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { DetailAdBanner, PopupAd } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { formatRentPrice, formatSalePrice as formatSalePriceUtil } from "../utils/priceFormatter";
import LocationMap from "../components/LocationMap";
import YouTubeCard from "../components/YouTubeCard";
import AgentCard from "../components/AgentCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function RealEstateDetailScreen({ route, navigation }) {
  const { item: routeItem, id: deepLinkId } = route.params || {};
  const { user, isAdmin } = useAuth();
  const { t, i18n } = useTranslation(['realEstate', 'common']);

  const [item, setItem] = useState(routeItem || null);
  const [loadingItem, setLoadingItem] = useState(!routeItem);
  const [itemNotFound, setItemNotFound] = useState(false);
  const [liveAgent, setLiveAgent] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [similarItems, setSimilarItems] = useState([]);
  const [agentItems, setAgentItems] = useState([]);

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

  // 화면 포커스 시마다 Firebase에서 최신 데이터 재로드
  // routeItem.id 또는 deepLinkId 기반으로 항상 최신 상태 유지
  const stableItemId = routeItem?.id || deepLinkId || null;
  useFocusEffect(
    useCallback(() => {
      if (!stableItemId) return;
      const fetchLatest = async () => {
        try {
          const docRef = doc(db, "RealEstate", stableItemId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const fresh = { id: docSnap.id, ...docSnap.data() };
            console.log("🔄 상세 재로드 agentSnapshot=", !!fresh.agentSnapshot, fresh.agentId);
            setItem(fresh);
            setCurrentStatus(fresh.status || "거래가능");
          }
        } catch (e) { console.error("상세 재로드 실패:", e); }
      };
      fetchLatest();
    }, [stableItemId]) // stableItemId는 route.params에서 오므로 변하지 않음
  );

  // 에이전트 조회: agentId 직접 조회 → 없으면 매물 소유자의 에이전트 자동 조회 후 연결 저장
  useEffect(() => {
    if (!item) return;
    setAgentLoading(true);

    const fetchAgent = async () => {
      try {
        // 1) agentId가 있으면 직접 조회
        if (item.agentId) {
          const agentSnap = await getDoc(doc(db, "Agents", item.agentId));
          if (agentSnap.exists()) {
            setLiveAgent({ id: agentSnap.id, ...agentSnap.data() });
            return;
          }
          // agentId가 있지만 문서 없음 → 삭제된 에이전트, 매물 agentId도 정리
          setLiveAgent(null);
          try {
            await updateDoc(doc(db, "RealEstate", item.id), { agentId: null, agentSnapshot: null });
          } catch {}
          return;
        }

        // 2) agentId 없음 → 매물 소유자(userId)로 에이전트 자동 조회
        if (item.userId) {
          const q = query(collection(db, "Agents"), where("userId", "==", item.userId));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const agentData = { id: snap.docs[0].id, ...snap.docs[0].data() };
            setLiveAgent(agentData);
            // RealEstate 문서에 agentId/agentSnapshot 자동 저장 (다음 진입부터 빠르게 로드)
            try {
              await updateDoc(doc(db, "RealEstate", item.id), {
                agentId: agentData.id,
                agentSnapshot: {
                  name: agentData.name || "",
                  company: agentData.company || "",
                  phone: agentData.phone || "",
                  kakaoId: agentData.kakaoId || "",
                  profileImage: agentData.profileImage || null,
                  licenseNumber: agentData.licenseNumber || "",
                  experienceYears: agentData.experienceYears || 0,
                  description: agentData.description || "",
                  city: agentData.city || "",
                  district: agentData.district || "",
                  addressDetail: agentData.addressDetail || "",
                },
              });
              console.log("✅ 에이전트 자동 연결 완료:", agentData.id);
            } catch (updateErr) {
              console.error("에이전트 자동 연결 저장 실패:", updateErr);
            }
            return;
          }
        }

        setLiveAgent(null);
      } catch (e) {
        console.error("에이전트 조회 실패:", e);
        setLiveAgent(null);
      } finally {
        setAgentLoading(false);
      }
    };

    fetchAgent();
  }, [item?.agentId, item?.userId, item?.id]);

  // 유사 매물 5개 + 중개인 매물 3개 조회 (orderBy 없이 JS 정렬로 복합 인덱스 회피)
  useEffect(() => {
    if (!item) return;
    const fetchSimilar = async () => {
      try {
        const q = query(
          collection(db, "RealEstate"),
          where("dealType", "==", item.dealType),
          limit(20)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.id !== item.id)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 5);
        setSimilarItems(results);
      } catch (e) { console.error("유사 매물 조회 실패:", e); }
    };
    const fetchAgentItems = async () => {
      if (!item.userId) return;
      try {
        const q = query(
          collection(db, "RealEstate"),
          where("userId", "==", item.userId),
          limit(10)
        );
        const snap = await getDocs(q);
        const results = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.id !== item.id)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 3);
        setAgentItems(results);
      } catch (e) { console.error("중개인 매물 조회 실패:", e); }
    };
    fetchSimilar();
    fetchAgentItems();
  }, [item?.id, item?.dealType, item?.userId]);

  // ── 모든 Hook을 early return 위에 배치 (Rules of Hooks 준수) ──

  // 채팅하기
  const handleChat = useCallback(() => {
    if (!user || !item) return;
    if (isMyItem) {
      Alert.alert(t('common:notice'), t('detail.ownPost'));
      return;
    }
    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: item.id,
      itemTitle: item.title,
      itemImage: (item.images || [])[0] || null,
      otherUserId: item.userId,
      otherUserName: item.userEmail ? item.userEmail.split("@")[0] : t('detail.poster'),
      sellerId: item.userId,
    });
  }, [user, item, navigation, t]);

  // 📤 SNS 공유 핸들러
  const handleShare = useCallback(async (platform = 'more') => {
    if (!item) return;
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

  // 헤더 설정
  const isMyItem = item?.userId === user?.uid;
  const canDelete = !!(isMyItem || isAdmin());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={handleShare} style={{ marginRight: 16 }}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity onPress={() => {
              // handleDelete는 early return 후 정의되므로 item 유효성을 여기서도 확인
              if (!item) return;
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
                        if (item.images && item.images.length > 0) {
                          for (const imageUrl of item.images) {
                            try {
                              if (imageUrl.includes("firebase")) {
                                const imageRef = ref(storage, imageUrl);
                                await deleteObject(imageRef);
                              }
                            } catch (imgError) { }
                          }
                        }
                        await deleteDoc(doc(db, "RealEstate", item.id));
                        Alert.alert(t('detail.complete'), t('detail.deleteSuccess'), [
                          { text: t('common:confirm'), onPress: () => navigation.goBack() },
                        ]);
                      } catch (error) {
                        Alert.alert(t('common:error'), t('detail.deleteFailed'));
                      }
                    },
                  },
                ]
              );
            }}>
              <Ionicons name="trash-outline" size={24} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [navigation, canDelete, handleShare, item, t]);

  // ── 여기서부터 early return (모든 Hook 호출 완료) ──

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

  // ── item 확정 후 사용되는 변수들 ──
  const images = item.images || [];
  const canEdit = !!(isMyItem || isAdmin());

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

  // 거래완료 처리 (item 확정 후)
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

  // 채팅하기 / 공유 / 헤더 → 이미 위에서 Hook으로 정의됨

  // 전화걸기
  const handleCall = () => {
    if (!item.contact) {
      Alert.alert(t('common:notice'), t('detail.noContact'));
      return;
    }

    const phoneNumber = item.contact.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // 수정하기
  const handleEdit = () => {
    navigation.navigate("부동산 등록", { editItem: item });
  };

  // 헤더 설정 → 이미 위에서 useLayoutEffect로 정의됨

  const badge = getTypeBadge(item.dealType);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 상단 광고 */}
        <DetailAdBanner position="top" screen="realestate" />

        {/* 이미지 영역 — 히어로 스타일 */}
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

            {/* 하단 그라데이션 오버레이 */}
            <View style={styles.heroGradient} pointerEvents="none" />

            {/* 좌하단 배지 */}
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
                <Text style={styles.heroBadgeText}>{currentStatus}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.heroBadgeText, { color: badge.color }]}>{badge.text}</Text>
              </View>
              {item.propertyType && (
                <View style={[styles.heroBadge, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
                  <Text style={[styles.heroBadgeText, { color: "#555" }]}>{item.propertyType}</Text>
                </View>
              )}
            </View>

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

        {/* 메인 정보 */}
        <View style={styles.mainInfo}>
          {/* 제목 */}
          <TranslatedText style={styles.title}>{item.title}</TranslatedText>

          {/* 가격 정보 — 크게 강조 */}
          <View style={styles.priceSection}>
            {item.dealType === "임대" ? (
              <View style={styles.priceGrid}>
                <View style={styles.priceGridItem}>
                  <Text style={styles.priceGridLabel}>{t('detail.deposit')}</Text>
                  <Text style={styles.priceGridValue}>{displayPrice(item.deposit)}</Text>
                </View>
                <View style={styles.priceGridDivider} />
                <View style={styles.priceGridItem}>
                  <Text style={styles.priceGridLabel}>{t('detail.monthlyRent')}</Text>
                  <Text style={styles.priceGridValue}>{displayPrice(item.monthlyRent)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('detail.salePrice')}</Text>
                <Text style={styles.priceValue}>{displayPrice(item.price)}</Text>
              </View>
            )}
          </View>

          {/* 스펙 바: 면적 · 방 · 층 */}
          <View style={styles.specBar}>
            {item.area ? (
              <View style={styles.specItem}>
                <Ionicons name="resize-outline" size={16} color="#E91E63" />
                <Text style={styles.specVal}>{item.area}㎡</Text>
                <Text style={styles.specKey}>면적</Text>
              </View>
            ) : null}
            {item.rooms ? (
              <>
                <View style={styles.specDivider} />
                <View style={styles.specItem}>
                  <Ionicons name="bed-outline" size={16} color="#9C27B0" />
                  <Text style={styles.specVal}>{item.rooms}</Text>
                  <Text style={styles.specKey}>방/화장실</Text>
                </View>
              </>
            ) : null}
            {item.floor ? (
              <>
                <View style={styles.specDivider} />
                <View style={styles.specItem}>
                  <Ionicons name="layers-outline" size={16} color="#FF9800" />
                  <Text style={styles.specVal}>{item.floor}</Text>
                  <Text style={styles.specKey}>층</Text>
                </View>
              </>
            ) : null}
            {(item.city || item.district) ? (
              <>
                <View style={styles.specDivider} />
                <View style={styles.specItem}>
                  <Ionicons name="location-outline" size={16} color="#4CAF50" />
                  <Text style={styles.specVal} numberOfLines={1}>
                    {item.district || item.city}
                  </Text>
                  <Text style={styles.specKey}>위치</Text>
                </View>
              </>
            ) : null}
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

        {/* 🗺️ 위치 지도 */}
        {(item.city || item.district) && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>🗺️ {t('detail.location')}</Text>
            <LocationMap
              city={item.city}
              district={item.district}
            />
          </View>
        )}

        {/* 상세 설명 */}
        <View style={styles.descriptionCard}>
          <Text style={styles.cardTitle}>📝 {t('detail.description')}</Text>
          <TranslatedText style={styles.description}>
            {item.description || t('detail.noDescription')}
          </TranslatedText>
        </View>

        {/* 매물 소개 영상 */}
        {item.youtubeUrl && (
          <YouTubeCard
            youtubeUrl={item.youtubeUrl}
            label="📹 매물 소개 영상"
          />
        )}

        {/* 중개인 카드 — Agents 컬렉션 실시간 조회 결과만 사용 (삭제된 에이전트 자동 숨김) */}
        {agentLoading ? (
          <View style={styles.noAgentCard}>
            <ActivityIndicator size="small" color="#E91E63" style={{ marginVertical: 12 }} />
          </View>
        ) : liveAgent ? (
          <AgentCard
            agent={liveAgent}
            onEdit={isMyItem ? () => navigation.navigate("중개인 등록", {
              editAgent: liveAgent
            }) : null}
          />
        ) : (
          <View style={styles.noAgentCard}>
            <View style={styles.noAgentHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#E91E63" />
              <Text style={styles.noAgentTitle}>🏢 담당 중개인</Text>
            </View>
            <View style={styles.noAgentBody}>
              <Ionicons name="person-circle-outline" size={48} color="#ddd" />
              <Text style={styles.noAgentText}>등록된 중개인 정보가 없습니다.</Text>
              {isMyItem && (
                <TouchableOpacity
                  style={styles.noAgentBtn}
                  onPress={() => navigation.navigate("중개인 등록")}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#E91E63" />
                  <Text style={styles.noAgentBtnText}>중개인 프로필 등록하기</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

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

        {/* 중간 광고 — 매물 정보 하단 */}
        <DetailAdBanner position="middle" screen="realestate" />

        {/* 유사 매물 5개 */}
        {similarItems.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>🏠 비슷한 매물</Text>
            {similarItems.map(sim => (
              <TouchableOpacity
                key={sim.id}
                style={styles.relatedCard}
                onPress={() => navigation.push("부동산 상세", { item: sim })}
              >
                {sim.images?.[0] ? (
                  <Image source={{ uri: sim.images[0] }} style={styles.relatedThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.relatedThumb, styles.relatedThumbFallback]}>
                    <Ionicons name="home-outline" size={22} color="#ccc" />
                  </View>
                )}
                <View style={styles.relatedInfo}>
                  <Text style={styles.relatedItemTitle} numberOfLines={1}>{sim.title}</Text>
                  <Text style={styles.relatedItemSub} numberOfLines={1}>
                    {sim.dealType} · {sim.city} {sim.district}
                  </Text>
                  <Text style={styles.relatedItemPrice} numberOfLines={1}>
                    {sim.dealType === "임대"
                      ? `보증금 ${sim.deposit || "-"} / 월세 ${sim.monthlyRent || "-"}`
                      : `매매 ${sim.price || "-"}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 중개인 등록 매물 3개 */}
        {agentItems.length > 0 && liveAgent && (
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>👤 {liveAgent.name} 중개인의 다른 매물</Text>
            {agentItems.map(ag => (
              <TouchableOpacity
                key={ag.id}
                style={styles.relatedCard}
                onPress={() => navigation.push("부동산 상세", { item: ag })}
              >
                {ag.images?.[0] ? (
                  <Image source={{ uri: ag.images[0] }} style={styles.relatedThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.relatedThumb, styles.relatedThumbFallback]}>
                    <Ionicons name="home-outline" size={22} color="#ccc" />
                  </View>
                )}
                <View style={styles.relatedInfo}>
                  <Text style={styles.relatedItemTitle} numberOfLines={1}>{ag.title}</Text>
                  <Text style={styles.relatedItemSub} numberOfLines={1}>
                    {ag.dealType} · {ag.city} {ag.district}
                  </Text>
                  <Text style={styles.relatedItemPrice} numberOfLines={1}>
                    {ag.dealType === "임대"
                      ? `보증금 ${ag.deposit || "-"} / 월세 ${ag.monthlyRent || "-"}`
                      : `매매 ${ag.price || "-"}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 최하단 광고 */}
        <DetailAdBanner position="bottom" screen="realestate" style={{ marginTop: 4 }} />

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
    height: 300,
    backgroundColor: "#111",
    position: "relative",
  },
  image: {
    width: SCREEN_WIDTH,
    height: 300,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: "transparent",
    // react-native 에서 linear-gradient 없이 단순 반투명 오버레이
  },
  heroBadges: {
    position: "absolute",
    bottom: 14,
    left: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  imageIndicator: {
    position: "absolute",
    bottom: 14,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  imageIndicatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  noImageContainer: {
    width: SCREEN_WIDTH,
    height: 220,
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
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1A1A2E",
    lineHeight: 28,
    marginBottom: 12,
  },
  priceSection: {
    backgroundColor: "#FFF8F8",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  priceGrid: {
    flexDirection: "row",
  },
  priceGridItem: {
    flex: 1,
    padding: 14,
    alignItems: "center",
  },
  priceGridDivider: {
    width: 1,
    backgroundColor: "#FFE0E8",
    marginVertical: 8,
  },
  priceGridLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  priceGridValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#E91E63",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  priceLabel: {
    fontSize: 14,
    color: "#666",
  },
  priceValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#E91E63",
  },
  specBar: {
    flexDirection: "row",
    backgroundColor: "#F8F9FF",
    borderRadius: 12,
    marginBottom: 12,
    paddingVertical: 4,
  },
  specItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    gap: 3,
  },
  specDivider: {
    width: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: 8,
  },
  specVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  specKey: {
    fontSize: 10,
    color: "#888",
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
  noAgentCard: {
    backgroundColor: "#fff",
    marginTop: 8,
    padding: 16,
  },
  noAgentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  noAgentTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  noAgentBody: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  noAgentText: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  noAgentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "#FCE4EC",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  noAgentBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#E91E63",
  },

  // 유사 매물 섹션
  relatedSection: {
    marginHorizontal: 12,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  relatedTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  relatedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
  },
  relatedThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  relatedThumbFallback: {
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  relatedInfo: { flex: 1 },
  relatedItemTitle: { fontSize: 14, fontWeight: "600", color: "#222" },
  relatedItemSub: { fontSize: 12, color: "#888", marginTop: 2 },
  relatedItemPrice: { fontSize: 13, color: "#E91E63", fontWeight: "700", marginTop: 3 },
});
