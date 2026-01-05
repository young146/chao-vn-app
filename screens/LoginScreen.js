import React, { useState, useEffect } from "react";
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
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, googleLogin, appleLogin } = useAuth();

  // Google Sign-In 초기화 (안드로이드에서만 활성화)
  useEffect(() => {
    if (Platform.OS === 'android') {
      GoogleSignin.configure({
        webClientId: "249390849714-uh33llioruo1dc861eoh7o3267i0ap22.apps.googleusercontent.com",
        offlineAccess: true,
      });
    }
  }, []);

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      
      // rawNonce 생성을 위한 랜덤 문자열
      const rawNonce = Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const result = await appleLogin(credential.identityToken, rawNonce);
        if (result.success) {
          Alert.alert("로그인 성공! ✅", "환영합니다!", [
            { text: "확인", onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert("애플 로그인 실패", result.error);
        }
      }
    } catch (error) {
      if (error.code === 'ERR_CANCELED') {
        console.log("애플 로그인을 취소했습니다.");
      } else {
        console.error("애플 로그인 에러:", error);
        Alert.alert("오류", "애플 로그인에 실패했습니다.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      console.log('🚀 구글 로그인 시작...');
      const startTime = Date.now();
      
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // 🔄 매번 계정 선택 화면을 보여주기 위해 signOut 호출 (빠름)
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // signOut 실패해도 무시
      }
      
      const userInfo = await GoogleSignin.signIn();
      console.log(`⏱️ 구글 계정 선택 완료: ${Date.now() - startTime}ms`);
      
      const idToken = userInfo.data?.idToken || userInfo.idToken;
      
      if (idToken) {
        const result = await googleLogin(idToken, null);
        console.log(`⏱️ 전체 로그인 완료: ${Date.now() - startTime}ms`);
        
        if (result.success) {
          Alert.alert("로그인 성공! ✅", "환영합니다!", [
            { text: "확인", onPress: () => navigation.goBack() },
          ]);
        } else {
          Alert.alert("구글 로그인 실패", result.error);
        }
      }
    } catch (error) {
      console.error("Google Sign-In 에러:", error);
      if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
        Alert.alert("구글 로그인 실패", error.message || "알 수 없는 오류가 발생했습니다.");
      }
    } finally {
      setGoogleLoading(false);
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
      Alert.alert("로그인 실패", result.error);
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
            <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
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
            <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="비밀번호"
              placeholderTextColor="rgba(0, 0, 0, 0.38)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>로그인</Text>}
          </TouchableOpacity>

          {/* 안드로이드에서만 제3자 로그인(구글) 표시 */}
          {Platform.OS === 'android' && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>또는</Text>
                <View style={styles.divider} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, googleLoading && { opacity: 0.7 }]}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || appleLoading}
              >
                {googleLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color="#fff" />
                    <Text style={[styles.googleButtonText, { marginLeft: 10 }]}>로그인 중...</Text>
                  </View>
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#fff" />
                    <Text style={styles.googleButtonText}>Google로 로그인</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* iOS 전용 애플 로그인은 현재 기획상 숨김 처리 (주석 처리) */}
          {/* 
          {Platform.OS === 'ios' && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          )} 
          */}

          <View style={styles.findContainer}>
            <TouchableOpacity onPress={() => navigation.navigate("아이디찾기")}>
              <Text style={styles.findText}>아이디 찾기</Text>
            </TouchableOpacity>
            <Text style={styles.findDivider}>|</Text>
            <TouchableOpacity onPress={() => navigation.navigate("비밀번호찾기")}>
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
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  logoContainer: { alignItems: "center", marginBottom: 48 },
  logoCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#FFF0EB", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  logoText: { fontSize: 28, fontWeight: "bold", color: "#333", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#999" },
  formContainer: { width: "100%" },
  inputGroup: { flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: "#e0e0e0" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#333" },
  eyeIcon: { padding: 4 },
  loginButton: { backgroundColor: "#FF6B35", borderRadius: 8, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  signupContainer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  signupText: { fontSize: 14, color: "#666" },
  signupLink: { fontSize: 14, color: "#FF6B35", fontWeight: "600" },
  findContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 16 },
  findText: { color: "#666", fontSize: 13 },
  findDivider: { color: "#ddd", marginHorizontal: 12 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  divider: { flex: 1, height: 1, backgroundColor: "#e0e0e0" },
  dividerText: { marginHorizontal: 12, fontSize: 14, color: "#999" },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#000", borderRadius: 8, paddingVertical: 14, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  googleButtonText: { marginLeft: 10, fontSize: 16, fontWeight: "600", color: "#fff" },
  appleButton: { width: '100%', height: 50, marginBottom: 16 },
});
