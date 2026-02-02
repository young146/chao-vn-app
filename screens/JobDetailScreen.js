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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import AdBanner from "../components/AdBanner";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function JobDetailScreen({ route, navigation }) {
  const { job } = route.params;
  const { user, isAdmin } = useAuth();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [currentStatus, setCurrentStatus] = useState(job.status || "모집중");

  const images = job.images || [];
  const isMyJob = job.userId === user?.uid;
  const canDelete = isMyJob || isAdmin();
  const canEdit = isMyJob;

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

    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

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
    return jobType === "구인"
      ? { bg: "#E3F2FD", color: "#1976D2", text: "구인" }
      : { bg: "#FFF3E0", color: "#E65100", text: "구직" };
  };

  // 마감 처리
  const handleMarkAsClosed = async () => {
    Alert.alert("마감 처리", "이 공고를 마감으로 표시하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        onPress: async () => {
          try {
            const jobRef = doc(db, "Jobs", job.id);
            await updateDoc(jobRef, {
              status: "마감",
            });
            setCurrentStatus("마감");
            Alert.alert("완료", "마감으로 표시되었습니다!");
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert("오류", "상태 변경에 실패했습니다.");
          }
        },
      },
    ]);
  };

  // 모집중으로 재오픈
  const handleReopen = async () => {
    Alert.alert("재오픈", "이 공고를 다시 모집중으로 변경하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "확인",
        onPress: async () => {
          try {
            const jobRef = doc(db, "Jobs", job.id);
            await updateDoc(jobRef, {
              status: "모집중",
            });
            setCurrentStatus("모집중");
            Alert.alert("완료", "모집중으로 변경되었습니다!");
          } catch (error) {
            console.error("상태 변경 실패:", error);
            Alert.alert("오류", "상태 변경에 실패했습니다.");
          }
        },
      },
    ]);
  };

  // 채팅하기
  const handleChat = useCallback(() => {
    if (!user) {
      Alert.alert("알림", "로그인이 필요합니다.", [
        { text: "확인" },
        { text: "로그인하기", onPress: () => navigation.navigate("로그인") },
      ]);
      return;
    }

    if (isMyJob) {
      Alert.alert("알림", "본인이 등록한 공고입니다.");
      return;
    }

    navigation.navigate("ChatRoom", {
      chatRoomId: null,
      itemId: job.id,
      itemTitle: job.title,
      itemImage: images[0] || null,
      otherUserId: job.userId,
      otherUserName: job.userEmail ? job.userEmail.split("@")[0] : "담당자",
      sellerId: job.userId,
    });
  }, [user, job, images, navigation, isMyJob]);

  // 전화걸기
  const handleCall = () => {
    if (!job.contact) {
      Alert.alert("알림", "연락처 정보가 없습니다.");
      return;
    }

    const phoneNumber = job.contact.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // 공유하기
  const handleShare = async () => {
    try {
      await Share.share({
        message: `[${job.jobType}] ${job.title}\n\n📍 ${job.city}${job.district ? ` ${job.district}` : ''}\n💰 ${job.salary || '급여 협의'}\n\n씬짜오 베트남 앱에서 확인하세요!`,
      });
    } catch (error) {
      console.error("공유 실패:", error);
    }
  };

  // 수정하기
  const handleEdit = () => {
    navigation.navigate("Jobs등록", { editJob: job });
  };

  // 삭제하기
  const handleDelete = () => {
    Alert.alert(
      "삭제 확인",
      "이 공고를 삭제하시겠습니까?\n삭제된 공고는 복구할 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              // 이미지 삭제
              if (job.images && job.images.length > 0) {
                for (const imageUrl of job.images) {
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

              await deleteDoc(doc(db, "Jobs", job.id));

              Alert.alert("삭제 완료", "공고가 삭제되었습니다.", [
                { text: "확인", onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error("삭제 실패:", error);
              Alert.alert("오류", "삭제에 실패했습니다.");
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

  const badge = getJobTypeBadge(job.jobType);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={200}
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
          </View>
        ) : (
          <View style={styles.noImageContainer}>
            <Ionicons name="briefcase-outline" size={80} color="#ddd" />
            <Text style={styles.noImageText}>등록된 이미지가 없습니다</Text>
          </View>
        )}

        {/* 광고 배너 */}
        <AdBanner position="job_detail" style={{ marginHorizontal: 16, marginTop: 12, borderRadius: 8 }} />

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
                <Text style={styles.industryText}>{job.industry}</Text>
              </View>
            )}
          </View>

          {/* 제목 */}
          <Text style={styles.title}>{job.title}</Text>

          {/* 등록 정보 */}
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#888" />
            <Text style={styles.metaText}>
              {job.userEmail ? job.userEmail.split("@")[0] : "익명"}
            </Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.metaText}>{formatDate(job.createdAt)}</Text>
          </View>
        </View>

        {/* 상세 정보 카드 */}
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle}>📋 상세 정보</Text>

          {/* 급여 */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="cash-outline" size={18} color="#4CAF50" />
              <Text style={styles.labelText}>급여</Text>
            </View>
            <Text style={styles.infoValue}>{job.salary || "협의"}</Text>
          </View>

          {/* 고용 형태 */}
          {job.employmentType && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="time-outline" size={18} color="#2196F3" />
                <Text style={styles.labelText}>고용 형태</Text>
              </View>
              <Text style={styles.infoValue}>{job.employmentType}</Text>
            </View>
          )}

          {/* 업종 */}
          {job.industry && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="briefcase-outline" size={18} color="#9C27B0" />
                <Text style={styles.labelText}>업종</Text>
              </View>
              <Text style={styles.infoValue}>{job.industry}</Text>
            </View>
          )}

          {/* 근무지 */}
          <View style={styles.infoRow}>
            <View style={styles.infoLabel}>
              <Ionicons name="location-outline" size={18} color="#FF5722" />
              <Text style={styles.labelText}>근무지</Text>
            </View>
            <Text style={styles.infoValue}>
              {job.city}{job.district ? ` ${job.district}` : ''}
            </Text>
          </View>

          {/* 마감일 */}
          {job.deadline && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="calendar-outline" size={18} color="#795548" />
                <Text style={styles.labelText}>마감일</Text>
              </View>
              <Text style={styles.infoValue}>{job.deadline}</Text>
            </View>
          )}

          {/* 연락처 */}
          {job.contact && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="call-outline" size={18} color="#009688" />
                <Text style={styles.labelText}>연락처</Text>
              </View>
              <TouchableOpacity onPress={handleCall}>
                <Text style={[styles.infoValue, styles.linkText]}>{job.contact}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 상세 내용 */}
        <View style={styles.descriptionCard}>
          <Text style={styles.cardTitle}>📝 상세 내용</Text>
          <Text style={styles.description}>
            {job.description || "상세 내용이 없습니다."}
          </Text>
        </View>

        {/* 자격 요건 */}
        {job.requirements && (
          <View style={styles.descriptionCard}>
            <Text style={styles.cardTitle}>✅ 자격 요건</Text>
            <Text style={styles.description}>{job.requirements}</Text>
          </View>
        )}

        {/* 내 공고인 경우 관리 버튼 */}
        {isMyJob && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#2196F3" />
              <Text style={styles.editButtonText}>수정하기</Text>
            </TouchableOpacity>

            {currentStatus !== "마감" ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleMarkAsClosed}
              >
                <Ionicons name="close-circle-outline" size={20} color="#FF9800" />
                <Text style={styles.closeButtonText}>마감 처리</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={handleReopen}
              >
                <Ionicons name="refresh-outline" size={20} color="#4CAF50" />
                <Text style={styles.reopenButtonText}>재오픈</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 하단 액션 바 */}
      {!isMyJob && (
        <View style={styles.bottomBar}>
          {job.contact && (
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Ionicons name="call" size={22} color="#fff" />
              <Text style={styles.callButtonText}>전화하기</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.chatButton, !job.contact && { flex: 1 }]}
            onPress={handleChat}
          >
            <Ionicons name="chatbubble" size={22} color="#fff" />
            <Text style={styles.chatButtonText}>채팅하기</Text>
          </TouchableOpacity>
        </View>
      )}
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
});
