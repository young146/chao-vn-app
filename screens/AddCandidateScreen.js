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
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

// ─── 선택 옵션들 ─────────────────────────────────────────────────
const NATIONALITIES_KO = ["대한민국", "베트남", "기타"];
const NATIONALITIES_VI = ["Hàn Quốc", "Việt Nam", "Khác"];
const NATIONALITIES_EN = ["South Korea", "Vietnam", "Other"];
const NATIONALITY_KEY = ["korea", "vietnam", "other"];

const LEVELS_KO = ["없음", "초급", "중급", "고급", "원어민"];
const LEVELS_VI = ["Không có", "Sơ cấp", "Trung cấp", "Cao cấp", "Bản ngữ"];
const LEVELS_EN = ["None", "Beginner", "Intermediate", "Advanced", "Native"];
const LEVEL_KEY = ["없음", "초급", "중급", "고급", "원어민"]; // 저장 시 고정값

const EDUCATION_KO = ["고등학교", "전문대학", "대학교", "대학원", "기타"];
const EDUCATION_VI = ["Trung học PT", "Cao đẳng", "Đại học", "Sau đại học", "Khác"];
const EDUCATION_EN = ["High School", "Associate", "Bachelor's", "Graduate", "Other"];

const VISA_KO = ["취업 비자/워크퍼밋", "비즈니스 비자", "관광 비자", "영주권", "시민권", "기타/협의"];
const VISA_VI = ["Visa lao động", "Visa thương mại", "Visa du lịch", "Thường trú nhân", "Công dân", "Khác"];
const VISA_EN = ["Work Visa/Permit", "Business Visa", "Tourist Visa", "Permanent Resident", "Citizen", "Other"];

const JOB_TRACKS_KO = ["제조", "물류", "서비스", "IT", "마케팅", "통역", "기타"];
const JOB_TRACKS_VI = ["Sản xuất", "Kho vận", "Dịch vụ", "IT", "Marketing", "Phiên dịch", "Khác"];
const JOB_TRACKS_EN = ["Manufacturing", "Logistics", "Service", "IT", "Marketing", "Translation", "Other"];
const JOB_TRACK_KEY = ["제조", "물류", "서비스", "IT", "마케팅", "통역", "기타"]; // 저장 고정값

