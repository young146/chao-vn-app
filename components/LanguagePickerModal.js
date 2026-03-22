import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * LanguagePickerModal
 *
 * Step 1: 언어 선택 (한국어 / Tiếng Việt / English)
 * Step 2: 등록 유형 선택 (구인 / 구직)
 *
 * onSelect(sourceLanguage, type)  type: "hiring" | "seeking"
 * onClose()
 */
export default function LanguagePickerModal({ visible, onClose, onSelect }) {
  const [step, setStep] = React.useState(1); // 1=언어선택, 2=유형선택
  const [selectedLang, setSelectedLang] = React.useState(null);

  const handleClose = () => {
    setStep(1);
    setSelectedLang(null);
    onClose();
  };

  const handleLangSelect = (lang) => {
    setSelectedLang(lang);
    setStep(2);
  };

  const handleTypeSelect = (type) => {
    onSelect(selectedLang, type);
    setStep(1);
    setSelectedLang(null);
  };

  // ─── 언어 목록 ───
  const languages = [
    { code: "ko", flag: "🇰🇷", label: "한국어" },
    { code: "vi", flag: "🇻🇳", label: "Tiếng Việt" },
    { code: "en", flag: "🇺🇸", label: "English" },
  ];

  // ─── 유형별 타이틀 (선택 언어 기준) ───
  const typeTexts = {
    ko: {
      step1Title: "언어를 선택하세요",
      step1Sub: "등록할 양식의 언어를 선택해 주세요",
      step2Title: "등록 유형 선택",
      hiring: "🏢 구인 등록",
      hiringDesc: "인재를 찾고 있습니다",
      seeking: "👤 구직 등록",
      seekingDesc: "일자리를 찾고 있습니다",
      back: "← 언어 다시 선택",
    },
    vi: {
      step1Title: "Chọn ngôn ngữ",
      step1Sub: "Vui lòng chọn ngôn ngữ cho biểu mẫu đăng ký",
      step2Title: "Chọn loại đăng ký",
      hiring: "🏢 Đăng tin tuyển dụng",
      hiringDesc: "Tôi đang tìm kiếm nhân viên",
      seeking: "👤 Đăng ký tìm việc",
      seekingDesc: "Tôi đang tìm việc làm",
      back: "← Chọn lại ngôn ngữ",
    },
    en: {
      step1Title: "Select Language",
      step1Sub: "Please select the language for your registration form",
      step2Title: "Select Registration Type",
      hiring: "🏢 Post Job Opening",
      hiringDesc: "I am looking for employees",
      seeking: "👤 Register as Job Seeker",
      seekingDesc: "I am looking for a job",
      back: "← Change Language",
    },
  };

  const tx = typeTexts[selectedLang] || typeTexts.ko;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            {/* 헤더 */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {step === 2 && (
                  <TouchableOpacity
                    onPress={() => setStep(1)}
                    style={styles.backButton}
                  >
                    <Ionicons name="arrow-back" size={20} color="#2196F3" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, step === 1 && styles.stepDotActive]} />
                <View style={styles.stepLine} />
                <View style={[styles.stepDot, step === 2 && styles.stepDotActive]} />
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Step 1: 언어 선택 */}
            {step === 1 && (
              <View style={styles.content}>
                <Text style={styles.titleText}>언어를 선택하세요</Text>
                <Text style={styles.subText}>Select language / Chọn ngôn ngữ</Text>

                <View style={styles.optionList}>
                  {languages.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      style={styles.langOption}
                      onPress={() => handleLangSelect(lang.code)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.flagText}>{lang.flag}</Text>
                      <Text style={styles.langLabel}>{lang.label}</Text>
                      <Ionicons name="chevron-forward" size={20} color="#aaa" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 2: 구인/구직 선택 */}
            {step === 2 && (
              <View style={styles.content}>
                <Text style={styles.titleText}>{tx.step2Title}</Text>
                <Text style={styles.subText}>
                  {languages.find((l) => l.code === selectedLang)?.flag}{" "}
                  {languages.find((l) => l.code === selectedLang)?.label}
                </Text>

                <View style={styles.optionList}>
                  <TouchableOpacity
                    style={[styles.typeOption, styles.typeOptionHiring]}
                    onPress={() => handleTypeSelect("hiring")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeOptionTitle}>{tx.hiring}</Text>
                    <Text style={styles.typeOptionDesc}>{tx.hiringDesc}</Text>
                    <Ionicons name="chevron-forward" size={22} color="#1976D2" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.typeOption, styles.typeOptionSeeking]}
                    onPress={() => handleTypeSelect("seeking")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.typeOptionTitle}>{tx.seeking}</Text>
                    <Text style={styles.typeOptionDesc}>{tx.seekingDesc}</Text>
                    <Ionicons name="chevron-forward" size={22} color="#E65100" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  safeArea: {
    backgroundColor: "transparent",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    minHeight: 340,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    width: 40,
    alignItems: "flex-start",
  },
  backButton: {
    padding: 4,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ddd",
  },
  stepDotActive: {
    backgroundColor: "#2196F3",
  },
  stepLine: {
    width: 30,
    height: 2,
    backgroundColor: "#ddd",
    marginHorizontal: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },
  subText: {
    fontSize: 13,
    color: "#888",
    marginBottom: 20,
  },
  optionList: {
    gap: 12,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ececec",
  },
  flagText: {
    fontSize: 24,
    marginRight: 14,
  },
  langLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: "#222",
  },
  typeOption: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderWidth: 1.5,
  },
  typeOptionHiring: {
    backgroundColor: "#E3F2FD",
    borderColor: "#90CAF9",
  },
  typeOptionSeeking: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FFCC80",
  },
  typeOptionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },
  typeOptionDesc: {
    fontSize: 12,
    color: "#666",
    marginRight: 8,
    position: "absolute",
    bottom: 8,
    left: 20,
  },
});
