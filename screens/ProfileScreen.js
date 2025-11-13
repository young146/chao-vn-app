import React, { useState, useEffect, useRef } from "react";
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
  const scrollViewRef = useRef(null);
  const detailedAddressRef = useRef(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  const [stats, setStats] = useState({
    bookmarks: 0,
    comments: 0,
  });

  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");

  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");
  const [detailedAddress, setDetailedAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [residencePeriod, setResidencePeriod] = useState("");
  const [residencePurpose, setResidencePurpose] = useState("");
  const [occupation, setOccupation] = useState("");

  const [kakaoId, setKakaoId] = useState("");
  const [zaloId, setZaloId] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");

  const [howDidYouKnow, setHowDidYouKnow] = useState("");
  const [interests, setInterests] = useState([]);
  const [languagePreference, setLanguagePreference] = useState("");
  const [suggestions, setSuggestions] = useState("");

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
        setEmail(data.email || "");
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

        // 프로필 완성 여부 확인
        const isComplete =
          data.email &&
          data.name &&
          data.phone &&
          data.city &&
          data.district &&
          data.residencePeriod &&
          data.residencePurpose &&
          data.occupation;

        setIsProfileComplete(isComplete);
        setIsEditMode(!isComplete);

        console.log("✅ 프로필 로드 완료, 완성 여부:", isComplete);
      } else {
        // 프로필이 없으면 Edit 모드
        setIsEditMode(true);
        setIsProfileComplete(false);
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

      if (!user || !user.uid) {
        throw new Error("로그인되지 않았습니다. 다시 로그인해주세요.");
      }

      console.log("⏳ 이미지 fetch 중...");
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`이미지 fetch 실패: ${response.status}`);
      }
      console.log("✅ 이미지 fetch 성공");

      console.log("⏳ Blob 생성 중...");
      const blob = await response.blob();
      console.log("✅ Blob 생성 성공, 크기:", blob.size, "bytes");

      if (blob.size === 0) {
        throw new Error("이미지 파일이 비어있습니다.");
      }

      const filename = `profile_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, `profileImages/${filename}`);
      console.log("📁 Storage 경로:", storageRef.fullPath);

      console.log("⏳ Firebase Storage에 업로드 중...");
      await uploadBytes(storageRef, blob);
      console.log("✅ uploadBytes 성공");

      console.log("⏳ Download URL 받기 중...");
      const downloadURL = await getDownloadURL(storageRef);
      console.log("✅ Download URL 받기 성공");

      console.log("⏳ Firestore에 저장 중...");
      await setDoc(
        doc(db, "users", user.uid),
        { profileImage: downloadURL },
        { merge: true }
      );
      console.log("✅ Firestore 저장 성공");

      setProfileImage(downloadURL);
      Alert.alert("✅ 성공", "프로필 사진이 업데이트되었습니다!");
    } catch (error) {
      console.error("❌ 사진 업로드 실패:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);

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
    if (!email || !name || !phone) {
      Alert.alert(
        "입력 오류",
        "이메일, 이름, 전화번호는 필수 입력 항목입니다."
      );
      return;
    }

    if (!selectedCity || !selectedDistrict) {
      Alert.alert("입력 오류", "도시와 구/군을 선택해주세요.");
      return;
    }

    try {
      setIsSaving(true);

      console.log("=== 프로필 저장 시작 ===");

      const isProfileIncomplete =
        !email ||
        !selectedCity ||
        !selectedDistrict ||
        !residencePeriod ||
        !residencePurpose ||
        !occupation;

      console.log(
        "📊 프로필 완성도:",
        !isProfileIncomplete ? "완전" : "불완전"
      );

      // ✅ setDoc으로 프로필 저장
      await setDoc(
        doc(db, "users", user.uid),
        {
          email,
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

          isProfileIncomplete,
          userProfile: {
            city: selectedCity,
            district: selectedDistrict,
          },

          profileCompletedAt: new Date().toISOString(),
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // ✅ 처음 저장하는 경우 createdAt 추가
      const userDocCheck = await getDoc(doc(db, "users", user.uid));
      if (!userDocCheck.data()?.createdAt) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            createdAt: new Date(),
          },
          { merge: true }
        );
        console.log("✅ createdAt 추가 완료");
      }

      console.log("✅ 프로필 저장 성공!");

      // 프로필 완성 상태 업데이트
      setIsProfileComplete(!isProfileIncomplete);
      setIsEditMode(false);

      // 상세주소 여부 확인
      const hasDetailedAddress = detailedAddress && detailedAddress.trim();
      if (hasDetailedAddress) {
        Alert.alert(
          "✅ 저장 완료!",
          "프로필이 저장되었습니다!\n\n📦 담당자가 2-3일 내 전화로 배송지를 확인한 후\n무료 잡지를 보내드립니다.",
          [{ text: "확인" }]
        );
      } else {
        Alert.alert(
          "✅ 저장 완료!",
          "프로필이 저장되었습니다!\n\n💡 잡지 무료 배송을 원하시면\n'수정' 버튼을 눌러 '상세 주소'를 입력해주세요.",
          [{ text: "확인" }]
        );
      }
    } catch (error) {
      console.error("❌ 프로필 저장 실패:", error);
      Alert.alert("오류", `프로필 저장에 실패했습니다.\n\n${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    if (isProfileComplete) {
      setIsEditMode(false);
      loadUserProfile();
    } else {
      Alert.alert(
        "프로필 미완성",
        "프로필을 완성해야 다른 기능을 사용할 수 있습니다.",
        [{ text: "확인" }]
      );
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

  // View 모드 (완성된 프로필 보기)
  if (!isEditMode && isProfileComplete) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
            {uploading ? (
              <View style={styles.avatar}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.avatarImage}
              />
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
            <Text style={styles.username}>{name || "User"}</Text>
            {isAdmin() && (
              <View style={styles.adminBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
                <Text style={styles.adminBadgeText}>ADMIN</Text>
              </View>
            )}
          </View>
          <Text style={styles.email}>{email}</Text>
        </View>

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

        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={20} color="#fff" />
          <Text style={styles.editButtonText}>프로필 수정</Text>
        </TouchableOpacity>

        {/* 프로필 정보 표시 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>기본 정보</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이메일</Text>
            <Text style={styles.infoValue}>{email || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>이름</Text>
            <Text style={styles.infoValue}>{name || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>전화번호</Text>
            <Text style={styles.infoValue}>{phone || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>나이대</Text>
            <Text style={styles.infoValue}>{ageGroup || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>성별</Text>
            <Text style={styles.infoValue}>{gender || "-"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>주소</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>도시</Text>
            <Text style={styles.infoValue}>{selectedCity || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>구/군</Text>
            <Text style={styles.infoValue}>{selectedDistrict || "-"}</Text>
          </View>
          {selectedApartment && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>아파트</Text>
              <Text style={styles.infoValue}>{selectedApartment}</Text>
            </View>
          )}
          {detailedAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>상세 주소</Text>
              <Text style={styles.infoValue}>{detailedAddress}</Text>
            </View>
          )}
          {postalCode && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>우편번호</Text>
              <Text style={styles.infoValue}>{postalCode}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="briefcase-outline" size={20} color="#FF6B35" />
            <Text style={styles.sectionTitle}>거주 및 직업</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>거주 기간</Text>
            <Text style={styles.infoValue}>{residencePeriod || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>거주 목적</Text>
            <Text style={styles.infoValue}>{residencePurpose || "-"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>직업</Text>
            <Text style={styles.infoValue}>{occupation || "-"}</Text>
          </View>
        </View>

        {(kakaoId || zaloId || facebook || instagram) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="share-social-outline" size={20} color="#FF6B35" />
              <Text style={styles.sectionTitle}>SNS</Text>
            </View>
            {kakaoId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>카카오톡</Text>
                <Text style={styles.infoValue}>{kakaoId}</Text>
              </View>
            )}
            {zaloId && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Zalo</Text>
                <Text style={styles.infoValue}>{zaloId}</Text>
              </View>
            )}
            {facebook && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Facebook</Text>
                <Text style={styles.infoValue}>{facebook}</Text>
              </View>
            )}
            {instagram && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Instagram</Text>
                <Text style={styles.infoValue}>{instagram}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem} onPress={handleAppSettings}>
            <Ionicons name="settings-outline" size={20} color="#666" />
            <Text style={styles.menuText}>앱 설정</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
            <Ionicons name="help-circle-outline" size={20} color="#666" />
            <Text style={styles.menuText}>도움말</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color="#666"
            />
            <Text style={styles.menuText}>앱 정보</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>씬짜오 베트남 v1.0.0</Text>
        </View>
      </ScrollView>
    );
  }

  // Edit 모드 (프로필 작성/수정)
  return (
    <ScrollView ref={scrollViewRef} style={styles.container}>
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
        <Text style={styles.email}>{email || user?.email || ""}</Text>
      </View>

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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>기본 정보</Text>
        </View>

        <Text style={styles.inputLabel}>이메일 *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="example@email.com"
          placeholderTextColor="#bbb"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>이름 *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="이름을 입력하세요"
          placeholderTextColor="#bbb"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.inputLabel}>전화번호 (베트남) *</Text>
        <TextInput
          style={styles.textInput}
          placeholder="+84 901234567"
          placeholderTextColor="#bbb"
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
          ref={detailedAddressRef}
          style={styles.textInput}
          placeholder="101동 2003호"
          placeholderTextColor="#bbb"
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

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="briefcase-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>거주 및 직업 정보</Text>
        </View>

        <Text style={styles.inputLabel}>베트남 거주 기간</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={residencePeriod}
            onValueChange={setResidencePeriod}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="6개월 미만" value="6개월 미만" />
            <Picker.Item label="6개월~1년" value="6개월~1년" />
            <Picker.Item label="1년~3년" value="1년~3년" />
            <Picker.Item label="3년~5년" value="3년~5년" />
            <Picker.Item label="5년 이상" value="5년 이상" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>거주 목적</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={residencePurpose}
            onValueChange={setResidencePurpose}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="현지 취업" value="현지 취업" />
            <Picker.Item label="사업/투자" value="사업/투자" />
            <Picker.Item label="주재원" value="주재원" />
            <Picker.Item label="유학" value="유학" />
            <Picker.Item label="배우자 동반" value="배우자 동반" />
            <Picker.Item label="은퇴 후 거주" value="은퇴 후 거주" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>직업/업종</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={occupation} onValueChange={setOccupation}>
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="IT/소프트웨어" value="IT/소프트웨어" />
            <Picker.Item label="제조업" value="제조업" />
            <Picker.Item label="금융/회계" value="금융/회계" />
            <Picker.Item label="교육" value="교육" />
            <Picker.Item label="요식업/서비스업" value="요식업/서비스업" />
            <Picker.Item label="무역" value="무역" />
            <Picker.Item label="자영업" value="자영업" />
            <Picker.Item label="학생" value="학생" />
            <Picker.Item label="주부" value="주부" />
            <Picker.Item label="은퇴" value="은퇴" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="share-social-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>SNS (선택사항)</Text>
        </View>

        <Text style={styles.inputLabel}>카카오톡 ID</Text>
        <TextInput
          style={styles.textInput}
          placeholder="카카오톡 ID"
          placeholderTextColor="#bbb"
          value={kakaoId}
          onChangeText={setKakaoId}
        />

        <Text style={styles.inputLabel}>Zalo ID</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Zalo ID"
          placeholderTextColor="#bbb"
          value={zaloId}
          onChangeText={setZaloId}
        />

        <Text style={styles.inputLabel}>Facebook</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Facebook 계정"
          placeholderTextColor="#bbb"
          value={facebook}
          onChangeText={setFacebook}
        />

        <Text style={styles.inputLabel}>Instagram</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Instagram 계정"
          placeholderTextColor="#bbb"
          value={instagram}
          onChangeText={setInstagram}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>관심사 및 선호</Text>
        </View>

        <Text style={styles.inputLabel}>
          씬짜오 베트남을 어떻게 알게 되셨나요?
        </Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={howDidYouKnow}
            onValueChange={setHowDidYouKnow}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="검색엔진 (구글, 네이버)" value="검색엔진" />
            <Picker.Item label="지인 추천" value="지인 추천" />
            <Picker.Item label="SNS (페이스북, 카카오톡)" value="SNS" />
            <Picker.Item label="한인 커뮤니티" value="한인 커뮤니티" />
            <Picker.Item label="현지 한인 업체" value="현지 한인 업체" />
            <Picker.Item label="기타" value="기타" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>관심 분야 (복수 선택 가능)</Text>
        <View style={styles.interestsGrid}>
          {interestOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.interestButton,
                interests.includes(option) && styles.interestButtonSelected,
              ]}
              onPress={() => toggleInterest(option)}
            >
              <Text
                style={[
                  styles.interestButtonText,
                  interests.includes(option) &&
                    styles.interestButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>선호 언어</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={languagePreference}
            onValueChange={setLanguagePreference}
          >
            <Picker.Item label="선택하세요" value="" />
            <Picker.Item label="한국어" value="한국어" />
            <Picker.Item label="베트남어" value="베트남어" />
            <Picker.Item label="영어" value="영어" />
            <Picker.Item label="한국어+베트남어" value="한국어+베트남어" />
          </Picker>
        </View>

        <Text style={styles.inputLabel}>희망하는 콘텐츠나 서비스</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="예) 더 많은 부동산 정보, 한인 맛집 리뷰 등"
          placeholderTextColor="#bbb"
          value={suggestions}
          onChangeText={setSuggestions}
          multiline
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="notifications-outline" size={20} color="#FF6B35" />
          <Text style={styles.sectionTitle}>마케팅 수신 동의 (선택)</Text>
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
          <Text style={styles.checkboxLabel}>한인 행사/이벤트 소식</Text>
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
          <Text style={styles.checkboxLabel}>할인/프로모션 정보</Text>
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
          <Text style={styles.checkboxLabel}>설문조사 참여 요청</Text>
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
          <Text style={styles.checkboxLabel}>제휴사 혜택 정보</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonContainer}>
        {isProfileComplete && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelEdit}
          >
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaving && styles.saveButtonDisabled,
            !isProfileComplete && { flex: 1 },
          ]}
          onPress={saveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>저장하기</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={handleAppSettings}>
          <Ionicons name="settings-outline" size={20} color="#666" />
          <Text style={styles.menuText}>앱 설정</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleHelp}>
          <Ionicons name="help-circle-outline" size={20} color="#666" />
          <Text style={styles.menuText}>도움말</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleAppInfo}>
          <Ionicons name="information-circle-outline" size={20} color="#666" />
          <Text style={styles.menuText}>앱 정보</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>씬짜오 베트남 v1.0.0</Text>
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
    paddingVertical: 24,
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
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
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
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
  infoRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  infoLabel: {
    fontSize: 14,
    color: "#666",
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
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
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  interestButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  interestButtonSelected: {
    backgroundColor: "#FFE5D9",
    borderColor: "#FF6B35",
  },
  interestButtonText: {
    fontSize: 13,
    color: "#666",
  },
  interestButtonTextSelected: {
    color: "#FF6B35",
    fontWeight: "600",
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
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#999",
    paddingVertical: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    borderRadius: 8,
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
