// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore 데이터베이스 export
export const db = getFirestore(app);

// Authentication export (중요!)
export const auth = getAuth(app);
