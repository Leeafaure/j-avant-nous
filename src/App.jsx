import React, { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

import { db } from "./firebase";
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { defaultRoomState } from "./sync";

// ✅ ROOM FIREBASE FIXE (pas de code à entrer)
// Mets un truc pas trop devinable :
const ROOM_ID = "gauthier-lea-2026-coeur";

const LOVE_NOTES = [
  "Je fais semblant d’être sage… mais je pense à toi tout le temps 😇",
  "Mon programme du jour : te manquer. Encore.",
  "J’ai mis ton prénom dans ma to-do list ✅",
  "Je suis en manque… de toi. Et de tes câlins.",
  "Mon cœur a demandé un remboursement de distance.",
  "Bientôt je reviens te coller. Officiellement.",
  "Je te préviens : je vais te faire perdre ton espace vital 💞",
  "À ce stade, tu es littéralement mon obsession préférée.",
  "Je t’attends… mais je boude un peu 😤💖",
  "Si tu veux savoir où je suis : dans tes pensées 😌",

  "Prépare-toi… je vais te dévorer de bisous 💋",
  "J’ai hâte de te revoir… et de ne plus te laisser respirer (un peu) 😇",
  "Mon corps te réclame. Voilà c’est dit 😌",
  "Je pense à toi… et c’est rarement innocent.",
  "Je vais te sauter dessus. Avec amour. Beaucoup d’amour.",
  "Je te préviens : mon câlin va durer minimum 3 heures.",
  "Quand je te revois : je t’embrasse, et après on discute (peut-être) 😈",
  "Je veux juste être dans tes bras… et y rester.",
  "Bientôt je reprends mes droits : bisous illimités ✅",
  "Je t’aime. Et je te veux. Simple.",

  "J’ai hâte de te retrouver… j’ai des intentions très claires 😇",
  "Je suis prête à te coller comme une appli inutile : impossible à supprimer 💅",
  "Je t’envoie un bisou… mais IRL ça sera une attaque.",
  "J’ai faim. De toi. Oui bon.",
  "Tu me manques au point d’être un besoin vital 😭💋",
  "Quand je te revois je fais la fille tranquille… 2 minutes.",
  "Je compte les jours… et je prépare mon plan de bisous 😈",
  "Spoiler : tu vas pas t’en sortir indemne 😘",
  "Ça devient urgent là. Urgent câlin. Urgent toi.",
];

const CHALLENGES = [
  "Envoie-lui un message : “J’ai une annonce importante : tu me manques.”",
  "Fais une ‘review’ de ton copain : ⭐⭐⭐⭐⭐ + une phrase.",
  "Envoie un emoji qui résume ton humeur du jour + “à cause de toi”.",
  "Décris-le en 3 mots… puis ajoute “et c’est MON préféré”.",
  "Envoie “Je pense à toi” mais en version dramatique (exagérée 😭🎭).",
  "Envoie une photo de ton outfit du jour (même en pyjama 😌).",
  "Envoie un GIF qui dit EXACTEMENT ce que tu ressens.",

  "Envoie-lui : “Je te préviens… quand je te vois, je te lâche plus 😇”",
  "Envoie un vocal (5 sec) : “Je te veux là, maintenant.”",
  "Écris : “J’ai envie de…” et finis la phrase avec un truc très doux (ou pas 😈).",
  "Dis-lui : “Mon câlin de retrouvailles va durer ___ minutes”.",
  "Envoie : “J’ai pensé à toi… et c’était PAS innocent.”",
  "Envoie un message : “Tu me manques physiquement.” 😮‍💨",
  "Écris une phrase interdite : “Je serai sage…” (mens un peu).",
  "Donne-lui une mission : “Ce soir tu dois penser à moi avant de dormir.”",

  "Défi 10 secondes : chacun envoie un vocal “j’ai hâte de…”",
  "Défi souvenir : raconte un moment drôle de vous deux en 2 phrases.",
  "Défi imagination : votre prochaine soirée idéale en 3 étapes.",
  "Défi teasing : “Quand on se revoit, je te fais…” (bisou/resto/massage 😇).",
  "Défi secret : chacun écrit une chose qu’il/elle veut refaire ensemble.",
  "Défi musique : choisis une chanson qui te donne envie de l’embrasser.",
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

// Moments clés
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

export default function App() {
  const [tab, setTab] = useState("home"); // home | meet | playlist

  const texts = useMemo(
    () => ({
      title: "Avant de te revoir 💖",
      subtitle: "Les retrouvailles de Gauthier et Léa",
      dateLabel: "Date de nos retrouvailles :",
      buttonDaily: "Débloquer le mot + défi du jour ✨",
    }),
    []
  );

  // Time
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(t);
  }, []);

  const todayKey = useMemo(() => todayKeyLocal(now), [now]);
  const untilMidnight = useMemo(() => msUntilMidnightLocal(now), [now]);
  const untilMidnightParts = useMemo(() => msToParts(untilMidnight), [untilMidnight]);

  // Firestore room
  const roomRef = useMemo(() => doc(db, "rooms", ROOM_ID), []);
  const [shared, setShared] = useState(() => defaultRoomState());
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState("");

  // Prevent write-back loops
  const suppressNextWrite = useRef(false);

  useEffect(() => {
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
          setShared(snap.data());
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
      } catch {}
      setSyncError(String(e?.message || e));
    }
  }

  // Countdown
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
    const iso = local.toISOString();
    patchShared({ targetISO: iso });
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.75 } });
  }

  // Moments clés calcul
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
    const payload = { dateKey: todayKey, love, challenge };
    patchShared({ daily: payload });
    confetti({ particleCount: 150, spread: 85, origin: { y: 0.7 } });
  }

  // Meet
  const meet = shared.meet || defaultRoomState().meet;

  // Playlist
  const playlist = shared.playlist || [];
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

  function clearPlaylist() {
    patchShared({ playlist: [] });
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
            <div className="h1">{texts.title}</div>
            <p className="p">{texts.subtitle}</p>

            <div className="card">
              <div className="sectionTitle">
                <span>Choisis la date</span>
                <span className="badge">✨</span>
              </div>

              <div className="label">{texts.dateLabel}</div>
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

                  {/* ✅ Timer version 1 : Jours / Heures / Secondes */}
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

              {/* Moments clés */}
              <div className="sep" />

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

              <button className="btn" onClick={unlockDaily} disabled={alreadyUnlockedToday}>
                {alreadyUnlockedToday
                  ? `Reviens demain (dans ${pad2(untilMidnightParts.hours)}:${pad2(untilMidnightParts.minutes)}:${pad2(
                      untilMidnightParts.seconds
                    )})`
                  : texts.buttonDaily}
              </button>

              <div className="heart">💞</div>
            </div>
          </>
        )}

        {/* LIEU */}
        {tab === "meet" && (
          <>
            <div className="h1">Notre retrouvailles ✈️💗</div>
            <p className="p">Lieu + photo (lien) + infos de vol. Tout est synchronisé.</p>

            <div className="card">
              <div className="sectionTitle">
                <span>Lieu</span>
                <span className="badge">📍</span>
              </div>

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

              <div className="sectionTitle">
                <span>Photo (lien)</span>
                <span className="badge">🖼️</span>
              </div>

              {meet.imageUrl ? (
                <img
                  src={meet.imageUrl}
                  alt="Lieu"
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    border: "1px solid rgba(90,42,74,.10)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                />
              ) : (
                <div className="small">Colle un lien d’image (site, Google Photos, iCloud…)</div>
              )}

              <div className="label">Lien image :</div>
              <input
                className="input"
                value={meet.imageUrl}
                onChange={(e) => patchShared({ meet: { ...meet, imageUrl: e.target.value } })}
                placeholder="https://..."
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
                onChange={(e) => patchShared({ meet: { ...meet, flight: { ...meet.flight, airline: e.target.value } } })}
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

              <div className="label">Référence (optionnel) :</div>
              <input
                className="input"
                value={meet.flight.bookingRef}
                onChange={(e) =>
                  patchShared({ meet: { ...meet, flight: { ...meet.flight, bookingRef: e.target.value } } })
                }
                placeholder="ABC123"
              />

              <div className="label">Notes (optionnel) :</div>
              <input
                className="input"
                value={meet.flight.notes}
                onChange={(e) => patchShared({ meet: { ...meet, flight: { ...meet.flight, notes: e.target.value } } })}
                placeholder="Terminal / porte / qui attend qui…"
              />

              <div className="heart">🌸</div>
            </div>
          </>
        )}

        {/* PLAYLIST */}
        {tab === "playlist" && (
          <>
            <div className="h1">Playlist DUO 🎧💗</div>
            <p className="p">Une musique par jour pour Léa + une pour Gauthier (synchronisé).</p>

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
                Prochaine musique dans {pad2(untilMidnightParts.hours)}:{pad2(untilMidnightParts.minutes)}:
                {pad2(untilMidnightParts.seconds)} 💖
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

              {playlistSorted.length > 0 && (
                <button className="btn" style={{ marginTop: 12 }} onClick={clearPlaylist}>
                  Tout effacer (playlist)
                </button>
              )}

              <div className="heart">🍓</div>
            </div>
          </>
        )}

        {/* Bottom tabs */}
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
          </div>
        </div>
      </div>
    </div>
  );
}
