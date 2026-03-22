/**
 * AddJobScreen.js — 구인 등록 폼 (Notion Jobs DB 스키마 기준)
 *
 * route.params:
 *   sourceLanguage: "ko" | "vi" | "en"
 *   editJob: (optional) existing job document
 */
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
import { Ionicons } from "@expo/vector-icons";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── 옵션 데이터 ─────────────────────────────────────────────────
const INDUSTRY_TRACKS_KO = ["제조/생산", "무역/물류", "IT/개발", "식당/요리", "서비스/판매", "교육/강사", "사무/관리", "건설/인테리어", "미용/뷰티", "통역/번역", "기타"];
const INDUSTRY_TRACKS_VI = ["Sản xuất", "Thương mại/Vận chuyển", "IT/Phát triển", "Nhà hàng/Nấu ăn", "Dịch vụ/Bán hàng", "Giáo dục/Giảng viên", "Văn phòng/Quản lý", "Xây dựng/Nội thất", "Làm đẹp", "Phiên dịch/Biên dịch", "Khác"];
const INDUSTRY_TRACKS_EN = ["Manufacturing", "Trade/Logistics", "IT/Development", "Restaurant/Cooking", "Service/Sales", "Education/Teaching", "Office/Management", "Construction/Interior", "Beauty", "Translation/Interpretation", "Other"];

const JOB_TRACKS_KO = ["제조", "물류", "서비스", "IT", "마케팅", "통역", "교육", "기타"];
const JOB_TRACKS_VI = ["Sản xuất", "Kho vận", "Dịch vụ", "IT", "Marketing", "Phiên dịch", "Giáo dục", "Khác"];
const JOB_TRACKS_EN = ["Manufacturing", "Logistics", "Service", "IT", "Marketing", "Translation", "Education", "Other"];

const EMPLOYMENT_KO = ["정규직", "계약직", "파트타임", "인턴", "프리랜서", "협의"];
const EMPLOYMENT_VI = ["Toàn thời gian", "Hợp đồng", "Bán thời gian", "Thực tập", "Freelance", "Thương lượng"];
const EMPLOYMENT_EN = ["Full-time", "Contract", "Part-time", "Internship", "Freelance", "Negotiable"];

const CITIES_KO = ["호치민", "하노이", "다낭", "냐짱", "붕따우", "빈증", "동나이", "기타"];
const CITIES_VI = ["TP.HCM", "Hà Nội", "Đà Nẵng", "Nha Trang", "Vũng Tàu", "Bình Dương", "Đồng Nai", "Khác"];
const CITIES_EN = ["Ho Chi Minh City", "Hanoi", "Da Nang", "Nha Trang", "Vung Tau", "Binh Duong", "Dong Nai", "Other"];

const STATUS_OPTIONS = ["모집중", "마감"];

