import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
import { db } from "../firebase/config";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  getDoc,
  doc,
} from "firebase/firestore";
import AdBanner from "../components/AdBanner";

// 검색바 컴포넌트
const SearchBar = memo(({ value, onChangeText }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
    <TextInput
      style={styles.searchInput}
      placeholder="구인구직 정보를 검색하세요"
      placeholderTextColor="rgba(0, 0, 0, 0.38)"
      value={value}
      onChangeText={onChangeText}
    />
  </View>
));

// Jobs 카드 컴포넌트
const JobCard = memo(({ item, onPress, index }) => {
  const status = item.status || "모집중";
  const originalImage = item.images?.[0];

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

  const badge = getJobTypeBadge(item.jobType);

  return (
    <TouchableOpacity style={styles.jobCard} onPress={() => onPress(item)}>
      {/* 이미지 영역 */}
      <View style={styles.imageContainer}>
        {originalImage ? (
          <Image
            source={{ uri: originalImage }}
            style={styles.jobImage}
            contentFit="cover"
            transition={200}
            cachePolicy="disk"
            priority={index < 4 ? "high" : "normal"}
          />
        ) : (
          <View style={styles.noImagePlaceholder}>
            <Ionicons name="briefcase-outline" size={40} color="#ccc" />
          </View>
        )}
        {/* 상태 배지 */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      {/* 정보 영역 */}
      <View style={styles.jobInfo}>
        {/* 구인/구직 + 업종 태그 */}
        <View style={styles.tagRow}>
          <View style={[styles.jobTypeBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.jobTypeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
          {item.industry && (
            <View style={styles.industryBadge}>
              <Text style={styles.industryText}>{item.industry}</Text>
            </View>
          )}
        </View>

        {/* 제목 */}
        <Text style={styles.jobTitle} numberOfLines={2}>{item.title}</Text>

        {/* 급여 */}
        {item.salary && (
          <View style={styles.salaryRow}>
            <Ionicons name="cash-outline" size={14} color="#4CAF50" />
            <Text style={styles.salaryText}>{item.salary}</Text>
          </View>
        )}

        {/* 위치 */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.city}{item.district ? ` · ${item.district}` : ''}
          </Text>
        </View>

        {/* 고용 형태 */}
        {item.employmentType && (
          <View style={styles.employmentRow}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <Text style={styles.employmentText}>{item.employmentType}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function JobsScreen({ navigation }) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  
  const [jobs, setJobs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("전체");
  const [selectedIndustry, setSelectedIndustry] = useState("전체");
  const [selectedCity, setSelectedCity] = useState("전체");
  const [refreshing, setRefreshing] = useState(false);

  // 페이지네이션 관련 state
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  // 구인/구직 타입
  const jobTypes = ["전체", "구인", "구직"];

  // 업종 카테고리
  const industries = [
    "전체",
    "식당/요리",
    "IT/개발",
    "제조/생산",
    "무역/물류",
    "교육/강사",
    "서비스/판매",
    "사무/관리",
    "건설/인테리어",
    "미용/뷰티",
    "통역/번역",
    "기타",
  ];

  // 도시 목록
  const cities = ["전체", "호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "기타"];

  // 데이터 페칭
  const fetchJobs = async (isFirstFetch = true) => {
    if (!isFirstFetch && (loadingMore || !hasMore)) return;

    if (isFirstFetch) {
      // 캐시된 데이터 먼저 표시
      if (jobs.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem("cached_jobs");
          if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            setJobs(parsedData);
            console.log("⚡ [Cache] Jobs 캐시 데이터 표시");
          }
        } catch (e) {
          console.error("캐시 로드 실패:", e);
        }
      }

      setRefreshing(true);
      setLastVisible(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(
        collection(db, "Jobs"),
        limit(isFirstFetch ? 60 : ITEMS_PER_PAGE)
      );

      if (!isFirstFetch && lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);
      
      const fetchedJobs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      }));

      // 최신순 정렬
      fetchedJobs.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (isFirstFetch) {
        const uniqueJobs = Array.from(new Map(fetchedJobs.map(job => [job.id, job])).values());
        setJobs(uniqueJobs);
        await AsyncStorage.setItem("cached_jobs", JSON.stringify(uniqueJobs));
      } else {
        setJobs((prev) => {
          const existingIds = new Set(prev.map((j) => j.id));
          const uniqueNewJobs = fetchedJobs.filter((j) => !existingIds.has(j.id));
          return [...prev, ...uniqueNewJobs];
        });
      }

      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length >= (isFirstFetch ? 60 : ITEMS_PER_PAGE));
    } catch (error) {
      console.error("❌ Jobs 데이터 페칭 실패:", error);
      // 권한 오류 등의 경우 더 이상 시도하지 않음
      setHasMore(false);
    } finally {
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // 한 번만 실행
  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchJobs(true);
    }
    return () => { isMounted = false; };
  }, []);

  const onRefresh = () => {
    fetchJobs(true);
  };

  const loadMore = () => {
    fetchJobs(false);
  };

  // 필터링
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // 마감된 공고는 맨 아래로 (필터링에서 제외하지 않음)
      const matchesSearch = !searchText || 
        job.title?.toLowerCase().includes(searchText.toLowerCase()) ||
        job.description?.toLowerCase().includes(searchText.toLowerCase());
      const matchesJobType = selectedJobType === "전체" || job.jobType === selectedJobType;
      const matchesIndustry = selectedIndustry === "전체" || job.industry === selectedIndustry;
      const matchesCity = selectedCity === "전체" || job.city === selectedCity;

      return matchesSearch && matchesJobType && matchesIndustry && matchesCity;
    }).sort((a, b) => {
      // 마감된 공고는 맨 아래로
      if (a.status === "마감" && b.status !== "마감") return 1;
      if (a.status !== "마감" && b.status === "마감") return -1;
      return 0;
    });
  }, [jobs, searchText, selectedJobType, selectedIndustry, selectedCity]);

  const handleAddJob = useCallback(() => {
    if (!user) {
      Alert.alert(
        "로그인 필요 🔒",
        "구인구직 글을 등록하려면 로그인이 필요합니다.\n지금 로그인하시겠어요?",
        [
          { text: "나중에", style: "cancel" },
          { text: "로그인", onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      navigation.navigate("Jobs등록");
    }
  }, [user, navigation]);

  const handleJobPress = useCallback((job) => {
    const serializableJob = {
      ...job,
      createdAt: job.createdAt,
    };
    navigation.navigate("Jobs상세", { job: serializableJob });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <JobCard
      item={item}
      onPress={handleJobPress}
      index={index}
    />
  ), [handleJobPress]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  }, [loadingMore]);

  // 구인/구직 탭 버튼
  const JobTypeTab = useMemo(() => (
    <View style={styles.jobTypeTabContainer}>
      {jobTypes.map((type) => (
        <TouchableOpacity
          key={type}
          style={[
            styles.jobTypeTab,
            selectedJobType === type && styles.jobTypeTabActive
          ]}
          onPress={() => setSelectedJobType(type)}
        >
          <Text style={[
            styles.jobTypeTabText,
            selectedJobType === type && styles.jobTypeTabTextActive
          ]}>
            {type}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [selectedJobType]);

  // 필터 영역
  const FilterSection = useMemo(() => (
    <View style={styles.filterSection}>
      <View style={styles.filterRow}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={setSelectedCity}
            style={styles.picker}
          >
            {cities.map((city) => (
              <Picker.Item key={city} label={city === "전체" ? "📍 전체 지역" : city} value={city} color="#333" />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedIndustry}
            onValueChange={setSelectedIndustry}
            style={styles.picker}
          >
            {industries.map((ind) => (
              <Picker.Item key={ind} label={ind === "전체" ? "💼 전체 업종" : ind} value={ind} color="#333" />
            ))}
          </Picker>
        </View>
      </View>
    </View>
  ), [selectedCity, selectedIndustry]);

  // 리스트 헤더
  const ListHeader = useMemo(() => (
    <View>
      {/* 광고 배너 */}
      <AdBanner position="jobs_header" style={{ marginHorizontal: 12, marginTop: 8, borderRadius: 8 }} />
      
      {/* 로그인 유도 배너 */}
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#2196F3" />
          <Text style={styles.loginBannerText}>로그인하고 구인구직 정보를 등록하세요!</Text>
          <Ionicons name="chevron-forward" size={20} color="#2196F3" />
        </TouchableOpacity>
      )}

      {/* 검색바 */}
      <SearchBar value={searchText} onChangeText={setSearchText} />

      {/* 구인/구직 탭 */}
      {JobTypeTab}

      {/* 필터 */}
      {FilterSection}
    </View>
  ), [user, searchText, JobTypeTab, FilterSection, navigation]);

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredJobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2196F3"]} tintColor="#2196F3" />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !refreshing && (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>등록된 구인구직 정보가 없습니다</Text>
              <Text style={styles.emptySubText}>첫 번째로 등록해보세요!</Text>
            </View>
          )
        }
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
      />
      
      {/* 플로팅 등록 버튼 */}
      <TouchableOpacity style={styles.floatingButton} onPress={handleAddJob}>
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
    backgroundColor: "#E3F2FD",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
  },
  loginBannerText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#1976D2",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#000",
  },
  jobTypeTabContainer: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 4,
  },
  jobTypeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  jobTypeTabActive: {
    backgroundColor: "#2196F3",
  },
  jobTypeTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  jobTypeTabTextActive: {
    color: "#fff",
  },
  filterSection: {
    marginHorizontal: 12,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  pickerContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  picker: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: "#333",
  },
  listContainer: {
    paddingBottom: 80,
  },
  jobCard: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  imageContainer: {
    width: "100%",
    height: 160,
    backgroundColor: "#f0f0f0",
    position: "relative",
  },
  jobImage: {
    width: "100%",
    height: "100%",
  },
  noImagePlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  statusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  jobInfo: {
    padding: 12,
  },
  tagRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 6,
  },
  jobTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  jobTypeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  industryBadge: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  industryText: {
    fontSize: 11,
    color: "#666",
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    lineHeight: 22,
  },
  salaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  salaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4CAF50",
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  employmentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  employmentText: {
    fontSize: 12,
    color: "#888",
    marginLeft: 4,
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
  emptySubText: {
    marginTop: 4,
    fontSize: 14,
    color: "#bbb",
  },
  loaderFooter: {
    paddingVertical: 20,
    alignItems: "center",
  },
  floatingButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
