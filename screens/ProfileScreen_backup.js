import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  getDistrictsByCity,
  getApartmentsByDistrict,
} from "../utils/vietnamLocations";

export default function ProfileScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    bookmarks: 0,
    comments: 0,
  });

  // 프로필 사진
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 기본 정보
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");

  // 주소
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // 베트남 생활 정보
  const [residencePeriod, setResidencePeriod] = useState("");
  const [residencePurpose, setResidencePurpose] = useState("");
  const [occupation, setOccupation] = useState("");

  // SNS
  const [kakaoId, setKakaoId] = useState("");
  const [zaloId, setZaloId] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");

  // 잡지 관련
  const [howDidYouKnow, setHowDidYouKnow] = useState("");
  const [interests, setInterests] = useState([]);
  const [languagePreference, setLanguagePreference] = useState("");
  const [suggestions, setSuggestions] = useState("");

  // 마케팅 동의
  const [marketingConsent, setMarketingConsent] = useState({
    events: false,
    discounts: false,
    surveys: false,
    partnerships: false,
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadStats();
    loadUserProfile();
  }, []);

  const loadStats = async () => {
    try {
      const bookmarksQuery = query(
        collection(db, "bookmarks"),
        where("userId", "==", user?.uid)
      );
      const commentsQuery = query(
        collection(db, "comments"),
        where("userId", "==", user?.uid)
      );

      const [bookmarksSnapshot, commentsSnapshot] = await Promise.all([
        getCountFromServer(bookmarksQuery),
        getCountFromServer(commentsQuery),
      ]);

      setStats({
        bookmarks: bookmarksSnapshot.data().count,
        comments: commentsSnapshot.data().count,
      });
    } catch (error) {
      console.error("통계 로드 실패:", error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();

        setProfileImage(data.profileImage || null);
        setName(data.name || "");
        setPhone(data.phone || "");
        setAgeGroup(data.ageGroup || "");
        setGender(data.gender || "");

        setSelectedCity(data.city || "");
        setSelectedDistrict(data.district || "");
        setSelectedApartment(data.apartment || "");
        setDetailedAddress(data.detailedAddress || "");
        setPostalCode(data.postalCode || "");

        setResidencePeriod(data.residencePeriod || "");
        setResidencePurpose(data.residencePurpose || "");
        setOccupation(data.occupation || "");

        setKakaoId(data.kakaoId || "");
        setZaloId(data.zaloId || "");
        setFacebook(data.facebook || "");
        setInstagram(data.instagram || "");

        setHowDidYouKnow(data.howDidYouKnow || "");
        setInterests(data.interests || []);
        setLanguagePreference(data.languagePreference || "");
        setSuggestions(data.suggestions || "");

        setMarketingConsent(
          data.marketingConsent || {
            events: false,
            discounts: false,
            surveys: false,
            partnerships: false,
          }
        );

        console.log("✅ 프로필 로드 완료");
      }
    } catch (error) {
      console.error("❌ 프로필 로드 실패:", error);
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert("권한 필요", "사진 라이브러리 접근 권한이 필요합니다.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("사진 선택 실패:", error);
      Alert.alert("오류", "사진을 선택하는 중 오류가 발생했습니다.");
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploading(true);

      console.log("=== 사진 업로드 시작 ===");
      console.log("📸 이미지 URI:", uri);
      console.log("👤 User UID:", user?.uid);
      console.log("🔐 User 객체:", user);

      // 1. 로그인 확인
      if (!user || !user.uid) {
        throw new Error("로그인되지 않았습니다. 다시 로그인해주세요.");
      }

      // 2. 이미지 fetch
      console.log("⏳ 이미지 fetch 중...");
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`이미지 fetch 실패: ${response.status}`);
      }
      console.log("✅ 이미지 fetch 성공");

      // 3. Blob 생성
      console.log("⏳ Blob 생성 중...");
      const blob = await response.blob();
      console.log("✅ Blob 생성 성공, 크기:", blob.size, "bytes");

      if (blob.size === 0) {
        throw new Error("이미지 파일이 비어있습니다.");
      }

      // 4. Storage 업로드
      const filename = `profile_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profileImages/${filename}`);
      console.log("📁 Storage 경로:", storageRef.fullPath);
      console.log("📁 Storage Bucket:", storageRef.bucket);

      console.log("⏳ Firebase Storage에 업로드 중...");
      const uploadResult = await uploadBytes(storageRef, blob);
      console.log("✅ uploadBytes 성공:", uploadResult);

      // 5. URL 받기
      console.log("⏳ Download URL 받기 중...");
      const downloadURL = await getDownloadURL(storageRef);
      console.log("✅ Download URL:", downloadURL);

      // 6. Firestore 저장
      console.log("⏳ Firestore에 저장 중...");
      await setDoc(
        doc(db, "users", user.uid),
        { profileImage: downloadURL },
        { merge: true } // ✅ 문서가 없으면 생성, 있으면 업데이트
      );
      console.log("✅ Firestore 저장 성공");
      setProfileImage(downloadURL);
      Alert.alert("✅ 성공", "프로필 사진이 업데이트되었습니다!");
    } catch (error) {
      console.error("❌❌❌ 사진 업로드 실패 ❌❌❌");
      console.error("Error 전체:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);

      // 사용자에게 자세한 오류 메시지 표시
      let errorMessage = "사진 업로드에 실패했습니다.";

      if (error.code === "storage/unauthorized") {
        errorMessage += "\n\n권한이 없습니다. 로그인 상태를 확인해주세요.";
      } else if (error.code === "storage/canceled") {
        errorMessage += "\n\n업로드가 취소되었습니다.";
      } else if (error.code === "storage/unknown") {
        errorMessage += "\n\nFirebase Storage 오류가 발생했습니다.";
      } else {
        errorMessage += `\n\n오류: ${error.message}`;
      }

      Alert.alert("오류", errorMessage);
    } finally {
      setUploading(false);
    }
  };
  const toggleInterest = (interest) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const saveProfile = async () => {
    if (!name || !phone) {
      Alert.alert("입력 오류", "이름과 전화번호는 필수 입력 항목입니다.");
      return;
    }

    if (!selectedCity || !selectedDistrict) {
      Alert.alert("입력 오류", "도시와 구/군을 선택해주세요.");
      return;
    }

    try {
      setIsSaving(true);

      await updateDoc(
        doc(db, "users", user.uid),
        {
          name,
          phone,
          ageGroup,
          gender,

          city: selectedCity,
          district: selectedDistrict,
          apartment: selectedApartment,
          detailedAddress,
          postalCode,

          residencePeriod,
          residencePurpose,
          occupation,

          kakaoId,
          zaloId,
          facebook,
          instagram,

          howDidYouKnow,
          interests,
          languagePreference,
          suggestions,

          marketingConsent,

          profileCompletedAt: new Date().toISOString(),
        },
        { merge: true } // ✅ 추가!
      );

      Alert.alert(
        "✅ 저장 완료!",
        "프로필이 저장되었습니다!\n\n무료 잡지 배송이 시작됩니다. 주변에 새 상품이 등록되면 알림도 받을 수 있어요!",
        [{ text: "확인" }]
      );

      console.log("✅ 프로필 저장 성공");
    } catch (error) {
      console.error("❌ 프로필 저장 실패:", error);
      Alert.alert("오류", "프로필 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAppSettings = () => {
    Alert.alert("앱 설정", "언어: 한국어\n알림: 켜짐\n테마: 라이트 모드", [
      { text: "확인" },
    ]);
  };

  const handleAppInfo = () => {
    Alert.alert(
      "앱 정보",
      "씬짜오 베트남 뉴스\n버전: 1.0.0\n개발자: Chao Vietnam Team\n\n베트남 거주 한인을 위한 종합 뉴스 앱입니다.",
      [
        { text: "확인" },
        {
          text: "웹사이트 방문",
          onPress: () => Linking.openURL("https://chaovietnam.co.kr"),
        },
      ]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      "도움말",
      "📖 북마크: 기사를 저장하여 나중에 읽을 수 있습니다\n\n💬 댓글: 기사에 댓글을 남기고 다른 사용자와 소통하세요\n\n🔔 알림: 관심있는 카테고리의 새 기사 알림을 받으세요\n\n문의사항이 있으시면 이메일로 연락주세요:\ninfo@chaovietnam.co.kr",
      [
        { text: "확인" },
        {
          text: "이메일 보내기",
          onPress: () => Linking.openURL("mailto:info@chaovietnam.co.kr"),
        },
      ]
    );
  };

  const districts = selectedCity ? getDistrictsByCity(selectedCity) : [];
  const apartments =
    selectedCity && selectedDistrict
      ? getApartmentsByDistrict(selectedCity, selectedDistrict)
      : [];

  const interestOptions = [
    "베트남 생활 정보",
    "부동산",
    "맛집/카페",
    "여행",
    "비즈니스/투자",
    "자녀 교육",
    "한인 커뮤니티",
    "건강/의료",
    "법률/행정",
    "구인구직",
  ];

  return (
    <ScrollView style={styles.container}>
      {/* 프로필 헤더 */}
      <View style={styles.profileHeader}>
        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
          {uploading ? (
            <View style={styles.avatar}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          ) : profileImage ? (
            <Image source={{ uri: profileImage }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
          )}
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.usernameContainer}>
          <Text style={styles.username}>
            {name || user?.email?.split("@")[0] || "User"}
          </Text>
          {isAdmin() && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* 통계 */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.bookmarks}</Text>
          <Text style={styles.statLabel}>북마크</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.comments}</Text>
          <Text style={styles.statLabel}>댓글</Text>
        </View>
      </View>

      {/* 혜택 안내 */}
      <View style={styles.benefitBanner}>
        <Ionicons name="gift" size={24} color="#FF6B35" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.benefitTitle}>프로필 작성 혜택</Text>
          <Text style={styles.benefitText}>
            ✓ 종이 잡지 무료 배송 (매월){"\n"}✓ 디지털 뉴스 무제한{"\n"}✓ 한인
            커뮤니티 이벤트 초대
          </Text>
        </View>
      </View>

      {/* 기본 정보 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>기본 정보</Text>
        </View>

        <Text style={styles.inputLabel}>이름 *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="이름을 입력하세요"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.inputLabel}>전화번호 (베트남) *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="+84 901234567"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.inputLabel}>나이대</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={ageGroup} onValueChange={setAgeGroup}>
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="20대" value="20대" />
            <Picker.Item label="30대" value="30대" />
            <Picker.Item label="40대" value="40대" />
            <Picker.Item label="50대" value="50대" />
            <Picker.Item label="60대 이상" value="60대+" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>성별</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={gender} onValueChange={setGender}>
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="남" value="남" />
            <Picker.Item label="여" value="여" />
            <Picker.Item label="선택 안 함" value="선택안함" />
          </Picker>
        </View>
      </View>

      {/* 배송 주소 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="location" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>배송 주소 (잡지 받을 곳)</Text>
        </View>

        <Text style={styles.inputLabel}>도시 *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(value) => {
              setSelectedCity(value);
              setSelectedDistrict("");
              setSelectedApartment("");
            }}
          >
            <Picker.Item label="도시 선택" value="" />
            <Picker.Item label="호치민" value="호치민" />
            <Picker.Item label="하노이" value="하노이" />
            <Picker.Item label="다낭" value="다낭" />
            <Picker.Item label="냐짱" value="냐짱" />
          </Picker>
        </View>

        {selectedCity && (
          <>
            <Text style={styles.inputLabel}>구/군 (District) *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedDistrict}
                onValueChange={(value) => {
                  setSelectedDistrict(value);
                  setSelectedApartment("");
                }}
              >
                <Picker.Item label="구/군 선택" value="" />
                {districts.map((district) => (
                  <Picker.Item
                    key={district}
                    label={district}
                    value={district}
                  />
                ))}
              </Picker>
            </View>
          </>
        )}

        {selectedDistrict && apartments.length > 0 && (
          <>
            <Text style={styles.inputLabel}>아파트/빌라 (선택사항)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedApartment}
                onValueChange={setSelectedApartment}
              >
                <Picker.Item label="아파트 선택" value="" />
                {apartments.map((apartment) => (
                  <Picker.Item
                    key={apartment}
                    label={apartment}
                    value={apartment}
                  />
                ))}
              </Picker>
            </View>
          </>
        )}

        <Text style={styles.inputLabel}>상세 주소</Text>
        <TextInput
          style={styles.textInput}
          placeholder="101동 2003호"
          value={detailedAddress}
          onChangeText={setDetailedAddress}
        />

        <Text style={styles.inputLabel}>우편번호</Text>
        <TextInput
          style={styles.textInput}
          placeholder="700000"
          value={postalCode}
          onChangeText={setPostalCode}
          keyboardType="numeric"
        />
      </View>

      {/* 베트남 생활 정보 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flag" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>베트남 생활 정보</Text>
        </View>

        <Text style={styles.inputLabel}>베트남 거주 기간</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={residencePeriod}
            onValueChange={setResidencePeriod}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="6개월 미만" value="6개월미만" />
            <Picker.Item label="6개월~1년" value="6개월-1년" />
            <Picker.Item label="1-3년" value="1-3년" />
            <Picker.Item label="3-5년" value="3-5년" />
            <Picker.Item label="5-10년" value="5-10년" />
            <Picker.Item label="10년 이상" value="10년이상" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>거주 목적</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={residencePurpose}
            onValueChange={setResidencePurpose}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="주재원/파견 근무" value="주재원" />
            <Picker.Item label="현지 취업" value="현지취업" />
            <Picker.Item label="사업/창업" value="사업" />
            <Picker.Item label="유학" value="유학" />
            <Picker.Item label="가족 동반" value="가족동반" />
            <Picker.Item label="은퇴/장기 체류" value="은퇴" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>직업/업종</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={occupation} onValueChange={setOccupation}>
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="제조업 (삼성, LG 등)" value="제조업" />
            <Picker.Item label="IT/소프트웨어" value="IT" />
            <Picker.Item label="금융/보험" value="금융" />
            <Picker.Item label="무역/물류" value="무역" />
            <Picker.Item label="요식업/서비스업" value="요식업" />
            <Picker.Item label="자영업/창업" value="자영업" />
            <Picker.Item label="학생" value="학생" />
            <Picker.Item label="주부" value="주부" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>
      </View>

      {/* SNS 연락처 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="chatbubbles" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>SNS 연락처</Text>
        </View>

        <Text style={styles.inputLabel}>카카오톡 ID</Text>
        <TextInput
          style={styles.textInput}
          placeholder="hongvn"
          value={kakaoId}
          onChangeText={setKakaoId}
        />

        <Text style={styles.inputLabel}>Zalo ID</Text>
        <TextInput
          style={styles.textInput}
          placeholder="0901234567"
          value={zaloId}
          onChangeText={setZaloId}
        />

        <Text style={styles.inputLabel}>Facebook</Text>
        <TextInput
          style={styles.textInput}
          placeholder="facebook.com/yourname"
          value={facebook}
          onChangeText={setFacebook}
        />

        <Text style={styles.inputLabel}>Instagram</Text>
        <TextInput
          style={styles.textInput}
          placeholder="@yourname"
          value={instagram}
          onChangeText={setInstagram}
        />
      </View>

      {/* 잡지 관련 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="newspaper" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>잡지 관련 정보</Text>
        </View>

        <Text style={styles.inputLabel}>
          씬짜오베트남을 어떻게 알게 되셨나요?
        </Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={howDidYouKnow}
            onValueChange={setHowDidYouKnow}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="지인 소개" value="지인소개" />
            <Picker.Item label="페이스북 광고" value="페이스북" />
            <Picker.Item label="인터넷 검색" value="검색" />
            <Picker.Item label="한인마트/식당에서" value="한인마트" />
            <Picker.Item label="기존 구독자" value="구독자" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>관심 있는 콘텐츠 (복수선택 가능)</Text>
        {interestOptions.map((interest) => (
          <TouchableOpacity
            key={interest}
            style={styles.checkboxItem}
            onPress={() => toggleInterest(interest)}
          >
            <Ionicons
              name={
                interests.includes(interest) ? "checkbox" : "square-outline"
              }
              size={24}
              color={interests.includes(interest) ? "#FF6B35" : "#999"}
            />
            <Text style={styles.checkboxLabel}>{interest}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.inputLabel}>언어 선호도</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={languagePreference}
            onValueChange={setLanguagePreference}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="한국어 위주" value="한국어" />
            <Picker.Item label="베트남어 병기 선호" value="베트남어병기" />
            <Picker.Item label="영어 병기 선호" value="영어병기" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>희망사항 (200자 이내)</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="추가했으면 하는 콘텐츠나 개선사항을 자유롭게 적어주세요"
          value={suggestions}
          onChangeText={setSuggestions}
          multiline
          numberOfLines={4}
          maxLength={200}
        />
      </View>

      {/* 마케팅 동의 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="mail" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>알림 수신 동의</Text>
        </View>

        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() =>
            setMarketingConsent({
              ...marketingConsent,
              events: !marketingConsent.events,
            })
          }
        >
          <Ionicons
            name={marketingConsent.events ? "checkbox" : "square-outline"}
            size={24}
            color={marketingConsent.events ? "#FF6B35" : "#999"}
          />
          <Text style={styles.checkboxLabel}>이벤트/프로모션 알림</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() =>
            setMarketingConsent({
              ...marketingConsent,
              discounts: !marketingConsent.discounts,
            })
          }
        >
          <Ionicons
            name={marketingConsent.discounts ? "checkbox" : "square-outline"}
            size={24}
            color={marketingConsent.discounts ? "#FF6B35" : "#999"}
          />
          <Text style={styles.checkboxLabel}>한인 업체 할인 정보</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() =>
            setMarketingConsent({
              ...marketingConsent,
              surveys: !marketingConsent.surveys,
            })
          }
        >
          <Ionicons
            name={marketingConsent.surveys ? "checkbox" : "square-outline"}
            size={24}
            color={marketingConsent.surveys ? "#FF6B35" : "#999"}
          />
          <Text style={styles.checkboxLabel}>설문조사 참여 (답례품 제공)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxItem}
          onPress={() =>
            setMarketingConsent({
              ...marketingConsent,
              partnerships: !marketingConsent.partnerships,
            })
          }
        >
          <Ionicons
            name={marketingConsent.partnerships ? "checkbox" : "square-outline"}
            size={24}
            color={marketingConsent.partnerships ? "#FF6B35" : "#999"}
          />
          <Text style={styles.checkboxLabel}>광고주 제휴 혜택</Text>
        </TouchableOpacity>
      </View>

      {/* 저장 버튼 */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (!name || !phone || !selectedCity || !selectedDistrict || isSaving) &&
            styles.saveButtonDisabled,
        ]}
        onPress={saveProfile}
        disabled={
          !name || !phone || !selectedCity || !selectedDistrict || isSaving
        }
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>
              프로필 저장하고 무료 구독 신청
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* 메뉴 섹션 */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={handleAppSettings}>
          <Ionicons name="settings-outline" size={24} color="#333" />
          <Text style={styles.menuText}>앱 설정</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
          <Ionicons name="information-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>앱 정보</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
          <Text style={styles.menuText}>도움말</Text>
          <Ionicons name="chevron-forward" size={20} color="#C6C6C8" />
        </TouchableOpacity>
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>버전 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  profileHeader: {
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  usernameContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc3545",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
  },
  email: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginTop: 12,
    paddingVertical: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#666",
  },
  divider: {
    width: 1,
    backgroundColor: "#e0e0e0",
  },
  benefitBanner: {
    flexDirection: "row",
    backgroundColor: "#FFF8F3",
    marginTop: 12,
    padding: 16,
    borderRadius: 8,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#FFE0CC",
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  benefitText: {
    fontSize: 12,
    color: "#666",
    lineHeight: 18,
  },
  section: {
    backgroundColor: "#fff",
    marginTop: 12,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginBottom: 6,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 14,
    color: "#333",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 24,
    gap: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6C6C8",
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    marginLeft: 12,
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 12,
    color: "#999",
  },
});
