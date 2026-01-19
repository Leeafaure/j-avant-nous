const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

const TIME_ZONE = "Europe/Paris";

function chunkTokens(tokens, size) {
  const chunks = [];
  for (let i = 0; i < tokens.length; i += size) chunks.push(tokens.slice(i, i + size));
  return chunks;
}

function dateKeyInTZ(date, timeZone) {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function daysUntilTarget(targetISO, now = new Date()) {
  if (!targetISO) return null;
  const targetDate = new Date(targetISO);
  if (Number.isNaN(targetDate.getTime())) return null;
  return Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function getRoomTokens(roomId) {
  const snap = await db.collection("rooms").doc(roomId).collection("pushTokens").get();
  return snap.docs.map((doc) => doc.id);
}

async function removeInvalidTokens(roomId, tokens) {
  if (!tokens.length) return;
  const batch = db.batch();
  tokens.forEach((token) => {
    const ref = db.collection("rooms").doc(roomId).collection("pushTokens").doc(token);
    batch.delete(ref);
  });
  await batch.commit();
}

async function sendToRoom(roomId, { notification, data }) {
  const tokens = await getRoomTokens(roomId);
  if (!tokens.length) return null;

  const invalidTokens = [];
  const tokenChunks = chunkTokens(tokens, 500);

  for (const chunk of tokenChunks) {
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification,
      data,
    });

    response.responses.forEach((res, idx) => {
      if (res.success) return;
      const code = res.error?.code || "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(chunk[idx]);
      }
    });
  }

  await removeInvalidTokens(roomId, invalidTokens);
  return null;
}

exports.notifyPlaylistAdd = functions.firestore
  .document("rooms/{roomId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeList = Array.isArray(before.playlist) ? before.playlist : [];
    const afterList = Array.isArray(after.playlist) ? after.playlist : [];
    if (!afterList.length) return null;

    const beforeKeys = new Set(beforeList.map((s) => `${s.dateKey || ""}|${s.who || ""}`));
    const added = afterList.filter((s) => !beforeKeys.has(`${s.dateKey || ""}|${s.who || ""}`));
    if (!added.length) return null;

    const latest = added[0];
    const whoLabel = latest.who === "lea" ? "Léa" : latest.who === "gauthier" ? "Gauthier" : "Quelqu'un";
    const title = latest.title || "une musique";
    const artist = latest.artist ? ` — ${latest.artist}` : "";

    return sendToRoom(context.params.roomId, {
      notification: {
        title: "Nouvelle musique 🎧",
        body: `${whoLabel} a ajouté "${title}"${artist}`,
      },
      data: { type: "playlist", roomId: context.params.roomId },
    });
  });

exports.notifyDailyUnlock = functions.pubsub
  .schedule("5 0 * * *")
  .timeZone(TIME_ZONE)
  .onRun(async () => {
    const todayKey = dateKeyInTZ(new Date(), TIME_ZONE);
    const roomsSnap = await db.collection("rooms").get();

    for (const doc of roomsSnap.docs) {
      const room = doc.data() || {};
      if (room.lastDailyNotify === todayKey) continue;

      await sendToRoom(doc.id, {
        notification: {
          title: "Mot + mini défi dispo ✨",
          body: "Le mot du jour et le mini défi sont prêts à être débloqués.",
        },
        data: { type: "daily-unlock", roomId: doc.id, dateKey: todayKey },
      });

      await doc.ref.set({ lastDailyNotify: todayKey }, { merge: true });
    }

    return null;
  });

exports.notifyJ14 = functions.pubsub
  .schedule("0 9 * * *")
  .timeZone(TIME_ZONE)
  .onRun(async () => {
    const roomsSnap = await db.collection("rooms").get();

    for (const doc of roomsSnap.docs) {
      const room = doc.data() || {};
      const daysLeft = daysUntilTarget(room.targetISO);
      if (daysLeft !== 14) continue;

      const targetKey = dateKeyInTZ(new Date(room.targetISO), TIME_ZONE);
      if (room.lastJ14Notify === targetKey) continue;

      await sendToRoom(doc.id, {
        notification: {
          title: "J-14 💖",
          body: "Dans 14 jours, on se retrouve. Ça se rapproche !",
        },
        data: { type: "j-14", roomId: doc.id, targetDateKey: targetKey },
      });

      await doc.ref.set({ lastJ14Notify: targetKey }, { merge: true });
    }

    return null;
  });
