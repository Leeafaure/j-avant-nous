import React, { useEffect, useMemo, useState } from "react";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot, runTransaction, setDoc, updateDoc } from "firebase/firestore";
import { defaultRoomState } from "./sync";

const ROOM_CODE_STORAGE_KEY = "avant-nous-room-code-v1";
const ROOM_BACKUP_STORAGE_KEY = "avant-nous-room-backup-v1";
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LEGACY_ROOM_CODE = "gauthier-lea-2026-coeur";

const QUIZ_PLAYER_STORAGE_KEY = "avant-nous-quiz-player-v1";
const VALENTINE_DAY_KEY = "2026-02-14";

const DEFAULT_TAB_ICONS = {
  home: "🏠",
  meet: "📍",
  playlist: "🎧",
  rests: "🛌",
  activities: "✅",
};

const VALENTINE_TAB_ICONS = {
  home: "💘",
  meet: "🌹",
  playlist: "💌",
  rests: "🫶",
  activities: "🎁",
};

const VALENTINE_COUPLE_QUESTIONS = [
  { id: "first-memory", prompt: "Quel est ton premier souvenir marquant de nous deux ?" },
  { id: "favorite-quality", prompt: "Quelle qualité de l’autre te fait le plus craquer ?" },
  { id: "comfort-gesture", prompt: "Quel petit geste te fait te sentir aimé(e) par l’autre ?" },
  { id: "dream-trip", prompt: "Si on partait demain, quelle destination choisirais-tu pour nous ?" },
  { id: "song-us", prompt: "Quelle chanson te fait le plus penser à notre couple ?" },
  { id: "favorite-routine", prompt: "Quel moment simple de notre quotidien préfères-tu ?" },
  { id: "love-language", prompt: "Comment préfères-tu qu’on se montre notre amour ?" },
  { id: "couple-challenge", prompt: "Quel défi de couple aimerais-tu qu’on relève ensemble cette année ?" },
  { id: "sweet-message", prompt: "Quel message d’amour veux-tu laisser à l’autre aujourd’hui ?" },
  { id: "next-date", prompt: "Quelle est ta prochaine idée de date parfaite pour nous ?" },
];

const QUIZ_QUESTIONS = [
  {
    id: "symbol-au",
    prompt: "Le symbole chimique Au correspond à quel élément ?",
    options: ["Argent", "Aluminium", "Or", "Osmium"],
    correctIndex: 2,
    explanation: "Au vient du latin aurum, qui désigne l’or.",
  },
  {
    id: "first-moon-landing-year",
    prompt: "En quelle année les humains ont-ils marché sur la Lune pour la première fois ?",
    options: ["1959", "1969", "1979", "1989"],
    correctIndex: 1,
    explanation: "La mission Apollo 11 a aluni en 1969.",
  },
  {
    id: "petit-prince-author",
    prompt: "Qui est l’auteur du livre Le Petit Prince ?",
    options: ["Victor Hugo", "Marcel Proust", "Albert Camus", "Antoine de Saint-Exupéry"],
    correctIndex: 3,
    explanation: "Le Petit Prince a été écrit par Antoine de Saint-Exupéry.",
  },
  {
    id: "largest-hot-desert",
    prompt: "Quel est le plus grand désert chaud du monde ?",
    options: ["Le Sahara", "Le Kalahari", "Le désert d’Arabie", "Le désert de Gobi"],
    correctIndex: 0,
    explanation: "Le Sahara est le plus vaste désert chaud au monde.",
  },
  {
    id: "heart-chambers",
    prompt: "Combien de cavités principales possède le coeur humain ?",
    options: ["2", "3", "4", "5"],
    correctIndex: 2,
    explanation: "Le coeur possède 4 cavités: 2 oreillettes et 2 ventricules.",
  },
  {
    id: "switzerland-language",
    prompt: "Quelle est la langue la plus parlée en Suisse ?",
    options: ["Italien", "Français", "Allemand", "Romanche"],
    correctIndex: 2,
    explanation: "L’allemand est la langue la plus parlée en Suisse.",
  },
  {
    id: "kyoto-country",
    prompt: "Dans quel pays se trouve la ville de Kyoto ?",
    options: ["Corée du Sud", "Chine", "Japon", "Thaïlande"],
    correctIndex: 2,
    explanation: "Kyoto est une ville historique du Japon.",
  },
  {
    id: "salt-formula",
    prompt: "Quelle est la formule chimique du sel de table ?",
    options: ["NaCl", "KCl", "Na2CO3", "HCl"],
    correctIndex: 0,
    explanation: "Le sel de table est principalement du chlorure de sodium (NaCl).",
  },
  {
    id: "telephone-inventor",
    prompt: "Quel inventeur est généralement associé à l’invention du téléphone ?",
    options: ["Nikola Tesla", "Alexander Graham Bell", "Thomas Edison", "Guglielmo Marconi"],
    correctIndex: 1,
    explanation: "Alexander Graham Bell est historiquement associé au brevet du téléphone.",
  },
  {
    id: "atlantic-ocean",
    prompt: "Quel océan sépare principalement l’Afrique et les Amériques ?",
    options: ["Océan Pacifique", "Océan Arctique", "Océan Indien", "Océan Atlantique"],
    correctIndex: 3,
    explanation: "L’océan Atlantique se situe entre ces continents.",
  },
  {
    id: "capital-australia",
    prompt: "Quelle est la capitale de l’Australie ?",
    options: ["Sydney", "Canberra", "Melbourne", "Perth"],
    correctIndex: 1,
    explanation: "Canberra est la capitale politique de l’Australie.",
  },
  {
    id: "binary-base",
    prompt: "Le système binaire est basé sur combien de chiffres ?",
    options: ["2", "8", "10", "16"],
    correctIndex: 0,
    explanation: "Le binaire utilise uniquement 0 et 1.",
  },
  {
    id: "starry-night-artist",
    prompt: "Qui a peint La Nuit étoilée ?",
    options: ["Claude Monet", "Pablo Picasso", "Vincent van Gogh", "Paul Cezanne"],
    correctIndex: 2,
    explanation: "La Nuit étoilée est une oeuvre de Vincent van Gogh.",
  },
  {
    id: "egypt-continent",
    prompt: "Sur quel continent se trouve l’Égypte ?",
    options: ["Europe", "Asie", "Afrique", "Amérique du Sud"],
    correctIndex: 2,
    explanation: "L’Égypte est un pays du nord-est de l’Afrique.",
  },
  {
    id: "current-unit",
    prompt: "Quelle est l’unité SI de l’intensité du courant électrique ?",
    options: ["Le volt", "L’ampère", "Le watt", "L’ohm"],
    correctIndex: 1,
    explanation: "L’unité SI du courant électrique est l’ampère.",
  },
  {
    id: "smallest-prime",
    prompt: "Quel est le plus petit nombre premier ?",
    options: ["0", "1", "2", "3"],
    correctIndex: 2,
    explanation: "2 est le seul nombre premier pair.",
  },
  {
    id: "photosynthesis-gas",
    prompt: "Quel gaz les plantes absorbent-elles lors de la photosynthèse ?",
    options: ["Oxygène", "Hydrogène", "Diazote", "Dioxyde de carbone"],
    correctIndex: 3,
    explanation: "Les plantes absorbent surtout le dioxyde de carbone (CO2).",
  },
  {
    id: "japan-currency",
    prompt: "Quelle est la monnaie officielle du Japon ?",
    options: ["Le yuan", "Le won", "Le yen", "Le dollar"],
    correctIndex: 2,
    explanation: "La monnaie japonaise est le yen.",
  },
  {
    id: "four-seasons-composer",
    prompt: "Qui a composé Les Quatre Saisons ?",
    options: ["Wolfgang Amadeus Mozart", "Johann Sebastian Bach", "Antonio Vivaldi", "Franz Schubert"],
    correctIndex: 2,
    explanation: "Les Quatre Saisons est une oeuvre d’Antonio Vivaldi.",
  },
  {
    id: "arctic-ocean-location",
    prompt: "Quel océan entoure principalement le pôle Nord ?",
    options: ["Océan Pacifique", "Océan Atlantique", "Océan Indien", "Océan Arctique"],
    correctIndex: 3,
    explanation: "Le pôle Nord se situe dans l’océan Arctique.",
  },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayKeyLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}
function msToParts(ms) {
  const clamped = Math.max(0, ms);
  const s = Math.floor(clamped / 1000);
  const days = Math.floor(s / 86400);
  const rem = s % 86400;
  const hours = Math.floor(rem / 3600);
  const minutes = Math.floor((rem % 3600) / 60);
  const seconds = rem % 60;
  return { days, hours, minutes, seconds };
}
function msUntilMidnightLocal(now = new Date()) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}
function pickDeterministic(list, seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return list[Math.abs(h) % list.length];
}
function normalizeRoomCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // Legacy rooms can contain dashes (ex: gauthier-lea-2026-coeur)
  if (raw.includes("-")) {
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 64);
  }

  // Private room code format (new flow)
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}
function generateRoomCode(length = 8) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}
function readStoredRoomCode() {
  if (typeof window === "undefined") return "";
  return normalizeRoomCode(window.localStorage.getItem(ROOM_CODE_STORAGE_KEY) || "");
}
function persistRoomCode(code) {
  if (typeof window === "undefined") return;
  const normalized = normalizeRoomCode(code);
  if (!normalized) {
    window.localStorage.removeItem(ROOM_CODE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ROOM_CODE_STORAGE_KEY, normalized);
}
function extractRoomContent(source) {
  const merged = { ...defaultRoomState(), ...(source || {}) };
  delete merged.joinCode;
  delete merged.ownerUid;
  delete merged.participants;
  delete merged.createdAt;
  return merged;
}
function readRoomBackup() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ROOM_BACKUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return extractRoomContent(parsed);
  } catch {
    return null;
  }
}
function persistRoomBackup(data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ROOM_BACKUP_STORAGE_KEY, JSON.stringify(extractRoomContent(data)));
  } catch {
    // Ignore localStorage errors
  }
}
function normalizeQuizPlayer(value) {
  return value === "gauthier" ? "gauthier" : "lea";
}
function readStoredQuizPlayer() {
  if (typeof window === "undefined") return "lea";
  return normalizeQuizPlayer(window.localStorage.getItem(QUIZ_PLAYER_STORAGE_KEY));
}
function persistQuizPlayer(player) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(QUIZ_PLAYER_STORAGE_KEY, normalizeQuizPlayer(player));
}

