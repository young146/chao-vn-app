import { StackActions } from "@react-navigation/native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

const ACCENT = "#E91E63";

const CITIES = ["호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "달랏", "후에", "호이안", "기타"];

// 도시별 구/군 목록
const DISTRICTS = {
  호치민: [
    "1군", "3군", "4군", "5군", "6군", "7군", "8군", "10군", "11군", "12군",
    "Bình Thạnh", "Gò Vấp", "Phú Nhuận", "Tân Bình", "Tân Phú",
    "Bình Tân", "Thủ Đức", "Củ Chi", "Hóc Môn", "Bình Chánh", "Nhà Bè", "Cần Giờ",
  ],
  하노이: [
    "Ba Đình", "Hoàn Kiếm", "Tây Hồ", "Long Biên", "Cầu Giấy",
    "Đống Đa", "Hai Bà Trưng", "Hoàng Mai", "Thanh Xuân", "Nam Từ Liêm",
    "Bắc Từ Liêm", "Hà Đông", "Sơn Tây", "기타",
  ],
  다낭: ["Hải Châu", "Thanh Khê", "Sơn Trà", "Ngũ Hành Sơn", "Liên Chiểu", "Cẩm Lệ", "Hòa Vang", "기타"],
  냐짱: ["Vĩnh Hải", "Vĩnh Phước", "Vĩnh Thọ", "Xương Huân", "Phương Sài", "Ngọc Hiệp", "기타"],
  붕따우: ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 7", "Phường 8", "Phường 9", "Phường 10", "Phường 11", "Phường 12", "기타"],
  빈증: ["Thủ Dầu Một", "Dĩ An", "Thuận An", "Bến Cát", "Tân Uyên", "기타"],
  동나이: ["Biên Hòa", "Long Khánh", "Nhơn Trạch", "Long Thành", "기타"],
  달랏: ["Phường 1", "Phường 2", "Phường 3", "Phường 4", "Phường 5", "Phường 6", "Phường 7", "Phường 8", "Phường 9", "Phường 10", "Phường 11", "Phường 12", "기타"],
  후에: ["Phú Hội", "Phú Nhuận", "Vĩnh Ninh", "Tây Lộc", "기타"],
  호이안: ["Minh An", "Cẩm Phô", "Thanh Hà", "Cửa Đại", "기타"],
  기타: ["기타"],
};

export default function AddAgentScreen({ navigation, route }) {
  const { user, isAdmin } = useAuth();
  const editAgent = route?.params?.editAgent;
  const isEditMode = !!editAgent;

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [kakaoId, setKakaoId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [description, setDescription] = useState("");
  const [profileImage, setProfileImage] = useState(null);

  // 주소 필드
  const [city, setCity] = useState("호치민");
  const [district, setDistrict] = useState("");
  const [addressDetail, setAddressDetail] = useState("");

  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // 확인 대기 중인 이미지

  // 수정 모드 데이터 로드
  useEffect(() => {
    if (isEditMode && editAgent) {
      setName(editAgent.name || "");
      setCompany(editAgent.company || "");
      setPhone(editAgent.phone || "");
      setKakaoId(editAgent.kakaoId || "");
      setLicenseNumber(editAgent.licenseNumber || "");
      setExperienceYears(String(editAgent.experienceYears || ""));
      setDescription(editAgent.description || "");
      setProfileImage(editAgent.profileImage || null);
      setCity(editAgent.city || "호치민");
      setDistrict(editAgent.district || "");
      setAddressDetail(editAgent.addressDetail || "");
    }
  }, [isEditMode, editAgent]);

  // 도시 변경 시 구/군 초기화
  const handleCitySelect = (c) => {
    setCity(c);
    setShowCityPicker(false);
    // 기존 구/군이 새 도시 목록에 없으면 초기화
    const newDistricts = DISTRICTS[c] || ["기타"];
    if (!newDistricts.includes(district)) {
      setDistrict("");
    }
  };

  // ── 이미지 선택 ──
  const pickImage = () => {
    Alert.alert("프로필 사진", "방법을 선택하세요", [
      { text: "📷 카메라", onPress: takePhoto },
      { text: "🖼️ 갤러리", onPress: pickFromGallery },
      { text: "취소", style: "cancel" },
    ]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setPendingImage(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setPendingImage(result.assets[0].uri);
  };

  const confirmImage = () => {
    setProfileImage(pendingImage);
    setPendingImage(null);
  };

  const cancelImage = () => {
    setPendingImage(null);
  };

  const uploadImage = async (uri) => {
    if (!uri || uri.startsWith("https://")) return uri;
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri, [{ resize: { width: 400 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const blob = await (await fetch(resized.uri)).blob();
      const filename = `agents/${user.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error("이미지 업로드 실패:", e);
      return null;
    }
  };

  // ── 유효성 검사 ──
  const validate = () => {
    if (!name.trim()) { Alert.alert("⚠️", "이름을 입력해주세요."); return false; }
    if (!phone.trim()) { Alert.alert("⚠️", "전화번호를 입력해주세요."); return false; }
    if (!city) { Alert.alert("⚠️", "도시를 선택해주세요."); return false; }
    if (!district.trim()) { Alert.alert("⚠️", "구/군을 입력해주세요."); return false; }
    if (!addressDetail.trim()) { Alert.alert("⚠️", "상세 주소를 입력해주세요."); return false; }
    return true;
  };

  // ── 제출 ──
  const handleSubmit = async () => {
    if (!validate()) return;
    setUploading(true);
    try {
      const imageUrl = profileImage ? await uploadImage(profileImage) : null;

      const agentData = {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        kakaoId: kakaoId.trim(),
        licenseNumber: licenseNumber.trim(),
        experienceYears: parseInt(experienceYears) || 0,
        description: description.trim(),
        profileImage: imageUrl,
        city,
        district: district.trim(),
        addressDetail: addressDetail.trim(),
        userId: user.uid,
        userEmail: user.email,
      };

      if (isEditMode) {
        await updateDoc(doc(db, "Agents", editAgent.id), {
          ...agentData,
          updatedAt: serverTimestamp(),
        });
        Alert.alert("완료", "중개인 프로필이 수정되었습니다.", [
          { text: "확인", onPress: () => navigation.goBack() },
        ]);
      } else {
        await addDoc(collection(db, "Agents"), {
          ...agentData,
          createdAt: serverTimestamp(),
        });
        Alert.alert("완료", "중개인 프로필이 등록되었습니다!", [
          { text: "확인", onPress: () => navigation.dispatch(StackActions.pop(1)) },
        ]);
      }
    } catch (e) {
      console.error("중개인 등록 실패:", e);
      Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  // ── 삭제 ──
  const handleDelete = () => {
    if (!isEditMode) return;
    const canDelete = editAgent.userId === user?.uid || isAdmin?.();
    if (!canDelete) { Alert.alert("권한 없음", "삭제 권한이 없습니다."); return; }

    Alert.alert(
      "중개인 프로필 삭제",
      "삭제하면 복구할 수 없습니다. 계속하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              // 1. 프로필 이미지 삭제
              if (editAgent.profileImage?.startsWith("https://firebasestorage")) {
                try { await deleteObject(ref(storage, editAgent.profileImage)); } catch {}
              }

              // 2. 이 에이전트가 연결된 모든 RealEstate 매물의 agentId/agentSnapshot 초기화
              try {
                const relatedQ = query(
                  collection(db, "RealEstate"),
                  where("agentId", "==", editAgent.id)
                );
                const relatedSnap = await getDocs(relatedQ);
                if (!relatedSnap.empty) {
                  const batch = writeBatch(db);
                  relatedSnap.docs.forEach((d) => {
                    batch.update(d.ref, { agentId: null, agentSnapshot: null });
                  });
                  await batch.commit();
                  console.log(`✅ ${relatedSnap.size}개 매물 에이전트 연결 해제 완료`);
                }
              } catch (batchErr) {
                console.error("매물 에이전트 해제 실패:", batchErr);
              }

              // 3. Agents 문서 삭제
              await deleteDoc(doc(db, "Agents", editAgent.id));

              Alert.alert("완료", "중개인 프로필이 삭제되었습니다.", [
                { text: "확인", onPress: () => navigation.dispatch(StackActions.pop(2)) },
              ]);
            } catch (e) {
              console.error("삭제 실패:", e);
              Alert.alert("오류", "삭제에 실패했습니다.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const canDelete = isEditMode && (editAgent?.userId === user?.uid || isAdmin?.());

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 배너 */}
        <View style={styles.headerBanner}>
          <Ionicons name="home" size={26} color={ACCENT} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>
              {isEditMode ? "중개인 프로필 수정" : "중개인 프로필 등록"}
            </Text>
            <Text style={styles.headerSub}>
              매물에 연결할 중개인 정보를 입력해주세요
            </Text>
          </View>
        </View>

        {/* ── 프로필 사진 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person-circle" size={16} /> 프로필 사진
          </Text>

          {/* 대기 중인 사진 확인 UI */}
          {pendingImage ? (
            <View style={{ alignItems: "center", gap: 12 }}>
              <Image
                source={{ uri: pendingImage }}
                style={[styles.avatar, { width: 120, height: 120, borderRadius: 60 }]}
                contentFit="cover"
              />
              <Text style={{ fontSize: 13, color: "#555" }}>이 사진을 사용하시겠습니까?</Text>
              <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "#f0f0f0", borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
                  onPress={cancelImage}
                >
                  <Text style={{ fontSize: 14, color: "#666", fontWeight: "600" }}>다시 선택</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12, alignItems: "center" }}
                  onPress={confirmImage}
                >
                  <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>이 사진 사용</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatar}
                  contentFit="cover"
                  cachePolicy="none"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#ccc" />
                  <Text style={styles.avatarPlaceholderText}>사진 추가</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 기본 정보 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person" size={16} /> 담당자 이름 *
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="이름을 입력하세요"
            placeholderTextColor="#aaa"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="business" size={16} /> 업체명
          </Text>
          <TextInput
            style={styles.input}
            value={company}
            onChangeText={setCompany}
            placeholder="부동산 업체 이름"
            placeholderTextColor="#aaa"
          />
        </View>

        {/* ── 주소 (필수) ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location" size={16} /> 사무실 주소 *
          </Text>

          {/* 도시 선택 */}
          <Text style={styles.fieldLabel}>도시 *</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setShowCityPicker(!showCityPicker); setShowDistrictPicker(false); }}
          >
            <Text style={styles.pickerBtnText}>{city || "도시 선택"}</Text>
            <Ionicons name={showCityPicker ? "chevron-up" : "chevron-down"} size={16} color="#888" />
          </TouchableOpacity>
          {showCityPicker && (
            <View style={styles.pickerList}>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pickerItem, city === c && styles.pickerItemActive]}
                  onPress={() => handleCitySelect(c)}
                >
                  <Text style={[styles.pickerItemText, city === c && styles.pickerItemTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 구/군 드롭다운 */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>구/군 *</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => { setShowDistrictPicker(!showDistrictPicker); setShowCityPicker(false); }}
          >
            <Text style={[styles.pickerBtnText, !district && { color: "#aaa" }]}>
              {district || "구/군 선택"}
            </Text>
            <Ionicons name={showDistrictPicker ? "chevron-up" : "chevron-down"} size={16} color="#888" />
          </TouchableOpacity>
          {showDistrictPicker && (
            <View style={styles.pickerList}>
              {(DISTRICTS[city] || ["기타"]).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pickerItem, district === d && styles.pickerItemActive]}
                  onPress={() => { setDistrict(d); setShowDistrictPicker(false); }}
                >
                  <Text style={[styles.pickerItemText, district === d && styles.pickerItemTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 상세 주소 */}
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>상세 주소 *</Text>
          <TextInput
            style={styles.input}
            value={addressDetail}
            onChangeText={setAddressDetail}
            placeholder="도로명, 건물명, 층 등"
            placeholderTextColor="#aaa"
          />
        </View>

        {/* ── 연락처 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call" size={16} /> 전화번호 *
          </Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+84-90-0000-0000"
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
          />

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
            <Ionicons name="chatbubble-ellipses" size={16} /> 카카오 ID
          </Text>
          <TextInput
            style={styles.input}
            value={kakaoId}
            onChangeText={setKakaoId}
            placeholder="카카오톡 아이디 (선택)"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
          />
        </View>

        {/* ── 자격 정보 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text" size={16} /> 자격증 번호
          </Text>
          <TextInput
            style={styles.input}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="공인중개사 자격증 번호 (선택)"
            placeholderTextColor="#aaa"
          />

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
            <Ionicons name="time" size={16} /> 경력 (년)
          </Text>
          <TextInput
            style={[styles.input, { width: 120 }]}
            value={experienceYears}
            onChangeText={setExperienceYears}
            placeholder="0"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
          />
        </View>

        {/* ── 소개 ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text" size={16} /> 소개 / 전문 분야
          </Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="전문 분야, 담당 지역, 한 줄 소개 등을 자유롭게 작성해주세요"
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* 제출 버튼 */}
        <TouchableOpacity
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={uploading || deleting}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>
                {isEditMode ? "수정하기" : "중개인 등록하기"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* 삭제 버튼 (수정 모드 + 본인 또는 관리자) */}
        {canDelete && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.submitBtnDisabled]}
            onPress={handleDelete}
            disabled={uploading || deleting}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.deleteBtnText}>중개인 프로필 삭제</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 110 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  content: { padding: 16 },

  headerBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#FFDDE8",
    elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: ACCENT },
  headerSub: { fontSize: 12, color: "#888", marginTop: 2 },

  section: {
    backgroundColor: "#fff", borderRadius: 14,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#ececec",
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 10 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#666", marginBottom: 6 },

  // avatar
  avatarWrap: { alignSelf: "center", position: "relative" },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#f5f5f5",
    borderWidth: 2, borderColor: "#eee", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  avatarPlaceholderText: { fontSize: 11, color: "#aaa" },
  avatarEditBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },

  input: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
    fontSize: 15, color: "#222", backgroundColor: "#fafafa",
  },
  multiline: { minHeight: 90, textAlignVertical: "top", paddingTop: 10 },

  // 도시 드롭다운
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: "#fafafa",
  },
  pickerBtnText: { fontSize: 15, color: "#222" },
  pickerList: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    marginTop: 4, backgroundColor: "#fff", overflow: "hidden",
  },
  pickerItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  pickerItemActive: { backgroundColor: "#FCE4EC" },
  pickerItemText: { fontSize: 14, color: "#333" },
  pickerItemTextActive: { color: ACCENT, fontWeight: "700" },

  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: ACCENT,
    borderRadius: 14, paddingVertical: 16, marginTop: 8, elevation: 3,
  },
  submitBtnDisabled: { backgroundColor: "#E0E0E0" },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  deleteBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#F44336",
    borderRadius: 14, paddingVertical: 14, marginTop: 10, elevation: 2,
  },
  deleteBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
