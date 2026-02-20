import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ⚠️ Google Apps Script 광고문의 자동등록 URL
const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw1rd5SbMDMSxDYbCarcuJ5chVgcKKQgEvyJfXR0xEpYxs-tP93ZJigYoB6XgDzfoOpGQ/exec";

const AD_TYPES = [
  { label: "선택하세요", value: "" },
  { label: "잡지 지면 광고", value: "잡지 지면 광고" },
  { label: "온라인 광고", value: "온라인 광고" },
  { label: "양쪽 다 (지면 + 온라인)", value: "양쪽 다" },
];

const AD_SIZES = [
  { label: "선택하세요", value: "" },
  { label: "FC (Full Color)", value: "FC" },
  { label: "1/2 Page", value: "1/2" },
  { label: "1/4 Page", value: "1/4" },
  { label: "옐로페이지", value: "옐로페이지" },
  { label: "온라인 포함", value: "온라인 포함" },
];

/**
 * 광고 문의 네이티브 카드 모달
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 닫기 콜백
 */
export default function AdInquiryModal({ visible, onClose }) {
  const [form, setForm] = useState({
    customerName: "",
    contact: "",
    phone: "",
    email: "",
    adType: "",
    size: "",
    remark: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [adTypeOpen, setAdTypeOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.customerName.trim()) newErrors.customerName = "회사명을 입력해주세요";
    if (!form.contact.trim()) newErrors.contact = "담당자명을 입력해주세요";
    if (!form.phone.trim()) newErrors.phone = "전화번호를 입력해주세요";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const data = {
        date: new Date().toISOString().split("T")[0],
        customerName: form.customerName,
        contact: form.contact,
        phone: form.phone,
        email: form.email,
        adType: form.adType,
        size: form.size,
        remark: form.remark,
        source: "APP", // 앱에서 접수된 문의
        contactMethod: "APP",
      };

      await fetch(GAS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setForm({
          customerName: "", contact: "", phone: "", email: "",
          adType: "", size: "", remark: "",
        });
        setErrors({});
        onClose();
      }, 2500);
    } catch (error) {
      console.error("광고 문의 전송 오류:", error);
      setErrors({ submit: "전송 중 오류가 발생했습니다. 다시 시도해주세요." });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setForm({ customerName: "", contact: "", phone: "", email: "", adType: "", size: "", remark: "" });
    setErrors({});
    setSuccess(false);
    setAdTypeOpen(false);
    setSizeOpen(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* 전체 화면 컨테이너 */}
      <View style={styles.modalRoot}>
        {/* 반투명 배경 - 탭하면 닫힘 */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

        {/* 키보드 회피 영역: 카드만 감싸서 위로 밀어줌 */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
          style={styles.keyboardView}
        >
          <View style={styles.card}>
            {/* 헤더 */}
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.header}>
                <View style={styles.handle} />
                <Text style={styles.title}>📢 광고 문의</Text>
                <Text style={styles.subtitle}>Xinchao Vietnam 매거진 광고 문의</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>

            <ScrollView
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={styles.scrollContent}
              bounces={true}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
            >
              {/* 성공 메시지 */}
              {success && (
                <View style={styles.successBox}>
                  <Text style={styles.successText}>
                    ✅ 문의가 접수되었습니다!{"\n"}
                    빠른 시간 내에 담당자가 연락드리겠습니다.
                  </Text>
                </View>
              )}

              {/* 에러 메시지 */}
              {errors.submit && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorBoxText}>{errors.submit}</Text>
                </View>
              )}

              {!success && (
                <>
                  {/* 회사 정보 */}
                  <Text style={styles.sectionTitle}>📋 회사 정보</Text>

                  <Field label="회사명" required error={errors.customerName}>
                    <TextInput
                      style={[styles.input, errors.customerName && styles.inputError]}
                      placeholder="예: 삼성전자"
                      value={form.customerName}
                      onChangeText={(v) => handleChange("customerName", v)}
                      returnKeyType="next"
                    />
                  </Field>

                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field label="담당자명" required error={errors.contact}>
                        <TextInput
                          style={[styles.input, errors.contact && styles.inputError]}
                          placeholder="예: 박영수"
                          value={form.contact}
                          onChangeText={(v) => handleChange("contact", v)}
                          returnKeyType="next"
                        />
                      </Field>
                    </View>
                    <View style={styles.half}>
                      <Field label="전화" required error={errors.phone}>
                        <TextInput
                          style={[styles.input, errors.phone && styles.inputError]}
                          placeholder="예: 090-1234-5678"
                          value={form.phone}
                          onChangeText={(v) => handleChange("phone", v)}
                          keyboardType="phone-pad"
                          returnKeyType="next"
                        />
                      </Field>
                    </View>
                  </View>

                  <Field label="이메일">
                    <TextInput
                      style={styles.input}
                      placeholder="예: contact@company.com"
                      value={form.email}
                      onChangeText={(v) => handleChange("email", v)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="next"
                    />
                  </Field>

                  {/* 광고 정보 */}
                  <Text style={styles.sectionTitle}>📰 광고 정보</Text>

                  <View style={styles.row}>
                    <View style={styles.half}>
                      <Field label="광고 유형">
                        <TouchableOpacity
                          style={styles.select}
                          onPress={() => { setAdTypeOpen(!adTypeOpen); setSizeOpen(false); }}
                        >
                          <Text style={form.adType ? styles.selectText : styles.selectPlaceholder}>
                            {AD_TYPES.find(t => t.value === form.adType)?.label || "선택하세요"}
                          </Text>
                          <Text style={styles.selectArrow}>{adTypeOpen ? "▲" : "▼"}</Text>
                        </TouchableOpacity>
                        {adTypeOpen && (
                          <View style={styles.dropdown}>
                            {AD_TYPES.slice(1).map((t) => (
                              <TouchableOpacity
                                key={t.value}
                                style={[styles.dropdownItem, form.adType === t.value && styles.dropdownItemSelected]}
                                onPress={() => { handleChange("adType", t.value); setAdTypeOpen(false); }}
                              >
                                <Text style={[styles.dropdownText, form.adType === t.value && styles.dropdownTextSelected]}>
                                  {t.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </Field>
                    </View>
                    <View style={styles.half}>
                      <Field label="광고 크기">
                        <TouchableOpacity
                          style={styles.select}
                          onPress={() => { setSizeOpen(!sizeOpen); setAdTypeOpen(false); }}
                        >
                          <Text style={form.size ? styles.selectText : styles.selectPlaceholder}>
                            {AD_SIZES.find(s => s.value === form.size)?.label || "선택하세요"}
                          </Text>
                          <Text style={styles.selectArrow}>{sizeOpen ? "▲" : "▼"}</Text>
                        </TouchableOpacity>
                        {sizeOpen && (
                          <View style={styles.dropdown}>
                            {AD_SIZES.slice(1).map((s) => (
                              <TouchableOpacity
                                key={s.value}
                                style={[styles.dropdownItem, form.size === s.value && styles.dropdownItemSelected]}
                                onPress={() => { handleChange("size", s.value); setSizeOpen(false); }}
                              >
                                <Text style={[styles.dropdownText, form.size === s.value && styles.dropdownTextSelected]}>
                                  {s.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </Field>
                    </View>
                  </View>

                  {/* 문의 내용 */}
                  <Text style={styles.sectionTitle}>💬 문의 내용</Text>

                  <Field label="문의 내용">
                    <TextInput
                      style={[styles.input, styles.textarea]}
                      placeholder="광고 문의사항을 자유롭게 적어주세요. 예산, 기간, 컨셉 등"
                      value={form.remark}
                      onChangeText={(v) => handleChange("remark", v)}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      scrollEnabled={false}
                    />
                  </Field>

                  {/* 버튼 */}
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.submitBtn}
                      onPress={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.submitText}>문의 제출</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                      <Text style={styles.cancelText}>취소</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// 필드 래퍼 컴포넌트
function Field({ label, required, error, children }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // 모달 전체 루트: flex:1로 오버레이+카드 분리
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  keyboardView: {
    width: "100%",
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  scrollContent: {
    paddingBottom: Platform.OS === "ios" ? 60 : 80,
  },
  header: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    marginBottom: 16,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#ddd",
    borderRadius: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 12,
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    color: "#999",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  required: {
    color: "#f44336",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  inputError: {
    borderColor: "#f44336",
    backgroundColor: "#fff5f5",
  },
  textarea: {
    height: 90,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  half: {
    flex: 1,
  },
  select: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  selectText: {
    fontSize: 13,
    color: "#333",
    flex: 1,
  },
  selectPlaceholder: {
    fontSize: 13,
    color: "#aaa",
    flex: 1,
  },
  selectArrow: {
    fontSize: 10,
    color: "#888",
  },
  dropdown: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropdownItemSelected: {
    backgroundColor: "#fff5f5",
  },
  dropdownText: {
    fontSize: 13,
    color: "#333",
  },
  dropdownTextSelected: {
    color: "#d32f2f",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    color: "#f44336",
    marginTop: 4,
  },
  successBox: {
    backgroundColor: "#e8f5e9",
    borderLeftWidth: 4,
    borderLeftColor: "#4caf50",
    borderRadius: 8,
    padding: 16,
    marginVertical: 16,
  },
  successText: {
    color: "#2e7d32",
    fontSize: 14,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: "#ffebee",
    borderLeftWidth: 4,
    borderLeftColor: "#f44336",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  errorBoxText: {
    color: "#c62828",
    fontSize: 13,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: "#d32f2f",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 15,
  },
});