// ─── 언어별 레이블 헬퍼 ─────────────────────────────────────────
function getLabels(lang) {
  if (lang === "vi") {
    return {
      nationalities: NATIONALITIES_VI,
      levels: LEVELS_VI,
      education: EDUCATION_VI,
      visa: VISA_VI,
      jobTracks: JOB_TRACKS_VI,
      title: "Đăng ký tìm việc",
      nameLabel: "Họ và tên *",
      namePlaceholder: "Nhập họ và tên",
      nationalityLabel: "Quốc tịch *",
      phoneLabel: "Số điện thoại",
      phonePlaceholder: "+84-90-0000-0000",
      emailLabel: "Email",
      emailPlaceholder: "example@gmail.com",
      locationLabel: "Khu vực muốn làm việc",
      locationPlaceholder: "VD: Hà Nội, TP.HCM",
      koreanLabel: "Tiếng Hàn",
      vietnameseLabel: "Tiếng Việt",
      englishLabel: "Tiếng Anh",
      jobTracksLabel: "Ngành nghề mong muốn (chọn nhiều)",
      experienceLabel: "Kinh nghiệm (năm)",
      educationLabel: "Học vấn",
      skillsLabel: "Kỹ năng / Chứng chỉ",
      skillsPlaceholder: "Bằng lái xe nâng, Excel...",
      visaLabel: "Tình trạng visa",
      salaryLabel: "Mức lương mong muốn (USD/tháng)",
      salaryPlaceholder: "VD: 1500",
      submitButton: "Đăng ký tìm việc",
      updateButton: "Cập nhật",
      success: "Thành công!",
      registered: "Đăng ký tìm việc thành công!",
      updated: "Đã cập nhật!",
      error: "Lỗi",
      errorMessage: "Đăng ký thất bại. Vui lòng thử lại.",
      nameRequired: "Vui lòng nhập họ và tên.",
    };
  }
  if (lang === "en") {
    return {
      nationalities: NATIONALITIES_EN,
      levels: LEVELS_EN,
      education: EDUCATION_EN,
      visa: VISA_EN,
      jobTracks: JOB_TRACKS_EN,
      title: "Job Seeker Registration",
      nameLabel: "Full Name *",
      namePlaceholder: "Enter your full name",
      nationalityLabel: "Nationality *",
      phoneLabel: "Phone Number",
      phonePlaceholder: "+84-90-0000-0000",
      emailLabel: "Email",
      emailPlaceholder: "example@gmail.com",
      locationLabel: "Preferred Work Location",
      locationPlaceholder: "e.g., Hanoi, Ho Chi Minh City",
      koreanLabel: "Korean Level",
      vietnameseLabel: "Vietnamese Level",
      englishLabel: "English Level",
      jobTracksLabel: "Desired Job Type (multiple)",
      experienceLabel: "Experience (years)",
      educationLabel: "Education",
      skillsLabel: "Skills / Certifications",
      skillsPlaceholder: "Forklift license, Excel...",
      visaLabel: "Visa Status",
      salaryLabel: "Desired Salary (USD/month)",
      salaryPlaceholder: "e.g., 1500",
      submitButton: "Register",
      updateButton: "Update",
      success: "Success!",
      registered: "Registration complete!",
      updated: "Updated!",
      error: "Error",
      errorMessage: "Registration failed. Please try again.",
      nameRequired: "Please enter your name.",
    };
  }
  // 기본: 한국어
  return {
    nationalities: NATIONALITIES_KO,
    levels: LEVELS_KO,
    education: EDUCATION_KO,
    visa: VISA_KO,
    jobTracks: JOB_TRACKS_KO,
    title: "구직자 등록",
    nameLabel: "이름 *",
    namePlaceholder: "이름을 입력하세요",
    nationalityLabel: "국적 *",
    phoneLabel: "연락처",
    phonePlaceholder: "+84-90-0000-0000",
    emailLabel: "이메일",
    emailPlaceholder: "example@gmail.com",
    locationLabel: "취업 희망 지역",
    locationPlaceholder: "예: 하노이, 호치민 우선",
    koreanLabel: "한국어 수준",
    vietnameseLabel: "베트남어 수준",
    englishLabel: "영어 수준",
    jobTracksLabel: "희망 직무 (복수 선택)",
    experienceLabel: "경력(년)",
    educationLabel: "학력",
    skillsLabel: "보유 기술/자격증",
    skillsPlaceholder: "지게차 자격, 엑셀, SAP 등",
    visaLabel: "비자 상태",
    salaryLabel: "희망 급여 (USD/월)",
    salaryPlaceholder: "예: 1500",
    submitButton: "구직 등록하기",
    updateButton: "수정하기",
    success: "성공!",
    registered: "구직 등록이 완료되었습니다!",
    updated: "수정되었습니다!",
    error: "오류",
    errorMessage: "등록에 실패했습니다. 다시 시도해주세요.",
    nameRequired: "이름을 입력해주세요.",
  };
}

