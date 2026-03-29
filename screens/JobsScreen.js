import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Pressable,
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
import { useTranslation } from "react-i18next";
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
import AdBanner, { InlineAdBanner, DetailAdBanner } from "../components/AdBanner";
import TranslatedText from "../components/TranslatedText";
import { translateCity } from "../utils/vietnamLocations";
import { translateIndustry } from "../utils/optionTranslations";
import LanguagePickerModal from "../components/LanguagePickerModal";

// 검색바 컴포넌트
const SearchBar = memo(({ value, onChangeText, placeholder }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
    <TextInput
      style={styles.searchInput}
      placeholder={placeholder}
      placeholderTextColor="rgba(0, 0, 0, 0.38)"
      value={value}
      onChangeText={onChangeText}
    />
  </View>
));

// Jobs 카드 컴포넌트
const JobCard = memo(({ item, onPress, index, t }) => {
  const status = item.status || t('recruiting');
  const originalImage = item.images?.[0] || item.imageUrls?.[0] || null;

  const getStatusColor = (status) => {
    switch (status) {
      case "모집중":
      case t('recruiting'):
        return "#4CAF50";
      case "마감임박":
      case t('closingSoon'):
        return "#FF9800";
      case "마감":
      case t('closed'):
        return "#9E9E9E";
      default:
        return "#4CAF50";
    }
  };

  const getJobTypeBadge = (jobType) => {
    const isHiring = jobType === "구인" || jobType === t('hiring');
    return isHiring
      ? { bg: "#E3F2FD", color: "#1976D2", text: t('hiring') }
      : { bg: "#FFF3E0", color: "#E65100", text: t('seeking') };
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
          <Image
            source={require('../assets/og_jobs_seeker.png')}
            style={styles.jobImage}
            contentFit="cover"
          />
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
              <TranslatedText style={styles.industryText}>{item.industry}</TranslatedText>
            </View>
          )}
        </View>

        {/* 제목 */}
        <TranslatedText style={styles.jobTitle} numberOfLines={2}>{item.title}</TranslatedText>

        {/* 급여 */}
        {item.salary && (
          <View style={styles.salaryRow}>
            <Ionicons name="cash-outline" size={14} color="#4CAF50" />
            <TranslatedText style={styles.salaryText}>{item.salary}</TranslatedText>
          </View>
        )}

        {/* 위치 */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#666" />
          <TranslatedText style={styles.locationText} numberOfLines={1}>
            {item.city}{item.district ? ` · ${item.district}` : ''}
          </TranslatedText>
        </View>

        {/* 고용 형태 */}
        {item.employmentType && (
          <View style={styles.employmentRow}>
            <Ionicons name="time-outline" size={14} color="#666" />
            <TranslatedText style={styles.employmentText}>{item.employmentType}</TranslatedText>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

export default function JobsScreen({ navigation }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('jobs');
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [jobs, setJobs] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedJobType, setSelectedJobType] = useState("전체");
  const [selectedIndustry, setSelectedIndustry] = useState("전체");
  const [selectedCity, setSelectedCity] = useState("전체");
  const [refreshing, setRefreshing] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // 페이지네이션 관련 state
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  // 구인/구직 타입 (데이터 저장용은 한국어, 표시용은 번역)
  const jobTypes = ["전체", "구인", "구직"];
  const jobTypeLabels = [t('common:all'), t('hiring'), t('seeking')];

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

  // candidates 컬렉션 데이터를 JobCard 표시 형식으로 정규화
  const normalizeCandidateToJob = (docId, data) => {
    const profile = data.profile || {};
    const career = data.career || {};
    const lang = data.language || {};
    const comp = data.compensation || {};
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt;

    const langParts = [];
    if (lang.korean && lang.korean !== '없음') langParts.push(`한국어:${lang.korean}`);
    if (lang.vietnamese && lang.vietnamese !== '없음') langParts.push(`베트남어:${lang.vietnamese}`);

    const salaryUsd = comp.desiredSalaryUsdPerMonth;

    // 이름 fallback: profile.name → data.title → data.name → '이름 미입력'
    const personName = profile.name || data.name || '';
    const extraTitle = data.title && data.title !== personName ? data.title : '';
    // 카드 제목: "이름" 또는 "이름 · 직무/제목"
    const displayTitle = personName
      ? (extraTitle ? `${personName} · ${extraTitle}` : personName)
      : (extraTitle || '이름 미입력');

    // 사진: 원본 데이터에서 보존
    const images = data.images || data.imageUrls || [];

    return {
      id: docId,
      jobType: '구직',
      sourceCollection: 'candidates',
      title: displayTitle,
      description: data.description || career.skills || '',
      city: profile.desiredLocation || data.city || '',
      district: '',
      salary: salaryUsd ? `${salaryUsd} USD/월` : (langParts.length ? langParts.join(' | ') : ''),
      contact: profile.phone || data.phone || '',
      employmentType: career.jobTracks?.join(', ') || '',
      industry: career.jobTracks?.[0] || '',
      images,
      status: data.status || '신규 등록',
      youtubeUrl: data.youtubeUrl || null,
      userId: data.userId || null,
      userEmail: data.userEmail || null,
      createdAt,
      _candidateRaw: data,
    };
  };

  // 데이터 페칭 (Jobs + candidates 통합)
  const fetchJobs = async (isFirstFetch = true) => {
    if (!isFirstFetch && (loadingMore || !hasMore)) return;

    if (isFirstFetch) {
      // 캐시된 데이터 먼저 표시
      if (jobs.length === 0) {
        try {
          const cachedData = await AsyncStorage.getItem("cached_jobs_v2");
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
      // Jobs 컬렉션 (구인 + 예전 jobType:'구직')
      const jobsQuery = query(
        collection(db, "Jobs"),
        limit(isFirstFetch ? 60 : ITEMS_PER_PAGE)
      );

      // candidates 컬렉션 (구직자 전용) — 첫 페이지에서만 전체 로드
      const candidatesQuery = isFirstFetch
        ? query(collection(db, "candidates"), limit(100))
        : null;

      const [jobsSnapshot, candidatesSnapshot] = await Promise.all([
        getDocs(jobsQuery),
        candidatesQuery ? getDocs(candidatesQuery) : Promise.resolve(null),
      ]);

      // Jobs 컬렉션 데이터
      const fetchedJobs = jobsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          images: (data.images?.length > 0 ? data.images : null) || (data.imageUrls?.length > 0 ? data.imageUrls : null) || [],
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        };
      });

      // candidates 컬렉션 데이터 정규화 (첫 페이지만)
      const fetchedCandidates = candidatesSnapshot
        ? candidatesSnapshot.docs.map((doc) =>
            normalizeCandidateToJob(doc.id, doc.data())
          )
        : [];

      console.log(`📋 Jobs: ${fetchedJobs.length}개, Candidates: ${fetchedCandidates.length}개`);

      // 합치고 최신순 정렬
      const combined = [...fetchedJobs, ...fetchedCandidates];
      combined.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (isFirstFetch) {
        const uniqueJobs = Array.from(new Map(combined.map(job => [job.id, job])).values());
        setJobs(uniqueJobs);
        await AsyncStorage.setItem("cached_jobs_v2", JSON.stringify(uniqueJobs));
      } else {
        setJobs((prev) => {
          const existingIds = new Set(prev.map((j) => j.id));
          const uniqueNewJobs = fetchedJobs.filter((j) => !existingIds.has(j.id));
          return [...prev, ...uniqueNewJobs];
        });
      }

      setLastVisible(jobsSnapshot.docs[jobsSnapshot.docs.length - 1]);
      setHasMore(jobsSnapshot.docs.length >= (isFirstFetch ? 60 : ITEMS_PER_PAGE));
    } catch (error) {
      console.error("❌ Jobs 데이터 페칭 실패:", error);
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
        t('common:loginRequired') + " 🔒",
        t('loginMessage'),
        [
          { text: t('common:later'), style: "cancel" },
          { text: t('common:login'), onPress: () => navigation.navigate("로그인") },
        ]
      );
    } else {
      setShowLangPicker(true);
    }
  }, [user, navigation, t]);

  const handleLangTypeSelect = useCallback((sourceLanguage, type) => {
    setShowLangPicker(false);
    if (type === "hiring") {
      navigation.navigate("구인구직 등록", { sourceLanguage });
    } else {
      navigation.navigate("구직자 등록", { sourceLanguage });
    }
  }, [navigation]);

  const handleJobPress = useCallback((job) => {
    const serializableJob = {
      ...job,
      createdAt: job.createdAt,
    };
    navigation.navigate("구인구직 상세", { job: serializableJob });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }) => (
    <View>
      <JobCard
        item={item}
        onPress={handleJobPress}
        index={index}
        t={t}
      />
      {/* 2개마다 광고 삽입 */}
      {(index + 1) % 2 === 0 && (
        <InlineAdBanner screen="job" />
      )}
    </View>
  ), [handleJobPress, t]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loaderFooter}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  }, [loadingMore]);

  // 리스트 헤더 (FlatList 안) — 광고/로그인배너/필터만
  const renderListHeader = () => (
    <View>
      {/* 광고 배너 */}
      <AdBanner screen="job" style={{ marginTop: 8 }} />

      {/* 로그인 유도 배너 */}
      {!user && (
        <TouchableOpacity style={styles.loginBanner} onPress={() => navigation.navigate("로그인")}>
          <Ionicons name="lock-closed" size={20} color="#2196F3" />
          <Text style={styles.loginBannerText}>{t('loginMessage').split('\n')[0]}</Text>
          <Ionicons name="chevron-forward" size={20} color="#2196F3" />
        </TouchableOpacity>
      )}

      {/* 필터 */}
      <View style={styles.filterSection}>
        <View style={styles.filterRow}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCity}
              onValueChange={setSelectedCity}
              style={styles.picker}
            >
              {cities.map((city) => (
                <Picker.Item key={city} label={city === "전체" ? `📍 ${t('allCities')}` : translateCity(city, i18n.language)} value={city} />
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
                <Picker.Item key={ind} label={ind === "전체" ? `💼 ${t('allIndustries')}` : translateIndustry(ind, i18n.language)} value={ind} />
              ))}
            </Picker>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* ─── FlatList 바깥 고정 영역: 검색바 + 서브탭 ─── */}
      <SearchBar value={searchText} onChangeText={setSearchText} placeholder={t('searchPlaceholder')} />
      <View style={styles.jobTypeTabContainer}>
        {jobTypes.map((type, index) => (
          <Pressable
            key={type}
            style={({ pressed }) => [
              styles.jobTypeTab,
              selectedJobType === type && styles.jobTypeTabActive,
              pressed && { opacity: 0.7 }
            ]}
            onPress={() => setSelectedJobType(type)}
            hitSlop={8}
          >
            <Text style={[
              styles.jobTypeTabText,
              selectedJobType === type && styles.jobTypeTabTextActive
            ]}>
              {jobTypeLabels[index]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredJobs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
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
              <Text style={styles.emptyText}>{t('noJobs')}</Text>
              <Text style={styles.emptySubText}>{t('beFirst')}</Text>
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
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.floatingButtonText}>{t('common:register')}</Text>
      </TouchableOpacity>

      {showLangPicker && (
        <LanguagePickerModal
          visible={showLangPicker}
          onClose={() => setShowLangPicker(false)}
          onSelect={handleLangTypeSelect}
        />
      )}
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
    height: Platform.OS === "ios" ? 120 : undefined,
  },
  picker: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 0 : 8,
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
    bottom: 105,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  floatingButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
