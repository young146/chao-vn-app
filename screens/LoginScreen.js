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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";

// WebBrowser 완료 후 자동 닫기
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, googleLogin } = useAuth();

  // 구글 로그인 설정
  const googleConfig = {
    webClientId:
      "249390849714-uh33llioruo1dc861eoh7o3267i0ap22.apps.googleusercontent.com", // Web 클라이언트 ID
    expoClientId:
      "249390849714-uh33llioruo1dc861eoh7o3267i0ap22.apps.googleusercontent.com",
    androidClientId:
      "249390849714-ttacsttt5tv2lhqc7vv0g5t7e27lqmfr.apps.googleusercontent.com", // Android Client ID
    // iosClientId: "TODO: iOS 출시 시 추가 필요",
    redirectUri: makeRedirectUri({
      scheme: "chao-vn-app",
    }),
    scopes: ["openid", "profile", "email"],
    responseType: "id_token",
  };

  const [request, response, promptAsync] = Google.useAuthRequest(googleConfig);

  // 구글 로그인 응답 처리
  React.useEffect(() => {
    if (response?.type === "success") {
      const idToken =
        response.params?.id_token || response.authentication?.idToken;
      if (idToken) {
        handleGoogleLogin(idToken);
      } else {
        setGoogleLoading(false);
        console.error("ID Token not found in response:", response);
        Alert.alert("구글 로그인 실패", "인증 토큰을 받지 못했습니다.");
      }
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      console.error("Google login error:", response.error);
      Alert.alert("구글 로그인 실패", "구글 로그인에 실패했습니다.");
    } else if (response?.type === "dismiss" || response?.type === "cancel") {
      setGoogleLoading(false);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken) => {
    setGoogleLoading(true);
    const result = await googleLogin(idToken);
    setGoogleLoading(false);

    if (result.success) {
      Alert.alert("로그인 성공! ✅", "환영합니다!", [
        {
          text: "확인",
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert("구글 로그인 실패", result.error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      if (result.error.includes("비밀번호")) {
        Alert.alert(
          "로그인 실패",
          result.error + "\n\n비밀번호를 잊으셨나요?",
          [
            { text: "취소", style: "cancel" },
            {
              text: "비밀번호 찾기",
              onPress: () => navigation.navigate("비밀번호찾기"),
            },
          ]
        );
      } else {
        Alert.alert("로그인 실패", result.error);
      }
    } else {
      Alert.alert("로그인 성공! ✅", "환영합니다!", [
        {
          text: "확인",
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="newspaper" size={40} color="#FF6B35" />
          </View>
          <Text style={styles.logoText}>씬짜오 베트남</Text>
          <Text style={styles.subtitle}>한국 내 베트남 커뮤니티</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Ionicons
              name="mail-outline"
              size={20}
              color="#999"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="이메일"
              placeholderTextColor="rgba(0, 0, 0, 0.38)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#999"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
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

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>로그인</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => {
              setGoogleLoading(true);
              promptAsync();
            }}
            disabled={googleLoading || !request}
          >
            {googleLoading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#333" />
                <Text style={styles.googleButtonText}>구글로 로그인</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.findContainer}>
            <TouchableOpacity onPress={() => navigation.navigate("아이디찾기")}>
              <Text style={styles.findText}>아이디 찾기</Text>
            </TouchableOpacity>
            <Text style={styles.findDivider}>|</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("비밀번호찾기")}
            >
              <Text style={styles.findText}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("회원가입")}>
              <Text style={styles.signupLink}>회원가입</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF0EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
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
  loginButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  signupText: {
    fontSize: 14,
    color: "#666",
  },
  signupLink: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "600",
  },
  findContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  findText: {
    color: "#666",
    fontSize: 13,
  },
  findDivider: {
    color: "#ddd",
    marginHorizontal: 12,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: "#999",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 16,
  },
  googleButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
});
