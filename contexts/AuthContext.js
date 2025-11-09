import React, { createContext, useState, useEffect, useContext } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Firebase Auth 상태 변화 감지
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await AsyncStorage.setItem("@user_id", currentUser.uid);
      } else {
        await AsyncStorage.removeItem("@user_id");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // 회원가입
  const signup = async (email, password) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      return { success: true, user: userCredential.user };
    } catch (error) {
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

  return (
    <AuthContext.Provider value={{ user, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
