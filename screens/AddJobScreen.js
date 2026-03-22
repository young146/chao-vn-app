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
import { Image } from "expo-image";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
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
import { translateCity, translateOther } from "../utils/vietnamLocations";
import { translateIndustry, translateEmploymentType, translateJobType, translateJobStatus } from "../utils/optionTranslations";

export default function AddJobScreen({ navigation, route }) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['jobs', 'common']);

  const editJob = route?.params?.editJob;
  const isEditMode = !!editJob;
  const sourceLanguage = route?.params?.sourceLanguage || "ko";

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
      Alert.alert(t('common:permissionRequired'), t('common:cameraPermission'));
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t('common:permissionRequired'), t('common:galleryPermission'));
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
      Alert.alert(t('form.error'), t('common:cameraError'));
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
      Alert.alert(t('form.error'), t('common:photoSelectError'));
    }
  };

  const pickImages = () => {
    if (images.length >= 5) {
      Alert.alert(t('common:notice'), t('common:maxPhotos5'));
      return;
    }

    Alert.alert(t('common:selectPhoto'), t('common:selectPhotoMethod'), [
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
      Alert.alert(t('common:notice'), t('form.titleRequired'));
      return false;
    }
    if (title.trim().length < 5) {
      Alert.alert(t('common:notice'), t('form.titleTooShort'));
      return false;
    }
    if (!description.trim()) {
      Alert.alert(t('common:notice'), t('form.descriptionRequired'));
      return false;
    }
    if (description.trim().length < 20) {
      Alert.alert(t('common:notice'), t('form.descriptionTooShort'));
      return false;
    }
    if (!selectedCity) {
      Alert.alert(t('common:notice'), t('form.cityRequired'));
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
        sourceLanguage,
      };

      if (isEditMode) {
        // 수정
        console.log("💾 Jobs 수정 중...");
        const jobRef = doc(db, "Jobs", editJob.id);
        await updateDoc(jobRef, {
          ...jobData,
          updatedAt: serverTimestamp(),
        });

        Alert.alert(t('form.success'), t('form.jobUpdated'), [
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

        Alert.alert(t('form.success'), t('form.jobRegistered'), [
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
      Alert.alert(t('form.error'), t('form.errorMessage'));
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
              {isEditMode ? t('form.updateButton') : t('addJob')}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('subtitle')}
            </Text>
          </View>
        </View>

        {/* 구인/구직 선택 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="swap-horizontal" size={16} /> {t('form.jobTypeLabel')}
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
                  {type === "구인" ? t('hiring') : t('seeking')}
                </Text>
                <Text style={[
                  styles.jobTypeDesc,
                  jobType === type && styles.jobTypeDescActive,
                ]}>
                  {type === "구인" ? t('common:lookingForTalent', '인재를 찾습니다') : t('common:lookingForJob', '일자리를 찾습니다')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="create" size={16} /> {t('form.titleLabel')}
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
            <Ionicons name="briefcase-outline" size={16} /> {t('form.industryLabel')}
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={industry}
              onValueChange={setIndustry}
              style={styles.picker}
            >
              {industries.map((ind) => (
                <Picker.Item key={ind} label={translateIndustry(ind, i18n.language)} value={ind} />
              ))}
            </Picker>
          </View>
        </View>

        {/* 급여 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cash-outline" size={16} /> {t('form.salaryLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.salaryPlaceholder')}
            placeholderTextColor="#999"
            value={salary}
            onChangeText={setSalary}
          />
        </View>

        {/* 고용 형태 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time-outline" size={16} /> {t('form.employmentTypeLabel')}
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={employmentType}
              onValueChange={setEmploymentType}
              style={styles.picker}
            >
              {employmentTypes.map((type) => (
                <Picker.Item key={type} label={translateEmploymentType(type, i18n.language)} value={type} />
              ))}
            </Picker>
          </View>
        </View>

        {/* 근무지 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location-outline" size={16} /> {t('form.cityLabel')}
          </Text>
          <View style={styles.locationRow}>
            <View style={[styles.pickerWrapper, { flex: 1 }]}>
              <Picker
                selectedValue={selectedCity}
                onValueChange={setSelectedCity}
                style={styles.picker}
              >
                {cities.map((city) => (
                  <Picker.Item key={city} label={translateCity(city, i18n.language)} value={city} />
                ))}
              </Picker>
            </View>
          </View>
          <TextInput
            style={[styles.textInput, { marginTop: 8 }]}
            placeholder={t('form.selectDistrict')}
            placeholderTextColor="#999"
            value={selectedDistrict}
            onChangeText={setSelectedDistrict}
          />
        </View>

        {/* 연락처 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call-outline" size={16} /> {t('form.contactLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.contactPlaceholder')}
            placeholderTextColor="#999"
            value={contact}
            onChangeText={setContact}
            keyboardType="phone-pad"
          />
          <Text style={styles.helperText}>
            * {t('common:chatOnlyContact', '비공개를 원하시면 채팅으로만 연락받을 수 있습니다')}
          </Text>
        </View>

        {/* 마감일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={16} /> {t('form.deadlineLabel')}
          </Text>
          <TextInput
            style={styles.textInput}
            placeholder={t('form.deadlinePlaceholder')}
            placeholderTextColor="#999"
            value={deadline}
            onChangeText={setDeadline}
          />
        </View>

        {/* 상세 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text-outline" size={16} /> {t('form.descriptionLabel')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder={t('form.descriptionPlaceholder')}
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
            <Ionicons name="checkmark-circle-outline" size={16} />
            {t('form.requirementsLabel')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { height: 100 }]}
            placeholder={t('form.requirementsPlaceholder')}
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
            <Ionicons name="images-outline" size={16} /> {t('form.photoSection')} (5)
          </Text>
          <Text style={styles.helperText}>
            {t('common:photoHelperText', '회사 사진, 근무환경 등을 등록하면 신뢰도가 올라갑니다')}
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
                <Text style={styles.addImageText}>{t('form.addPhoto')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 수정 모드일 때 상태 변경 */}
        {isEditMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="flag-outline" size={16} /> {t('form.statusLabel')}
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
                    {translateJobStatus(s, i18n.language)}
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
                {isEditMode ? t('form.updateButton') : t('form.submitButton')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
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
    height: Platform.OS === "ios" ? 120 : 56,
    justifyContent: "center",
  },
  picker: {
    height: Platform.OS === "ios" ? 120 : 56,
    marginLeft: Platform.OS === "ios" ? 0 : -8,
    color: "#333",
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
