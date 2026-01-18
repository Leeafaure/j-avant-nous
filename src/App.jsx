import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

import { db } from "./firebase";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { messaging } from "./firebase";
import { getToken, onMessage } from "firebase/messaging";
import { defaultRoomState } from "./sync";

const ROOM_ID = "gauthier-lea-2026-coeur"; // fixe = pas de code

const LOVE_NOTES = [
  "Je fais semblant d’être sage… mais je pense à toi tout le temps 😇",
  "Mon programme du jour : te manquer. Encore.",
  "Je suis en manque… de toi. Et de tes câlins.",
  "Je te préviens : je vais te faire perdre ton espace vital 💞",
  "Prépare-toi… je vais te dévorer de bisous 💋",
  "Je pense à toi… et c’est rarement innocent.",
  "Spoiler : tu vas pas t’en sortir indemne 😘",
  "Ça devient urgent là. Urgent câlin. Urgent toi.",
];

const CHALLENGES = [
  "Envoie un vocal (5 sec) : “Je te veux là, maintenant.”",
  "Écris : “J’ai envie de…” et finis la phrase (douce… ou pas 😈).",
  "Défi musique : choisis une chanson qui te donne envie de l’embrasser.",
  "Défi souvenir : raconte un moment drôle de vous deux en 2 phrases.",
  "Fais une ‘review’ de ton copain : ⭐⭐⭐⭐⭐ + une phrase.",
  "Envoie “Je pense à toi” mais en version dramatique 😭🎭",
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

function buildMapsLink({ city, placeName, address }) {
  const q = [placeName, address, city]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join(", ");
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export default function App() {
  const [tab, setTab] = useState("home"); // home | meet | playlist | todo | movies
  const [editMeet, setEditMeet] = useState(false);
  const [customMovieTitle, setCustomMovieTitle] = useState("");
  const [notificationsRequested, setNotificationsRequested] = useState(() => 
    localStorage.getItem('notificationsRequested') === 'true'
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(t);
  }, []);

  const todayKey = useMemo(() => todayKeyLocal(now), [now]);
  const untilMidnight = useMemo(() => msUntilMidnightLocal(now), [now]);
  const untilMidnightParts = useMemo(() => msToParts(untilMidnight), [untilMidnight]);

  const roomRef = useMemo(() => doc(db, "rooms", ROOM_ID), []);
  const [shared, setShared] = useState(() => defaultRoomState());
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState("");

  const suppressNextWrite = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSyncError("");
    setSyncing(true);

    const unsub = onSnapshot(
      roomRef,
      async (snap) => {
        try {
          if (!snap.exists()) {
            const init = defaultRoomState();
            await setDoc(roomRef, init);
            suppressNextWrite.current = true;
            setShared(init);
            setSyncing(false);
            return;
          }
          suppressNextWrite.current = true;
          setShared({ ...defaultRoomState(), ...snap.data() });
          setSyncing(false);
        } catch (e) {
          setSyncError(String(e?.message || e));
          setSyncing(false);
        }
      },
      (err) => {
        setSyncError(String(err?.message || err));
        setSyncing(false);
      }
    );

    return () => unsub();
  }, [roomRef]);

  useEffect(() => {
    // Only register service worker in production (HTTPS) - works on Vercel
    const isProduction = window.location.protocol === 'https:' && window.location.hostname !== 'localhost';
    const isLocalhost = window.location.hostname === 'localhost';

    if ('serviceWorker' in navigator) {
      if (isProduction) {
        console.log('🔥 Registering Firebase service worker (production)...');
        navigator.serviceWorker.register('/firebase-messaging-sw.js')
          .then((registration) => {
            console.log('✅ Service worker registered successfully:', registration);
          })
          .catch((error) => {
            console.error('❌ Service worker registration failed:', error);
          });
      } else if (isLocalhost) {
        console.log('ℹ️ Service worker skipped in development (localhost) - notifications will work in foreground only');
      } else {
        console.log('ℹ️ Service worker registration conditions not met');
      }
    }

    // Foreground messages work in both dev and prod
    console.log('📱 Setting up foreground message handler...');
    onMessage(messaging, (payload) => {
      console.log('📨 Foreground message received:', payload);
      // Show notification
      if (Notification.permission === 'granted') {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/vite.svg'
        });
      }
    });
  }, []);

  async function patchShared(patch) {
    setShared((prev) => ({ ...prev, ...patch, updatedAt: Date.now() }));

    if (suppressNextWrite.current) {
      suppressNextWrite.current = false;
      return;
    }

    try {
      await updateDoc(roomRef, { ...patch, updatedAt: Date.now() });
    } catch (e) {
      try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          await setDoc(roomRef, { ...defaultRoomState(), ...patch, updatedAt: Date.now() });
        }
      } catch {
        // Ignore errors in fallback setDoc
      }
      setSyncError(String(e?.message || e));
    }
  }

  async function shareToSnapchat() {
    if (!shared.daily?.challenge) return;

    const text = `Mini-défi du jour 😈✨\n\n${shared.daily.challenge}\n\n💖 signé : nous`;

    // 1) Copier
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback ancien iOS
        window.prompt("Copie ce texte :", text);
      }
    } catch {
      window.prompt("Copie ce texte :", text);
    }

    // 2) Ouvrir Snapchat
    // (sur iPhone si Snapchat est installé -> s'ouvre)
    window.location.href = "snapchat://";
  }

  function addCustomMovie() {
    if (!customMovieTitle.trim()) return;
    const newMovie = { title: customMovieTitle.trim(), done: false };
    patchShared({ customMovies: [...shared.customMovies, newMovie] });
    setCustomMovieTitle("");
  }

  function toggleCustomMovie(index) {
    const newDone = !shared.customMovies[index].done;
    if (newDone) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    const newCustomMovies = [...shared.customMovies];
    newCustomMovies[index] = { ...newCustomMovies[index], done: newDone };
    patchShared({ customMovies: newCustomMovies });
  }

  function sendNotification(title, body, icon = '/vite.svg') {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: icon,
        tag: 'j-avant-nous', // Pour éviter les doublons
      });
    }
  }

  // Notifications automatiques basées sur les conditions
  useEffect(() => {
    if (!shared.daily || Notification.permission !== 'granted' || !shared.movies) return;

    const now = new Date();
    const today = todayKeyLocal(now);
    const lastNotification = localStorage.getItem('lastDailyNotification');

    // Rappel quotidien du défi (une fois par jour)
    if (lastNotification !== today) {
      setTimeout(() => {
        sendNotification(
          '💕 Rappel quotidien',
          `N'oublie pas ton défi du jour : "${shared.daily.challenge}"`,
          '/vite.svg'
        );
        localStorage.setItem('lastDailyNotification', today);
      }, 2000); // 2 secondes après chargement
    }
  }, [shared.daily, shared.movies]); // Ajout de shared.movies pour éviter les erreurs

  // Notification quand l'autre coche quelque chose
  useEffect(() => {
    if (!shared.updatedAt || Notification.permission !== 'granted' || !shared.movies) return;

    const lastUpdate = localStorage.getItem('lastUpdateNotification') || 0;
    const currentUpdate = shared.updatedAt;

    if (currentUpdate > lastUpdate + 5000) { // Au moins 5 secondes d'écart
      setTimeout(() => {
        if (shared.movies && shared.movies.some(m => m.done)) {
          const doneCount = shared.movies.filter(m => m.done).length;
          sendNotification(
            '🎬 Progrès cinéma !',
            `${doneCount} film(s) de coché(s) dans votre liste partagée !`,
            '/vite.svg'
          );
        }

        if (shared.customMovies && shared.customMovies.some(m => m.done)) {
          const customDoneCount = shared.customMovies.filter(m => m.done).length;
          sendNotification(
            '❤️ Film personnalisé vu !',
            `Un film de votre liste personnalisée a été coché !`,
            '/vite.svg'
          );
        }

        localStorage.setItem('lastUpdateNotification', currentUpdate.toString());
      }, 1000);
    }
  }, [shared.updatedAt, shared.movies, shared.customMovies]);

  // Notification de motivation selon le nombre de jours
  useEffect(() => {
    if (!targetDate || Notification.permission !== 'granted') return;

    const daysLeft = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const lastMotivation = localStorage.getItem('lastMotivationNotification');

    // Notifications de motivation aux jalons importants
    const milestones = [100, 50, 30, 14, 7, 3, 1];
    const currentMilestone = milestones.find(m => daysLeft <= m && daysLeft > 0);

    if (currentMilestone && lastMotivation !== currentMilestone.toString()) {
      setTimeout(() => {
        let message = '';
        if (daysLeft === 100) message = '100 jours ! Le compte à rebours commence... 💕';
        else if (daysLeft === 50) message = 'La moitié du chemin ! On est les meilleurs ! 💪';
        else if (daysLeft === 30) message = 'Plus que 30 jours ! La fin approche... 😍';
        else if (daysLeft === 14) message = '2 semaines ! Prépare tes valises ! 🎒';
        else if (daysLeft === 7) message = '1 semaine ! C\'est presque fini ! 🎉';
        else if (daysLeft === 3) message = '3 jours ! Plus que quelques heures... ⏰';
        else if (daysLeft === 1) message = 'Dernier jour ! Demain c\'est le grand jour ! 🌟';

        if (message) {
          sendNotification('⏰ Motivation !', message, '/vite.svg');
          localStorage.setItem('lastMotivationNotification', currentMilestone.toString());
        }
      }, 3000);
    }
  }, [targetDate]); // Suppression de 'now' des dépendances pour éviter les re-renders constants

  async function enableNotifications() {
    const isProduction = window.location.protocol === 'https:' && window.location.hostname !== 'localhost';

    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        alert('❌ Ce navigateur ne supporte pas les notifications');
        return;
      }

      console.log('🔔 Requesting notification permission...');
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        console.log('✅ Permission granted, getting token...');
        try {
          const token = await getToken(messaging, {
            vapidKey: 'BAIl1EofkEk5-F9vnYu6jRAhybdscwJoKYnK9CiAygSghhulhchH3M3wL_pG1cVQxAxzvb3dT2kAuQ8URgRrsFo'
          });
          console.log('🔑 FCM Token obtained:', token);

          if (isProduction) {
            alert('✅ Notifications push activées sur Vercel !\n\nVous recevrez maintenant des notifications même quand l\'app n\'est pas ouverte. 💕🎉');
          } else {
            alert('✅ Notifications activées en développement !\n\nEn production (Vercel), vous recevrez aussi des notifications push. 📱');
          }

          // Store token in Firestore or send to server
          // TODO: Send token to your server for push notifications

        } catch (tokenError) {
          console.error('❌ Token error:', tokenError);
          if (tokenError.code === 'messaging/failed-service-worker-registration') {
            alert(`✅ Notifications activées !\n\n${isProduction ? 'Service worker enregistré sur Vercel.' : 'Service worker limité en développement - fonctionnalités complètes sur Vercel.'}`);
          } else {
            alert('⚠️ Erreur token : ' + tokenError.message + '\n\nLes notifications de base fonctionnent.');
          }
        }
      } else {
        alert('❌ Permission refusée\n\nVous pouvez réactiver les notifications dans les paramètres de votre navigateur.');
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      alert('❌ Erreur inattendue : ' + error.message);
    } finally {
      // Marquer que les notifications ont été demandées, peu importe le résultat
      setNotificationsRequested(true);
      localStorage.setItem('notificationsRequested', 'true');
    }
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
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.75 } });
  }

  // Moments clés
  const dodos = daysDiff !== null ? nightsLeft(daysDiff) : null;
  const weekends = targetDate ? weekendsLeft(now, targetDate) : null;
  const cap = daysDiff !== null ? nextMilestone(daysDiff) : null;
  const capText = cap !== null ? milestoneLabel(cap) : "";
  const daysToCap = cap !== null ? Math.max(0, daysDiff - cap) : null;
  const vibe = vibeLine(daysDiff);

  // Daily
  const alreadyUnlockedToday = shared.daily?.dateKey === todayKey;
  function unlockDaily() {
    const seed = `${todayKey}|${shared.targetISO || "no-target"}|ROOM:${ROOM_ID}`;
    const love = pickDeterministic(LOVE_NOTES, seed + "|LOVE");
    const challenge = pickDeterministic(CHALLENGES, seed + "|CHALLENGE");
    patchShared({ daily: { dateKey: todayKey, love, challenge } });
    confetti({ particleCount: 150, spread: 85, origin: { y: 0.7 } });
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
    patchShared({ playlist: next });

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

    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
  }

  function removeSong(dateKey, who) {
    patchShared({ playlist: playlist.filter((s) => !(s.dateKey === dateKey && s.who === who)) });
  }

  const playlistSorted = useMemo(() => {
    const copy = [...playlist];
    copy.sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || "") || (a.who || "").localeCompare(b.who || ""));
    return copy;
  }, [playlist]);

  return (
    <div className="app">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <span className="badge">💞 Avant de te revoir</span>
          </div>
          <span className="badge">📅 {todayKey}</span>
        </div>

        <div className="small" style={{ marginBottom: 12 }}>
          {syncing ? "Synchronisation…" : syncError ? `⚠️ ${syncError}` : "✅ Synchronisé"}
        </div>

        {/* HOME */}
        {tab === "home" && (
          <>
            <div className="h1">Avant de te revoir 💖</div>
            <p className="p">Les retrouvailles de Gauthier et Léa</p>

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

              {/* Daily */}
              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">Mot du jour</div>
                  <div className="panelBody">{shared.daily ? shared.daily.love : "Débloque ton mot ✨"}</div>
                </div>
                <div className="panel">
                  <div className="panelTitle blue">Mini-défi</div>
                  <div className="panelBody">{shared.daily ? shared.daily.challenge : "Débloque ton mini-défi ✨"}</div>
                </div>
              </div>
              <button
              className="btn"
              style={{
                marginTop: 10,
                background: "linear-gradient(90deg, #fff59b, #ffe4f2)",
              }}
              onClick={shareToSnapchat}
              disabled={!shared.daily}
            >
              👻📋 Partager le mini-défi dans Snapchat
            </button>

            {!notificationsRequested && (
              <button
                className="btn"
                style={{
                  marginTop: 10,
                  background: "linear-gradient(90deg, #a8edea, #fed6e3)",
                  animation: "wiggle 2s infinite",
                }}
                onClick={enableNotifications}
              >
                🔔 Activer les notifications
              </button>
            )}

            {/* Bouton de debug pour retester (visible seulement en développement) */}
            {window.location.hostname === 'localhost' && notificationsRequested && (
              <button
                className="btn"
                style={{
                  marginTop: 10,
                  background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
                  fontSize: '12px',
                  padding: '8px 12px',
                }}
                onClick={() => {
                  setNotificationsRequested(false);
                  localStorage.removeItem('notificationsRequested');
                  alert('🔄 Bouton notifications réinitialisé - vous pouvez maintenant le tester à nouveau !');
                }}
              >
                🔄 Retester notifications (dev only)
              </button>
            )}

            <div className="small" style={{ marginTop: 6 }}>
              {shared.daily
                ? "Le défi est copié → il te reste à coller dans Snapchat 😈📸"
                : "Débloque d’abord le mini-défi ✨"}
            </div>

              <button className="btn" onClick={unlockDaily} disabled={alreadyUnlockedToday}>
                {alreadyUnlockedToday
                  ? `Reviens demain (dans ${pad2(untilMidnightParts.hours)}:${pad2(untilMidnightParts.minutes)}:${pad2(
                      untilMidnightParts.seconds
                    )})`
                  : "Débloquer le mot + défi du jour ✨"}
              </button>

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

        {/* TODO */}
        {tab === "todo" && (
          <>
            <div className="h1">Notre to-do list ✅💕</div>
            <p className="p">50 choses à faire ensemble — cochez quand c'est fait !</p>

            <div className="card">
              <div className="sectionTitle">
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
                          if (newDone) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
                {shared.todo.filter(t => t.done).length} / {shared.todo.length} activités complétées 💖
              </div>

              <div className="heart">🌸</div>
            </div>
          </>
        )}

        {/* MOVIES */}
        {tab === "movies" && (
          <>
            <div className="h1">🎥 Films à voir ensemble</div>
            <p className="p">Les meilleurs films du cinéma — cochez quand vous les avez vus !</p>

            <div className="card">
              <div className="sectionTitle">
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
                          if (newDone) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
                {shared.movies.filter(m => m.done).length} / {shared.movies.length} films suggérés vus 💕
              </div>

              <div className="sep" />

              <div className="sectionTitle">
                <span>Ajouter un film personnalisé</span>
                <span className="badge">➕</span>
              </div>

              <div className="row">
                <div style={{ flex: 1 }}>
                  <div className="label">Titre du film :</div>
                  <input
                    className="input"
                    value={customMovieTitle}
                    onChange={(e) => setCustomMovieTitle(e.target.value)}
                    placeholder="Ex: La La Land"
                    onKeyPress={(e) => e.key === 'Enter' && addCustomMovie()}
                  />
                </div>
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
                    {shared.customMovies.filter(m => m.done).length} / {shared.customMovies.length} films personnalisés vus 💕
                  </div>
                </>
              )}

              <div className="heart">🎬</div>
            </div>
          </>
        )}

        {/* Tabs */}
        <div className="tabs">
          <div className="tabbar">
            <button className={`tabbtn ${tab === "home" ? "tabbtnActive" : ""}`} onClick={() => setTab("home")}>
              <div className="tabicon">🏠</div>
              Accueil
            </button>
            <button className={`tabbtn ${tab === "meet" ? "tabbtnActive" : ""}`} onClick={() => setTab("meet")}>
              <div className="tabicon">📍</div>
              Lieu
            </button>
            <button className={`tabbtn ${tab === "playlist" ? "tabbtnActive" : ""}`} onClick={() => setTab("playlist")}>
              <div className="tabicon">🎧</div>
              Playlist
            </button>
            <button className={`tabbtn ${tab === "todo" ? "tabbtnActive" : ""}`} onClick={() => setTab("todo")}>
              <div className="tabicon">✅</div>
              To-Do
            </button>
            <button className={`tabbtn ${tab === "movies" ? "tabbtnActive" : ""}`} onClick={() => setTab("movies")}>
              <div className="tabicon">🎥</div>
              Films
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