function clampMin0(n) {
  return Math.max(0, n);
}
function nightsLeft(days) {
  return clampMin0(days);
}
function weekendsLeft(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  if (toDate <= fromDate) return 0;

  const start = new Date(fromDate);
  start.setHours(12, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(12, 0, 0, 0);

  let count = 0;
  const d = new Date(start);
  while (d < end) {
    if (d.getDay() === 6) count += 1; // samedi
    d.setDate(d.getDate() + 1);
  }
  return count;
}
function nextMilestone(days) {
  const caps = [60, 45, 30, 21, 14, 10, 7, 5, 3, 2, 1, 0];
  const d = Number.isFinite(days) ? days : null;
  if (d === null) return null;
  for (const c of caps) if (d > c) return c;
  return null;
}
function milestoneLabel(cap) {
  if (cap === 0) return "Aujourd’hui 💖";
  if (cap === 1) return "1 jour";
  return `${cap} jours`;
}
function vibeLine(days) {
  if (days === null) return "";
  if (days < 0) return "On s’est déjà retrouvés… et j’en veux encore 😈";
  if (days === 0) return "C’est le jour J. Respire… j’arrive 💞";
  if (days <= 3) return "Ok là… c’est imminent 😈💗";
  if (days <= 7) return "Semaine finale. Je tiens plus 😭💋";
  if (days <= 14) return "Deux semaines… je commence à préparer les bisous 😇";
  if (days <= 30) return "Ça se rapproche. Et je souris bêtement.";
  return "On avance, un jour à la fois. Team nous 💪💖";
}
function parseDateKeyLocal(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return null;
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const parsed = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== (m || 1) - 1 ||
    parsed.getDate() !== (d || 1)
  ) {
    return null;
  }
  return parsed;
}
function daysBetweenDateKeys(fromKey, toKey) {
  const from = parseDateKeyLocal(fromKey);
  const to = parseDateKeyLocal(toKey);
  if (!from || !to) return null;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / oneDay);
}
function formatDateKeyFr(dateKey) {
  const parsed = parseDateKeyLocal(dateKey);
  if (!parsed) return String(dateKey || "");
  return parsed.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function relativeDaysLabel(days) {
  if (days === null) return "";
  if (days === 0) return "Aujourd’hui";
  if (days === 1) return "Demain";
  if (days < 0) return `Il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  return `Dans ${days} jours`;
}
function normalizeRestPeriod(value) {
  return value === "evening" ? "evening" : "full_day";
}
function restPeriodRank(period) {
  return normalizeRestPeriod(period) === "evening" ? 1 : 0;
}
function restPeriodLabel(period) {
  return normalizeRestPeriod(period) === "evening" ? "Soirée" : "Journée entière";
}
function formatDateWithRestPeriod(dateKey, period) {
  const dateText = formatDateKeyFr(dateKey);
  if (normalizeRestPeriod(period) === "evening") return `${dateText} (soirée)`;
  return `${dateText} (journée)`;
}
function normalizeRestRanges(rawRanges, legacyDates) {
  const next = [];
  const seen = new Set();

  const pushRange = (
    startKey,
    endKey,
    startPeriodValue = "full_day",
    endPeriodValue = "full_day"
  ) => {
    if (!parseDateKeyLocal(startKey) || !parseDateKeyLocal(endKey)) return;
    let start = String(startKey);
    let end = String(endKey);
    let startPeriod = normalizeRestPeriod(startPeriodValue);
    let endPeriod = normalizeRestPeriod(endPeriodValue);
    if (end < start) {
      const swap = start;
      start = end;
      end = swap;
      const swapPeriod = startPeriod;
      startPeriod = endPeriod;
      endPeriod = swapPeriod;
    }
    const key = `${start}|${end}|${startPeriod}|${endPeriod}`;
    if (seen.has(key)) return;
    seen.add(key);
    next.push({ start, end, startPeriod, endPeriod });
  };

  const ranges = Array.isArray(rawRanges) ? rawRanges : [];
  for (const range of ranges) {
    if (typeof range === "string") {
      pushRange(range, range, "full_day", "full_day");
      continue;
    }
    if (!range || typeof range !== "object") continue;
    const start = range.start ?? range.from ?? range.startDate ?? "";
    const end = range.end ?? range.to ?? range.endDate ?? "";
    const legacyPeriod = range.period ?? range.timeType ?? range.slot ?? range.kind ?? "full_day";
    const startPeriod = range.startPeriod ?? legacyPeriod;
    const endPeriod = range.endPeriod ?? legacyPeriod;
    pushRange(start, end || start, startPeriod, endPeriod);
  }

  const dates = Array.isArray(legacyDates) ? legacyDates : [];
  for (const dateKey of dates) pushRange(dateKey, dateKey, "full_day", "full_day");

  next.sort(
    (a, b) =>
      a.start.localeCompare(b.start) ||
      a.end.localeCompare(b.end) ||
      restPeriodRank(a.startPeriod) - restPeriodRank(b.startPeriod) ||
      restPeriodRank(a.endPeriod) - restPeriodRank(b.endPeriod)
  );
  return next;
}
function restRangeKey(range) {
  if (!range) return "";
  return `${range.start}|${range.end}|${normalizeRestPeriod(range.startPeriod)}|${normalizeRestPeriod(range.endPeriod)}`;
}
function formatRestRange(range) {
  if (!range) return "";
  if (range.start === range.end && normalizeRestPeriod(range.startPeriod) === normalizeRestPeriod(range.endPeriod)) {
    return formatDateWithRestPeriod(range.start, range.startPeriod);
  }
  return `${formatDateWithRestPeriod(range.start, range.startPeriod)} → ${formatDateWithRestPeriod(
    range.end,
    range.endPeriod
  )}`;
}
function restRangeLength(range) {
  const diff = daysBetweenDateKeys(range?.start, range?.end);
  if (diff === null) return 0;
  return diff + 1;
}
function restRangeMeta(range, todayKey) {
  const fromDiff = daysBetweenDateKeys(todayKey, range?.start);
  const toDiff = daysBetweenDateKeys(todayKey, range?.end);
  if (fromDiff === null || toDiff === null) return "";
  if (toDiff < 0) return `Terminé ${relativeDaysLabel(toDiff).toLowerCase()}`;
  if (fromDiff > 0) return `Début ${relativeDaysLabel(fromDiff).toLowerCase()}`;
  if (fromDiff === 0 && toDiff === 0) return "Aujourd’hui";
  if (fromDiff === 0) return "Débute aujourd’hui";
  if (toDiff === 0) return "Dernier jour";
  return "En cours";
}
function restRangeSummary(range, todayKey) {
  if (!range) return "Ajoute une plage pour afficher le prochain repos.";
  const fromDiff = daysBetweenDateKeys(todayKey, range.start);
  const toDiff = daysBetweenDateKeys(todayKey, range.end);
  if (fromDiff === null || toDiff === null) return "Ajoute une plage pour afficher le prochain repos.";
  if (toDiff < 0) return "Ajoute une plage pour afficher le prochain repos.";
  if (fromDiff > 1) return `Prochain repos : dans ${fromDiff} jours 💙`;
  if (fromDiff === 1) return "Prochain repos : demain 💙";
  if (fromDiff === 0 && toDiff === 0) return "Prochain repos : aujourd’hui 💙";
  return "Repos en cours 💙";
}
function toLegacyRestDates(ranges) {
  return ranges
    .filter(
      (range) =>
        range.start === range.end &&
        normalizeRestPeriod(range.startPeriod) === "full_day" &&
        normalizeRestPeriod(range.endPeriod) === "full_day"
    )
    .map((range) => range.start);
}
function restRangeDetailLabel(range) {
  const length = restRangeLength(range);
  const startPeriod = normalizeRestPeriod(range?.startPeriod);
  const endPeriod = normalizeRestPeriod(range?.endPeriod);
  if (startPeriod === endPeriod && startPeriod === "evening") {
    return `${restPeriodLabel(startPeriod)} • ${length > 1 ? `${length} soirées` : "1 soirée"}`;
  }
  if (startPeriod === endPeriod && startPeriod === "full_day") {
    return `${restPeriodLabel(startPeriod)} • ${length > 1 ? `${length} jours de repos` : "1 jour de repos"}`;
  }
  return `${restPeriodLabel(startPeriod)} → ${restPeriodLabel(endPeriod)} • ${length > 1 ? `${length} jours` : "1 jour"}`;
}

function buildMapsLink({ city, placeName, address }) {
  const q = [placeName, address, city]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(", ");
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

let confettiPromise = null;
function fireConfetti(options) {
  if (typeof window === "undefined") return;
  if (!confettiPromise) confettiPromise = import("canvas-confetti");
  confettiPromise
    .then((mod) => (mod.default || mod)(options))
    .catch(() => {});
}

export default function App() {
  const [tab, setTab] = useState("home"); // home | meet | playlist | rests | activities
  const [activitiesSubTab, setActivitiesSubTab] = useState("todo"); // todo | movies
  const [editMeet, setEditMeet] = useState(false);
  const [customMovieTitle, setCustomMovieTitle] = useState("");
  const [restStartInput, setRestStartInput] = useState("");
  const [restEndInput, setRestEndInput] = useState("");
  const [restStartPeriodInput, setRestStartPeriodInput] = useState("full_day"); // full_day | evening
  const [restEndPeriodInput, setRestEndPeriodInput] = useState("full_day"); // full_day | evening
  const [editingRestRangeKey, setEditingRestRangeKey] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [quizPlayer, setQuizPlayer] = useState(() => readStoredQuizPlayer());
  const [showTopMenu, setShowTopMenu] = useState(false);
  const [legacyRecoveryAttempted, setLegacyRecoveryAttempted] = useState(false);
  const [showValentineQuizModal, setShowValentineQuizModal] = useState(false);
  const [valentineDraftAnswers, setValentineDraftAnswers] = useState(() =>
    VALENTINE_COUPLE_QUESTIONS.map(() => "")
  );
  const [valentineSubmitBusy, setValentineSubmitBusy] = useState(false);
  const [valentineSubmitError, setValentineSubmitError] = useState("");

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayKey = useMemo(() => todayKeyLocal(now), [now]);
  const isValentineMode = todayKey === VALENTINE_DAY_KEY;
  const appClassName = `app${isValentineMode ? " appValentine" : ""}`;
  const tabIcons = isValentineMode ? VALENTINE_TAB_ICONS : DEFAULT_TAB_ICONS;
  const untilMidnight = useMemo(() => msUntilMidnightLocal(now), [now]);
  const untilMidnightParts = useMemo(() => msToParts(untilMidnight), [untilMidnight]);

  const [roomCode, setRoomCode] = useState(() => readStoredRoomCode());
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");

  const roomRef = useMemo(() => (roomCode ? doc(db, "rooms", roomCode) : null), [roomCode]);
  const [shared, setShared] = useState(() => defaultRoomState());
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState("");
  const isRoomMember = Boolean(currentUser && shared?.participants?.[currentUser.uid]);
  const canWriteInRoom = Boolean(roomRef && (isRoomMember || roomCode === LEGACY_ROOM_CODE));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    if (!auth.currentUser) {
      signInAnonymously(auth).catch((e) => {
        setAuthError(String(e?.message || e));
        setAuthReady(true);
      });
    } else {
      setAuthReady(true);
    }

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomRef || !roomCode || !currentUser) {
      setShared(defaultRoomState());
      setSyncing(false);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncError("");
    setSyncing(true);

    const unsub = onSnapshot(
      roomRef,
      (snap) => {
        try {
          if (!snap.exists()) {
            clearActiveRoom("Salon introuvable. Vérifie le code de salon.");
            return;
          }
          const merged = { ...defaultRoomState(), ...snap.data() };
          setShared(merged);
          persistRoomBackup(merged);
          setSyncing(false);
        } catch (e) {
          setSyncError(String(e?.message || e));
          setSyncing(false);
        }
      },
      (err) => {
        if (err?.code === "permission-denied") {
          clearActiveRoom("Accès refusé à ce salon. Rejoins-le avec un code valide.");
          return;
        }
        setSyncError(String(err?.message || err));
        setSyncing(false);
      }
    );

    return () => unsub();
  }, [currentUser, roomCode, roomRef]);

  useEffect(() => {
    if (!roomCode || !isRoomMember) return;
    persistRoomBackup(shared);
  }, [isRoomMember, roomCode, shared]);

  useEffect(() => {
    persistQuizPlayer(quizPlayer);
  }, [quizPlayer]);

  useEffect(() => {
    if (!currentUser || roomCode || legacyRecoveryAttempted) return;
    if (readRoomBackup()) return;
    setLegacyRecoveryAttempted(true);
    activateRoom(LEGACY_ROOM_CODE);
  }, [currentUser, legacyRecoveryAttempted, roomCode]);

  useEffect(() => {
    if (!isValentineMode || typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const effectKey = `avant-nous-valentine-${todayKey}`;
    if (window.sessionStorage.getItem(effectKey)) return;
    window.sessionStorage.setItem(effectKey, "1");

    fireConfetti({ particleCount: 70, spread: 52, origin: { y: 0.75 }, scalar: 0.9 });
    const timeout = window.setTimeout(
      () => fireConfetti({ particleCount: 50, spread: 46, origin: { y: 0.7 }, scalar: 0.8 }),
      240
    );
    return () => window.clearTimeout(timeout);
  }, [isValentineMode, todayKey]);

  useEffect(() => {
    if (!isValentineMode || !roomCode) {
      setShowValentineQuizModal(false);
      return;
    }
    setShowValentineQuizModal(true);
  }, [isValentineMode, roomCode]);

  function activateRoom(nextCode) {
    const normalized = normalizeRoomCode(nextCode);
    if (!normalized) return;
    setRoomCode(normalized);
    persistRoomCode(normalized);
    setRoomError("");
  }

  function clearActiveRoom(errorMessage = "") {
    setRoomCode("");
    persistRoomCode("");
    setRoomCodeInput("");
    setRoomError(errorMessage);
    setSyncError("");
    setSyncing(false);
    setShared(defaultRoomState());
  }

  async function createPrivateRoom() {
    if (!currentUser) return;
    setRoomBusy(true);
    setRoomError("");

    try {
      const seed = readRoomBackup() || extractRoomContent(shared);
      let createdCode = "";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = generateRoomCode();
        const candidateRef = doc(db, "rooms", code);
        try {
          const base = { ...defaultRoomState(), ...seed };
          await setDoc(candidateRef, {
            ...base,
            joinCode: code,
            ownerUid: currentUser.uid,
            participants: { [currentUser.uid]: true },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          createdCode = code;
          break;
        } catch (e) {
          const codeName = e?.code || "";
          if (codeName === "permission-denied" || codeName === "already-exists") continue;
          throw e;
        }
      }

      if (!createdCode) throw new Error("Impossible de créer un code unique. Réessaie.");
      activateRoom(createdCode);
    } catch (e) {
      setRoomError(String(e?.message || e));
    } finally {
      setRoomBusy(false);
    }
  }

  async function joinPrivateRoom() {
    if (!currentUser) return;
    const normalized = normalizeRoomCode(roomCodeInput);
    if (!normalized) {
      setRoomError("Entre un code de salon valide.");
      return;
    }

    setRoomBusy(true);
    setRoomError("");
    try {
      const joinRef = doc(db, "rooms", normalized);
      await updateDoc(joinRef, {
        [`participants.${currentUser.uid}`]: true,
        updatedAt: Date.now(),
      });
      activateRoom(normalized);
      setRoomCodeInput("");
    } catch (e) {
      const codeName = e?.code || "";
      if (codeName === "not-found") {
        setRoomError("Salon introuvable. Vérifie le code.");
      } else if (codeName === "permission-denied") {
        setRoomError("Impossible de rejoindre ce salon avec ce code.");
      } else {
        setRoomError(String(e?.message || e));
      }
    } finally {
      setRoomBusy(false);
    }
  }

  async function patchShared(patch) {
    if (!canWriteInRoom) return;
    setShared((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }));

    try {
      await updateDoc(roomRef, { ...patch, updatedAt: Date.now() });
    } catch (e) {
      setSyncError(String(e?.message || e));
    }
  }

  async function updateRoomTransaction(updateFromBase) {
    if (!canWriteInRoom) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef);
        const base = snap.exists() ? { ...defaultRoomState(), ...snap.data() } : defaultRoomState();
        const patch = updateFromBase(base);
        if (!patch) return;
        tx.set(roomRef, { ...base, ...patch, updatedAt: Date.now() });
      });
    } catch (e) {
      setSyncError(String(e?.message || e));
    }
  }

  function addCustomMovie() {
    if (!customMovieTitle.trim()) return;
    const newMovie = { title: customMovieTitle.trim(), done: false };
    const next = [...shared.customMovies, newMovie];
    setShared((prev) => ({ ...prev, customMovies: next, updatedAt: Date.now() }));
    updateRoomTransaction((base) => ({
      customMovies: [...(base.customMovies || []), newMovie],
    }));
    setCustomMovieTitle("");
  }

  function toggleCustomMovie(index) {
    const newDone = !shared.customMovies[index].done;
    if (newDone) fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    const newCustomMovies = [...shared.customMovies];
    newCustomMovies[index] = { ...newCustomMovies[index], done: newDone };
    setShared((prev) => ({ ...prev, customMovies: newCustomMovies, updatedAt: Date.now() }));
    updateRoomTransaction((base) => {
      const baseMovies = [...(base.customMovies || [])];
      if (!baseMovies[index]) return { customMovies: baseMovies };
      baseMovies[index] = { ...baseMovies[index], done: newDone };
      return { customMovies: baseMovies };
    });
  }

  function removeCustomMovie(index) {
    const newCustomMovies = shared.customMovies.filter((_, i) => i !== index);
    setShared((prev) => ({ ...prev, customMovies: newCustomMovies, updatedAt: Date.now() }));
    updateRoomTransaction((base) => ({
      customMovies: (base.customMovies || []).filter((_, i) => i !== index),
    }));
  }

  // Date / countdown
  const targetDate = useMemo(() => (shared.targetISO ? new Date(shared.targetISO) : null), [shared.targetISO]);
  const remainingMs = useMemo(() => (targetDate ? targetDate.getTime() - now.getTime() : 0), [targetDate, now]);
  const parts = useMemo(() => msToParts(remainingMs), [remainingMs]);

  const daysDiff = targetDate
    ? Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let resultText = "";
  if (daysDiff === null) resultText = "";
  else if (daysDiff > 0) resultText = `Plus que ${daysDiff} jours avant de te revoir 💕`;
  else if (daysDiff === 0) resultText = `C’est aujourd’hui 💖💖💖`;
  else resultText = `Je t’ai déjà retrouvé(e) ❤️`;

  const showTimer = targetDate && remainingMs > 0;

  const targetDateStr = useMemo(() => {
    if (!shared.targetISO) return "";
    const d = new Date(shared.targetISO);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  }, [shared.targetISO]);

  function saveDate(dateYYYYMMDD) {
    if (!dateYYYYMMDD) {
      patchShared({ targetISO: "" });
      return;
    }
    const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    patchShared({ targetISO: local.toISOString() });
    fireConfetti({ particleCount: 90, spread: 70, origin: { y: 0.75 } });
  }

  // Moments clés
  const dodos = daysDiff !== null ? nightsLeft(daysDiff) : null;
  const weekends = targetDate ? weekendsLeft(now, targetDate) : null;
  const cap = daysDiff !== null ? nextMilestone(daysDiff) : null;
  const capText = cap !== null ? milestoneLabel(cap) : "";
  const daysToCap = cap !== null ? Math.max(0, daysDiff - cap) : null;
  const vibe = vibeLine(daysDiff);

  // Quiz du jour
  const dailyQuizQuestion = useMemo(
    () => pickDeterministic(QUIZ_QUESTIONS, `${todayKey}|ROOM:${roomCode || "no-room"}|QUIZ`),
    [todayKey, roomCode]
  );
  const quizAnswers = useMemo(() => {
    const baseQuiz = shared.dailyQuiz;
    if (!baseQuiz || baseQuiz.dateKey !== todayKey || baseQuiz.questionId !== dailyQuizQuestion.id) {
      return { lea: null, gauthier: null };
    }
    return {
      lea: baseQuiz.answers?.lea || null,
      gauthier: baseQuiz.answers?.gauthier || null,
    };
  }, [shared.dailyQuiz, todayKey, dailyQuizQuestion.id]);

  const quizOtherPlayer = quizPlayer === "lea" ? "gauthier" : "lea";
  const quizMyAnswer = quizAnswers[quizPlayer];
  const quizOtherAnswer = quizAnswers[quizOtherPlayer];
  const bothAnswered = Boolean(quizAnswers.lea?.answeredAt && quizAnswers.gauthier?.answeredAt);
  const valentineLabel = quizPlayer === "lea" ? "Léa" : "Gauthier";
  const valentineOtherLabel = quizOtherPlayer === "lea" ? "Léa" : "Gauthier";
  const valentineAnswersByPlayer = useMemo(() => {
    const baseQuiz = shared.valentineCoupleQuiz;
    if (!baseQuiz || baseQuiz.dateKey !== VALENTINE_DAY_KEY) {
      return { lea: null, gauthier: null };
    }
    return {
      lea: baseQuiz.answers?.lea || null,
      gauthier: baseQuiz.answers?.gauthier || null,
    };
  }, [shared.valentineCoupleQuiz]);
  const myValentineSubmission = valentineAnswersByPlayer[quizPlayer];
  const otherValentineSubmission = valentineAnswersByPlayer[quizOtherPlayer];
  const valentineBothSubmitted = Boolean(
    valentineAnswersByPlayer.lea?.submittedAt && valentineAnswersByPlayer.gauthier?.submittedAt
  );
  const canSubmitValentineQuiz = useMemo(
    () => valentineDraftAnswers.every((answer) => String(answer || "").trim()),
    [valentineDraftAnswers]
  );
  const myValentineAnswersSerialized = useMemo(() => {
    const payload = {};
    VALENTINE_COUPLE_QUESTIONS.forEach((question) => {
      payload[question.id] = String(myValentineSubmission?.answers?.[question.id] || "");
    });
    return JSON.stringify(payload);
  }, [myValentineSubmission?.answers]);

  useEffect(() => {
    if (!isValentineMode) return;
    let baseAnswers = {};
    try {
      baseAnswers = JSON.parse(myValentineAnswersSerialized);
    } catch {
      baseAnswers = {};
    }
    setValentineDraftAnswers(VALENTINE_COUPLE_QUESTIONS.map((question) => baseAnswers[question.id] || ""));
    setValentineSubmitError("");
  }, [isValentineMode, quizPlayer, myValentineAnswersSerialized]);

  function quizAnswerLabel(answer) {
    if (!answer) return "En attente";
    return answer.isCorrect ? "✅ Bonne réponse" : "❌ Mauvaise réponse";
  }

  function submitDailyQuizAnswer(optionIndex) {
    if (!canWriteInRoom) return;
    const isCorrectNow = optionIndex === dailyQuizQuestion.correctIndex;

    updateRoomTransaction((base) => {
      const question = pickDeterministic(QUIZ_QUESTIONS, `${todayKey}|ROOM:${roomCode || "no-room"}|QUIZ`);
      const currentQuiz =
        base.dailyQuiz && base.dailyQuiz.dateKey === todayKey && base.dailyQuiz.questionId === question.id
          ? base.dailyQuiz
          : { dateKey: todayKey, questionId: question.id, answers: {} };

      const answers = { ...(currentQuiz.answers || {}) };
      if (answers[quizPlayer]?.answeredAt) return null;

      const isCorrect = optionIndex === question.correctIndex;
      answers[quizPlayer] = {
        optionIndex,
        isCorrect,
        answeredAt: Date.now(),
        uid: currentUser?.uid || "",
      };

      return {
        dailyQuiz: {
          dateKey: todayKey,
          questionId: question.id,
          answers,
        },
      };
    });

    if (isCorrectNow) fireConfetti({ particleCount: 110, spread: 80, origin: { y: 0.7 } });
  }

  function valentineAnswerFor(submission, questionId) {
    return String(submission?.answers?.[questionId] || "").trim() || "—";
  }

  function handleValentineAnswerChange(index, value) {
    setValentineDraftAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function submitValentineQuiz() {
    if (!canWriteInRoom) return;
    if (!canSubmitValentineQuiz) {
      setValentineSubmitError("Répondez aux 10 questions avant d’envoyer.");
      return;
    }

    const normalizedAnswers = {};
    VALENTINE_COUPLE_QUESTIONS.forEach((question, index) => {
      normalizedAnswers[question.id] = String(valentineDraftAnswers[index] || "").trim();
    });

    setValentineSubmitBusy(true);
    setValentineSubmitError("");

    await updateRoomTransaction((base) => {
      const baseQuiz =
        base.valentineCoupleQuiz && base.valentineCoupleQuiz.dateKey === VALENTINE_DAY_KEY
          ? base.valentineCoupleQuiz
          : { dateKey: VALENTINE_DAY_KEY, answers: {} };

      return {
        valentineCoupleQuiz: {
          dateKey: VALENTINE_DAY_KEY,
          answers: {
            ...(baseQuiz.answers || {}),
            [quizPlayer]: {
              answers: normalizedAnswers,
              submittedAt: Date.now(),
              uid: currentUser?.uid || "",
            },
          },
        },
      };
    });

    fireConfetti({ particleCount: 130, spread: 78, origin: { y: 0.68 } });
    setValentineSubmitBusy(false);
  }

  // Meet (résumé / édition)
  const meet = shared.meet || defaultRoomState().meet;
  const mapsLink = useMemo(() => buildMapsLink(meet), [meet]);

  const isMeetEmpty = useMemo(() => {
    const f = meet?.flight || {};
    const empty = (v) => !String(v || "").trim();
    return (
      empty(meet.placeName) &&
      empty(meet.city) &&
      empty(meet.address) &&
      empty(meet.imageUrl) &&
      empty(f.airline) &&
      empty(f.flightNumber) &&
      empty(f.departureAirport) &&
      empty(f.departureTime) &&
      empty(f.arrivalAirport) &&
      empty(f.arrivalTime) &&
      empty(f.notes)
    );
  }, [meet]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === "meet" && isMeetEmpty && !editMeet) setEditMeet(true);
  }, [tab, isMeetEmpty, editMeet]);

  // Playlist duo
  const playlist = useMemo(() => shared.playlist || [], [shared.playlist]);
  const leaToday = useMemo(() => playlist.find((s) => s.dateKey === todayKey && s.who === "lea"), [playlist, todayKey]);
  const gauToday = useMemo(
    () => playlist.find((s) => s.dateKey === todayKey && s.who === "gauthier"),
    [playlist, todayKey]
  );

  const [leaTitle, setLeaTitle] = useState("");
  const [leaArtist, setLeaArtist] = useState("");
  const [leaLink, setLeaLink] = useState("");
  const [leaNote, setLeaNote] = useState("");

  const [gauTitle, setGauTitle] = useState("");
  const [gauArtist, setGauArtist] = useState("");
  const [gauLink, setGauLink] = useState("");
  const [gauNote, setGauNote] = useState("");

  function addDuoSong(who) {
    const isLea = who === "lea";
    const title = (isLea ? leaTitle : gauTitle).trim();
    if (!title) return;

    const entry = {
      dateKey: todayKey,
      who,
      title,
      artist: (isLea ? leaArtist : gauArtist).trim(),
      link: (isLea ? leaLink : gauLink).trim(),
      note: (isLea ? leaNote : gauNote).trim(),
      addedAt: new Date().toISOString(),
    };

    const next = [entry, ...playlist.filter((s) => !(s.dateKey === todayKey && s.who === who))];
    setShared((prev) => ({ ...prev, playlist: next, updatedAt: Date.now() }));
    updateRoomTransaction((base) => {
      const baseList = base.playlist || [];
      return {
        playlist: [entry, ...baseList.filter((s) => !(s.dateKey === todayKey && s.who === who))],
      };
    });

    if (isLea) {
      setLeaTitle("");
      setLeaArtist("");
      setLeaLink("");
      setLeaNote("");
    } else {
      setGauTitle("");
      setGauArtist("");
      setGauLink("");
      setGauNote("");
    }

    fireConfetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
  }

  function removeSong(dateKey, who) {
    const next = playlist.filter((s) => !(s.dateKey === dateKey && s.who === who));
    setShared((prev) => ({ ...prev, playlist: next, updatedAt: Date.now() }));
    updateRoomTransaction((base) => ({
      playlist: (base.playlist || []).filter((s) => !(s.dateKey === dateKey && s.who === who)),
    }));
  }

  const playlistSorted = useMemo(() => {
    const copy = [...playlist];
    copy.sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || "") || (a.who || "").localeCompare(b.who || ""));
    return copy;
  }, [playlist]);

  const gauthierRestRanges = useMemo(
    () => normalizeRestRanges(shared.gauthierRestRanges, shared.gauthierRests),
    [shared.gauthierRestRanges, shared.gauthierRests]
  );

  const upcomingRestRanges = useMemo(
    () => gauthierRestRanges.filter((range) => range.end >= todayKey),
    [gauthierRestRanges, todayKey]
  );
  const previousRestRanges = useMemo(
    () => gauthierRestRanges.filter((range) => range.end < todayKey),
    [gauthierRestRanges, todayKey]
  );

  const nextRestRange = upcomingRestRanges[0] || null;
  const restRangeInvalid = Boolean(
    restStartInput &&
      restEndInput &&
      (restEndInput < restStartInput ||
        (restEndInput === restStartInput &&
          restPeriodRank(restEndPeriodInput) < restPeriodRank(restStartPeriodInput)))
  );

  function resetRestRangeForm() {
    setRestStartInput("");
    setRestEndInput("");
    setRestStartPeriodInput("full_day");
    setRestEndPeriodInput("full_day");
    setEditingRestRangeKey("");
  }

  function editGauthierRestRange(range) {
    if (!range) return;
    setRestStartInput(range.start || "");
    setRestEndInput(range.end || "");
    setRestStartPeriodInput(normalizeRestPeriod(range.startPeriod));
    setRestEndPeriodInput(normalizeRestPeriod(range.endPeriod));
    setEditingRestRangeKey(restRangeKey(range));
  }

  function addGauthierRestRange() {
    const start = restStartInput.trim();
    const end = restEndInput.trim();
    const normalizedInput = normalizeRestRanges(
      [{ start, end, startPeriod: restStartPeriodInput, endPeriod: restEndPeriodInput }],
      []
    );
    const range = normalizedInput[0];
    if (!range) return;

    const rangeKey = restRangeKey(range);
    const withoutEditedRanges = editingRestRangeKey
      ? gauthierRestRanges.filter((item) => restRangeKey(item) !== editingRestRangeKey)
      : gauthierRestRanges;
    if (withoutEditedRanges.some((item) => restRangeKey(item) === rangeKey)) {
      return;
    }

    const nextRanges = normalizeRestRanges([...withoutEditedRanges, range], []);
    const nextLegacyDates = toLegacyRestDates(nextRanges);
    setShared((prev) => ({
      ...prev,
      gauthierRestRanges: nextRanges,
      gauthierRests: nextLegacyDates,
      updatedAt: Date.now(),
    }));
    updateRoomTransaction((base) => {
      const baseRanges = normalizeRestRanges(base.gauthierRestRanges, base.gauthierRests);
      const baseWithoutEdited = editingRestRangeKey
        ? baseRanges.filter((item) => restRangeKey(item) !== editingRestRangeKey)
        : baseRanges;
      if (baseWithoutEdited.some((item) => restRangeKey(item) === rangeKey)) {
        return {
          gauthierRestRanges: baseRanges,
          gauthierRests: toLegacyRestDates(baseRanges),
        };
      }

      const txNextRanges = normalizeRestRanges([...baseWithoutEdited, range], []);
      return {
        gauthierRestRanges: txNextRanges,
        gauthierRests: toLegacyRestDates(txNextRanges),
      };
    });

    resetRestRangeForm();
    fireConfetti({ particleCount: 80, spread: 65, origin: { y: 0.72 } });
  }

  function removeGauthierRestRange(rangeKey) {
    const nextRanges = gauthierRestRanges.filter((range) => restRangeKey(range) !== rangeKey);
    const normalized = normalizeRestRanges(nextRanges, []);
    setShared((prev) => ({
      ...prev,
      gauthierRestRanges: normalized,
      gauthierRests: toLegacyRestDates(normalized),
      updatedAt: Date.now(),
    }));
    updateRoomTransaction((base) => {
      const baseRanges = normalizeRestRanges(base.gauthierRestRanges, base.gauthierRests);
      const txNextRanges = baseRanges.filter((range) => restRangeKey(range) !== rangeKey);
      return {
        gauthierRestRanges: txNextRanges,
        gauthierRests: toLegacyRestDates(txNextRanges),
      };
    });
    if (editingRestRangeKey === rangeKey) resetRestRangeForm();
  }

  const todoDoneCount = shared.todo.filter((t) => t.done).length;
  const moviesDoneCount = shared.movies.filter((m) => m.done).length;
  const customMoviesDoneCount = shared.customMovies.filter((m) => m.done).length;

  if (!authReady) {
    return (
      <div className={appClassName}>
        <div className="shell">
          <div className="card">
            <div className="h1">Connexion…</div>
            <p className="p">Ouverture sécurisée du salon.</p>
          </div>
        </div>
      </div>
    );
  }

  if (authError || !currentUser) {
    return (
      <div className={appClassName}>
        <div className="shell">
          <div className="card">
            <div className="h1">Erreur d’authentification ⚠️</div>
            <p className="p">{authError || "Impossible d’ouvrir la session."}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!roomCode) {
    return (
      <div className={appClassName}>
        <div className="shell">
          <div className="h1">Salon privé 🔐</div>
          <p className="p">Crée un salon, puis partage le code à Gauthier/Léa pour vous connecter tous les deux.</p>

          <div className="card">
            <div className="sectionTitle">
              <span>Nouveau salon</span>
              <span className="badge">✨</span>
            </div>
            <button className="btn" onClick={createPrivateRoom} disabled={roomBusy}>
              {roomBusy ? "Création…" : "Créer un salon privé"}
            </button>
            <div className="small" style={{ marginTop: 8 }}>
              La création reprend automatiquement la dernière sauvegarde locale disponible.
            </div>
            <button
              className="btn"
              style={{ marginTop: 10, background: "linear-gradient(90deg, #fff7c6, #ffe7f5)" }}
              onClick={() => {
                setLegacyRecoveryAttempted(true);
                activateRoom(LEGACY_ROOM_CODE);
              }}
              disabled={roomBusy}
            >
              Récupérer l’ancien salon
            </button>

            <div className="sep" />

            <div className="sectionTitle">
              <span>Rejoindre un salon</span>
              <span className="badge">🔑</span>
            </div>
            <div className="label">Code du salon :</div>
            <input
              className="input"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(normalizeRoomCode(e.target.value))}
              placeholder="Ex: A9F4K2QW"
              onKeyDown={(e) => e.key === "Enter" && joinPrivateRoom()}
            />
            <button className="btn" onClick={joinPrivateRoom} disabled={roomBusy || !roomCodeInput.trim()}>
              {roomBusy ? "Connexion…" : "Rejoindre ce salon"}
            </button>

            {roomError && (
              <div className="small" style={{ marginTop: 10 }}>
                ⚠️ {roomError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={appClassName}>
      <div className="shell">
        <div className="topbar">
          <span className="badge">💞 Avant de te revoir</span>
          <button className="topbarMenuBtn" onClick={() => setShowTopMenu((prev) => !prev)}>
            {showTopMenu ? "Fermer" : "Menu"}
          </button>
        </div>

        {isValentineMode && (
          <div className="valentineBanner" role="status" aria-live="polite">
            <div className="valentineBannerMain">
              <span className="valentineBannerText">Edition Saint-Valentin • 14 février uniquement</span>
              <button className="valentineBannerBtn" type="button" onClick={() => setShowValentineQuizModal(true)}>
                Ouvrir le mini quiz
              </button>
            </div>
            <span className="valentineBadgeIcon" aria-hidden>
              💘
            </span>
          </div>
        )}

        {isValentineMode && showValentineQuizModal && (
          <div className="valentineQuizOverlay" role="dialog" aria-modal="true" aria-labelledby="valentineQuizTitle">
            <div className="valentineQuizModal">
              <div className="valentineQuizHeader">
                <div>
                  <h2 className="valentineQuizTitle" id="valentineQuizTitle">
                    Mini quiz de couple • 10 questions
                  </h2>
                  <p className="valentineQuizIntro">
                    Répondez chacun de votre côté. Une fois envoyé, l’autre voit directement les réponses.
                  </p>
                </div>
                <button className="valentineQuizCloseBtn" type="button" onClick={() => setShowValentineQuizModal(false)}>
                  Fermer
                </button>
              </div>

              <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                Tu réponds en tant que :
              </div>
              <div className="subtabs" style={{ marginTop: 6 }}>
                <button
                  className={`subtabBtn ${quizPlayer === "lea" ? "subtabBtnActive" : ""}`}
                  type="button"
                  onClick={() => setQuizPlayer("lea")}
                >
                  Léa
                </button>
                <button
                  className={`subtabBtn ${quizPlayer === "gauthier" ? "subtabBtnActive" : ""}`}
                  type="button"
                  onClick={() => setQuizPlayer("gauthier")}
                >
                  Gauthier
                </button>
              </div>

              {myValentineSubmission?.submittedAt ? (
                <div className="valentineQuizSent">✅ Réponses envoyées pour {valentineLabel}.</div>
              ) : (
                <>
                  <div className="valentineQuizQuestionList">
                    {VALENTINE_COUPLE_QUESTIONS.map((question, index) => (
                      <div className="valentineQuizQuestionItem" key={question.id}>
                        <label className="label" htmlFor={`valentine-${question.id}`} style={{ marginTop: 0 }}>
                          {index + 1}. {question.prompt}
                        </label>
                        <textarea
                          id={`valentine-${question.id}`}
                          className="textarea"
                          value={valentineDraftAnswers[index] || ""}
                          onChange={(e) => handleValentineAnswerChange(index, e.target.value)}
                          placeholder="Ta réponse..."
                          maxLength={180}
                        />
                      </div>
                    ))}
                  </div>

                  {valentineSubmitError && (
                    <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                      ⚠️ {valentineSubmitError}
                    </div>
                  )}

                  <button
                    className="btn"
                    type="button"
                    onClick={submitValentineQuiz}
                    disabled={!canWriteInRoom || !canSubmitValentineQuiz || valentineSubmitBusy}
                  >
                    {valentineSubmitBusy ? "Envoi..." : `Envoyer mes réponses (${valentineLabel})`}
                  </button>
                </>
              )}

              <div className="sep" />
              <div className="sectionTitle">
                <span>Réponses partagées</span>
                <span className="badge">💌</span>
              </div>

              <div className="valentineAnswerPanels">
                <div className="panel">
                  <div className="panelTitle">{valentineLabel}</div>
                  {myValentineSubmission?.submittedAt ? (
                    <div className="valentineAnswerList">
                      {VALENTINE_COUPLE_QUESTIONS.map((question, index) => (
                        <div className="valentineAnswerItem" key={`${question.id}-${quizPlayer}`}>
                          <div className="valentineAnswerPrompt">
                            {index + 1}. {question.prompt}
                          </div>
                          <div className="valentineAnswerValue">{valentineAnswerFor(myValentineSubmission, question.id)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sub">Pas encore répondu.</div>
                  )}
                </div>

                <div className="panel">
                  <div className="panelTitle blue">{valentineOtherLabel}</div>
                  {otherValentineSubmission?.submittedAt ? (
                    <div className="valentineAnswerList">
                      {VALENTINE_COUPLE_QUESTIONS.map((question, index) => (
                        <div className="valentineAnswerItem" key={`${question.id}-${quizOtherPlayer}`}>
                          <div className="valentineAnswerPrompt">
                            {index + 1}. {question.prompt}
                          </div>
                          <div className="valentineAnswerValue">{valentineAnswerFor(otherValentineSubmission, question.id)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="sub">{valentineOtherLabel} n’a pas encore envoyé ses réponses.</div>
                  )}
                </div>
              </div>

              {valentineBothSubmitted && (
                <div className="small" style={{ marginTop: 10 }}>
                  Vous avez tous les deux terminé le mini quiz Saint-Valentin 💘
                </div>
              )}
            </div>
          </div>
        )}

        {showTopMenu && (
          <div className="topMenuPanel">
            <div className="topMenuRow">
              <div className="roomPill">
                <span className="roomPillLabel">Salon</span>
                <span className="roomPillValue">{roomCode}</span>
              </div>
              <span className="badge">📅 {todayKey}</span>
            </div>
            <div className={`syncPill ${syncError ? "syncPillError" : syncing ? "syncPillSyncing" : "syncPillOk"}`}>
              {syncing ? "Synchronisation…" : syncError ? `⚠️ ${syncError}` : "✅ Synchronisé"}
            </div>
            <button className="topbarChangeBtn" onClick={clearActiveRoom}>
              Changer de salon
            </button>
          </div>
        )}

        {/* HOME */}
        {tab === "home" && (
          <>
            <div className="h1">Avant de te revoir 💖</div>
            <p className="p">Les retrouvailles de Gauthier et Léa</p>
            {isValentineMode && (
              <div className="valentineHomeNote">
                ❤️ Bonne Saint-Valentin à vous deux. Mode spécial actif uniquement aujourd’hui, retour automatique demain.
              </div>
            )}

            <div className="card">
              <div className="sectionTitle">
                <span>Choisis la date</span>
                <span className="badge">✨</span>
              </div>

              <div className="label">Date de nos retrouvailles :</div>
              <input className="input" type="date" value={targetDateStr} onChange={(e) => saveDate(e.target.value)} />

              <div className="result">{resultText}</div>

              {showTimer && (
                <>
                  <div className="sub">
                    Temps restant :{" "}
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                      {parts.days}j {pad2(parts.hours)}h {pad2(parts.minutes)}m {pad2(parts.seconds)}s
                    </strong>
                  </div>

                  {/* Jours / Heures / Secondes */}
                  <div className="timerRow">
                    <div className="tile">
                      <div className="tileLabel">Jours</div>
                      <div className="tileValue">{parts.days}</div>
                    </div>
                    <div className="tile">
                      <div className="tileLabel">Heures</div>
                      <div className="tileValue">{pad2(parts.hours)}</div>
                    </div>
                    <div className="tile">
                      <div className="tileLabel">Secondes</div>
                      <div className="tileValue">{pad2(parts.seconds)}</div>
                    </div>
                  </div>
                </>
              )}

              <div className="sep" />

              {/* Moments clés */}
              <div className="sectionTitle">
                <span>Moments clés</span>
                <span className="badge">⏳</span>
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">Dodos</div>
                  <div className="panelBody">{dodos === null ? "—" : `${dodos} dodos`}</div>
                </div>
                <div className="panel">
                  <div className="panelTitle blue">Week-ends</div>
                  <div className="panelBody">
                    {weekends === null ? "—" : `${weekends} week-end${weekends > 1 ? "s" : ""}`}
                  </div>
                </div>
              </div>

              {cap !== null && (
                <div className="sub" style={{ marginTop: 10 }}>
                  Prochain cap : <strong>{capText}</strong>
                  {daysToCap !== null && daysToCap > 0 && (
                    <>
                      {" "}
                      — encore <strong>{daysToCap}</strong> jour{daysToCap > 1 ? "s" : ""} ✨
                    </>
                  )}
                </div>
              )}

              {vibe && (
                <div className="sub" style={{ marginTop: 8, fontWeight: 700 }}>
                  {vibe}
                </div>
              )}

              <div className="sep" />

              {/* Quiz du jour */}
              <div className="sectionTitle">
                <span>Quiz culture générale</span>
                <span className="badge">🧠</span>
              </div>

              <div className="panel">
                <div className="panelTitle">Question du jour</div>
                <div className="panelBody" style={{ marginTop: 8 }}>
                  {dailyQuizQuestion.prompt}
                </div>
              </div>

              <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                Tu réponds en tant que :
              </div>
              <div className="subtabs" style={{ marginTop: 6 }}>
                <button
                  className={`subtabBtn ${quizPlayer === "lea" ? "subtabBtnActive" : ""}`}
                  onClick={() => setQuizPlayer("lea")}
                >
                  Léa
                </button>
                <button
                  className={`subtabBtn ${quizPlayer === "gauthier" ? "subtabBtnActive" : ""}`}
                  onClick={() => setQuizPlayer("gauthier")}
                >
                  Gauthier
                </button>
              </div>

              <div className="list">
                {dailyQuizQuestion.options.map((option, index) => (
                  <button
                    key={option}
                    className="btn"
                    style={{
                      marginTop: 0,
                      textAlign: "left",
                      background:
                        quizMyAnswer?.optionIndex === index
                          ? "linear-gradient(90deg, #fff0a6, #ffe4f2)"
                          : "linear-gradient(90deg, #ffc6dc, #d9efff)",
                    }}
                    onClick={() => submitDailyQuizAnswer(index)}
                    disabled={Boolean(quizMyAnswer)}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </button>
                ))}
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">{quizPlayer === "lea" ? "Léa" : "Gauthier"}</div>
                  <div className="panelBody">{quizAnswerLabel(quizMyAnswer)}</div>
                </div>
                <div className="panel">
                  <div className="panelTitle blue">{quizOtherPlayer === "lea" ? "Léa" : "Gauthier"}</div>
                  <div className="panelBody">{quizAnswerLabel(quizOtherAnswer)}</div>
                </div>
              </div>

              {(quizMyAnswer || bothAnswered) && (
                <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                  Réponse : <strong>{dailyQuizQuestion.options[dailyQuizQuestion.correctIndex]}</strong>
                  {" — "}
                  {dailyQuizQuestion.explanation}
                </div>
              )}

              <div className="heart">💞</div>
            </div>
          </>
        )}

        {/* LIEU */}
        {tab === "meet" && (
          <>
            <div className="h1">Notre lieu ✈️💗</div>
            <p className="p">On remplit de temps en temps, puis on a un joli résumé.</p>

            <div className="card">
              <div className="sectionTitle">
                <span>{editMeet ? "Modifier le lieu" : "Résumé du lieu"}</span>
                <span className="badge">{editMeet ? "✏️" : "✅"}</span>
              </div>

              {!editMeet ? (
                <>
                  {meet.imageUrl ? (
                    <img
                      src={meet.imageUrl}
                      alt="Lieu"
                      style={{
                        width: "100%",
                        borderRadius: 16,
                        border: "1px solid rgba(90,42,74,.10)",
                        boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                        marginBottom: 12,
                      }}
                    />
                  ) : (
                    <div className="small" style={{ marginBottom: 12 }}>
                      Aucune image pour l’instant ✨
                    </div>
                  )}

                  <div className="grid2">
                    <div className="panel">
                      <div className="panelTitle">Ville</div>
                      <div className="panelBody">{meet.city?.trim() || "—"}</div>
                    </div>
                    <div className="panel">
                      <div className="panelTitle blue">Lieu</div>
                      <div className="panelBody">{meet.placeName?.trim() || "—"}</div>
                    </div>
                  </div>

                  <div className="panel" style={{ marginTop: 10 }}>
                    <div className="panelTitle">Adresse</div>
                    <div className="panelBody">{meet.address?.trim() || "—"}</div>
                  </div>

                  {mapsLink && (
                    <button
                      className="btn"
                      style={{ marginTop: 12, padding: "10px 12px", fontSize: 14 }}
                      onClick={() => window.open(mapsLink, "_blank")}
                    >
                      📍 Ouvrir dans Maps
                    </button>
                  )}

                  <div className="sep" />

                  <div className="sectionTitle">
                    <span>Vol</span>
                    <span className="badge">✈️</span>
                  </div>

                  <div className="grid2">
                    <div className="panel">
                      <div className="panelTitle">Compagnie</div>
                      <div className="panelBody">{meet.flight?.airline?.trim() || "—"}</div>
                    </div>
                    <div className="panel">
                      <div className="panelTitle blue">N° vol</div>
                      <div className="panelBody">{meet.flight?.flightNumber?.trim() || "—"}</div>
                    </div>
                  </div>

                  <div className="grid2">
                    <div className="panel">
                      <div className="panelTitle">Départ</div>
                      <div className="panelBody">
                        {(meet.flight?.departureAirport?.trim() || "—") +
                          (meet.flight?.departureTime?.trim() ? ` • ${meet.flight.departureTime.trim()}` : "")}
                      </div>
                    </div>
                    <div className="panel">
                      <div className="panelTitle blue">Arrivée</div>
                      <div className="panelBody">
                        {(meet.flight?.arrivalAirport?.trim() || "—") +
                          (meet.flight?.arrivalTime?.trim() ? ` • ${meet.flight.arrivalTime.trim()}` : "")}
                      </div>
                    </div>
                  </div>

                  <div className="panel" style={{ marginTop: 10 }}>
                    <div className="panelTitle">Notes</div>
                    <div className="panelBody">{meet.flight?.notes?.trim() || "—"}</div>
                  </div>

                  <button className="btn" style={{ marginTop: 14 }} onClick={() => setEditMeet(true)}>
                    ✏️ Modifier
                  </button>
                </>
              ) : (
                <>
                  <div className="label">Nom du lieu :</div>
                  <input
                    className="input"
                    value={meet.placeName}
                    onChange={(e) => patchShared({ meet: { ...meet, placeName: e.target.value } })}
                    placeholder="Aéroport / Gare / Hôtel…"
                  />

                  <div className="label">Ville :</div>
                  <input
                    className="input"
                    value={meet.city}
                    onChange={(e) => patchShared({ meet: { ...meet, city: e.target.value } })}
                    placeholder="Paris"
                  />

                  <div className="label">Adresse (optionnel) :</div>
                  <input
                    className="input"
                    value={meet.address}
                    onChange={(e) => patchShared({ meet: { ...meet, address: e.target.value } })}
                    placeholder="Terminal, hall…"
                  />

                  <div className="sep" />

                  <div className="label">Lien image (optionnel) :</div>
                  <input
                    className="input"
                    value={meet.imageUrl}
                    onChange={(e) => patchShared({ meet: { ...meet, imageUrl: e.target.value } })}
                    placeholder="https://... (idéalement .jpg/.png)"
                  />

                  <div className="sep" />

                  <div className="sectionTitle">
                    <span>Infos de vol</span>
                    <span className="badge">✈️</span>
                  </div>

                  <div className="label">Compagnie :</div>
                  <input
                    className="input"
                    value={meet.flight.airline}
                    onChange={(e) =>
                      patchShared({ meet: { ...meet, flight: { ...meet.flight, airline: e.target.value } } })
                    }
                    placeholder="Air France"
                  />

                  <div className="label">Numéro de vol :</div>
                  <input
                    className="input"
                    value={meet.flight.flightNumber}
                    onChange={(e) =>
                      patchShared({ meet: { ...meet, flight: { ...meet.flight, flightNumber: e.target.value } } })
                    }
                    placeholder="AF1234"
                  />

                  <div className="row">
                    <div>
                      <div className="label">Départ :</div>
                      <input
                        className="input"
                        value={meet.flight.departureAirport}
                        onChange={(e) =>
                          patchShared({ meet: { ...meet, flight: { ...meet.flight, departureAirport: e.target.value } } })
                        }
                        placeholder="ORY"
                      />
                    </div>
                    <div>
                      <div className="label">Heure départ :</div>
                      <input
                        className="input"
                        value={meet.flight.departureTime}
                        onChange={(e) =>
                          patchShared({ meet: { ...meet, flight: { ...meet.flight, departureTime: e.target.value } } })
                        }
                        placeholder="10:35"
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div>
                      <div className="label">Arrivée :</div>
                      <input
                        className="input"
                        value={meet.flight.arrivalAirport}
                        onChange={(e) =>
                          patchShared({ meet: { ...meet, flight: { ...meet.flight, arrivalAirport: e.target.value } } })
                        }
                        placeholder="CDG"
                      />
                    </div>
                    <div>
                      <div className="label">Heure arrivée :</div>
                      <input
                        className="input"
                        value={meet.flight.arrivalTime}
                        onChange={(e) =>
                          patchShared({ meet: { ...meet, flight: { ...meet.flight, arrivalTime: e.target.value } } })
                        }
                        placeholder="12:05"
                      />
                    </div>
                  </div>

                  <div className="label">Notes (optionnel) :</div>
                  <input
                    className="input"
                    value={meet.flight.notes}
                    onChange={(e) => patchShared({ meet: { ...meet, flight: { ...meet.flight, notes: e.target.value } } })}
                    placeholder="Terminal / porte / qui attend qui…"
                  />

                  <button className="btn" style={{ marginTop: 14 }} onClick={() => setEditMeet(false)}>
                    ✅ Enregistrer
                  </button>
                </>
              )}

              <div className="heart">🌸</div>
            </div>
          </>
        )}

        {/* PLAYLIST */}
        {tab === "playlist" && (
          <>
            <div className="h1">Playlist DUO 🎧💗</div>
            <p className="p">Une musique par jour pour Léa + une pour Gauthier.</p>

            <div className="card">
              <div className="sectionTitle">
                <span>Musiques d’aujourd’hui</span>
                <span className="badge">🎵</span>
              </div>

              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">Léa</div>
                  <div className="panelBody">
                    {leaToday ? (
                      <>
                        <div style={{ fontWeight: 900 }}>
                          {leaToday.title}
                          {leaToday.artist ? ` — ${leaToday.artist}` : ""}
                        </div>
                        {leaToday.note && <div className="sub">💬 {leaToday.note}</div>}
                        {leaToday.link && (
                          <div className="sub" style={{ marginTop: 6 }}>
                            🔗{" "}
                            <a href={leaToday.link} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          </div>
                        )}
                        <button
                          className="btn"
                          style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
                          onClick={() => removeSong(todayKey, "lea")}
                        >
                          Supprimer (Léa)
                        </button>
                      </>
                    ) : (
                      <div className="sub">Pas encore ajoutée ✨</div>
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panelTitle blue">Gauthier</div>
                  <div className="panelBody">
                    {gauToday ? (
                      <>
                        <div style={{ fontWeight: 900 }}>
                          {gauToday.title}
                          {gauToday.artist ? ` — ${gauToday.artist}` : ""}
                        </div>
                        {gauToday.note && <div className="sub">💬 {gauToday.note}</div>}
                        {gauToday.link && (
                          <div className="sub" style={{ marginTop: 6 }}>
                            🔗{" "}
                            <a href={gauToday.link} target="_blank" rel="noreferrer">
                              Ouvrir
                            </a>
                          </div>
                        )}
                        <button
                          className="btn"
                          style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
                          onClick={() => removeSong(todayKey, "gauthier")}
                        >
                          Supprimer (Gauthier)
                        </button>
                      </>
                    ) : (
                      <div className="sub">Pas encore ajoutée ✨</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="small">
                Prochaine musique dans {pad2(untilMidnightParts.hours)}:{pad2(untilMidnightParts.minutes)}:{pad2(untilMidnightParts.seconds)} 💖
              </div>

              <div className="sep" />

              <div className="sectionTitle">
                <span>Ajouter une musique</span>
                <span className="badge">➕</span>
              </div>

              <div className="row">
                <div>
                  <div className="label">Léa — Titre :</div>
                  <input className="input" value={leaTitle} onChange={(e) => setLeaTitle(e.target.value)} placeholder="Titre" />
                </div>
                <div>
                  <div className="label">Gauthier — Titre :</div>
                  <input className="input" value={gauTitle} onChange={(e) => setGauTitle(e.target.value)} placeholder="Titre" />
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Artiste (Léa) :</div>
                  <input className="input" value={leaArtist} onChange={(e) => setLeaArtist(e.target.value)} placeholder="Artiste" />
                </div>
                <div>
                  <div className="label">Artiste (Gauthier) :</div>
                  <input className="input" value={gauArtist} onChange={(e) => setGauArtist(e.target.value)} placeholder="Artiste" />
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Lien (Léa) :</div>
                  <input className="input" value={leaLink} onChange={(e) => setLeaLink(e.target.value)} placeholder="Spotify/Apple/YouTube" />
                </div>
                <div>
                  <div className="label">Lien (Gauthier) :</div>
                  <input className="input" value={gauLink} onChange={(e) => setGauLink(e.target.value)} placeholder="Spotify/Apple/YouTube" />
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Petit mot (Léa) :</div>
                  <textarea className="textarea" value={leaNote} onChange={(e) => setLeaNote(e.target.value)} placeholder="Pourquoi cette musique ? 💗" />
                </div>
                <div>
                  <div className="label">Petit mot (Gauthier) :</div>
                  <textarea className="textarea" value={gauNote} onChange={(e) => setGauNote(e.target.value)} placeholder="Pourquoi cette musique ? 💗" />
                </div>
              </div>

              <div className="row">
                <button className="btn" onClick={() => addDuoSong("lea")} disabled={!leaTitle.trim() || !!leaToday}>
                  Ajouter Léa ✨
                </button>
                <button className="btn" onClick={() => addDuoSong("gauthier")} disabled={!gauTitle.trim() || !!gauToday}>
                  Ajouter Gauthier ✨
                </button>
              </div>

              <div className="sep" />

              <div className="sectionTitle">
                <span>Historique</span>
                <span className="badge">🗂️</span>
              </div>

              {playlistSorted.length === 0 ? (
                <div className="small">Aucune musique encore… première du jour ? 🥰</div>
              ) : (
                <div className="list">
                  {playlistSorted.map((s) => (
                    <div className="item" key={`${s.dateKey}-${s.who}`}>
                      <div className="itemTop">
                        <div className="itemTitle">
                          {s.who === "lea" ? "Léa" : "Gauthier"} — {s.title}
                          {s.artist ? ` — ${s.artist}` : ""}
                        </div>
                        <div className="itemMeta">{s.dateKey}</div>
                      </div>
                      {s.note && <div className="sub">💬 {s.note}</div>}
                      {s.link && (
                        <div className="sub" style={{ marginTop: 6 }}>
                          🔗{" "}
                          <a href={s.link} target="_blank" rel="noreferrer">
                            Ouvrir
                          </a>
                        </div>
                      )}
                      <button
                        className="btn"
                        style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
                        onClick={() => removeSong(s.dateKey, s.who)}
                      >
                        Supprimer
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="heart">🍓</div>
            </div>
          </>
        )}

        {/* REPOS */}
        {tab === "rests" && (
          <>
            <div className="h1">Repos de Gauthier 🛌💙</div>
            <p className="p">Ajoute des plages de repos (du / au) pour garder le planning clair.</p>

            <div className="card">
              <div className="sectionTitle">
                <span>Ajouter une plage</span>
                <span className="badge">📅</span>
              </div>

              <div className="grid2" style={{ marginTop: 0 }}>
                <div>
                  <div className="label">Du :</div>
                  <input
                    className="input"
                    type="date"
                    value={restStartInput}
                    onChange={(e) => setRestStartInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addGauthierRestRange()}
                  />
                </div>
                <div>
                  <div className="label">Au :</div>
                  <input
                    className="input"
                    type="date"
                    value={restEndInput}
                    onChange={(e) => setRestEndInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addGauthierRestRange()}
                  />
                </div>
              </div>

              <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                Type du début :
              </div>
              <div className="subtabs" style={{ marginTop: 6 }}>
                <button
                  className={`subtabBtn ${restStartPeriodInput === "full_day" ? "subtabBtnActive" : ""}`}
                  onClick={() => setRestStartPeriodInput("full_day")}
                >
                  Journée entière
                </button>
                <button
                  className={`subtabBtn ${restStartPeriodInput === "evening" ? "subtabBtnActive" : ""}`}
                  onClick={() => setRestStartPeriodInput("evening")}
                >
                  Soirée
                </button>
              </div>

              <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                Type de fin :
              </div>
              <div className="subtabs" style={{ marginTop: 6 }}>
                <button
                  className={`subtabBtn ${restEndPeriodInput === "full_day" ? "subtabBtnActive" : ""}`}
                  onClick={() => setRestEndPeriodInput("full_day")}
                >
                  Journée entière
                </button>
                <button
                  className={`subtabBtn ${restEndPeriodInput === "evening" ? "subtabBtnActive" : ""}`}
                  onClick={() => setRestEndPeriodInput("evening")}
                >
                  Soirée
                </button>
              </div>
              {restRangeInvalid && (
                <div className="small" style={{ marginTop: 8 }}>
                  La fin doit être après le début (date et type de repos).
                </div>
              )}

              {editingRestRangeKey && (
                <div className="small" style={{ marginTop: 8, textAlign: "left" }}>
                  Mode modification actif.
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  style={{ width: "auto", flex: 1 }}
                  onClick={addGauthierRestRange}
                  disabled={!restStartInput.trim() || !restEndInput.trim() || restRangeInvalid}
                >
                  {editingRestRangeKey ? "Enregistrer" : "Ajouter la plage"}
                </button>
                {editingRestRangeKey && (
                  <button className="btn" style={{ width: "auto", flex: 1 }} onClick={resetRestRangeForm}>
                    Annuler
                  </button>
                )}
              </div>

              <div className="sep" />

              <div className="sectionTitle">
                <span>Prochains repos</span>
                <span className="badge">🗓️</span>
              </div>

              {upcomingRestRanges.length === 0 ? (
                <div className="small">Aucun prochain repos enregistré pour l’instant ✨</div>
              ) : (
                <div className="list">
                  {upcomingRestRanges.map((range) => {
                    const rangeKey = restRangeKey(range);
                    return (
                      <div className="item" key={`upcoming-${rangeKey}`}>
                        <div className="itemTop">
                          <div className="itemTitle">{formatRestRange(range)}</div>
                          <div className="itemMeta">{restRangeMeta(range, todayKey)}</div>
                        </div>
                        <div className="sub">{restRangeDetailLabel(range)}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            className="btn"
                            style={{ marginTop: 0, width: "auto", flex: 1, padding: "10px 12px", fontSize: 14 }}
                            onClick={() => editGauthierRestRange(range)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn"
                            style={{ marginTop: 0, width: "auto", flex: 1, padding: "10px 12px", fontSize: 14 }}
                            onClick={() => removeGauthierRestRange(rangeKey)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="small" style={{ marginTop: 14 }}>
                {restRangeSummary(nextRestRange, todayKey)}
              </div>

              {previousRestRanges.length > 0 && (
                <>
                  <div className="sep" />
                  <div className="sectionTitle">
                    <span>Dates passées</span>
                    <span className="badge">🕰️</span>
                  </div>
                  <div className="list">
                    {[...previousRestRanges].reverse().map((range) => {
                      const rangeKey = restRangeKey(range);
                      return (
                      <div className="item" key={`past-${rangeKey}`}>
                        <div className="itemTop">
                          <div className="itemTitle">{formatRestRange(range)}</div>
                          <div className="itemMeta">{restRangeMeta(range, todayKey)}</div>
                        </div>
                        <div className="sub">{restRangeDetailLabel(range)}</div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            className="btn"
                            style={{ marginTop: 0, width: "auto", flex: 1, padding: "10px 12px", fontSize: 14 }}
                            onClick={() => editGauthierRestRange(range)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn"
                            style={{ marginTop: 0, width: "auto", flex: 1, padding: "10px 12px", fontSize: 14 }}
                            onClick={() => removeGauthierRestRange(rangeKey)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </>
              )}

              <div className="heart">🩵</div>
            </div>
          </>
        )}

        {/* ACTIVITIES */}
        {tab === "activities" && (
          <>
            <div className="h1">Nos activités ✅🎬</div>
            <p className="p">Un seul onglet pour la to-do et les films, avec deux sous-onglets.</p>

            <div className="card">
              <div className="subtabs">
                <button
                  className={`subtabBtn ${activitiesSubTab === "todo" ? "subtabBtnActive" : ""}`}
                  onClick={() => setActivitiesSubTab("todo")}
                >
                  ✅ To-Do ({todoDoneCount}/{shared.todo.length})
                </button>
                <button
                  className={`subtabBtn ${activitiesSubTab === "movies" ? "subtabBtnActive" : ""}`}
                  onClick={() => setActivitiesSubTab("movies")}
                >
                  🎥 Films ({moviesDoneCount}/{shared.movies.length})
                </button>
              </div>

              {activitiesSubTab === "todo" && (
                <>
                  <div className="sectionTitle" style={{ marginTop: 12 }}>
                    <span>Activités à faire</span>
                    <span className="badge">🎯</span>
                  </div>

                  <div className="list">
                    {shared.todo.map((item, index) => (
                      <div className="item" key={index}>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={item.done}
                            onChange={() => {
                              const newDone = !item.done;
                              if (newDone) fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                              const newTodo = [...shared.todo];
                              newTodo[index] = { ...item, done: newDone };
                              patchShared({ todo: newTodo });
                            }}
                            style={{ marginRight: 10 }}
                          />
                          <span style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.6 : 1 }}>
                            {item.text}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="small" style={{ marginTop: 20 }}>
                    {todoDoneCount} / {shared.todo.length} activités complétées 💖
                  </div>

                  <div className="heart">🌸</div>
                </>
              )}

              {activitiesSubTab === "movies" && (
                <>
                  <div className="sectionTitle" style={{ marginTop: 12 }}>
                    <span>Films suggérés</span>
                    <span className="badge">🍿</span>
                  </div>

                  <div className="list">
                    {shared.movies.map((movie, index) => (
                      <div className="item" key={index}>
                        <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={movie.done}
                            onChange={() => {
                              const newDone = !movie.done;
                              if (newDone) fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                              const newMovies = [...shared.movies];
                              newMovies[index] = { ...movie, done: newDone };
                              patchShared({ movies: newMovies });
                            }}
                            style={{ marginRight: 10 }}
                          />
                          <span style={{ textDecoration: movie.done ? "line-through" : "none", opacity: movie.done ? 0.6 : 1 }}>
                            {movie.title}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="small" style={{ marginTop: 20 }}>
                    {moviesDoneCount} / {shared.movies.length} films suggérés vus 💕
                  </div>

                  <div className="sep" />

                  <div className="sectionTitle">
                    <span>Ajouter un film personnalisé</span>
                    <span className="badge">➕</span>
                  </div>

                  <div>
                    <div className="label">Titre du film :</div>
                    <input
                      className="input"
                      value={customMovieTitle}
                      onChange={(e) => setCustomMovieTitle(e.target.value)}
                      placeholder="Ex: La La Land"
                      onKeyDown={(e) => e.key === "Enter" && addCustomMovie()}
                    />
                  </div>

                  <button className="btn" onClick={addCustomMovie} disabled={!customMovieTitle.trim()}>
                    Ajouter ce film ✨
                  </button>

                  {shared.customMovies.length > 0 && (
                    <>
                      <div className="sep" />

                      <div className="sectionTitle">
                        <span>Vos films personnalisés</span>
                        <span className="badge">❤️</span>
                      </div>

                      <div className="list">
                        {shared.customMovies.map((movie, index) => (
                          <div className="item" key={index}>
                            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", flex: 1 }}>
                              <input
                                type="checkbox"
                                checked={movie.done}
                                onChange={() => toggleCustomMovie(index)}
                                style={{ marginRight: 10 }}
                              />
                              <span style={{ textDecoration: movie.done ? "line-through" : "none", opacity: movie.done ? 0.6 : 1, flex: 1 }}>
                                {movie.title}
                              </span>
                            </label>
                            <button
                              className="btn"
                              style={{ marginLeft: 10, padding: "8px 12px", fontSize: 12, background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
                              onClick={() => removeCustomMovie(index)}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="small" style={{ marginTop: 20 }}>
                        {customMoviesDoneCount} / {shared.customMovies.length} films personnalisés vus 💕
                      </div>
                    </>
                  )}

                  <div className="heart">🎬</div>
                </>
              )}
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="tabs">
          <div className="tabbar">
            <button className={`tabbtn ${tab === "home" ? "tabbtnActive" : ""}`} onClick={() => setTab("home")}>
              <div className="tabicon">{tabIcons.home}</div>
              Accueil
            </button>
            <button className={`tabbtn ${tab === "meet" ? "tabbtnActive" : ""}`} onClick={() => setTab("meet")}>
              <div className="tabicon">{tabIcons.meet}</div>
              Lieu
            </button>
            <button className={`tabbtn ${tab === "playlist" ? "tabbtnActive" : ""}`} onClick={() => setTab("playlist")}>
              <div className="tabicon">{tabIcons.playlist}</div>
              Playlist
            </button>
            <button className={`tabbtn ${tab === "rests" ? "tabbtnActive" : ""}`} onClick={() => setTab("rests")}>
              <div className="tabicon">{tabIcons.rests}</div>
              Repos
            </button>
            <button className={`tabbtn ${tab === "activities" ? "tabbtnActive" : ""}`} onClick={() => setTab("activities")}>
              <div className="tabicon">{tabIcons.activities}</div>
              Activités
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
