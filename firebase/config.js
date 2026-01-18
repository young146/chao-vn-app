// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";  // ✅ Storage 추가!
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAAtT9gcu8eVQIhQxYEgBTGp2XZ6ghz_NU",
  authDomain: "chaovietnam-login.firebaseapp.com",
  projectId: "chaovietnam-login",
  storageBucket: "chaovietnam-login.firebasestorage.app",
  messagingSenderId: "249390849714",
  appId: "1:249390849714:web:95ae3e7f066b70ffe973ab",
  measurementId: "G-QTCWJ6GGH0",
};

// Initialize Firebase (중복 초기화 방지)
let app;
try {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
  } else {
    app = initializeApp(firebaseConfig);
  }
} catch (error) {
  console.error("Firebase 초기화 실패:", error);
  // 크래시 방지를 위해 기본값으로 초기화 시도
  try {
    app = initializeApp(firebaseConfig);
  } catch (retryError) {
    console.error("Firebase 재초기화 실패:", retryError);
    throw retryError;
  }
}

// Firestore 데이터베이스 export (안전한 초기화)
let db;
try {
  db = getFirestore(app);
} catch (error) {
  console.error("Firestore 초기화 실패:", error);
  throw error;
}

// Authentication with AsyncStorage persistence (안전한 초기화)
let auth;
try {
  // 이미 초기화된 auth가 있는지 확인
  try {
    auth = getAuth(app);
  } catch (e) {
    // auth가 없으면 초기화
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  }
} catch (error) {
  console.error("Firebase Auth 초기화 실패:", error);
  // 크래시 방지를 위해 기본 auth로 초기화 시도
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage)
    });
  } catch (retryError) {
    console.error("Firebase Auth 재초기화 실패:", retryError);
    throw retryError;
  }
}

// ✅ Firebase Storage export (사진 업로드용) - 안전한 초기화
let storage;
try {
  storage = getStorage(app);
} catch (error) {
  console.error("Firebase Storage 초기화 실패:", error);
  throw error;
}

export { db, auth, storage };