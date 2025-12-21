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
import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  // 구글 로그인 설정 - Development Build용
  const discovery = AuthSession.useAutoDiscovery("https://accounts.google.com");

  // Expo Auth Proxy URI (Google Cloud Console에 등록됨)
  const redirectUri = "https://auth.expo.io/@young146/chao-vn-app";

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:
        "249390849714-uh33llioruo1dc861eoh7o3267i0ap22.apps.googleusercontent.com",
      scopes: ["openid", "profile", "email"],
      redirectUri: redirectUri,
    },
    discovery
  );

  React.useEffect(() => {
    if (request) {
      console.log("✅ Auth Request Created!");
      console.log("🔧 Redirect URI:", request.redirectUri);
    }
  }, [request]);

  React.useEffect(() => {
    console.log("🔍 Response changed:", response?.type);
    console.log("🔍 Response:", JSON.stringify(response, null, 2));

    // 디버깅: response 전체 확인
    if (response) {
      console.log(
        "📩 Google Auth Response:",
        JSON.stringify(response, null, 2)
      );
    }

    if (response?.type === "success") {
      console.log("✅ Google Auth Success!");
      const { id_token, access_token } = response.params;

      if (!id_token) {
        console.error("❌ No id_token in response");
        Alert.alert("로그인 오류", "Google 인증 토큰을 받지 못했습니다.");
        setGoogleLoading(false);
        return;
      }

      const credential = GoogleAuthProvider.credential(id_token);

      setGoogleLoading(true);
      signInWithCredential(auth, credential)
        .then(async (userCredential) => {
          console.log("✅ Firebase Login Success:", userCredential.user.email);

          // 구글 로그인 사용자의 Firestore 프로필 생성/업데이트
          const user = userCredential.user;
          const userDocRef = doc(db, "users", user.uid);

          // 기존 프로필이 있는지 확인
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            // 신규 구글 로그인 사용자 - 프로필 생성
            await setDoc(userDocRef, {
              uid: user.uid,
              email: user.email,
              name: user.displayName || null,
              displayName: user.displayName || user.email.split("@")[0],
              photoURL: user.photoURL || null,
              city: null,
              district: null,
              apartment: null,
              profileCompleted: false,
              createdAt: serverTimestamp(),
              provider: "google",
            });

            // notificationSettings 초기화
            await setDoc(doc(db, "notificationSettings", user.uid), {
              userId: user.uid,
              nearbyItems: false,
              favorites: true,
              reviews: true,
              chat: true,
              adminAlerts: true,
            });

            console.log("✅ 구글 로그인 신규 사용자 프로필 생성 완료");
          } else {
            console.log("✅ 기존 구글 로그인 사용자");
          }

          Alert.alert(
            "로그인 성공! ✅",
            `환영합니다, ${user.displayName || "회원"}님!`,
            [{ text: "확인", onPress: () => navigation.goBack() }]
          );
        })
        .catch((error) => {
          console.error("❌ Firebase Login Error:", error);
          let errorMessage = "로그인에 실패했습니다.";
          if (error.code === "auth/account-exists-with-different-credential") {
            errorMessage =
              "이 이메일은 다른 로그인 방법으로 가입되어 있습니다.";
          } else if (error.code === "auth/invalid-credential") {
            errorMessage = "인증 정보가 유효하지 않습니다.";
          } else if (error.code === "auth/network-request-failed") {
            errorMessage = "네트워크 연결을 확인해주세요.";
          }
          Alert.alert("로그인 실패", errorMessage);
        })
        .finally(() => setGoogleLoading(false));
    } else if (response?.type === "error") {
      setGoogleLoading(false);
      console.error("❌ Google Auth Error:", response.error);
      Alert.alert(
        "로그인 오류",
        "구글 로그인 중 오류가 발생했습니다. 다시 시도해주세요."
      );
    } else if (response?.type === "cancel") {
      setGoogleLoading(false);
      console.log("⚠️ User cancelled Google login");
      // 사용자가 취소한 경우는 알림 표시하지 않음
    }
  }, [response]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("알림", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert("로그인 실패", result.error);
    } else {
      // 로그인 성공!
      Alert.alert("로그인 성공! ✅", "환영합니다!", [
        {
          text: "확인",
          onPress: () => navigation.goBack(), // 이전 페이지로 복귀
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
        {/* 로고 영역 */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="newspaper" size={40} color="#FF6B35" />
          </View>
          <Text style={styles.logoText}>씬짜오 베트남</Text>
          <Text style={styles.subtitle}>한국 내 베트남 커뮤니티</Text>
        </View>

        {/* 입력 폼 */}
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

          {/* 구글 로그인 버튼 */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              {
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#ddd",
                marginTop: 12,
                flexDirection: "row",
                justifyContent: "center",
                opacity: googleLoading ? 0.6 : 1,
              },
            ]}
            onPress={async () => {
              if (!googleLoading) {
                setGoogleLoading(true);
                console.log("🚀 Starting Google login...");
                await promptAsync();
              }
            }}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <>
                <Ionicons
                  name="logo-google"
                  size={20}
                  color="#333"
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.loginButtonText, { color: "#333" }]}>
                  Google로 계속하기
                </Text>
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
});
