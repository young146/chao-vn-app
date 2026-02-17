import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  CITIES,
  getDistrictsByCity,
  getApartmentsByDistrict,
  translateCity,
  translateOther,
} from "../utils/vietnamLocations";
import { getColors } from "../utils/colors";

export default function SignupScreen({ navigation }) {
  const { t, i18n } = useTranslation('auth');
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState(""); // 실명
  const [displayName, setDisplayName] = useState("");

  // 주소 정보 (선택사항)
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedApartment, setSelectedApartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { signup } = useAuth();

  const districts = selectedCity ? getDistrictsByCity(selectedCity) : [];
  const apartments =
    selectedCity && selectedDistrict
      ? getApartmentsByDistrict(selectedCity, selectedDistrict)
      : [];

  const handleSignup = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !name.trim()) {
      Alert.alert(t('common:loginRequired'), t('allFieldsRequired'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common:loginRequired'), t('passwordMismatch'));
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common:loginRequired'), t('passwordTooShort'));
      return;
    }

    setLoading(true);

    // 프로필 데이터 준비
    const profileData = {
      name: name.trim(),
      displayName: displayName.trim() || email.split("@")[0],
      city: selectedCity || null,
      district: selectedDistrict || null,
      apartment: selectedApartment || null,
    };

    const result = await signup(email, password, profileData);
    setLoading(false);

    if (result.success) {
      const message = result.profileCompleted
        ? t('profileCompleteMessage')
        : t('profileLaterMessage');

      Alert.alert("🎉 " + t('signupSuccess'), message, [
        {
          text: t('common:confirm'),
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert(t('signupFailed'), result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('signupTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('signupSubtitle')}
            </Text>
          </View>

          {/* 입력 폼 */}
          <View style={styles.formContainer}>
            {/* 이메일 */}
            <View style={styles.inputGroup}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor="rgba(0, 0, 0, 0.38)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* 이름 (실명) */}
            <View style={styles.inputGroup}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('name')}
                placeholderTextColor="rgba(0, 0, 0, 0.38)"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>

            {/* 닉네임 (선택) */}
            <View style={styles.inputGroup}>
              <Ionicons
                name="person-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('nickname')}
                placeholderTextColor="rgba(0, 0, 0, 0.38)"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>

            {/* 비밀번호 */}
            <View style={styles.inputGroup}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('passwordMin')}
                placeholderTextColor="rgba(0, 0, 0, 0.38)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* 비밀번호 확인 */}
            <View style={styles.inputGroup}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#999"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('passwordConfirm')}
                placeholderTextColor="rgba(0, 0, 0, 0.38)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* 안내 메시지 */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color="#FF6B35" />
              <Text style={styles.infoText}>
                {t('profileTip')}
              </Text>
            </View>

            {/* 주소 입력 (선택사항) */}
            <View style={styles.addressSection}>
              <Text style={styles.sectionTitle}>{t('addressOptional')}</Text>

              {/* 도시 */}
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={selectedCity}
                  onValueChange={(value) => {
                    setSelectedCity(value);
                    setSelectedDistrict("");
                    setSelectedApartment("");
                  }}
                  style={styles.picker}
                >
                  <Picker.Item label={t('selectCity')} value="" />
                  {CITIES.map((city) => (
                    <Picker.Item key={city} label={translateCity(city, i18n.language)} value={city} />
                  ))}
                </Picker>
              </View>

              {/* 구/군 */}
              {selectedCity && (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedDistrict}
                    onValueChange={(value) => {
                      setSelectedDistrict(value);
                      setSelectedApartment("");
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label={t('selectDistrict')} value="" />
                    {districts.map((district) => (
                      <Picker.Item
                        key={district}
                        label={translateOther(district, i18n.language)}
                        value={district}
                      />
                    ))}
                  </Picker>
                </View>
              )}

              {/* 아파트/지역 */}
              {selectedDistrict && apartments.length > 0 && (
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedApartment}
                    onValueChange={setSelectedApartment}
                    style={styles.picker}
                  >
                    <Picker.Item label={t('selectApartment')} value="" />
                    {apartments.map((apartment) => (
                      <Picker.Item
                        key={apartment}
                        label={translateOther(apartment, i18n.language)}
                        value={apartment}
                      />
                    ))}
                  </Picker>
                </View>
              )}
            </View>

            {/* 가입 버튼 */}
            <TouchableOpacity
              style={styles.signupButton}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>{t('signupButton')}</Text>
              )}
            </TouchableOpacity>

            {/* 로그인으로 이동 */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>{t('hasAccount')} </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>{t('loginButton')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
  },
  formContainer: {
    width: "100%",
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: "#333",
  },
  eyeIcon: {
    padding: 4,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF4E6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: "#FF6B35",
    lineHeight: 16,
  },
  addressSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  pickerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    height: Platform.OS === "ios" ? 120 : undefined,
  },
  picker: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 0 : 8,
    fontSize: 14,
  },
  signupButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  signupButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: "#666",
  },
  loginLink: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "600",
  },
});
