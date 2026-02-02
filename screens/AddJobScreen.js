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
  useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../contexts/AuthContext";
import { getColors } from "../utils/colors";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AddJobScreen({ navigation, route }) {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  
  const editJob = route?.params?.editJob;
  const isEditMode = !!editJob;

  // 기본 정보
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Jobs 전용 필드
  const [jobType, setJobType] = useState("구인"); // 구인/구직
  const [industry, setIndustry] = useState("식당/요리");
  const [salary, setSalary] = useState("");
  const [employmentType, setEmploymentType] = useState("정규직");
  const [selectedCity, setSelectedCity] = useState("호치민");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [contact, setContact] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("모집중");

  // 구인/구직 타입
  const jobTypes = ["구인", "구직"];

  // 업종 카테고리
  const industries = [
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

  // 고용 형태
  const employmentTypes = ["정규직", "계약직", "파트타임", "인턴", "프리랜서", "협의"];

  // 도시 목록
  const cities = ["호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "기타"];

  // 수정 모드일 때 기존 데이터 로드
  useEffect(() => {
    if (isEditMode && editJob) {
      console.log("📝 수정 모드: 기존 Jobs 데이터 로드", editJob);

      setTitle(editJob.title || "");
      setDescription(editJob.description || "");
      setRequirements(editJob.requirements || "");
      setJobType(editJob.jobType || "구인");
      setIndustry(editJob.industry || "식당/요리");
      setSalary(editJob.salary || "");
      setEmploymentType(editJob.employmentType || "정규직");
      setSelectedCity(editJob.city || "호치민");
      setSelectedDistrict(editJob.district || "");
      setContact(editJob.contact || "");
      setDeadline(editJob.deadline || "");
      setStatus(editJob.status || "모집중");

      if (editJob.images && editJob.images.length > 0) {
        setImages(editJob.images);
      }
    }
  }, [isEditMode, editJob]);

  // 권한 요청
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다.");
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다.");
      return false;
    }
    return true;
  };

  // 사진 촬영
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImages([...images, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert("오류", "사진 촬영에 실패했습니다.");
    }
  };

  // 갤러리에서 선택
  const pickImagesFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 5 - images.length,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages([...images, ...newImages].slice(0, 5));
      }
    } catch (error) {
      Alert.alert("오류", "사진을 선택할 수 없습니다.");
    }
  };

  const pickImages = () => {
    if (images.length >= 5) {
      Alert.alert("알림", "사진은 최대 5장까지 등록할 수 있습니다.");
      return;
    }

    Alert.alert("사진 선택", "사진을 추가할 방법을 선택하세요", [
      {
        text: "📷 카메라로 촬영",
        onPress: takePhoto,
      },
      {
        text: "🖼️ 갤러리에서 선택",
        onPress: pickImagesFromGallery,
      },
      {
        text: "취소",
        style: "cancel",
      },
    ]);
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
  };

  // 이미지 리사이징
  const resizeImage = async (uri) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return manipResult.uri;
    } catch (error) {
      console.error("이미지 리사이징 실패:", error);
      return uri;
    }
  };

  // 이미지 업로드
  const uploadImageToStorage = async (uri) => {
    try {
      if (uri.startsWith("https://")) {
        return uri;
      }

      const resizedUri = await resizeImage(uri);
      const response = await fetch(resizedUri);
      const blob = await response.blob();

      const filename = `jobs/${user.uid}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      throw error;
    }
  };

  // 폼 유효성 검사
  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert("알림", "제목을 입력해주세요.");
      return false;
    }
    if (title.trim().length < 5) {
      Alert.alert("알림", "제목은 최소 5자 이상 입력해주세요.");
      return false;
    }
    if (!description.trim()) {
      Alert.alert("알림", "상세 내용을 입력해주세요.");
      return false;
    }
    if (description.trim().length < 20) {
      Alert.alert("알림", "상세 내용은 최소 20자 이상 입력해주세요.");
      return false;
    }
    if (!selectedCity) {
      Alert.alert("알림", "근무지 도시를 선택해주세요.");
      return false;
    }
    return true;
  };

  // 등록/수정 처리
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setUploading(true);

    try {
      // 이미지 업로드
      const uploadedImages = [];
      for (const imageUri of images) {
        const downloadURL = await uploadImageToStorage(imageUri);
        uploadedImages.push(downloadURL);
      }

      const jobData = {
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        jobType,
        industry,
        salary: salary.trim() || "협의",
        employmentType,
        city: selectedCity,
        district: selectedDistrict.trim(),
        contact: contact.trim(),
        deadline: deadline.trim(),
        images: uploadedImages,
        status,
      };

      if (isEditMode) {
        // 수정
        console.log("💾 Jobs 수정 중...");
        const jobRef = doc(db, "Jobs", editJob.id);
        await updateDoc(jobRef, {
          ...jobData,
          updatedAt: serverTimestamp(),
        });

        Alert.alert("수정 완료", "공고가 수정되었습니다!", [
          {
            text: "확인",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // 새 등록
        console.log("💾 Jobs 등록 중...");
        await addDoc(collection(db, "Jobs"), {
          ...jobData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: serverTimestamp(),
        });

        // 캐시 무효화
        await AsyncStorage.removeItem("cached_jobs");

        Alert.alert("등록 완료", "구인구직 공고가 등록되었습니다!", [
          {
            text: "확인",
            onPress: () => {
              navigation.dispatch(StackActions.pop(1));
            },
          },
        ]);
      }
    } catch (error) {
      console.error("등록 실패:", error);
      Alert.alert("오류", "등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 안내 */}
        <View style={styles.headerBanner}>
          <Ionicons name="briefcase" size={24} color="#2196F3" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              {isEditMode ? "공고 수정" : "구인구직 등록"}
            </Text>
            <Text style={styles.headerSubtitle}>
              베트남 한인 커뮤니티와 함께해요
            </Text>
          </View>
        </View>

        {/* 구인/구직 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="swap-horizontal" size={16} color="#333" /> 유형 선택 *
          </Text>
          <View style={styles.jobTypeContainer}>
            {jobTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.jobTypeButton,
                  jobType === type && styles.jobTypeButtonActive,
                ]}
                onPress={() => setJobType(type)}
              >
                <Ionicons
                  name={type === "구인" ? "business" : "person"}
                  size={20}
                  color={jobType === type ? "#fff" : "#666"}
                />
                <Text
                  style={[
                    styles.jobTypeText,
                    jobType === type && styles.jobTypeTextActive,
                  ]}
                >
                  {type}
                </Text>
                <Text style={[
                  styles.jobTypeDesc,
                  jobType === type && styles.jobTypeDescActive,
                ]}>
                  {type === "구인" ? "인재를 찾습니다" : "일자리를 찾습니다"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="create" size={16} color="#333" /> 제목 *
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={jobType === "구인" ? "예: 호치민 한식당 주방보조 구합니다" : "예: 경력 5년 웹개발자 구직합니다"}
            placeholderTextColor="#999"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
          <Text style={styles.charCount}>{title.length}/50</Text>
        </View>

        {/* 업종 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="briefcase-outline" size={16} color="#333" /> 업종 *
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={industry}
              onValueChange={setIndustry}
              style={styles.picker}
            >
              {industries.map((ind) => (
                <Picker.Item key={ind} label={ind} value={ind} color="#333" />
              ))}
            </Picker>
          </View>
        </View>

        {/* 급여 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cash-outline" size={16} color="#333" /> 급여
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 월 2000만동, 시급 5만동, 협의 가능"
            placeholderTextColor="#999"
            value={salary}
            onChangeText={setSalary}
          />
        </View>

        {/* 고용 형태 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time-outline" size={16} color="#333" /> 고용 형태
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={employmentType}
              onValueChange={setEmploymentType}
              style={styles.picker}
            >
              {employmentTypes.map((type) => (
                <Picker.Item key={type} label={type} value={type} color="#333" />
              ))}
            </Picker>
          </View>
        </View>

        {/* 근무지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={16} color="#333" /> 근무지 *
          </Text>
          <View style={styles.locationRow}>
            <View style={[styles.pickerWrapper, { flex: 1 }]}>
              <Picker
                selectedValue={selectedCity}
                onValueChange={setSelectedCity}
                style={styles.picker}
              >
                {cities.map((city) => (
                  <Picker.Item key={city} label={city} value={city} color="#333" />
                ))}
              </Picker>
            </View>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder="상세 지역 (선택사항)"
            placeholderTextColor="#999"
            value={selectedDistrict}
            onChangeText={setSelectedDistrict}
          />
        </View>

        {/* 연락처 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call-outline" size={16} color="#333" /> 연락처
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="전화번호 또는 카카오톡 ID"
            placeholderTextColor="#999"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
          />
          <Text style={styles.helperText}>
            * 비공개를 원하시면 채팅으로만 연락받을 수 있습니다
          </Text>
        </View>

        {/* 마감일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={16} color="#333" /> 마감일
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 2026년 3월 31일, 채용시까지"
            placeholderTextColor="#999"
            value={deadline}
            onChangeText={setDeadline}
          />
        </View>

        {/* 상세 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={16} color="#333" /> 상세 내용 *
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={jobType === "구인" 
              ? "업무 내용, 근무 시간, 복리후생 등을 상세히 작성해주세요"
              : "경력 사항, 희망 업무, 가능 시간 등을 상세히 작성해주세요"
            }
            placeholderTextColor="#999"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}자</Text>
        </View>

        {/* 자격 요건 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#333" /> 
            {jobType === "구인" ? " 자격 요건" : " 보유 스킬/자격증"}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { height: 100 }]}
            placeholder={jobType === "구인"
              ? "필요한 경력, 자격증, 언어 능력 등"
              : "보유하고 있는 스킬, 자격증, 언어 능력 등"
            }
            placeholderTextColor="#999"
            value={requirements}
            onChangeText={setRequirements}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* 이미지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="images-outline" size={16} color="#333" /> 사진 (최대 5장)
          </Text>
          <Text style={styles.helperText}>
            회사 사진, 근무환경 등을 등록하면 신뢰도가 올라갑니다
          </Text>
          <View style={styles.imageGrid}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} contentFit="cover" />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#F44336" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageButton} onPress={pickImages}>
                <Ionicons name="camera" size={32} color="#999" />
                <Text style={styles.addImageText}>사진 추가</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 수정 모드일 때 상태 변경 */}
        {isEditMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="flag-outline" size={16} color="#333" /> 모집 상태
            </Text>
            <View style={styles.statusContainer}>
              {["모집중", "마감임박", "마감"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusButton,
                    status === s && styles.statusButtonActive,
                    status === s && {
                      backgroundColor:
                        s === "모집중" ? "#E8F5E9" :
                        s === "마감임박" ? "#FFF3E0" : "#F5F5F5"
                    }
                  ]}
                  onPress={() => setStatus(s)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === s && {
                        color:
                          s === "모집중" ? "#4CAF50" :
                          s === "마감임박" ? "#FF9800" : "#9E9E9E"
                      }
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 등록 버튼 */}
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isEditMode ? "수정 완료" : "등록하기"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  contentContainer: {
    padding: 16,
  },
  headerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1976D2",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  jobTypeContainer: {
    flexDirection: "row",
    gap: 12,
  },
  jobTypeButton: {
    flex: 1,
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e0e0e0",
  },
  jobTypeButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  jobTypeText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 8,
  },
  jobTypeTextActive: {
    color: "#fff",
  },
  jobTypeDesc: {
    fontSize: 11,
    color: "#999",
    marginTop: 4,
  },
  jobTypeDescActive: {
    color: "rgba(255,255,255,0.8)",
  },
  textInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 12,
    fontSize: 15,
    color: "#333",
  },
  textArea: {
    height: 150,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    height: 56,
    justifyContent: "center",
  },
  picker: {
    height: 56,
    color: "#333",
    marginLeft: -8,
  },
  locationRow: {
    flexDirection: "row",
    gap: 8,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  imageWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  addImageText: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: "row",
    gap: 10,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
  },
  statusButtonActive: {
    borderWidth: 2,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: "#90CAF9",
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#fff",
  },
});
