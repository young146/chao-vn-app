import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import {
  GoogleSignin,
  statusCodes,
  GoogleSigninButton,
} from "@react-native-google-signin/google-signin";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Google Sign-In 초기화 (네이티브 SDK 사용)
  useEffect(() => {
    GoogleSignin.configure({
      // ⚠️ Web Client ID (google-services.json의 client_type: 3)
      webClientId:
        "249390849714-uh33llioruo1dc861eoh7o3267i0ap22.apps.googleusercontent.com",
      offlineAccess: true,
    });
  }, []);

  // 이메일 로그인 핸들러
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      // 로그인 성공 시 메인 화면으로 이동
      navigation.reset({
        index: 0,
        routes: [{ name: "MainApp" }],
      });
    } else {
      Alert.alert("로그인 실패", result.error);
    }
  };

  // 구글 로그인 핸들러 (Native SDK)
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);

      // 1. 항상 계정 선택창이 뜨도록 로그아웃 먼저 실행
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // 이미 로그아웃 상태일 때 에러 무시
      }

      // 2. Google Play Services 확인 및 서명
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      console.log("Google Sign-In Success:", userInfo);

      // 2. idToken 추출
      // 라이브러리 버전에 따라 위치가 다를 수 있어 안전하게 처리
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("Google ID Token을 가져오지 못했습니다.");
      }

      // 3. Firebase Auth 로그인
      const result = await googleLogin(idToken);

      if (result.success) {
        Alert.alert("로그인 성공! ✅", "환영합니다!", [
          {
            text: "확인",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "MainApp" }],
              });
            },
          },
        ]);
      } else {
        Alert.alert("구글 로그인 실패", result.error);
      }

    } catch (error) {
      console.error("Google Sign-In Error:", error);

      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("User cancelled the login flow");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert("알림", "이미 로그인이 진행 중입니다.");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("오류", "Google Play 서비스를 사용할 수 없습니다.");
      } else {
        Alert.alert("오류", "구글 로그인 중 알 수 없는 오류가 발생했습니다.\n" + error.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 로고 영역 */}
          <View style={styles.logoContainer}>
            <Image
              source={require("../assets/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>씬짜오베트남</Text>
            <Text style={styles.appDesc}>베트남 교민 라이프스타일 플랫폼</Text>
          </View>

          {/* 입력 폼 영역 */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>로그인</Text>
              )}
            </TouchableOpacity>

            <View style={styles.findContainer}>
              <TouchableOpacity
                onPress={() => navigation.navigate("아이디찾기")}
              >
                <Text style={styles.findText}>아이디 찾기</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity
                onPress={() => navigation.navigate("비밀번호찾기")}
              >
                <Text style={styles.findText}>비밀번호 찾기</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 소셜 로그인 영역 */}
          <View style={styles.socialContainer}>
            <View style={styles.dividerContainer}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>또는</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialButtons}>
              {/* 구글 로그인 버튼 */}
              {/* 구글 로그인 버튼 (공식 컴포넌트 사용) */}
              <GoogleSigninButton
                style={{ width: "100%", height: 48 }}
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
              />
            </View>
          </View>

          {/* 회원가입 링크 */}
          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("회원가입")}>
              <Text style={styles.signupLink}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  appDesc: {
    fontSize: 16,
    color: "#666",
  },
  formContainer: {
    width: "100%",
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 50,
    backgroundColor: "#f9f9f9",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: "#FFB095",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  findContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  findText: {
    color: "#666",
    fontSize: 14,
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: "#ccc",
    marginHorizontal: 16,
  },
  socialContainer: {
    width: "100%",
    alignItems: "center",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#eee",
  },
  dividerText: {
    color: "#999",
    paddingHorizontal: 10,
    fontSize: 14,
  },
  socialButtons: {
    width: "100%",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    height: 50,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  signupText: {
    color: "#666",
    fontSize: 14,
  },
  signupLink: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "bold",
  },
});
