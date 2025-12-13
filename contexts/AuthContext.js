import React, { createContext, useState, useEffect, useContext } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

const AuthContext = createContext({});

// Admin 사용자 이메일 목록 (여기에 추가하세요!)
const ADMIN_EMAILS = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase Auth 상태 변화 감지
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await AsyncStorage.setItem("@user_id", currentUser.uid);

        // 로그인 시 푸시 토큰 등록 (Expo + FCM 둘 다)
        const tokens = await registerForPushNotificationsAsync();
        if (tokens && (tokens.expoToken || tokens.fcmToken)) {
          const tokenData = {
            ...(tokens.expoToken && { expoPushToken: tokens.expoToken }),
            ...(tokens.fcmToken && {
              fcmToken: tokens.fcmToken,
              fcmTokenUpdatedAt: serverTimestamp(),
              platform: Platform.OS,
            }),
          };
          await setDoc(doc(db, "users", currentUser.uid), tokenData, {
            merge: true,
          });
          console.log(
            "✅ 푸시 토큰 저장 완료 - Expo:",
            tokens.expoToken,
            "FCM:",
            tokens.fcmToken
          );
        }
      } else {
        await AsyncStorage.removeItem("@user_id");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  async function registerForPushNotificationsAsync() {
    let expoToken;
    let fcmToken;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });

      // 채팅 알림용 채널 (높은 우선순위)
      await Notifications.setNotificationChannelAsync("chat", {
        name: "채팅 알림",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF6B35",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== "granted") {
        console.log("알림 권한이 거부되었습니다!");
        return { expoToken: null, fcmToken: null };
      }

      // Expo Push Token 가져오기
      try {
        expoToken = (
          await Notifications.getExpoPushTokenAsync({
            projectId: "9b58881f-f09a-4042-acc3-a8593658c231",
          })
        ).data;
        console.log("📲 Expo Push Token:", expoToken);
      } catch (e) {
        console.log("Expo Token 획득 실패:", e);
      }

      // FCM/APNS 기기 토큰 가져오기 (Force Alarm용 - 앱이 꺼져도 작동)
      try {
        const devicePushToken = await Notifications.getDevicePushTokenAsync();
        fcmToken = devicePushToken.data;
        console.log("🔥 FCM/APNS Device Token:", fcmToken);
        console.log("📱 Token Type:", devicePushToken.type); // 'fcm' or 'apns'
      } catch (e) {
        console.log("FCM Token 획득 실패:", e);
      }
    } else {
      console.log("실물 기기에서만 푸시 알림이 작동합니다.");
    }

    return { expoToken, fcmToken };
  }

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
        name: profileData.name || null, // 실명 저장
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
        nearbyItems: profileCompleted ? true : false, // 주소 입력하면 자동 활성화
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

  // 아이디 찾기 (닉네임 또는 이름으로 이메일 찾기)
  const findId = async (type, value) => {
    try {
      // type: 'displayName' or 'name'
      const field = type === "name" ? "name" : "displayName";

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

  // 비밀번호 찾기 (이메일로 재설정 메일 발송)
  const findPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error("비밀번호 찾기 오류:", error);
      let message = "메일 발송에 실패했습니다.";
      if (error.code === "auth/user-not-found") {
        message = "가입되지 않은 이메일입니다.";
      } else if (error.code === "auth/invalid-email") {
        message = "유효하지 않은 이메일 형식입니다.";
      }
      return { success: false, error: message };
    }
  };

  // 구글 로그인
  const googleLogin = async (idToken) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const googleUser = userCredential.user;

      // 사용자 프로필이 없으면 생성
      const userDoc = await getDoc(doc(db, "users", googleUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email,
          name: googleUser.displayName || googleUser.email?.split("@")[0] || "",
          displayName:
            googleUser.displayName || googleUser.email?.split("@")[0] || "",
          profileImage: googleUser.photoURL || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
        });

        // notificationSettings 초기화
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
      if (error.code === "auth/account-exists-with-different-credential") {
        message = "이미 다른 방법으로 가입된 이메일입니다.";
      }
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        signup,
        login,
        logout,
        findId,
        findPassword,
        googleLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
