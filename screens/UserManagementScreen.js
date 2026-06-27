import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "../contexts/AuthContext";
import {
  addToBlacklist,
  removeFromBlacklist,
  banKeyFromUserDoc,
  isBanned as checkBanned,
} from "../lib/blacklist";

export default function UserManagementScreen() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  // 영구 제명(블랙리스트)
  const [selectedUserBanned, setSelectedUserBanned] = useState(false);
  const [banReasonModalVisible, setBanReasonModalVisible] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banningUser, setBanningUser] = useState(null);

  // 검색 & 필터
  const [searchText, setSearchText] = useState("");
  const [cityFilter, setCityFilter] = useState("전체");
  const [districtFilter, setDistrictFilter] = useState("전체");
  const [statusFilter, setStatusFilter] = useState("전체");

  // 상세보기 모달
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, searchText, cityFilter, districtFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      console.log("👥 회원 정보 불러오는 중...");

      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      const usersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      usersList.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || new Date(0);
        const timeB = b.createdAt?.toDate?.() || new Date(0);
        return timeB - timeA;
      });

      console.log(`✅ 회원 ${usersList.length}명 로드 완료`);
      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error("회원 로드 실패:", error);
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    // 검색어 필터
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name?.toLowerCase().includes(search) ||
          user.email?.toLowerCase().includes(search) ||
          user.phone?.includes(search)
      );
    }

    // 도시 필터
    if (cityFilter !== "전체") {
      filtered = filtered.filter((user) => user.city === cityFilter);
    }

    // 구/군 필터
    if (districtFilter !== "전체") {
      filtered = filtered.filter((user) => user.district === districtFilter);
    }

    // 상태 필터
    if (statusFilter === "완성") {
      filtered = filtered.filter(
        (user) => user.detailedAddress && user.detailedAddress.trim()
      );
    } else if (statusFilter === "미완성") {
      filtered = filtered.filter(
        (user) => !user.detailedAddress || !user.detailedAddress.trim()
      );
    }

    setFilteredUsers(filtered);
  };

  // 선택된 도시의 구/군 목록
  const getDistrictsForCity = () => {
    if (cityFilter === "전체") return [];

    const cityUsers = users.filter((u) => u.city === cityFilter);
    const districts = [
      ...new Set(cityUsers.map((u) => u.district).filter(Boolean)),
    ];
    return districts.sort();
  };

  const availableDistricts = getDistrictsForCity();

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert("알림", "전화번호가 등록되지 않았습니다.");
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleUserPress = (u) => {
    setSelectedUser(u);
    setSelectedUserBanned(false);
    setModalVisible(true);
    // 이 회원이 이미 블랙리스트에 있는지 확인 (버튼을 제명/해제 중 무엇으로 보일지 결정)
    checkBanned(banKeyFromUserDoc(u)).then(setSelectedUserBanned).catch(() => {});
  };

  // 영구 제명 시작 → 사유 입력 모달
  const handleBanUser = (u) => {
    setModalVisible(false);
    setTimeout(() => {
      setBanningUser(u);
      setBanReason("");
      setBanReasonModalVisible(true);
    }, 300);
  };

  const confirmBan = () => {
    if (!banReason.trim()) {
      Alert.alert("알림", "제명 사유를 입력해주세요.");
      return;
    }
    setBanReasonModalVisible(false);
    setTimeout(() => {
      Alert.alert(
        "⛔ 영구 제명 최종 확인",
        `${banningUser?.name || "이 회원"}을(를) 영구 제명합니다.\n\n사유: ${banReason}\n\n• 블랙리스트 등록 → 재로그인·재가입·글쓰기 모두 차단\n• 등록한 모든 게시물 삭제\n• 되돌리려면 '차단 해제'`,
        [
          { text: "취소", style: "cancel" },
          {
            text: "영구 제명",
            style: "destructive",
            onPress: () => banUserCompletely(banningUser),
          },
        ]
      );
    }, 300);
  };

  const banUserCompletely = async (u) => {
    try {
      setDeletingUserId(u.id);
      // 1) 블랙리스트 등록 (서버 규칙이 이걸로 차단을 강제)
      await addToBlacklist(
        { ...u, uid: u.uid || u.id },
        banReason,
        user?.email || "admin"
      );
      // 2) 등록한 모든 게시물 삭제 + 계정 문서 삭제 (기존 삭제 로직 재사용)
      await deleteUserData(u.id, u);
      setUsers(users.filter((x) => x.id !== u.id));
      Alert.alert(
        "✅ 영구 제명 완료",
        `${u.name || "회원"}이(가) 블랙리스트에 등록되었습니다.\n이 계정·이메일로는 다시 들어올 수 없습니다.`
      );
    } catch (error) {
      console.error("❌ 영구 제명 실패:", error);
      Alert.alert("오류", `영구 제명에 실패했습니다.\n\n${error.message}`);
    } finally {
      setDeletingUserId(null);
      setBanningUser(null);
    }
  };

  const handleUnbanUser = (u) => {
    Alert.alert(
      "차단 해제",
      `${u.name || "이 회원"}을(를) 블랙리스트에서 해제하시겠습니까?\n(다시 로그인·이용 가능해집니다)`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "차단 해제",
          onPress: async () => {
            try {
              await removeFromBlacklist(u);
              setSelectedUserBanned(false);
              Alert.alert("완료", "차단이 해제되었습니다.");
            } catch (e) {
              Alert.alert("오류", `차단 해제 실패\n${e.message}`);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (userId, userName) => {
    setModalVisible(false);

    setTimeout(() => {
      Alert.alert(
        "회원 삭제 확인",
        `${userName || "이 회원"}을(를) 정말 삭제하시겠습니까?`,
        [
          {
            text: "취소",
            style: "cancel",
          },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                "⚠️ 최종 확인",
                "회원의 모든 데이터가 영구적으로 삭제됩니다:\n\n• 프로필 정보\n• 북마크\n• 댓글\n• 등록한 물품\n• 프로필 사진\n\n이 작업은 되돌릴 수 없습니다.",
                [
                  {
                    text: "취소",
                    style: "cancel",
                  },
                  {
                    text: "완전 삭제",
                    style: "destructive",
                    onPress: () => deleteUserCompletely(userId, userName),
                  },
                ]
              );
            },
          },
        ]
      );
    }, 300);
  };

  // 회원 데이터 일괄 삭제 (게시물 전종류 + 사진 + 계정문서). 알림은 호출측에서.
  const deleteUserData = async (userId, userDoc) => {
    const cols = [
      "bookmarks", "comments", "XinChaoDanggn", "Jobs",
      "RealEstate", "candidates", "Agents", "reviews", "favorites",
    ];
    for (const col of cols) {
      try {
        const snap = await getDocs(
          query(collection(db, col), where("userId", "==", userId))
        );
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      } catch (e) {
        console.log(`⚠️ ${col} 삭제 실패(계속):`, e?.message);
      }
    }
    // 알림 설정
    try { await deleteDoc(doc(db, "notificationSettings", userId)); } catch (_) {}
    // 프로필 사진
    const photo = userDoc?.profileImage;
    if (photo) {
      try {
        const imagePath = photo.split("/o/")[1]?.split("?")[0];
        if (imagePath) {
          await deleteObject(ref(storage, decodeURIComponent(imagePath)));
        }
      } catch (_) {
        console.log("⚠️ 프로필 사진 삭제 실패 (무시)");
      }
    }
    // 계정 문서
    await deleteDoc(doc(db, "users", userId));
  };

  const deleteUserCompletely = async (userId, userName) => {
    try {
      setDeletingUserId(userId);
      const userDoc = users.find((u) => u.id === userId);
      await deleteUserData(userId, userDoc);
      setUsers(users.filter((u) => u.id !== userId));
      Alert.alert(
        "✅ 삭제 완료",
        `${userName || "회원"}이(가) 완전히 삭제되었습니다.`
      );
    } catch (error) {
      console.error("❌ 회원 삭제 실패:", error);
      Alert.alert("오류", `회원 삭제에 실패했습니다.\n\n${error.message}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const renderUserRow = ({ item }) => {
    const hasDetailedAddress =
      item.detailedAddress && item.detailedAddress.trim();

    return (
      <TouchableOpacity
        style={styles.tableRow}
        onPress={() => handleUserPress(item)}
      >
        <View style={styles.tableCell}>
          <Text style={styles.cellText} numberOfLines={1}>
            {item.name || "-"}
          </Text>
        </View>
        <View style={[styles.tableCell, { flex: 1.5 }]}>
          <Text style={styles.cellTextSmall} numberOfLines={1}>
            {item.email || "-"}
          </Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellTextSmall} numberOfLines={1}>
            {item.phone || "-"}
          </Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellTextSmall} numberOfLines={1}>
            {item.city || "-"}
          </Text>
        </View>
        <View style={styles.tableCellStatus}>
          {hasDetailedAddress ? (
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
          ) : (
            <Ionicons name="close-circle" size={20} color="#FF9800" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>회원 정보를 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          placeholder="이름, 이메일, 전화번호 검색..."
          placeholderTextColor="rgba(0, 0, 0, 0.38)"
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* 필터 */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* 도시 필터 */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              cityFilter === "전체" && styles.filterButtonActive,
            ]}
            onPress={() => {
              setCityFilter("전체");
              setDistrictFilter("전체");
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                cityFilter === "전체" && styles.filterButtonTextActive,
              ]}
            >
              전체 도시
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              cityFilter === "호치민" && styles.filterButtonActive,
            ]}
            onPress={() => {
              setCityFilter("호치민");
              setDistrictFilter("전체");
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                cityFilter === "호치민" && styles.filterButtonTextActive,
              ]}
            >
              호치민
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              cityFilter === "하노이" && styles.filterButtonActive,
            ]}
            onPress={() => {
              setCityFilter("하노이");
              setDistrictFilter("전체");
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                cityFilter === "하노이" && styles.filterButtonTextActive,
              ]}
            >
              하노이
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              cityFilter === "다낭" && styles.filterButtonActive,
            ]}
            onPress={() => {
              setCityFilter("다낭");
              setDistrictFilter("전체");
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                cityFilter === "다낭" && styles.filterButtonTextActive,
              ]}
            >
              다낭
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              cityFilter === "냐짱" && styles.filterButtonActive,
            ]}
            onPress={() => {
              setCityFilter("냐짱");
              setDistrictFilter("전체");
            }}
          >
            <Text
              style={[
                styles.filterButtonText,
                cityFilter === "냐짱" && styles.filterButtonTextActive,
              ]}
            >
              냐짱
            </Text>
          </TouchableOpacity>

          {/* 구/군 필터 (도시 선택했을 때만) */}
          {cityFilter !== "전체" && availableDistricts.length > 0 && (
            <>
              <View style={styles.filterDivider} />

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  districtFilter === "전체" && styles.filterButtonActive,
                ]}
                onPress={() => setDistrictFilter("전체")}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    districtFilter === "전체" && styles.filterButtonTextActive,
                  ]}
                >
                  전체 구/군
                </Text>
              </TouchableOpacity>

              {availableDistricts.map((district) => (
                <TouchableOpacity
                  key={district}
                  style={[
                    styles.filterButton,
                    districtFilter === district && styles.filterButtonActive,
                  ]}
                  onPress={() => setDistrictFilter(district)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      districtFilter === district &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {district}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          <View style={styles.filterDivider} />

          {/* 상태 필터 */}
          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === "전체" && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter("전체")}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === "전체" && styles.filterButtonTextActive,
              ]}
            >
              전체
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === "완성" && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter("완성")}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === "완성" && styles.filterButtonTextActive,
              ]}
            >
              완성
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              statusFilter === "미완성" && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter("미완성")}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === "미완성" && styles.filterButtonTextActive,
              ]}
            >
              미완성
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* 통계 */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{filteredUsers.length}</Text>
          <Text style={styles.statLabel}>검색 결과</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{users.length}</Text>
          <Text style={styles.statLabel}>전체 회원</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {
              users.filter((u) => u.detailedAddress && u.detailedAddress.trim())
                .length
            }
          </Text>
          <Text style={styles.statLabel}>완성</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {users.filter((u) => u.city === "호치민").length}
          </Text>
          <Text style={styles.statLabel}>호치민</Text>
        </View>
      </View>

      {/* 테이블 헤더 */}
      <View style={styles.tableHeader}>
        <View style={styles.tableCell}>
          <Text style={styles.headerText}>이름</Text>
        </View>
        <View style={[styles.tableCell, { flex: 1.5 }]}>
          <Text style={styles.headerText}>이메일</Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.headerText}>전화</Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.headerText}>지역</Text>
        </View>
        <View style={styles.tableCellStatus}>
          <Text style={styles.headerText}>완성</Text>
        </View>
      </View>

      {/* 테이블 데이터 */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUserRow}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
            colors={["#FF6B35"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={60} color="#ddd" />
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
          </View>
        }
      />

      {/* 상세보기 모달 */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }]}>
          <View style={[styles.modalContent, { position: "absolute", top: 90, bottom: 110, left: 16, right: 16, borderRadius: 20, overflow: "hidden" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>회원 상세 정보</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={[styles.modalBody, { flex: 1 }]}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {selectedUser && (
                <>
                  <View style={styles.statusBadges}>
                    {selectedUser.detailedAddress &&
                    selectedUser.detailedAddress.trim() ? (
                      <View style={[styles.badge, styles.completeBadge]}>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color="#4CAF50"
                        />
                        <Text style={styles.badgeText}>프로필 완성</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.incompleteBadge]}>
                        <Ionicons
                          name="alert-circle"
                          size={16}
                          color="#FF9800"
                        />
                        <Text style={styles.badgeText}>미완성</Text>
                      </View>
                    )}

                    {selectedUser.city === "호치민" ? (
                      <View style={[styles.badge, styles.hcmBadge]}>
                        <Ionicons name="location" size={16} color="#2196F3" />
                        <Text style={styles.badgeText}>호치민</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.otherBadge]}>
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color="#9C27B0"
                        />
                        <Text style={styles.badgeText}>타지역</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>이름</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.name || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>이메일</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.email || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>전화</Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Text style={styles.detailValue}>
                          {selectedUser.phone || "-"}
                        </Text>
                        {selectedUser.phone && (
                          <TouchableOpacity
                            onPress={() => handleCall(selectedUser.phone)}
                          >
                            <Ionicons
                              name="call-outline"
                              size={20}
                              color="#4CAF50"
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>나이대</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.ageGroup || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>성별</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.gender || "-"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>주소</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>도시</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.city || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>구/군</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.district || "-"}
                      </Text>
                    </View>
                    {selectedUser.apartment && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>아파트</Text>
                        <Text style={styles.detailValue}>
                          {selectedUser.apartment}
                        </Text>
                      </View>
                    )}
                    {selectedUser.detailedAddress && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>상세 주소</Text>
                        <Text style={styles.detailValue}>
                          {selectedUser.detailedAddress}
                        </Text>
                      </View>
                    )}
                    {selectedUser.postalCode && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>우편번호</Text>
                        <Text style={styles.detailValue}>
                          {selectedUser.postalCode}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>거주 정보</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>거주 기간</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.residencePeriod || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>거주 목적</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.residencePurpose || "-"}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>직업</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.occupation || "-"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>가입 정보</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>가입일</Text>
                      <Text style={styles.detailValue}>
                        {selectedUser.createdAt
                          ? formatDistanceToNow(
                              selectedUser.createdAt.toDate(),
                              {
                                addSuffix: true,
                                locale: ko,
                              }
                            )
                          : "-"}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            {isAdmin() && selectedUser && (
              <View style={styles.footerRow}>
                <TouchableOpacity
                  style={[styles.footerBtn, styles.deleteBtn]}
                  onPress={() =>
                    handleDeleteUser(selectedUser.id, selectedUser.name)
                  }
                  disabled={deletingUserId === selectedUser.id}
                >
                  {deletingUserId === selectedUser.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Text style={styles.footerBtnText}>삭제</Text>
                    </>
                  )}
                </TouchableOpacity>

                {selectedUserBanned ? (
                  <TouchableOpacity
                    style={[styles.footerBtn, styles.unbanBtn]}
                    onPress={() => handleUnbanUser(selectedUser)}
                    disabled={deletingUserId === selectedUser.id}
                  >
                    <Ionicons name="lock-open-outline" size={18} color="#fff" />
                    <Text style={styles.footerBtnText}>차단 해제</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.footerBtn, styles.banBtn]}
                    onPress={() => handleBanUser(selectedUser)}
                    disabled={deletingUserId === selectedUser.id}
                  >
                    <Ionicons name="ban" size={18} color="#fff" />
                    <Text style={styles.footerBtnText}>영구 제명</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* 제명 사유 입력 모달 */}
      <Modal
        visible={banReasonModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setBanReasonModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }]}>
          <View style={styles.banReasonCard}>
            <View style={styles.banReasonHeader}>
              <Ionicons name="ban" size={22} color="#8B0000" />
              <Text style={styles.banReasonTitle}>영구 제명 사유</Text>
            </View>
            <Text style={styles.banReasonSub}>
              {banningUser?.name || "이 회원"} — 사유는 블랙리스트에 기록됩니다.
            </Text>
            <TextInput
              style={styles.banReasonInput}
              placeholder="예) 사기성 구인공고 반복, 불법 상품 판매..."
              placeholderTextColor="#aaa"
              value={banReason}
              onChangeText={setBanReason}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.banReasonBtns}>
              <TouchableOpacity
                style={styles.banCancelBtn}
                onPress={() => setBanReasonModalVisible(false)}
              >
                <Text style={styles.banCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.banConfirmBtn} onPress={confirmBan}>
                <Ionicons name="ban" size={16} color="#fff" />
                <Text style={styles.banConfirmText}>제명 진행</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  filterButtonActive: {
    backgroundColor: "#FF6B35",
  },
  filterButtonText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  filterDivider: {
    width: 1,
    backgroundColor: "#ddd",
    marginHorizontal: 8,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#e0e0e0",
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableCell: {
    flex: 1,
    justifyContent: "center",
  },
  tableCellStatus: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
  },
  cellText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  cellTextSmall: {
    fontSize: 13,
    color: "#333",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    maxHeight: "85%",
    marginBottom: 50,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  modalBody: {
    flexShrink: 1,
    padding: 20,
  },
  statusBadges: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  completeBadge: {
    backgroundColor: "#E8F5E9",
  },
  incompleteBadge: {
    backgroundColor: "#FFF3E0",
  },
  hcmBadge: {
    backgroundColor: "#E3F2FD",
  },
  otherBadge: {
    backgroundColor: "#F3E5F5",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  detailSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  footerRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    gap: 6,
  },
  deleteBtn: { backgroundColor: "#dc3545" },
  banBtn: { backgroundColor: "#8B0000" },
  unbanBtn: { backgroundColor: "#2e7d32" },
  footerBtnText: { color: "#fff", fontSize: 15, fontWeight: "bold" },

  banReasonCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 22,
  },
  banReasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  banReasonTitle: { fontSize: 18, fontWeight: "bold", color: "#8B0000" },
  banReasonSub: { fontSize: 13, color: "#555", marginBottom: 14, lineHeight: 19 },
  banReasonInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    minHeight: 80,
    backgroundColor: "#fafafa",
    marginBottom: 18,
  },
  banReasonBtns: { flexDirection: "row", gap: 10 },
  banCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
  },
  banCancelText: { fontSize: 15, color: "#666", fontWeight: "600" },
  banConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: "#8B0000",
    gap: 6,
  },
  banConfirmText: { color: "#fff", fontSize: 15, fontWeight: "bold" },
});
