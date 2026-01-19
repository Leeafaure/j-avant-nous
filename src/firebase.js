import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDGrfSUU7mo7lALwMCoxNozQYyLqQQEcYE",
  authDomain: "j-avant-nous.firebaseapp.com",
  projectId: "j-avant-nous",
  storageBucket: "j-avant-nous.firebasestorage.app",
  messagingSenderId: "71780708901",
  appId: "1:71780708901:web:53c4e4702b500fa5aa45cc",
  measurementId: "G-7D2ZCHFV16",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Messaging - only initialize in production
let messaging = null;
if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.warn('Firebase messaging initialization failed:', error);
  }
}

export { messaging };
