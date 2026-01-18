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
import { auth, db, initializeFirebase, getAuthInstance, getDb } from "../firebase/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext({});

// Admin 사용자 이메일 목록
const ADMIN_EMAILS = ["info@chaovietnam.co.kr", "younghan146@gmail.com"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);

  // ✅ Firebase 초기화 대기
  useEffect(() => {
    const waitForFirebase = async () => {
      try {
        // Firebase가 이미 초기화되어 있으면 즉시 진행
        if (auth) {
          setFirebaseReady(true);
          return;
        }
        
        // Firebase 초기화 대기 (최대 5초)
        const timeout = setTimeout(() => {
          console.warn("⚠️ Firebase 초기화 타임아웃, 계속 진행...");
          setFirebaseReady(true);
        }, 5000);

        await initializeFirebase();
        clearTimeout(timeout);
        setFirebaseReady(true);
        console.log("✅ AuthContext: Firebase 초기화 완료");
      } catch (error) {
        console.error("❌ AuthContext: Firebase 초기화 실패:", error);
        setFirebaseReady(true); // 실패해도 계속 진행
      }
    };

    waitForFirebase();
  }, []);

  useEffect(() => {
    // Firebase가 준비될 때까지 대기
    if (!firebaseReady) {
      return;
    }

    // ✅ getAuthInstance()를 사용하여 초기화 보장
    const setupAuthListener = async () => {
      try {
        const authInstance = await getAuthInstance();
        
        if (!authInstance) {
          console.error("❌ AuthContext: authInstance가 null입니다");
          setLoading(false);
          return null;
        }

        const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
          setUser(currentUser);
          if (currentUser) {
            await AsyncStorage.setItem("@user_id", currentUser.uid);
            // 🔔 알림 토큰 등록은 NotificationService에서 전담하므로 여기서 중복 호출하지 않음
          } else {
            await AsyncStorage.removeItem("@user_id");
          }
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error("❌ AuthContext: onAuthStateChanged 설정 실패:", error);
        setLoading(false);
        return null;
      }
    };

    let unsubscribe = null;
    setupAuthListener().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [firebaseReady]);

  // Admin 권한 확인
  const isAdmin = () => {
    if (!user || !user.email) return false;
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
  };

  // 회원가입 (프로필 정보 포함)
  const signup = async (email, password, profileData = {}) => {
    try {
      // Firebase 초기화 보장
      const authInstance = await getAuthInstance();
      const dbInstance = await getDb();
      
      // 1. Firebase Authentication 계정 생성
      const userCredential = await createUserWithEmailAndPassword(
        authInstance,
        email,
        password
      );
      const newUser = userCredential.user;

      // 2. users 컬렉션에 프로필 저장
      const profileCompleted = !!(profileData.city && profileData.district);

      await setDoc(doc(dbInstance, "users", newUser.uid), {
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
      await setDoc(doc(dbInstance, "notificationSettings", newUser.uid), {
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
      const authInstance = await getAuthInstance();
      const userCredential = await signInWithEmailAndPassword(
        authInstance,
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
      const authInstance = await getAuthInstance();
      await signOut(authInstance);
      await AsyncStorage.removeItem("@user_id");
      return { success: true };
    } catch (error) {
      return { success: false, error: "로그아웃에 실패했습니다." };
    }
  };

  // 아이디 찾기
  const findId = async (type, value) => {
    try {
      const dbInstance = await getDb();
      const field = type === 'name' ? 'name' : 'displayName';
      const q = query(collection(dbInstance, "users"), where(field, "==", value));
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
      const authInstance = await getAuthInstance();
      await sendPasswordResetEmail(authInstance, email);
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
      const authInstance = await getAuthInstance();
      const dbInstance = await getDb();
      
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const userCredential = await signInWithCredential(authInstance, credential);
      const googleUser = userCredential.user;

      const userDoc = await getDoc(doc(dbInstance, "users", googleUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(dbInstance, "users", googleUser.uid), {
          uid: googleUser.uid,
          email: googleUser.email,
          name: googleUser.displayName || googleUser.email?.split("@")[0] || "",
          displayName: googleUser.displayName || googleUser.email?.split("@")[0] || "",
          profileImage: googleUser.photoURL || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(dbInstance, "notificationSettings", googleUser.uid), {
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
      const authInstance = await getAuthInstance();
      const dbInstance = await getDb();
      
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: rawNonce,
      });

      const userCredential = await signInWithCredential(authInstance, credential);
      const appleUser = userCredential.user;

      const userDoc = await getDoc(doc(dbInstance, "users", appleUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(dbInstance, "users", appleUser.uid), {
          uid: appleUser.uid,
          email: appleUser.email || null,
          name: appleUser.displayName || appleUser.email?.split("@")[0] || "Apple 사용자",
          displayName: appleUser.displayName || appleUser.email?.split("@")[0] || "Apple 사용자",
          profileImage: appleUser.photoURL || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
        });

        await setDoc(doc(dbInstance, "notificationSettings", appleUser.uid), {
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

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, signup, login, logout, findId, findPassword, googleLogin, appleLogin }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
