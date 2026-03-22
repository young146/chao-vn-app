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
  Share,
  ActivityIndicator,
} from "react-native";
import { Ionicons, FontAwesome } from "@expo/vector-icons";
import { Image } from "expo-image";
import ImageViewing from "react-native-image-viewing";
import { useTranslation } from "react-i18next";
import {
  doc,
  deleteDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { DetailAdBanner, PopupAd } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import LocationMap from "../components/LocationMap";
import YouTubeCard from "../components/YouTubeCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function JobDetailScreen({ route, navigation }) {
  const { job: initialJob, id: deepLinkId } = route.params || {};
  const { user, isAdmin } = useAuth();
  const { t, i18n } = useTranslation(['jobs', 'common']);

  const [job, setJob] = useState(initialJob || null);
  const [loadingJob, setLoadingJob] = useState(!initialJob);
  const [jobNotFound, setJobNotFound] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentStatus, setCurrentStatus] = useState(initialJob?.status || "모집중");
  const [showPopup, setShowPopup] = useState(true); // 🎯 상세 진입 시 바로 팝업 표시
  const [isImageViewVisible, setIsImageViewVisible] = useState(false); // 🔍 이미지 확대 뷰어

  // ✅ 딥링크를 통해 ID만 전달된 경우 데이터 패치
  useEffect(() => {
    if (!initialJob && deepLinkId) {
      const fetchJob = async () => {
        try {
          const docRef = doc(db, "Jobs", deepLinkId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = { id: docSnap.id, ...docSnap.data() };
            setJob(data);
            setCurrentStatus(data.status || "모집중");
          } else {
            setJobNotFound(true);
          }
        } catch (error) {
          console.error("아이템 불러오기 실패:", error);
          setJobNotFound(true);
        } finally {
          setLoadingJob(false);
        }
      };
      fetchJob();
    } else if (!initialJob && !deepLinkId) {
      setJobNotFound(true);
      setLoadingJob(false);
    }
  }, [initialJob, deepLinkId]);

  // ── 모든 Hook을 early return 위에 배치 (Rules of Hooks 준수) ──

  const isMyJob = job?.userId === user?.uid;
  const canDelete = !!(isMyJob || isAdmin());

  const handleChat = useCallback(() => {
    if (!user || !job) return;
    if (isMyJob) {
      Alert.alert(t('common:notice'), t('detail.ownPost'));
      return;
    }
    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: job.id,
      itemTitle: job.title,
      itemImage: (job.images || [])[0] || null,
      otherUserId: job.userId,
      otherUserName: job.userEmail ? job.userEmail.split("@")[0] : t('detail.poster'),
      sellerId: job.userId,
    });
  }, [user, job, navigation, isMyJob, t]);

  const handleShare = useCallback(async (platform = 'more') => {
    if (!job) return;
    const { shareItem } = require('../utils/deepLinkUtils');
    try {
      const result = await shareItem('job', job.id, job, platform);
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
  }, [job, t]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={handleShare} style={{ marginRight: 16 }}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
          {canDelete && (
            <TouchableOpacity onPress={() => {
              if (!job) return;
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
                        if (job.images && job.images.length > 0) {
                          for (const imageUrl of job.images) {
                            try {
                              if (imageUrl.includes("firebase")) {
                                const imageRef = ref(storage, imageUrl);
                                await deleteObject(imageRef);
                              }
                            } catch (imgError) { }
                          }
                        }
                        await deleteDoc(doc(db, "Jobs", job.id));
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
  }, [navigation, canDelete, handleShare, job, t]);

  // ── 여기서부터 early return ──

  if (loadingJob) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (jobNotFound || !job) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 16, color: "#666" }}>{t('common:notFound', '해당 게시물을 찾을 수 없습니다.')}</Text>
        <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: "#FF6B35", borderRadius: 8 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: "#fff", fontWeight: "bold" }}>뒤로 가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── job 확정 후 사용되는 변수들 ──
  const images = job.images || [];
  const canEdit = !!(isMyJob || isAdmin());

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
      case "모집중":
        return "#4CAF50";
      case "마감임박":
        return "#FF9800";
      case "마감":
        return "#9E9E9E";
      default:
        return "#4CAF50";
    }
  };

  const getJobTypeBadge = (jobType) => {
    const isHiring = jobType === "구인";
    return isHiring
      ? { bg: "#E3F2FD", color: "#1976D2", text: t('hiring') }
      : { bg: "#FFF3E0", color: "#E65100", text: t('seeking') };
  };

  // 마감 처리
  const handleMarkAsClosed = async () => {
    Alert.alert(t('detail.markAsClosed'), t('detail.markAsClosedConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:confirm'),
        onPress: async () => {
          try {
            const jobRef = doc(db, "Jobs", job.id);
            await updateDoc(jobRef, {
              status: "마감",
            });
            setCurrentStatus("마감");
            Alert.alert(t('detail.complete'), t('detail.markedAsClosed'));
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert(t('common:error'), t('detail.deleteFailed'));
          }
        },
      },
    ]);
  };

  // 모집중으로 재오픈
  const handleReopen = async () => {
    Alert.alert(t('detail.reopen'), t('detail.reopenConfirm'), [
      { text: t('common:cancel'), style: "cancel" },
      {
        text: t('common:confirm'),
        onPress: async () => {
          try {
            const jobRef = doc(db, "Jobs", job.id);
            await updateDoc(jobRef, {
              status: "모집중",
            });
            setCurrentStatus("모집중");
            Alert.alert(t('detail.complete'), t('detail.reopened'));
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert(t('common:error'), t('detail.deleteFailed'));
          }
        },
      },
    ]);
  };

  // 채팅 / 공유 / 헤더 → 이미 위에서 Hook으로 정의됨

  // 전화걸기
  const handleCall = () => {
    if (!job.contact) {
      Alert.alert(t('common:notice'), t('detail.noContact'));
      return;
    }

    const phoneNumber = job.contact.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // 수정하기
  const handleEdit = () => {
    navigation.navigate("구인구직 등록", { editJob: job });
  };

  // 삭제 / 헤더 → 이미 위에서 Hook으로 정의됨

  const badge = getJobTypeBadge(job.jobType);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 상단 광고 */}
        <DetailAdBanner position="top" screen="job" />

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
            <Ionicons name="briefcase-outline" size={80} color="#ddd" />
            <Text style={styles.noImageText}>{t('detail.noImage')}</Text>
          </View>
        )}

        {/* 광고 배너 */}
        <DetailAdBanner position="top" screen="job" style={{ marginTop: 12 }} />

        {/* 메인 정보 */}
        <View style={styles.mainInfo}>
          {/* 상태 + 구인/구직 배지 */}
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentStatus) }]}>
              <Text style={styles.statusText}>{currentStatus}</Text>
            </View>
            <View style={[styles.jobTypeBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.jobTypeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
            {job.industry && (
              <View style={styles.industryBadge}>
                <TranslatedText style={styles.industryText}>{job.industry}</TranslatedText>
              </View>
            )}
          </View>

          {/* 제목 */}
          <TranslatedText style={styles.title}>{job.title}</TranslatedText>

          {/* 등록 정보 */}
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#888" />
            <Text style={styles.metaText}>
              {job.userEmail ? job.userEmail.split("@")[0] : t('detail.anonymous')}
            </Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{formatDate(job.createdAt)}</Text>
          </View>
        </View>

        {/* 상세 정보 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>📋 {t('detail.detailInfo')}</Text>

          {/* 급여 */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="cash-outline" size={18} color="#4CAF50" />
              <Text style={styles.labelText}>{t('detail.salary')}</Text>
            </View>
            <TranslatedText style={styles.infoValue}>{job.salary || t('detail.negotiable')}</TranslatedText>
          </View>

          {/* 고용 형태 */}
          {job.employmentType && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="time-outline" size={18} color="#2196F3" />
                <Text style={styles.labelText}>{t('detail.employmentType')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{job.employmentType}</TranslatedText>
            </View>
          )}

          {/* 업종 */}
          {job.industry && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="briefcase-outline" size={18} color="#9C27B0" />
                <Text style={styles.labelText}>{t('detail.industry')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{job.industry}</TranslatedText>
            </View>
          )}

          {/* 근무지 */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="location-outline" size={18} color="#FF5722" />
              <Text style={styles.labelText}>{t('detail.workLocation')}</Text>
            </View>
            <TranslatedText style={styles.infoValue}>
              {job.city}{job.district ? ` ${job.district}` : ''}
            </TranslatedText>
          </View>

          {/* 마감일 */}
          {job.deadline && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="calendar-outline" size={18} color="#795548" />
                <Text style={styles.labelText}>{t('detail.deadline')}</Text>
              </View>
              <TranslatedText style={styles.infoValue}>{job.deadline}</TranslatedText>
            </View>
          )}

          {/* 연락처 */}
          {job.contact && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="call-outline" size={18} color="#009688" />
                <Text style={styles.labelText}>{t('detail.contact')}</Text>
              </View>
              <TouchableOpacity onPress={handleCall}>
                <Text style={[styles.infoValue, styles.linkText]}>{job.contact}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 🗺️ 근무지 지도 */}
        {(job.city || job.district) && (
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>🗺️ {t('detail.workLocation')}</Text>
            <LocationMap
              city={job.city}
              district={job.district}
            />
          </View>
        )}

        {/* 상세 내용 */}
        <View style={styles.descriptionCard}>
          <Text style={styles.cardTitle}>📝 {t('detail.description')}</Text>
          <TranslatedText style={styles.description}>
            {job.description || t('detail.noDescription')}
          </TranslatedText>
        </View>

        {/* 자격 요건 */}
        {job.requirements && (
          <View style={styles.descriptionCard}>
            <Text style={styles.cardTitle}>✅ {t('detail.requirements')}</Text>
            <TranslatedText style={styles.description}>{job.requirements}</TranslatedText>
          </View>
        )}

        {/* 소개 영상 */}
        {job.youtubeUrl && (
          <YouTubeCard
            youtubeUrl={job.youtubeUrl}
            label={job.jobType === "구직" ? "📹 자기소개 영상" : "📹 회사/업무 소개 영상"}
          />
        )}

        {/* 내 공고인 경우 관리 버튼 */}
        {isMyJob && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#2196F3" />
              <Text style={styles.editButtonText}>{t('detail.edit')}</Text>
            </TouchableOpacity>

            {currentStatus !== "마감" ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleMarkAsClosed}
              >
                <Ionicons name="close-circle-outline" size={20} color="#FF9800" />
                <Text style={styles.closeButtonText}>{t('detail.markAsClosed')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={handleReopen}
              >
                <Ionicons name="refresh-outline" size={20} color="#4CAF50" />
                <Text style={styles.reopenButtonText}>{t('detail.reopen')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 관리자 수정 버튼 (내 공고가 아닐 때만) */}
        {!isMyJob && isAdmin() && (
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
        <DetailAdBanner position="bottom" screen="job" />

        {/* 📤 SNS 공유 섹션 */}
        <View style={styles.shareSection}>
          <Text style={styles.shareTitle}>📤 이 게시물 공유하기</Text>
          <View style={styles.shareButtons}>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#FEE500' }]}
              onPress={() => handleShare('kakao')}
            >
              <Text style={styles.kakaoShareIcon}>💬</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#0068FF' }]}
              onPress={() => handleShare('zalo')}
            >
              <Text style={styles.zaloShareIcon}>Z</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#1877F2' }]}
              onPress={() => handleShare('facebook')}
            >
              <FontAwesome name="facebook" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#FF6B35' }]}
              onPress={() => handleShare('more')}
            >
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* 하단 액션 바 */}
      {!isMyJob && (
        <View style={styles.bottomBar}>
          {job.contact && (
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Ionicons name="call" size={22} color="#fff" />
              <Text style={styles.callButtonText}>{t('detail.call')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.chatButton, !job.contact && { flex: 1 }]}
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
        screen="job"
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
  jobTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jobTypeText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  industryBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  industryText: {
    fontSize: 12,
    color: "#666",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 28,
    marginBottom: 8,
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
    color: "#2196F3",
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
    backgroundColor: "#E3F2FD",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
  },
  closeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF3E0",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF9800",
  },
  reopenButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  reopenButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
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
    backgroundColor: "#2196F3",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  // 📤 SNS 공유 섹션
  shareSection: {
    margin: 16,
    marginTop: 12,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  shareButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  shareButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  kakaoShareIcon: {
    fontSize: 26,
  },
  zaloShareIcon: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
});
