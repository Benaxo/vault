import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration Firebase - A remplacer par vos vraies clés API
const firebaseConfig = {
  apiKey: "AIzaSyDcN6M5WnHFR_rAhfygBwpadmKHATG-UT8",
  authDomain: "piggybank-620cb.firebaseapp.com",
  projectId: "piggybank-620cb",
  storageBucket: "piggybank-620cb.firebasestorage.app",
  messagingSenderId: "261675898010",
  appId: "1:261675898010:web:4f8d881feb20c5add7bb23",
  measurementId: "G-3WN24N4JQY",
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