// ─── 선택 버튼 그룹 컴포넌트 ─────────────────────────────────────
function SelectButtons({ options, selected, onSelect, multi = false, color = "#2196F3" }) {
  return (
    <View style={styles.selectGroup}>
      {options.map((opt, idx) => {
        const isSelected = multi ? (selected || []).includes(opt) : selected === opt;
        return (
          <TouchableOpacity
            key={idx}
            style={[
              styles.selectBtn,
              isSelected && { backgroundColor: color, borderColor: color },
            ]}
            onPress={() => {
              if (multi) {
                const current = selected || [];
                if (current.includes(opt)) {
                  onSelect(current.filter((v) => v !== opt));
                } else {
                  onSelect([...current, opt]);
                }
              } else {
                onSelect(opt);
              }
            }}
          >
            <Text style={[styles.selectBtnText, isSelected && styles.selectBtnTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 메인 화면 ───────────────────────────────────────────────────
export default function AddCandidateScreen({ navigation, route }) {
  const { user } = useAuth();
  const sourceLanguage = route?.params?.sourceLanguage || "ko";
  const editCandidate = route?.params?.editCandidate;
  const isEditMode = !!editCandidate;
  const L = getLabels(sourceLanguage);

  // 기본 정보
  const [name, setName] = useState("");
  const [nationality, setNationality] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [desiredLocation, setDesiredLocation] = useState("");

  // 언어 수준
  const [koreanLevel, setKoreanLevel] = useState("없음");
  const [vietnameseLevel, setVietnameseLevel] = useState("없음");
  const [englishLevel, setEnglishLevel] = useState("없음");

  // 직무 / 경험
  const [jobTracks, setJobTracks] = useState([]);
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState("");

  // 비자 / 급여
  const [visaStatus, setVisaStatus] = useState("");
  const [desiredSalaryUsd, setDesiredSalaryUsd] = useState("");

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  // 수정 모드: 기존 데이터 로드
  useEffect(() => {
    if (isEditMode && editCandidate) {
      const p = editCandidate.profile || {};
      const lang = editCandidate.language || {};
      const car = editCandidate.career || {};
      const comp = editCandidate.compensation || {};
      const we = editCandidate.workEligibility || {};

      setName(p.name || "");
      setNationality(p.nationality || "");
      setPhone(p.phone || "");
      setEmail(p.email || "");
      setDesiredLocation(p.desiredLocation || "");
      setKoreanLevel(lang.korean || "없음");
      setVietnameseLevel(lang.vietnamese || "없음");
      setEnglishLevel(lang.english || "없음");
      setJobTracks(car.jobTracks || []);
      setExperience(String(car.experienceYears || ""));
      setEducation(car.education || "");
      setSkills(car.skills || "");
      setVisaStatus(we.visaStatus || "");
      setDesiredSalaryUsd(String(comp.desiredSalaryUsdPerMonth || ""));
      setYoutubeUrl(editCandidate.youtubeUrl || "");
    }
  }, [isEditMode, editCandidate]);

  const validateForm = () => {
    if (!name.trim()) {
      Alert.alert("⚠️", L.nameRequired);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setUploading(true);

    try {
      const candidateData = {
        sourceLanguage,
        status: "신규 등록",
        profile: {
          name: name.trim(),
          nationality: nationality || "",
          phone: phone.trim(),
          email: email.trim(),
          desiredLocation: desiredLocation.trim(),
        },
        language: {
          korean: koreanLevel,
          vietnamese: vietnameseLevel,
          english: englishLevel,
        },
        career: {
          jobTracks,
          experienceYears: parseInt(experience) || 0,
          education: education || "",
          skills: skills.trim(),
        },
        workEligibility: {
          visaStatus: visaStatus || "",
        },
        compensation: {
          desiredSalaryUsdPerMonth: parseFloat(desiredSalaryUsd) || null,
          desiredSalaryVndPerMonth: null,
          exchangeRate: null,
        },
        youtubeUrl: youtubeUrl.trim() || null,
        crm: {
          status: "신규 등록",
          assignedTo: null,
          notes: "",
        },
      };

      if (isEditMode) {
        const ref = doc(db, "candidates", editCandidate.id);
        await updateDoc(ref, {
          ...candidateData,
          updatedAt: serverTimestamp(),
        });
        Alert.alert(L.success, L.updated, [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        await addDoc(collection(db, "candidates"), {
          ...candidateData,
          userId: user.uid,
          userEmail: user.email,
          createdAt: serverTimestamp(),
        });
        Alert.alert(L.success, L.registered, [
          { text: "OK", onPress: () => navigation.dispatch(StackActions.pop(1)) },
        ]);
      }
    } catch (err) {
      console.error("구직 등록 실패:", err);
      Alert.alert(L.error, L.errorMessage);
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
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 배너 */}
        <View style={styles.headerBanner}>
          <Ionicons name="person-circle" size={28} color="#FF7043" />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{L.title}</Text>
            <Text style={styles.headerSubtitle}>
              {sourceLanguage === "ko" ? "구직자 정보를 입력해주세요" :
               sourceLanguage === "vi" ? "Vui lòng nhập thông tin của bạn" :
               "Please fill in your information"}
            </Text>
          </View>
        </View>

        {/* ─── 기본 정보 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="person" size={16} /> {L.nameLabel.replace(" *", "")}
          </Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder={L.namePlaceholder}
            placeholderTextColor="#aaa"
          />
        </View>

        {/* 국적 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{L.nationalityLabel.replace(" *","")}</Text>
          <SelectButtons
            options={L.nationalities}
            selected={nationality}
            onSelect={setNationality}
            color="#2196F3"
          />
        </View>

        {/* 연락처 / 이메일 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="call" size={16} /> {L.phoneLabel}
          </Text>
          <TextInput
            style={styles.textInput}
            value={phone}
            onChangeText={setPhone}
            placeholder={L.phonePlaceholder}
            placeholderTextColor="#aaa"
            keyboardType="phone-pad"
          />
          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
            <Ionicons name="mail" size={16} /> {L.emailLabel}
          </Text>
          <TextInput
            style={styles.textInput}
            value={email}
            onChangeText={setEmail}
            placeholder={L.emailPlaceholder}
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* 희망 지역 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location" size={16} /> {L.locationLabel}
          </Text>
          <TextInput
            style={styles.textInput}
            value={desiredLocation}
            onChangeText={setDesiredLocation}
            placeholder={L.locationPlaceholder}
            placeholderTextColor="#aaa"
          />
        </View>

        {/* ─── 언어 수준 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="language" size={16} /> {L.koreanLabel}
          </Text>
          <SelectButtons
            options={L.levels}
            selected={koreanLevel}
            onSelect={setKoreanLevel}
            color="#3F51B5"
          />

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{L.vietnameseLabel}</Text>
          <SelectButtons
            options={L.levels}
            selected={vietnameseLevel}
            onSelect={setVietnameseLevel}
            color="#E53935"
          />

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>{L.englishLabel}</Text>
          <SelectButtons
            options={L.levels}
            selected={englishLevel}
            onSelect={setEnglishLevel}
            color="#2E7D32"
          />
        </View>

        {/* ─── 희망 직무 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="briefcase" size={16} /> {L.jobTracksLabel}
          </Text>
          <SelectButtons
            options={L.jobTracks}
            selected={jobTracks}
            onSelect={setJobTracks}
            multi
            color="#FF7043"
          />
        </View>

        {/* 경력 / 학력 / 기술 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="time" size={16} /> {L.experienceLabel}
          </Text>
          <TextInput
            style={[styles.textInput, { width: 120 }]}
            value={experience}
            onChangeText={setExperience}
            placeholder="0"
            placeholderTextColor="#aaa"
            keyboardType="numeric"
          />

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
            <Ionicons name="school" size={16} /> {L.educationLabel}
          </Text>
          <SelectButtons
            options={L.education}
            selected={education}
            onSelect={setEducation}
            color="#795548"
          />

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
            <Ionicons name="star" size={16} /> {L.skillsLabel}
          </Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={skills}
            onChangeText={setSkills}
            placeholder={L.skillsPlaceholder}
            placeholderTextColor="#aaa"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* ─── 비자 상태 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="document-text" size={16} /> {L.visaLabel}
          </Text>
          <SelectButtons
            options={L.visa}
            selected={visaStatus}
            onSelect={setVisaStatus}
            color="#607D8B"
          />
        </View>

        {/* ─── 희망 급여 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cash" size={16} /> {L.salaryLabel}
          </Text>
          <TextInput
            style={[styles.textInput, { width: 200 }]}
            value={desiredSalaryUsd}
            onChangeText={setDesiredSalaryUsd}
            placeholder={L.salaryPlaceholder}
            placeholderTextColor="#aaa"
            keyboardType="numeric"
          />
        </View>

        {/* ─── YouTube 소개 영상 ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            📹 {sourceLanguage === "vi" ? "Video giới thiệu (YouTube)" : sourceLanguage === "en" ? "Intro Video (YouTube)" : "자기소개 영상 (YouTube)"}
          </Text>
          <Text style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            {sourceLanguage === "vi" ? "Nhập URL YouTube để giới thiệu bản thân" : sourceLanguage === "en" ? "Enter your YouTube video URL" : "유튜브 영상 링크를 입력하세요"}
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
        <TouchableOpacity
          style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>
                {isEditMode ? L.updateButton : L.submitButton}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 240 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── 스타일 ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
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
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FFE0B2",
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF7043",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fafafa",
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  selectGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  selectBtnText: {
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  selectBtnTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF7043",
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 8,
    gap: 8,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#E0E0E0",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
