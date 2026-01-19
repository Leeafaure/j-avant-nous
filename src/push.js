import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "./firebase";

const VAPID_KEY = "BAIl1EofkEk5-F9vnYu6jRAhybdscwJoKYnK9CiAygSghhulhchH3M3wL_pG1cVQxAxzvb3dT2kAuQ8URgRrsFo";
const SW_PATH = "/firebase-messaging-sw.js";

export async function registerPushToken({ roomId }) {
  if (typeof window === "undefined") return { ok: false, reason: "no-window" };
  if (!("Notification" in window)) return { ok: false, reason: "unsupported" };
  if (!navigator.serviceWorker) return { ok: false, reason: "no-sw" };
  if (Notification.permission !== "granted") return { ok: false, reason: "permission" };

  const onHttps = window.location.protocol === "https:" || window.location.hostname === "localhost";
  if (!onHttps) return { ok: false, reason: "https" };

  const supported = await isSupported().catch(() => false);
  if (!supported) return { ok: false, reason: "unsupported" };

  const registration = await navigator.serviceWorker.register(SW_PATH);
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: "no-token" };

  const tokenRef = doc(db, "rooms", roomId, "pushTokens", token);
  await setDoc(
    tokenRef,
    {
      token,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      userAgent: navigator.userAgent || "",
    },
    { merge: true }
  );

  return { ok: true, token };
}
