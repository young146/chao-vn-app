import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, Alert, Linking, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import {
  collection,
  query,
  where,
  getCountFromServer,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { auth } from "../firebase/config";
import { deleteUser } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import ProfileView from "../components/profile/ProfileView";
import ProfileEditForm from "../components/profile/ProfileEditForm";

export default function ProfileScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation(["menu", "common"]);
  const scrollViewRef = useRef(null);

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

  // 화면 진입 시마다 프로필 재로드 (탭 전환 포함)
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadStats();
        loadUserProfile();
      }
    }, [user?.uid])
  );

  // 이메일이 비어있고 user.email이 있으면 자동 채움 (editable=false 대비)
  useEffect(() => {
    if (!email && user?.email) {
      setEmail(user.email);
    }
    if (!name && user?.displayName) {
      setName(user.displayName);
    }
  }, [user?.email, user?.displayName, email, name]);

  const loadStats = async () => {
    try {
      const bookmarksQuery = query(
        collection(db, "bookmarks"),
        where("userId", "==", user?.uid),
      );
      const commentsQuery = query(
        collection(db, "comments"),
        where("userId", "==", user?.uid),
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

        let cityValue = data.city || "";
        const districtValue = data.district || "";
        const apartmentValue = data.apartment || "";

        if (cityValue) {
          cityValue = cityValue.trim();
        }

        setSelectedCity(cityValue);
        setSelectedDistrict(districtValue);
        setSelectedApartment(apartmentValue);
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
          },
        );

        const isComplete =
          data.email && data.name && data.phone && data.city && data.district;

        setIsProfileComplete(isComplete);
        setIsEditMode(!isComplete);
      } else {
        // Firestore 문서 없음 (탈퇴 후 재로그인 등)
        // Firebase Auth 기본 정보로 pre-fill
        setEmail(user.email || "");
        setName(user.displayName || "");
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
      if (!user || !user.uid) throw new Error("로그인되지 않았습니다.");

      // ✅ iOS에서 fetch+blob 실패 → XMLHttpRequest로 blob 생성
      const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new Error("파일 읽기 실패"));
        xhr.responseType = "blob";
        xhr.open("GET", uri, true);
        xhr.send(null);
      });

      // ✅ storage lazy init 문제 해결: import한 null 대신 getStorageSync() 사용
      const { getStorageSync } = require("../firebase/config");
      const storageInstance = getStorageSync();

      const filename = `profile_${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storageInstance, `profileImages/${filename}`);

      await uploadBytes(storageRef, blob);
      if (blob.close) blob.close(); // 메모리 해제

      const downloadURL = await getDownloadURL(storageRef);

      await setDoc(
        doc(db, "users", user.uid),
        { profileImage: downloadURL },
        { merge: true },
      );

      setProfileImage(downloadURL);
      Alert.alert("✅ 성공", "프로필 사진이 업데이트되었습니다!");
    } catch (error) {
      console.error("❌ 사진 업로드 실패:", error);
      Alert.alert("오류", `사진 업로드에 실패했습니다.\n${error.message}`);
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
        "이메일, 이름, 전화번호는 필수 입력 항목입니다.",
      );
      return;
    }

    if (!selectedCity || !selectedDistrict) {
      Alert.alert("입력 오류", "도시와 구/군을 선택해주세요.");
      return;
    }

    try {
      setIsSaving(true);

      const isProfileIncomplete = !email || !selectedCity || !selectedDistrict;

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
        { merge: true },
      );

      const userDocCheck = await getDoc(doc(db, "users", user.uid));
      if (!userDocCheck.data()?.createdAt) {
        await setDoc(
          doc(db, "users", user.uid),
          { createdAt: new Date() },
          { merge: true },
        );
      }

      setIsProfileComplete(!isProfileIncomplete);
      setIsEditMode(false);

      Alert.alert("✅ 저장 완료!", "프로필이 저장되었습니다.");
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
        [{ text: "확인" }],
      );
    }
  };

  // ─────────────────────────────────────────────────────
  // 회원 탈퇴 (Firebase Auth 계정 + Firestore 데이터 삭제)
  // ─────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    Alert.alert(
      "⚠️ 회원 탈퇴",
      "탈퇴하면 모든 데이터가 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "탈퇴하기",
          style: "destructive",
          onPress: async () => {
            setIsSaving(true);
            try {
              // 1. Firestore 사용자 문서 삭제
              await deleteDoc(doc(db, "users", user.uid));
              // 2. Firebase Auth 계정 삭제 (자동 로그아웃 포함)
              await deleteUser(auth.currentUser);
              // 3. 로컬 캐시 정리
              await AsyncStorage.removeItem("@user_id");
            } catch (error) {
              // auth.currentUser가 null이면 삭제 성공 (unmount 에러 무시)
              if (auth.currentUser !== null) {
                setIsSaving(false);
                if (error.code === "auth/requires-recent-login") {
                  Alert.alert("재로그인 필요", "보안을 위해 다시 로그인 후 탈퇴해 주세요.", [{ text: "확인" }]);
                } else {
                  Alert.alert("오류", `탈퇴 처리 중 오류가 발생했습니다.\n(${error.code || error.message})`);
                }
                return;
              }
            }
            // 삭제 성공 — 성공 메시지 + 로그인 화면으로 이동
            Alert.alert(
              "✅ 탈퇴 완료",
              "계정이 완전히 삭제되었습니다.\n이용해 주셔서 감사합니다.",
              [{
                text: "확인",
                onPress: () => navigation.navigate("로그인"),
              }]
            );
          },
        },
      ]
    );
  };

  // ProfileEditForm 하위 호환 (기존 onDelete prop)
  const handleDeleteProfile = handleDeleteAccount;

  const handleAppSettings = () => {
    Alert.alert("앱 설정", "언어: 한국어\n알림: 켜짐\n테마: 라이트 모드", [
      { text: "확인" },
    ]);
  };

  const handleAppInfo = () => {
    Alert.alert(
      "앱 정보",
      "씬짜오 베트남 뉴스\n버전: 2.2.4\n개발자: Chao Vietnam Team",
      [
        { text: "확인" },
        {
          text: "웹사이트 방문",
          onPress: () => Linking.openURL("https://chaovietnam.co.kr"),
        },
      ],
    );
  };

  const handleHelp = () => {
    Alert.alert(
      "도움말",
      "문의사항이 있으시면 이메일로 연락주세요:\ninfo@chaovietnam.co.kr",
      [
        { text: "확인" },
        {
          text: "이메일 보내기",
          onPress: () => Linking.openURL("mailto:info@chaovietnam.co.kr"),
        },
      ],
    );
  };

  if (!isEditMode && isProfileComplete) {
    return (
      <ProfileView
        user={user}
        profileImage={profileImage}
        uploading={uploading}
        name={name}
        email={email}
        isAdmin={isAdmin}
        stats={stats}
        city={selectedCity}
        district={selectedDistrict}
        apartment={selectedApartment}
        detailedAddress={detailedAddress}
        postalCode={postalCode}
        residencePeriod={residencePeriod}
        residencePurpose={residencePurpose}
        occupation={occupation}
        kakaoId={kakaoId}
        zaloId={zaloId}
        facebook={facebook}
        instagram={instagram}
        onPickImage={pickImage}
        onEdit={handleEdit}
        onAppSettings={handleAppSettings}
        onHelp={handleHelp}
        onAppInfo={handleAppInfo}
        onDeleteAccount={handleDeleteAccount}
      />
    );
  }

  return (
    <ProfileEditForm
      user={user}
      profileImage={profileImage}
      uploading={uploading}
      name={name}
      setName={setName}
      email={email}
      setEmail={setEmail}
      phone={phone}
      setPhone={setPhone}
      ageGroup={ageGroup}
      setAgeGroup={setAgeGroup}
      gender={gender}
      setGender={setGender}
      selectedCity={selectedCity}
      setSelectedCity={setSelectedCity}
      selectedDistrict={selectedDistrict}
      setSelectedDistrict={setSelectedDistrict}
      selectedApartment={selectedApartment}
      setSelectedApartment={setSelectedApartment}
      detailedAddress={detailedAddress}
      setDetailedAddress={setDetailedAddress}
      postalCode={postalCode}
      setPostalCode={setPostalCode}
      residencePeriod={residencePeriod}
      setResidencePeriod={setResidencePeriod}
      residencePurpose={residencePurpose}
      setResidencePurpose={setResidencePurpose}
      occupation={occupation}
      setOccupation={setOccupation}
      kakaoId={kakaoId}
      setKakaoId={setKakaoId}
      zaloId={zaloId}
      setZaloId={setZaloId}
      facebook={facebook}
      setFacebook={setFacebook}
      instagram={instagram}
      setInstagram={setInstagram}
      interests={interests}
      toggleInterest={toggleInterest}
      onPickImage={pickImage}
      onSave={saveProfile}
      onCancel={handleCancelEdit}
      onDelete={handleDeleteProfile}
      isSaving={isSaving}
      isAdmin={isAdmin}
    />
  );
}
