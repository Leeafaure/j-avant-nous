import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDGrfSUU7mo7lALwMCoxNozQYyLqQQEcYE",
  authDomain: "j-avant-nous.firebaseapp.com",
  projectId: "j-avant-nous",
  storageBucket: "j-avant-nous.firebasestorage.app",
  messagingSenderId: "71780708901",
  appId: "1:71780708901:web:53c4e4702b500fa5aa45cc",
  measurementId: "G-7D2ZCHFV16",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
