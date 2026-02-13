import React, { createContext, useState, useEffect, useContext } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as KakaoLogin from "@react-native-seoul/kakao-login";

const AuthContext = createContext({});

// Admin 사용자 이메일 목록
const ADMIN_EMAILS = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileComplete, setNeedsProfileComplete] = useState(false);

  useEffect(() => {
    // ✅ iOS 크래시 방어: auth가 null인 경우 초기화 대기
    // App.js에서 initializeFirebase() 완료 후 AuthProvider가 렌더링되므로
    // 일반적으로는 auth가 null이 아니지만, 추가 방어 코드로 안전성 확보
    if (!auth) {
      console.log("⚠️ AuthContext: auth가 아직 초기화되지 않음, 대기 중...");
      setLoading(false);
      return;
    }

    // Firebase Auth 상태 변화 감지
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await AsyncStorage.setItem("@user_id", currentUser.uid);
        // 🔔 알림 토큰 등록은 NotificationService에서 전담하므로 여기서 중복 호출하지 않음

        // 📝 프로필 완성 여부 체크
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            const isIncomplete = !data.city || !data.district || !data.phone || !data.name;
            setNeedsProfileComplete(isIncomplete);
          } else {
            setNeedsProfileComplete(true);
          }
        } catch (e) {
          console.log("프로필 체크 실패:", e);
        }
      } else {
        await AsyncStorage.removeItem("@user_id");
        setNeedsProfileComplete(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Admin 권한 확인
  const isAdmin = () => {
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  };

  // 회원가입 (프로필 정보 포함)
  const signup = async (email, password, profileData = {}) => {
    try {
      // 1. Firebase Authentication 계정 생성
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const newUser = userCredential.user;

      // 2. users 컬렉션에 프로필 저장
      const profileCompleted = !!(profileData.city && profileData.district);

      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        email: newUser.email,
        name: profileData.name || null,
        displayName: profileData.displayName || email.split("@")[0],
        city: profileData.city || null,
        district: profileData.district || null,
        apartment: profileData.apartment || null,
        profileCompleted: profileCompleted,
        createdAt: serverTimestamp(),
      });

      // 3. notificationSettings 초기화
      await setDoc(doc(db, "notificationSettings", newUser.uid), {
        userId: newUser.uid,
        nearbyItems: profileCompleted ? true : false,
        favorites: true,
        reviews: true,
        chat: true,
        adminAlerts: true,
      });

      return { success: true, user: newUser, profileCompleted };
    } catch (error) {
      console.error("회원가입 오류:", error);
      let message = "회원가입에 실패했습니다.";
      if (error.code === "auth/email-already-in-use") {
        message = "이미 사용중인 이메일입니다.";
      } else if (error.code === "auth/weak-password") {
        message = "비밀번호는 최소 6자 이상이어야 합니다.";
      } else if (error.code === "auth/invalid-email") {
        message = "유효하지 않은 이메일 형식입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 로그인
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: userCredential.user };
    } catch (error) {
      let message = "로그인에 실패했습니다.";
      if (error.code === "auth/user-not-found") {
        message = "존재하지 않는 계정입니다.";
      } else if (error.code === "auth/wrong-password") {
        message = "비밀번호가 일치하지 않습니다.";
      } else if (error.code === "auth/invalid-email") {
        message = "유효하지 않은 이메일 형식입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 로그아웃
  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem("@user_id");
      return { success: true };
    } catch (error) {
      return { success: false, error: "로그아웃에 실패했습니다." };
    }
  };

  // 아이디 찾기
  const findId = async (type, value) => {
    try {
      const field = type === 'name' ? 'name' : 'displayName';
      const q = query(collection(db, "users"), where(field, "==", value));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: "해당 정보로 가입된 계정이 없습니다." };
      }

      const foundEmails = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.email) {
          foundEmails.push(data.email);
        }
      });

      return { success: true, emails: foundEmails };
    } catch (error) {
      console.error("아이디 찾기 오류:", error);
      return { success: false, error: "아이디 찾기 중 오류가 발생했습니다." };
    }
  };

  // 비밀번호 찾기
  const findPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error("비밀번호 찾기 오류:", error);
      let message = "메일 발송에 실패했습니다.";
      if (error.code === 'auth/user-not-found') {
        message = "가입되지 않은 이메일입니다.";
      } else if (error.code === 'auth/invalid-email') {
        message = "유효하지 않은 이메일 형식입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 구글 로그인
  const googleLogin = async (idToken, accessToken = null) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      const googleUser = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", googleUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email,
          name: googleUser.displayName || googleUser.email?.split("@")[0] || "",
          displayName: googleUser.displayName || googleUser.email?.split("@")[0] || "",
          profileImage: googleUser.photoURL || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "notificationSettings", googleUser.uid), {
          userId: googleUser.uid,
          nearbyItems: false,
          favorites: true,
          reviews: true,
          chat: true,
          adminAlerts: true,
        });
      }

      return { success: true, user: googleUser };
    } catch (error) {
      console.error("구글 로그인 오류:", error);
      let message = "구글 로그인에 실패했습니다.";
      if (error.code === 'auth/account-exists-with-different-credential') {
        message = "이미 다른 방법으로 가입된 이메일입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 애플 로그인
  const appleLogin = async (identityToken, rawNonce) => {
    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: rawNonce,
      });

      const userCredential = await signInWithCredential(auth, credential);
      const appleUser = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", appleUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", appleUser.uid), {
          uid: appleUser.uid,
          email: appleUser.email || null,
          name: appleUser.displayName || appleUser.email?.split("@")[0] || "Apple 사용자",
          displayName: appleUser.displayName || appleUser.email?.split("@")[0] || "Apple 사용자",
          profileImage: appleUser.photoURL || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(db, "notificationSettings", appleUser.uid), {
          userId: appleUser.uid,
          nearbyItems: false,
          favorites: true,
          reviews: true,
          chat: true,
          adminAlerts: true,
        });
      }

      return { success: true, user: appleUser };
    } catch (error) {
      console.error("애플 로그인 오류:", error);
      let message = "애플 로그인에 실패했습니다.";
      if (error.code === 'auth/account-exists-with-different-credential') {
        message = "이미 가입된 이메일입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 카카오 로그인
  const kakaoLogin = async () => {
    try {
      // 카카오 로그인 (계정 선택 화면 표시)
      const token = await KakaoLogin.loginWithKakaoAccount();
      
      // 카카오 프로필 정보 가져오기
      const profile = await KakaoLogin.getProfile();
      console.log("✅ 카카오 로그인 성공:", profile.nickname);

      // Firebase Auth 로그인용 이메일/비밀번호 생성
      const kakaoEmail = `kakao_${profile.id}@chaovietnam.co.kr`;
      const kakaoPassword = `kakao_login_sec_${profile.id}`;

      let userCredential;
      let isNewUser = false;
      
      try {
        // 기존 사용자 로그인
        userCredential = await signInWithEmailAndPassword(auth, kakaoEmail, kakaoPassword);
      } catch (error) {
        if (error.code === "auth/user-not-found" || error.code === "auth/invalid-credential") {
          // 신규 사용자 생성
          userCredential = await createUserWithEmailAndPassword(auth, kakaoEmail, kakaoPassword);
          isNewUser = true;
        } else {
          throw error;
        }
      }

      const user = userCredential.user;

      // Firestore에 사용자 정보 저장
      const userRef = doc(db, "users", user.uid);
      const userData = {
        uid: user.uid,
        email: profile.email || kakaoEmail,
        name: profile.nickname || "Kakao 사용자",
        displayName: profile.nickname || "Kakao 사용자",
        profileImage: profile.profileImageUrl || null,
        provider: "kakao",
        kakaoId: profile.id,
        profileCompleted: false,
        createdAt: serverTimestamp(),
      };

      // 신규 사용자: users + notificationSettings 생성
      // 기존 사용자: 프로필 정보만 업데이트
      if (isNewUser) {
        await Promise.all([
          setDoc(userRef, userData),
          setDoc(doc(db, "notificationSettings", user.uid), {
            userId: user.uid,
            nearbyItems: false,
            favorites: true,
            reviews: true,
            chat: true,
            adminAlerts: true,
          })
        ]);
      } else {
        // 기존 사용자는 프로필 정보만 업데이트
        await setDoc(userRef, {
          name: userData.name,
          displayName: userData.displayName,
          profileImage: userData.profileImage,
          email: userData.email,
        }, { merge: true });
      }

      return { success: true, user };

    } catch (error) {
      console.error("❌ 카카오 로그인 오류:", error);
      if (error.code === 'E_CANCELLED_OPERATION') {
        return { success: false, error: "로그인이 취소되었습니다." };
      }
      return { success: false, error: "카카오 로그인에 실패했습니다." };
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, signup, login, logout, findId, findPassword, googleLogin, appleLogin, kakaoLogin, needsProfileComplete, setNeedsProfileComplete }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
