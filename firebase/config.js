// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence, getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getRemoteConfig, fetchAndActivate } from "firebase/remote-config";
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

// ✅ Lazy Initialization: 모듈 로드 시 즉시 실행하지 않음
// 이렇게 하면 네이티브 모듈 초기화와의 경쟁 상태를 방지할 수 있습니다.
let app = null;
let db = null;
let auth = null;
let storage = null;
let remoteConfig = null;
let initializationPromise = null;
let isInitialized = false;

// 초기화 함수 (필요할 때만 호출)
const initializeFirebase = async () => {
  if (isInitialized) {
    return { app, db, auth, storage };
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log("🔥 Firebase Web SDK 초기화 시작 (Lazy)...");
      
      // Initialize Firebase (중복 초기화 방지)
      const existingApps = getApps();
      if (existingApps.length > 0) {
        app = existingApps[0];
        console.log("✅ 기존 Firebase 앱 인스턴스 사용");
      } else {
        app = initializeApp(firebaseConfig);
        console.log("✅ 새 Firebase 앱 인스턴스 생성");
      }

      // Firestore 데이터베이스
      db = getFirestore(app);
      console.log("✅ Firestore 초기화 완료");

      // Authentication with AsyncStorage persistence
      try {
        auth = getAuth(app);
        console.log("✅ 기존 Auth 인스턴스 사용");
      } catch (e) {
        auth = initializeAuth(app, {
          persistence: getReactNativePersistence(ReactNativeAsyncStorage)
        });
        console.log("✅ 새 Auth 인스턴스 생성 (AsyncStorage persistence)");
      }

      // Firebase Storage
      storage = getStorage(app);
      console.log("✅ Firebase Storage 초기화 완료");

      // Firebase Remote Config (광고 설정용)
      try {
        remoteConfig = getRemoteConfig(app);
        remoteConfig.settings = {
          minimumFetchIntervalMillis: 3600000, // 1시간 캐시
        };
        // 기본값 설정
        remoteConfig.defaultConfig = {
          in_house_ads: JSON.stringify({
            banner: { imageUrl: "https://chaovietnam.co.kr/ads/banner_ad.png", linkUrl: "https://chaovietnam.co.kr" },
            inline: { imageUrl: "https://chaovietnam.co.kr/ads/inline_ad.png", linkUrl: "https://chaovietnam.co.kr" },
            section: { imageUrl: "https://chaovietnam.co.kr/ads/section_ad.png", linkUrl: "https://chaovietnam.co.kr" },
          }),
        };
        console.log("✅ Firebase Remote Config 초기화 완료");
      } catch (rcError) {
        console.log("⚠️ Remote Config 초기화 실패 (광고에 기본값 사용):", rcError.message);
      }

      isInitialized = true;
      console.log("✅ Firebase Web SDK 초기화 완료 (Lazy)");
      
      return { app, db, auth, storage, remoteConfig };
    } catch (error) {
      console.error("❌ Firebase 초기화 실패:", error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
};

// Getter 함수들 (초기화 보장)
const getApp = async () => {
  if (!isInitialized) await initializeFirebase();
  return app;
};

const getDb = async () => {
  if (!isInitialized) await initializeFirebase();
  return db;
};

const getAuthInstance = async () => {
  if (!isInitialized) await initializeFirebase();
  return auth;
};

const getStorageInstance = async () => {
  if (!isInitialized) await initializeFirebase();
  return storage;
};

// 동기식 getter (이미 초기화된 경우에만 사용 - 기존 코드 호환성)
const getDbSync = () => {
  if (!db) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first or use getDb() instead.");
  }
  return db;
};

const getAuthSync = () => {
  if (!auth) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first or use getAuthInstance() instead.");
  }
  return auth;
};

const getStorageSync = () => {
  if (!storage) {
    throw new Error("Firebase not initialized. Call initializeFirebase() first or use getStorageInstance() instead.");
  }
  return storage;
};

// 기존 호환성을 위한 export
// ⚠️ 중요: App.js에서 initializeFirebase()를 먼저 호출해야 합니다.
// React 컴포넌트들은 App.js가 렌더링된 후에야 사용되므로,
// App.js에서 초기화를 보장하면 다른 컴포넌트들이 사용할 때는 이미 초기화되어 있습니다.
export { db, auth, storage, remoteConfig };

// 새로운 Lazy Initialization API
export {
  initializeFirebase,
  getApp,
  getDb,
  getAuthInstance,
  getStorageInstance,
  getDbSync,
  getAuthSync,
  getStorageSync,
};