// ─── 언어별 레이블 ─────────────────────────────────────────────────
function getLabels(lang) {
  if (lang === "vi") {
    return {
      title: "Đăng tin tuyển dụng",
      subtitle: "Vui lòng điền thông tin tuyển dụng",
      companyNameLabel: "Tên công ty *",
      companyNamePlaceholder: "Nhập tên công ty",
      jobTitleLabel: "Tiêu đề tin tuyển dụng *",
      jobTitlePlaceholder: "VD: Tuyển kỹ sư IT người Việt Nam",
      descriptionLabel: "Mô tả công việc *",
      descriptionPlaceholder: "Mô tả chi tiết công việc, môi trường làm việc...",
      requirementsLabel: "Yêu cầu ứng viên",
      requirementsPlaceholder: "Kinh nghiệm, kỹ năng, bằng cấp cần thiết...",
      industryLabel: "Ngành nghề",
      jobTracksLabel: "Vị trí tuyển dụng (chọn nhiều)",
      employmentLabel: "Hình thức làm việc",
      cityLabel: "Khu vực làm việc *",
      districtLabel: "Quận/Huyện",
      districtPlaceholder: "VD: Quận 1, Bình Thạnh",
      salaryMinLabel: "Lương tối thiểu (USD/tháng)",
      salaryMaxLabel: "Lương tối đa (USD/tháng)",
      salaryPlaceholder: "VD: 1500",
      contactLabel: "Thông tin liên hệ *",
      contactPlaceholder: "Số điện thoại, email, hoặc KakaoTalk ID",
      deadlineLabel: "Hạn nộp hồ sơ",
      deadlinePlaceholder: "VD: 2026-04-30",
      photoLabel: "Hình ảnh (tối đa 5 ảnh)",
      addPhotoBtn: "➕ Thêm ảnh",
      submitButton: "Đăng tin tuyển dụng",
      updateButton: "Cập nhật",
      success: "Thành công!",
      registered: "Tin tuyển dụng đã được đăng!",
      updated: "Đã cập nhật tin tuyển dụng!",
      error: "Lỗi",
      errorMessage: "Đăng tin thất bại. Vui lòng thử lại.",
      companyRequired: "Vui lòng nhập tên công ty.",
      titleRequired: "Vui lòng nhập tiêu đề tin.",
      titleTooShort: "Tiêu đề quá ngắn (tối thiểu 5 ký tự).",
      descRequired: "Vui lòng nhập mô tả công việc.",
      descTooShort: "Mô tả quá ngắn (tối thiểu 20 ký tự).",
      cityRequired: "Vui lòng chọn khu vực.",
      contactRequired: "Vui lòng nhập thông tin liên hệ.",
      industryTracks: INDUSTRY_TRACKS_VI,
      jobTracks: JOB_TRACKS_VI,
      employment: EMPLOYMENT_VI,
      cities: CITIES_VI,
    };
  }
  if (lang === "en") {
    return {
      title: "Post Job Opening",
      subtitle: "Fill in your job posting details",
      companyNameLabel: "Company Name *",
      companyNamePlaceholder: "Enter company name",
      jobTitleLabel: "Job Title *",
      jobTitlePlaceholder: "e.g., Recruiting Vietnamese IT Engineer",
      descriptionLabel: "Job Description *",
      descriptionPlaceholder: "Describe the job, work environment...",
      requirementsLabel: "Requirements",
      requirementsPlaceholder: "Experience, skills, certifications required...",
      industryLabel: "Industry",
      jobTracksLabel: "Job Positions (multiple)",
      employmentLabel: "Employment Type",
      cityLabel: "Work Location *",
      districtLabel: "District",
      districtPlaceholder: "e.g., District 1, Binh Thanh",
      salaryMinLabel: "Min Salary (USD/month)",
      salaryMaxLabel: "Max Salary (USD/month)",
      salaryPlaceholder: "e.g., 1500",
      contactLabel: "Contact Info *",
      contactPlaceholder: "Phone, email, or KakaoTalk ID",
      deadlineLabel: "Application Deadline",
      deadlinePlaceholder: "e.g., 2026-04-30",
      photoLabel: "Photos (max 5)",
      addPhotoBtn: "➕ Add Photo",
      submitButton: "Post Job",
      updateButton: "Update",
      success: "Success!",
      registered: "Job posting published!",
      updated: "Job posting updated!",
      error: "Error",
      errorMessage: "Failed to post job. Please try again.",
      companyRequired: "Please enter company name.",
      titleRequired: "Please enter a job title.",
      titleTooShort: "Title too short (min 5 characters).",
      descRequired: "Please enter a job description.",
      descTooShort: "Description too short (min 20 characters).",
      cityRequired: "Please select a location.",
      contactRequired: "Please enter contact information.",
      industryTracks: INDUSTRY_TRACKS_EN,
      jobTracks: JOB_TRACKS_EN,
      employment: EMPLOYMENT_EN,
      cities: CITIES_EN,
    };
  }
  // 기본: 한국어
  return {
    title: "구인 등록",
    subtitle: "채용 정보를 입력해주세요",
    companyNameLabel: "회사명 *",
    companyNamePlaceholder: "회사 이름을 입력하세요",
    jobTitleLabel: "공고 제목 *",
    jobTitlePlaceholder: "예: 베트남인 IT 개발자 채용",
    descriptionLabel: "업무 내용 *",
    descriptionPlaceholder: "담당 업무, 근무 환경 등 상세히 작성해주세요...",
    requirementsLabel: "지원 자격",
    requirementsPlaceholder: "경력, 기술, 자격증 등 필요 조건...",
    industryLabel: "업종",
    jobTracksLabel: "채용 직무 (복수 선택)",
    employmentLabel: "고용 형태",
    cityLabel: "근무 지역 *",
    districtLabel: "구/군",
    districtPlaceholder: "예: 1군, 빈탄",
    salaryMinLabel: "최소 급여 (USD/월)",
    salaryMaxLabel: "최대 급여 (USD/월)",
    salaryPlaceholder: "예: 1500",
    contactLabel: "연락처 *",
    contactPlaceholder: "전화번호, 이메일, 카카오톡 ID",
    deadlineLabel: "모집 마감일",
    deadlinePlaceholder: "예: 2026-04-30",
    photoLabel: "사진 첨부 (최대 5장)",
    addPhotoBtn: "➕ 사진 추가",
    submitButton: "구인 등록하기",
    updateButton: "수정하기",
    success: "성공!",
    registered: "구인 공고가 등록되었습니다!",
    updated: "공고가 수정되었습니다!",
    error: "오류",
    errorMessage: "등록에 실패했습니다. 다시 시도해주세요.",
    companyRequired: "회사명을 입력해주세요.",
    titleRequired: "공고 제목을 입력해주세요.",
    titleTooShort: "제목이 너무 짧습니다 (최소 5자).",
    descRequired: "업무 내용을 입력해주세요.",
    descTooShort: "업무 내용이 너무 짧습니다 (최소 20자).",
    cityRequired: "근무 지역을 선택해주세요.",
    contactRequired: "연락처를 입력해주세요.",
    industryTracks: INDUSTRY_TRACKS_KO,
    jobTracks: JOB_TRACKS_KO,
    employment: EMPLOYMENT_KO,
    cities: CITIES_KO,
  };
}

