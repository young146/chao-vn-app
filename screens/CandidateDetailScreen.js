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
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import { DetailAdBanner, PopupAd } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import YouTubeCard from "../components/YouTubeCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ACCENT = "#FF7043";

// 언어 수준 → 한글 레이블 + 진행률
function getLangMeta(level) {
  const map = {
    "원어민": { label: "원어민", pct: 1.0, color: "#FF7043" },
    "고급":   { label: "고급",   pct: 0.8, color: "#FF9800" },
    "중급":   { label: "중급",   pct: 0.6, color: "#2196F3" },
    "초급":   { label: "초급",   pct: 0.35, color: "#9E9E9E" },
    "없음":   { label: "없음",   pct: 0.05, color: "#E0E0E0" },
  };
  return map[level] || map["없음"];
}

export default function CandidateDetailScreen({ route, navigation }) {
  const { candidate: initialCandidate, id: deepLinkId } = route.params || {};
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation(["jobs", "common"]);

  const [candidate, setCandidate] = useState(initialCandidate || null);
  const [loading, setLoading] = useState(!initialCandidate);
  const [notFound, setNotFound] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(
    initialCandidate?.status || "신규 등록"
  );
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageViewVisible, setIsImageViewVisible] = useState(false);
  const [showPopup, setShowPopup] = useState(true);

  // ── 딥링크 ID로 데이터 패치 ──
  useEffect(() => {
    if (!initialCandidate && deepLinkId) {
      const fetch = async () => {
        try {
          const snap = await getDoc(doc(db, "candidates", deepLinkId));
          if (snap.exists()) {
            setCandidate({ id: snap.id, ...snap.data() });
            setCurrentStatus(snap.data().status || "신규 등록");
          } else {
            setNotFound(true);
          }
        } catch {
          setNotFound(true);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    } else if (!initialCandidate && !deepLinkId) {
      setNotFound(true);
      setLoading(false);
    }
  }, [initialCandidate, deepLinkId]);

  const isMyProfile = candidate?.userId === user?.uid;
  const canManage = !!(isMyProfile || isAdmin());

  // ── 헤더 버튼 ──
  useLayoutEffect(() => {
    if (!candidate) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: "row", gap: 4, marginRight: 8 }}>
          {canManage && (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      ),
    });
  }, [candidate, canManage, navigation]);

  // ── 삭제 ──
  const handleDelete = () => {
    Alert.alert("삭제", "이 프로필을 삭제하시겠습니까?", [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: t("common:delete"),
        style: "destructive",
        onPress: async () => {
          try {
            const images = candidate.images || candidate.imageUrls || [];
            for (const url of images) {
              if (!url.startsWith("https://firebasestorage")) continue;
              try { await deleteObject(ref(storage, url)); } catch {}
            }
            await deleteDoc(doc(db, "candidates", candidate.id));
            Alert.alert("완료", "프로필이 삭제되었습니다.", [
              { text: "확인", onPress: () => navigation.goBack() },
            ]);
          } catch {
            Alert.alert(t("common:error"), "삭제에 실패했습니다.");
          }
        },
      },
    ]);
  };

  // ── 수정 ──
  const handleEdit = () => {
    navigation.navigate("구직자 등록", {
      editCandidate: { ...candidate, id: candidate.id },
    });
  };

  // ── 전화 ──
  const handleCall = () => {
    const phone = candidate?.profile?.phone || candidate?.contact || "";
    if (!phone) { Alert.alert("안내", "연락처가 없습니다."); return; }
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`);
  };

  // ── 상태 변경 ──
  const handleStatusChange = async (newStatus) => {
    try {
      await updateDoc(doc(db, "candidates", candidate.id), { status: newStatus });
      setCurrentStatus(newStatus);
    } catch {
      Alert.alert(t("common:error"), "상태 변경에 실패했습니다.");
    }
  };

  // ── 이력서 열기 ──
  const handleOpenResume = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() =>
      Alert.alert("오류", "파일을 열 수 없습니다.")
    );
  };

  // ── 로딩 / 에러 처리 ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }
  if (notFound || !candidate) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
        <Text style={styles.notFoundText}>프로필을 찾을 수 없습니다.</Text>
      </View>
    );
  }

  // ── 로그인 게이트: 비로그인 시 연락처/이력서 숨김 ──
  const isLoggedIn = !!user;

  // ── 데이터 분해 ──
  const profile      = candidate.profile || {};
  const lang         = candidate.language || {};
  const career       = candidate.career || {};
  const comp         = candidate.compensation || {};
  const workEl       = candidate.workEligibility || {};
  const images       = candidate.images || candidate.imageUrls || [];
  const resumeUrl    = candidate.resumeUrl || null;
  const resumeName   = candidate.resumeFileName || "이력서 파일";
  const name         = profile.name || candidate.name || "이름 미입력";
  const nationality  = profile.nationality || "";
  const phone        = profile.phone || "";
  const email        = profile.email || "";
  const location     = profile.desiredLocation || candidate.city || "";
  const korLvl       = getLangMeta(lang.korean   || "없음");
  const vietLvl      = getLangMeta(lang.vietnamese|| "없음");
  const engLvl       = getLangMeta(lang.english   || "없음");
  const jobTracks    = career.jobTracks || [];
  const expYears     = career.experienceYears ?? null;
  const education    = career.education || "";
  const skills       = career.skills || "";
  const visa         = workEl.visaStatus || "";
  const salaryUsd    = comp.desiredSalaryUsdPerMonth || null;

  const statusColors = {
    "신규 등록": "#4CAF50",
    "검토중":   "#FF9800",
    "매칭완료": "#2196F3",
    "보류":     "#9E9E9E",
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── 상단 광고 ── */}
        <DetailAdBanner position="top" screen="job" />

        {/* ── 이미지 갤러리 ── */}
        {images.length > 0 ? (
          <View style={styles.imageContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                setCurrentImageIndex(idx);
              }}
              scrollEventThrottle={16}
            >
              {images.map((uri, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.9}
                  onPress={() => { setCurrentImageIndex(i); setIsImageViewVisible(true); }}
                >
                  <Image source={{ uri }} style={styles.image} contentFit="cover" transition={200} />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* 하단 배지 오버레이 */}
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: statusColors[currentStatus] || "#9E9E9E" }]}>
                <Text style={styles.heroBadgeText}>{currentStatus}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: "#FFF3E0" }]}>
                <Text style={[styles.heroBadgeText, { color: "#E65100" }]}>구직</Text>
              </View>
              {nationality ? (
                <View style={[styles.heroBadge, { backgroundColor: "rgba(255,255,255,0.92)" }]}>
                  <Text style={[styles.heroBadgeText, { color: "#555" }]}>{nationality}</Text>
                </View>
              ) : null}
            </View>

            {images.length > 1 && (
              <View style={styles.imageIndicator}>
                <Text style={styles.imageIndicatorText}>
                  {currentImageIndex + 1} / {images.length}
                </Text>
              </View>
            )}
            <ImageViewing
              images={images.map((uri) => ({ uri }))}
              imageIndex={currentImageIndex}
              visible={isImageViewVisible}
              onRequestClose={() => setIsImageViewVisible(false)}
            />
          </View>
        ) : (
          <View style={styles.bannerContainer}>
            <Image
              source={require("../assets/og_jobs_seeker.png")}
              style={{ width: "100%", height: 200 }}
              contentFit="cover"
            />
            <View style={styles.heroBadges}>
              <View style={[styles.heroBadge, { backgroundColor: statusColors[currentStatus] || "#9E9E9E" }]}>
                <Text style={styles.heroBadgeText}>{currentStatus}</Text>
              </View>
              <View style={[styles.heroBadge, { backgroundColor: "#FFF3E0" }]}>
                <Text style={[styles.heroBadgeText, { color: "#E65100" }]}>구직</Text>
              </View>
              {nationality ? (
                <View style={[styles.heroBadge, { backgroundColor: "rgba(255,255,255,0.9)" }]}>
                  <Text style={[styles.heroBadgeText, { color: "#555" }]}>{nationality}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* ── 프로필 헤더 ── */}
        <View style={styles.profileHeader}>
          <Text style={styles.name}>{name}</Text>

          <View style={styles.metaRow}>
            {location ? (
              <>
                <Ionicons name="location-outline" size={14} color="#888" />
                <Text style={styles.metaText}>{location} 희망</Text>
                <Text style={styles.metaDivider}>·</Text>
              </>
            ) : null}
            {expYears !== null ? (
              <>
                <Ionicons name="briefcase-outline" size={14} color="#888" />
                <Text style={styles.metaText}>경력 {expYears}년</Text>
              </>
            ) : null}
          </View>

          {/* 스펙 그리드 */}
          <View style={styles.specBar}>
            <View style={styles.specItem}>
              <Ionicons name="language-outline" size={16} color="#FF7043" />
              <Text style={styles.specVal} numberOfLines={1}>
                {[
                  lang.korean && lang.korean !== "없음" ? "한국어" : null,
                  lang.vietnamese && lang.vietnamese !== "없음" ? "베트남어" : null,
                  lang.english && lang.english !== "없음" ? "영어" : null,
                ].filter(Boolean).join("/") || "-"}
              </Text>
              <Text style={styles.specKey}>언어</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Ionicons name="card-outline" size={16} color="#2196F3" />
              <Text style={styles.specVal} numberOfLines={1}>{visa || "-"}</Text>
              <Text style={styles.specKey}>비자</Text>
            </View>
            <View style={styles.specDivider} />
            <View style={styles.specItem}>
              <Ionicons name="time-outline" size={16} color="#9C27B0" />
              <Text style={styles.specVal}>{expYears !== null ? `${expYears}년` : "-"}</Text>
              <Text style={styles.specKey}>경력</Text>
            </View>
          </View>

          {/* 희망 급여 */}
          {salaryUsd ? (
            <View style={styles.salaryBox}>
              <Ionicons name="cash-outline" size={20} color={ACCENT} />
              <Text style={styles.salaryText}>
                희망 급여 ${salaryUsd.toLocaleString()} USD / 월
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── 언어 능력 ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌐 언어 능력</Text>
          {[
            { flag: "🇰🇷", label: "한국어", meta: korLvl },
            { flag: "🇻🇳", label: "베트남어", meta: vietLvl },
            { flag: "🇺🇸", label: "영어",   meta: engLvl },
          ].map(({ flag, label, meta }) => (
            <View key={label} style={styles.langRow}>
              <Text style={styles.langFlag}>{flag}</Text>
              <Text style={styles.langLabel}>{label}</Text>
              <View style={styles.langBarTrack}>
                <View style={[styles.langBarFill, { width: `${meta.pct * 100}%`, backgroundColor: meta.color }]} />
              </View>
              <Text style={[styles.langLevel, { color: meta.color }]}>{meta.label}</Text>
            </View>
          ))}
        </View>

        {/* ── 희망 직무 ── */}
        {jobTracks.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>💼 희망 직무</Text>
            <View style={styles.tagRow}>
              {jobTracks.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 경력 / 학력 / 기술 ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 경력 및 학력</Text>
          {expYears !== null && (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="time-outline" size={18} color="#888" />
                <Text style={styles.labelText}>경력</Text>
              </View>
              <Text style={styles.infoValue}>{expYears}년</Text>
            </View>
          )}
          {education ? (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="school-outline" size={18} color="#888" />
                <Text style={styles.labelText}>학력</Text>
              </View>
              <Text style={styles.infoValue}>{education}</Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="location-outline" size={18} color="#888" />
                <Text style={styles.labelText}>희망 근무지</Text>
              </View>
              <Text style={styles.infoValue}>{location}</Text>
            </View>
          ) : null}
          {skills ? (
            <View style={[styles.infoRow, { alignItems: "flex-start" }]}>
              <View style={[styles.infoLabel, { marginTop: 2 }]}>
                <Ionicons name="star-outline" size={18} color="#888" />
                <Text style={styles.labelText}>기술/자격</Text>
              </View>
              <Text style={[styles.infoValue, { flex: 1, flexWrap: "wrap" }]}>{skills}</Text>
            </View>
          ) : null}
        </View>

        {/* ── 비자 상태 ── */}
        {visa ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🪪 비자 및 근무 자격</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <Ionicons name="card-outline" size={18} color="#888" />
                <Text style={styles.labelText}>비자</Text>
              </View>
              <Text style={[styles.infoValue, { color: "#2E7D32", fontWeight: "700" }]}>{visa}</Text>
            </View>
            {nationality ? (
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <Ionicons name="flag-outline" size={18} color="#888" />
                  <Text style={styles.labelText}>국적</Text>
                </View>
                <Text style={styles.infoValue}>{nationality}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── 중간 광고 ── */}
        <DetailAdBanner position="middle" screen="job" />

        {/* ── 연락처 (로그인 전용) ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📞 연락처</Text>
          {isLoggedIn ? (
            <>
              {phone ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabel}>
                    <Ionicons name="call-outline" size={18} color="#888" />
                    <Text style={styles.labelText}>전화</Text>
                  </View>
                  <TouchableOpacity onPress={handleCall}>
                    <Text style={[styles.infoValue, styles.linkText]}>{phone}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {email ? (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabel}>
                    <Ionicons name="mail-outline" size={18} color="#888" />
                    <Text style={styles.labelText}>이메일</Text>
                  </View>
                  <TouchableOpacity onPress={() => Linking.openURL(`mailto:${email}`)}>
                    <Text style={[styles.infoValue, styles.linkText]}>{email}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {!phone && !email && (
                <Text style={styles.noDataText}>연락처 정보가 없습니다.</Text>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => navigation.navigate("로그인")}
            >
              <Ionicons name="lock-closed-outline" size={20} color={ACCENT} />
              <Text style={styles.loginPromptText}>
                로그인하면 연락처를 확인할 수 있습니다
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 이력서 파일 (로그인 전용) ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📄 이력서 / 포트폴리오</Text>
          {isLoggedIn ? (
            resumeUrl ? (
              <TouchableOpacity
                style={styles.resumeBox}
                onPress={() => handleOpenResume(resumeUrl)}
              >
                <View style={styles.resumeIconWrap}>
                  <Ionicons name="document-text" size={28} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeFileName}>{resumeName}</Text>
                  <Text style={styles.resumeMeta}>탭하여 열기</Text>
                </View>
                <Ionicons name="open-outline" size={22} color="#2196F3" />
              </TouchableOpacity>
            ) : (
              <View style={styles.resumeEmpty}>
                <Ionicons name="document-outline" size={36} color="#ccc" />
                <Text style={styles.resumeEmptyText}>등록된 이력서 파일이 없습니다.</Text>
              </View>
            )
          ) : (
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => navigation.navigate("로그인")}
            >
              <Ionicons name="lock-closed-outline" size={20} color={ACCENT} />
              <Text style={styles.loginPromptText}>
                로그인하면 이력서를 확인할 수 있습니다
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 자기소개 ── */}
        {candidate.description ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📝 자기소개</Text>
            <TranslatedText style={styles.description}>
              {candidate.description}
            </TranslatedText>
          </View>
        ) : null}

        {/* ── 자기소개 영상 ── */}
        {candidate.youtubeUrl && (
          <YouTubeCard
            youtubeUrl={candidate.youtubeUrl}
            label="📹 자기소개 영상"
          />
        )}

        {/* ── 내 프로필 관리 버튼 ── */}
        {canManage && (
          <View style={styles.ownerActions}>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={20} color={ACCENT} />
              <Text style={styles.editButtonText}>수정하기</Text>
            </TouchableOpacity>

            {currentStatus !== "매칭완료" ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => handleStatusChange("매칭완료")}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#4CAF50" />
                <Text style={styles.closeButtonText}>매칭 완료</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.reopenButton}
                onPress={() => handleStatusChange("신규 등록")}
              >
                <Ionicons name="refresh-outline" size={20} color="#2196F3" />
                <Text style={styles.reopenButtonText}>구직 재개</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── 관리자 버튼 ── */}
        {!isMyProfile && isAdmin() && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[styles.editButton, { backgroundColor: "#FFF3E0", flex: 1 }]}
              onPress={handleEdit}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#FF9800" />
              <Text style={[styles.editButtonText, { color: "#FF9800" }]}>관리자 수정</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── 최하단 광고 ── */}
        <DetailAdBanner position="bottom" screen="job" style={{ marginTop: 8 }} />

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── 하단 액션 바 ── */}
      {!isMyProfile && (
        <View style={styles.bottomBar}>
          {phone && isLoggedIn && (
            <TouchableOpacity style={styles.callButton} onPress={handleCall}>
              <Ionicons name="call" size={22} color="#fff" />
              <Text style={styles.callButtonText}>전화하기</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.chatButton, (!phone || !isLoggedIn) && { flex: 1 }]}
            onPress={() => {
              if (!user) {
                Alert.alert("안내", "채팅하려면 로그인이 필요합니다.", [
                  { text: "확인" },
                  { text: "로그인", onPress: () => navigation.navigate("로그인") },
                ]);
                return;
              }
              navigation.navigate("ChatRoom", {
                chatRoomId: null,
                itemId: candidate.id,
                itemTitle: name,
                itemImage: images[0] || null,
                otherUserId: candidate.userId,
                otherUserName: candidate.userEmail?.split("@")[0] || "구직자",
                sellerId: candidate.userId,
              });
            }}
          >
            <Ionicons name="chatbubble" size={22} color="#fff" />
            <Text style={styles.chatButtonText}>채팅하기</Text>
          </TouchableOpacity>
        </View>
      )}

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
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  notFoundText: { fontSize: 16, color: "#999" },

  // image
  imageContainer: { width: SCREEN_WIDTH, height: 260, backgroundColor: "#111", position: "relative" },
  image: { width: SCREEN_WIDTH, height: 260 },
  bannerContainer: { width: SCREEN_WIDTH, height: 200, position: "relative" },
  heroBadges: {
    position: "absolute", bottom: 14, left: 12,
    flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  heroBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  heroBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  imageIndicator: {
    position: "absolute", bottom: 14, right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  imageIndicatorText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // profile header
  profileHeader: { backgroundColor: "#fff", padding: 16, marginTop: 8 },
  name: { fontSize: 22, fontWeight: "800", color: "#1A1A2E", marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  metaText: { fontSize: 13, color: "#888", marginLeft: 2 },
  metaDivider: { marginHorizontal: 6, color: "#ddd" },

  // spec bar
  specBar: {
    flexDirection: "row", backgroundColor: "#F8F9FF",
    borderRadius: 12, marginBottom: 12, paddingVertical: 4,
  },
  specItem: { flex: 1, alignItems: "center", paddingVertical: 10, gap: 3 },
  specDivider: { width: 1, backgroundColor: "#E0E0E0", marginVertical: 8 },
  specVal: { fontSize: 12, fontWeight: "700", color: "#333" },
  specKey: { fontSize: 10, color: "#888" },

  salaryBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFF3EE", padding: 12, borderRadius: 10,
  },
  salaryText: { fontSize: 15, fontWeight: "700", color: ACCENT },

  // card
  card: { backgroundColor: "#fff", padding: 16, marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#333", marginBottom: 14 },

  // language bar
  langRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  langFlag: { fontSize: 20, width: 28 },
  langLabel: { fontSize: 13, color: "#666", width: 62 },
  langBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#eee", overflow: "hidden" },
  langBarFill: { height: 8, borderRadius: 4 },
  langLevel: { fontSize: 12, fontWeight: "700", width: 40, textAlign: "right" },

  // tags
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: "#FFF3EE", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { color: "#E64A19", fontSize: 13, fontWeight: "600" },

  // info rows
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  infoLabel: { flexDirection: "row", alignItems: "center", gap: 6, width: 90 },
  labelText: { fontSize: 13, color: "#888" },
  infoValue: { fontSize: 14, fontWeight: "500", color: "#333", flexShrink: 1 },
  linkText: { color: "#2196F3", textDecorationLine: "underline" },
  noDataText: { fontSize: 13, color: "#aaa", textAlign: "center", paddingVertical: 8 },

  // login prompt
  loginPrompt: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFF3EE", borderRadius: 10, padding: 14,
  },
  loginPromptText: { fontSize: 14, color: ACCENT, fontWeight: "600" },

  // resume
  resumeBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1.5, borderColor: "#eee", borderRadius: 12, padding: 14,
    backgroundColor: "#fafafa",
  },
  resumeIconWrap: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: "#FFCCBC",
    alignItems: "center", justifyContent: "center",
  },
  resumeFileName: { fontSize: 14, fontWeight: "600", color: "#222" },
  resumeMeta: { fontSize: 12, color: "#999", marginTop: 3 },
  resumeEmpty: {
    alignItems: "center", gap: 8, padding: 20,
    borderWidth: 1.5, borderColor: "#eee", borderStyle: "dashed",
    borderRadius: 12, backgroundColor: "#fafafa",
  },
  resumeEmptyText: { fontSize: 13, color: "#aaa" },

  // description
  description: { fontSize: 14, lineHeight: 22, color: "#555" },

  // owner actions
  ownerActions: { flexDirection: "row", gap: 8, padding: 16, marginTop: 8 },
  editButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#FFF3EE", borderRadius: 10, paddingVertical: 12,
  },
  editButtonText: { color: ACCENT, fontWeight: "700" },
  closeButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#E8F5E9", borderRadius: 10, paddingVertical: 12,
  },
  closeButtonText: { color: "#2E7D32", fontWeight: "700" },
  reopenButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#E3F2FD", borderRadius: 10, paddingVertical: 12,
  },
  reopenButtonText: { color: "#1565C0", fontWeight: "700" },

  // header btn
  headerBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  // bottom bar
  bottomBar: {
    flexDirection: "row", padding: 12, paddingBottom: 24,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eee", gap: 10,
  },
  callButton: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#FF7043", borderRadius: 12, paddingVertical: 14,
  },
  callButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  chatButton: {
    flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, backgroundColor: "#2196F3", borderRadius: 12, paddingVertical: 14,
  },
  chatButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