// ─── 선택 버튼 그룹 ───────────────────────────────────────────────
function SelectButtons({ options, selected, onSelect, multi = false, color = "#2196F3" }) {
  return (
    <View style={styles.selectGroup}>
      {options.map((opt, idx) => {
        const isSelected = multi ? (selected || []).includes(opt) : selected === opt;
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.selectBtn, isSelected && { backgroundColor: color, borderColor: color }]}
            onPress={() => {
              if (multi) {
                const current = selected || [];
                onSelect(current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt]);
              } else {
                onSelect(opt);
              }
            }}
          >
            <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 메인 화면 ───────────────────────────────────────────────────
export default function AddJobScreen({ navigation, route }) {
  const { user } = useAuth();
  const sourceLanguage = route?.params?.sourceLanguage || "ko";
  const editJob = route?.params?.editJob;
  const isEditMode = !!editJob;
  const L = getLabels(sourceLanguage);

  // 기본 정보
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");

  // Notion 스키마 필드
  const [industryTrack, setIndustryTrack] = useState("");
  const [jobTracks, setJobTracks] = useState([]);
  const [employmentType, setEmploymentType] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");

  // 연락처 / 마감
  const [contact, setContact] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState("모집중");

  // 이미지
  const [images, setImages] = useState([]);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // 수정 모드 데이터 로드
  useEffect(() => {
    if (isEditMode && editJob) {
      setCompanyName(editJob.companyName || "");
      setTitle(editJob.title || "");
      setDescription(editJob.description || "");
      setRequirements(editJob.requirements || "");
      setIndustryTrack(editJob.industryTrack || "");
      setJobTracks(editJob.jobTracks || []);
      setEmploymentType(editJob.employmentType || "");
      setSelectedCity(editJob.city || "");
      setSelectedDistrict(editJob.district || "");
      setSalaryMin(String(editJob.salaryMinUsdPerMonth || ""));
      setSalaryMax(String(editJob.salaryMaxUsdPerMonth || ""));
      setContact(editJob.contact || "");
      setDeadline(editJob.deadline || "");
      setStatus(editJob.status || "모집중");
      if (editJob.images?.length > 0) setImages(editJob.images);
      setYoutubeUrl(editJob.youtubeUrl || "");
    }
  }, [isEditMode, editJob]);

  // ─── 이미지 처리 ─────────────────────────────────────────────
  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("권한 필요", "갤러리 접근 권한이 필요합니다."); return false; }
    return true;
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("권한 필요", "카메라 접근 권한이 필요합니다."); return false; }
    return true;
  };

  const pickImages = () => {
    if (images.length >= 5) { Alert.alert("안내", "최대 5장까지 첨부 가능합니다."); return; }
    Alert.alert("사진 추가", "방법을 선택하세요", [
      { text: "📷 카메라 촬영", onPress: takePhoto },
      { text: "🖼️ 갤러리 선택", onPress: pickFromGallery },
      { text: "취소", style: "cancel" },
    ]);
  };

  const takePhoto = async () => {
    if (!await requestCameraPermission()) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setImages([...images, result.assets[0].uri]);
  };

  const pickFromGallery = async () => {
    if (!await requestGalleryPermission()) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 5 - images.length });
    if (!result.canceled) setImages([...images, ...result.assets.map(a => a.uri)].slice(0, 5));
  };

  const removeImage = (idx) => setImages(images.filter((_, i) => i !== idx));

  const resizeImage = async (uri) => {
    try {
      const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG });
      return r.uri;
    } catch { return uri; }
  };

  const uploadImage = async (uri) => {
    if (uri.startsWith("https://")) return uri;
    const resized = await resizeImage(uri);
    const blob = await (await fetch(resized)).blob();
    const filename = `jobs/${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  };

  // ─── 유효성 검사 ─────────────────────────────────────────────
  const validateForm = () => {
    if (!companyName.trim()) { Alert.alert("⚠️", L.companyRequired); return false; }
    if (!title.trim()) { Alert.alert("⚠️", L.titleRequired); return false; }
    if (title.trim().length < 5) { Alert.alert("⚠️", L.titleTooShort); return false; }
    if (!description.trim()) { Alert.alert("⚠️", L.descRequired); return false; }
    if (description.trim().length < 20) { Alert.alert("⚠️", L.descTooShort); return false; }
    if (!selectedCity) { Alert.alert("⚠️", L.cityRequired); return false; }
    if (!contact.trim()) { Alert.alert("⚠️", L.contactRequired); return false; }
    return true;
  };

  // ─── 제출 ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm()) return;
    setUploading(true);
    try {
      const uploadedImages = [];
      for (const uri of images) uploadedImages.push(await uploadImage(uri));

      const jobData = {
        jobType: "구인",
        sourceLanguage,
        status,
        companyName: companyName.trim(),
        title: title.trim(),
        description: description.trim(),
        requirements: requirements.trim(),
        industryTrack: industryTrack || "",
        jobTracks,
        employmentType: employmentType || "",
        city: selectedCity,
        district: selectedDistrict.trim(),
        salaryMinUsdPerMonth: parseFloat(salaryMin) || null,
        salaryMaxUsdPerMonth: parseFloat(salaryMax) || null,
        contact: contact.trim(),
        deadline: deadline.trim(),
        images: uploadedImages,
        youtubeUrl: youtubeUrl.trim() || null,
      };

      if (isEditMode) {
        await updateDoc(doc(db, "Jobs", editJob.id), { ...jobData, updatedAt: serverTimestamp() });
        Alert.alert(L.success, L.updated, [{ text: "OK", onPress: () => navigation.goBack() }]);
      } else {
        await addDoc(collection(db, "Jobs"), { ...jobData, userId: user.uid, userEmail: user.email, createdAt: serverTimestamp() });
        await AsyncStorage.removeItem("cached_jobs");
        Alert.alert(L.success, L.registered, [{ text: "OK", onPress: () => navigation.dispatch(StackActions.pop(1)) }]);
      }
    } catch (err) {
      console.error("구인 등록 실패:", err);
      Alert.alert(L.error, L.errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // ─── UI ───────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* 헤더 배너 */}
        <View style={styles.headerBanner}>
          <Ionicons name="business" size={28} color="#1976D2" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>{L.title}</Text>
            <Text style={styles.headerSubtitle}>{L.subtitle}</Text>
          </View>
        </View>

        {/* 회사명 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="business-outline" size={15} /> {L.companyNameLabel}</Text>
          <TextInput style={styles.textInput} value={companyName} onChangeText={setCompanyName} placeholder={L.companyNamePlaceholder} placeholderTextColor="#aaa" />
        </View>

        {/* 공고 제목 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="document-text-outline" size={15} /> {L.jobTitleLabel}</Text>
          <TextInput style={styles.textInput} value={title} onChangeText={setTitle} placeholder={L.jobTitlePlaceholder} placeholderTextColor="#aaa" />
        </View>

        {/* 업종 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="grid-outline" size={15} /> {L.industryLabel}</Text>
          <SelectButtons options={L.industryTracks} selected={industryTrack} onSelect={setIndustryTrack} color="#1976D2" />
        </View>

        {/* 채용 직무 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="briefcase-outline" size={15} /> {L.jobTracksLabel}</Text>
          <SelectButtons options={L.jobTracks} selected={jobTracks} onSelect={setJobTracks} multi color="#0288D1" />
        </View>

        {/* 고용 형태 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="time-outline" size={15} /> {L.employmentLabel}</Text>
          <SelectButtons options={L.employment} selected={employmentType} onSelect={setEmploymentType} color="#303F9F" />
        </View>

        {/* 근무 지역 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="location-outline" size={15} /> {L.cityLabel}</Text>
          <SelectButtons options={L.cities} selected={selectedCity} onSelect={setSelectedCity} color="#00796B" />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{L.districtLabel}</Text>
          <TextInput style={styles.textInput} value={selectedDistrict} onChangeText={setSelectedDistrict} placeholder={L.districtPlaceholder} placeholderTextColor="#aaa" />
        </View>

        {/* 급여 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="cash-outline" size={15} /> {L.salaryMinLabel}</Text>
          <TextInput style={[styles.textInput, { width: 180 }]} value={salaryMin} onChangeText={setSalaryMin} placeholder={L.salaryPlaceholder} placeholderTextColor="#aaa" keyboardType="numeric" />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{L.salaryMaxLabel}</Text>
          <TextInput style={[styles.textInput, { width: 180 }]} value={salaryMax} onChangeText={setSalaryMax} placeholder={L.salaryPlaceholder} placeholderTextColor="#aaa" keyboardType="numeric" />
        </View>

        {/* 업무 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="reader-outline" size={15} /> {L.descriptionLabel}</Text>
          <TextInput style={[styles.textInput, styles.multilineInput]} value={description} onChangeText={setDescription} placeholder={L.descriptionPlaceholder} placeholderTextColor="#aaa" multiline numberOfLines={5} />
        </View>

        {/* 지원 자격 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="checkmark-circle-outline" size={15} /> {L.requirementsLabel}</Text>
          <TextInput style={[styles.textInput, styles.multilineInput]} value={requirements} onChangeText={setRequirements} placeholder={L.requirementsPlaceholder} placeholderTextColor="#aaa" multiline numberOfLines={4} />
        </View>

        {/* 연락처 / 마감일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="call-outline" size={15} /> {L.contactLabel}</Text>
          <TextInput style={styles.textInput} value={contact} onChangeText={setContact} placeholder={L.contactPlaceholder} placeholderTextColor="#aaa" />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}><Ionicons name="calendar-outline" size={15} /> {L.deadlineLabel}</Text>
          <TextInput style={[styles.textInput, { width: 200 }]} value={deadline} onChangeText={setDeadline} placeholder={L.deadlinePlaceholder} placeholderTextColor="#aaa" />
        </View>

        {/* 모집 상태 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="flag-outline" size={15} /> {sourceLanguage === "vi" ? "Trạng thái" : sourceLanguage === "en" ? "Status" : "모집 상태"}</Text>
          <SelectButtons options={STATUS_OPTIONS} selected={status} onSelect={setStatus} color="#388E3C" />
        </View>

        {/* 사진 첨부 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}><Ionicons name="image-outline" size={15} /> {L.photoLabel}</Text>
          <View style={styles.imageRow}>
            {images.map((uri, idx) => (
              <View key={idx} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(idx)}>
                  <Ionicons name="close-circle" size={20} color="#f44" />
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                <Ionicons name="add" size={28} color="#90a4ae" />
                <Text style={styles.addImageText}>{L.addPhotoBtn}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* YouTube 소개 영상 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="logo-youtube" size={15} color="#FF0000" /> {L.sourceLanguage === "vi" ? "Video giới thiệu (YouTube)" : L.sourceLanguage === "en" ? "Company Video (YouTube)" : "회사 소개 영상 (YouTube)"}
          </Text>
          <Text style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            {sourceLanguage === "vi" ? "URL video YouTube giới thiệu công ty" : sourceLanguage === "en" ? "Add a YouTube URL to introduce your company" : "회사 또는 업무를 소개하는 유튜브 링크를 입력하세요"}
          </Text>
          <TextInput
            style={styles.textInput}
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            placeholder="https://youtu.be/xxxxx 또는 youtube.com/watch?v=xxxxx"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        {/* 제출 버튼 */}
        <TouchableOpacity style={[styles.submitButton, uploading && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>{isEditMode ? L.updateButton : L.submitButton}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 240 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── 스타일 ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f7fa" },
  scrollView: { flex: 1 },
  contentContainer: { padding: 16 },
  headerBanner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#BBDEFB", elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1976D2" },
  headerSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },
  section: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#ececec",
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#444", marginBottom: 10 },
  textInput: {
    borderWidth: 1, borderColor: "#ddd", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 12 : 9,
    fontSize: 15, color: "#222", backgroundColor: "#fafafa",
  },
  multilineInput: { minHeight: 100, textAlignVertical: "top", paddingTop: 10 },
  selectGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  selectBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: "#ddd", backgroundColor: "#fafafa",
  },
  selectBtnText: { fontSize: 13, color: "#555", fontWeight: "500" },
  selectBtnTextActive: { color: "#fff", fontWeight: "700" },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageWrapper: { position: "relative" },
  previewImage: { width: 80, height: 80, borderRadius: 10 },
  removeImageBtn: { position: "absolute", top: -6, right: -6 },
  addImageBtn: {
    width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: "#cfd8dc",
    borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: "#fafafa",
  },
  addImageText: { fontSize: 9, color: "#90a4ae", marginTop: 2 },
  submitButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1976D2", borderRadius: 14, paddingVertical: 16,
    marginTop: 8, gap: 8, elevation: 3,
  },
  submitButtonDisabled: { backgroundColor: "#E0E0E0" },
  submitButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
