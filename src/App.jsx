import React, { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";

const LS = {
  target: "jan_target_iso",
  daily: "jan_daily_payload",
  meet: "jan_meet",
  playlist: "jan_playlist",
};

function pad2(n) { return String(n).padStart(2, "0"); }

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

function todayKeyLocal(d = new Date()) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
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

const LOVE_NOTES = [
  "Plus que quelques dodos et je te serre fort 💕",
  "Aujourd’hui je t’aime encore un peu plus.",
  "Ton nom = sourire automatique.",
  "Je garde un câlin en réserve pour le jour J.",
  "Bientôt : toi, moi, et zéro distance.",
  "Je t’envoie un bisou de poche 😘",
  "Tu es mon endroit préféré.",
  "Je pense à toi là, maintenant 💖",
];

const CHALLENGES = [
  "Envoie-lui : “Ce que j’aime chez toi aujourd’hui, c’est…”",
  "Envoie une photo d’un truc qui te fait penser à lui/elle.",
  "Partage une chanson ‘mood nous’ (un titre).",
  "Écris un souvenir en 3 phrases (où / quoi / pourquoi).",
  "Écris 3 idées pour votre prochaine journée ensemble.",
  "Envoie un vocal de 10 secondes : “j’ai hâte de…”",
  "Fais un compliment super précis (un détail !).",
  "Écris une mini lettre de 5 lignes, simple et vraie.",
];

function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

export default function App() {
  const [now, setNow] = useState(() => new Date());

  // Onglets : home | meet | playlist
  const [tab, setTab] = useState("home");

  // Texte fixe (pas d’onglet texte)
  const texts = useMemo(() => ({
    title: "Avant de te revoir 💖",
    subtitle: "Les retrouvailles de Gauthier et Léa",
    dateLabel: "Date de nos retrouvailles :",
    buttonDaily: "Débloquer le mot + défi du jour ✨",
  }), []);

  // Lieu & vol
  const [meet, setMeet] = useState(() =>
    loadJSON(LS.meet, {
      placeName: "Notre lieu de retrouvailles",
      city: "",
      address: "",
      imageDataUrl: "",
      imageUrl: "",
      flight: {
        airline: "",
        flightNumber: "",
        departureAirport: "",
        departureTime: "",
        arrivalAirport: "",
        arrivalTime: "",
        bookingRef: "",
        notes: "",
      },
    })
  );

  // Playlist DUO (historique)
  // format: [{dateKey, who: "lea"|"gauthier", title, artist, link, note, addedAt}]
  const [playlist, setPlaylist] = useState(() => loadJSON(LS.playlist, []));

  // Formulaires DUO
  const [leaTitle, setLeaTitle] = useState("");
  const [leaArtist, setLeaArtist] = useState("");
  const [leaLink, setLeaLink] = useState("");
  const [leaNote, setLeaNote] = useState("");

  const [gauTitle, setGauTitle] = useState("");
  const [gauArtist, setGauArtist] = useState("");
  const [gauLink, setGauLink] = useState("");
  const [gauNote, setGauNote] = useState("");

  // Date cible
  const [targetDateStr, setTargetDateStr] = useState(() => {
    const iso = localStorage.getItem(LS.target);
    if (!iso) return "";
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    return `${y}-${m}-${day}`;
  });
  const [targetISO, setTargetISO] = useState(() => localStorage.getItem(LS.target) || "");

  // Daily
  const [daily, setDaily] = useState(() => loadJSON(LS.daily, null));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 250);
    return () => clearInterval(t);
  }, []);

  // Sauvegardes
  useEffect(() => {
    localStorage.setItem(LS.meet, JSON.stringify(meet));
  }, [meet]);

  useEffect(() => {
    localStorage.setItem(LS.playlist, JSON.stringify(playlist));
  }, [playlist]);

  const targetDate = useMemo(() => (targetISO ? new Date(targetISO) : null), [targetISO]);
  const remainingMs = useMemo(() => (targetDate ? targetDate.getTime() - now.getTime() : 0), [targetDate, now]);
  const parts = useMemo(() => msToParts(remainingMs), [remainingMs]);

  const todayKey = useMemo(() => todayKeyLocal(now), [now]);

  const alreadyUnlockedToday = daily?.dateKey === todayKey;

  const untilMidnight = useMemo(() => msUntilMidnightLocal(now), [now]);
  const untilMidnightParts = useMemo(() => msToParts(untilMidnight), [untilMidnight]);

  function saveDate(dateYYYYMMDD) {
    setTargetDateStr(dateYYYYMMDD);

    if (!dateYYYYMMDD) {
      setTargetISO("");
      localStorage.removeItem(LS.target);
      return;
    }

    // midi local pour éviter surprises fuseau horaire
    const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
    const iso = local.toISOString();

    setTargetISO(iso);
    localStorage.setItem(LS.target, iso);
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.75 } });
  }

  function unlockDaily() {
    const seed = `${todayKey}|${targetISO || "no-target"}|JAVANTNOUS`;
    const love = pickDeterministic(LOVE_NOTES, seed + "|LOVE");
    const challenge = pickDeterministic(CHALLENGES, seed + "|CHALLENGE");
    const payload = { dateKey: todayKey, love, challenge };
    setDaily(payload);
    localStorage.setItem(LS.daily, JSON.stringify(payload));
    confetti({ particleCount: 150, spread: 85, origin: { y: 0.7 } });
  }

  // Image: fichier -> dataURL
  function onPickImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setMeet((m) => ({ ...m, imageDataUrl: String(reader.result || ""), imageUrl: "" }));
    };
    reader.readAsDataURL(file);
  }

  const displayedImage = meet.imageDataUrl || meet.imageUrl;

  // Playlist DUO actions
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

    setPlaylist((prev) => {
      const filtered = prev.filter((s) => !(s.dateKey === todayKey && s.who === who));
      return [entry, ...filtered];
    });

    if (isLea) {
      setLeaTitle(""); setLeaArtist(""); setLeaLink(""); setLeaNote("");
    } else {
      setGauTitle(""); setGauArtist(""); setGauLink(""); setGauNote("");
    }

    confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
  }

  function removeSong(dateKey, who) {
    setPlaylist((prev) => prev.filter((s) => !(s.dateKey === dateKey && s.who === who)));
  }

  function clearPlaylist() {
    setPlaylist([]);
  }

  const leaToday = useMemo(
    () => playlist.find((s) => s.dateKey === todayKey && s.who === "lea"),
    [playlist, todayKey]
  );
  const gauToday = useMemo(
    () => playlist.find((s) => s.dateKey === todayKey && s.who === "gauthier"),
    [playlist, todayKey]
  );

  const daysDiff = targetDate
    ? Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let resultText = "";
  if (daysDiff === null) resultText = "";
  else if (daysDiff > 0) resultText = `Plus que ${daysDiff} jours avant de te revoir 💕`;
  else if (daysDiff === 0) resultText = `C’est aujourd’hui 💖💖💖`;
  else resultText = `Je t’ai déjà retrouvé(e) ❤️`;

  const showTimer = targetDate && remainingMs > 0;

  const playlistSorted = useMemo(() => {
    const copy = [...playlist];
    copy.sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || ""));
    return copy;
  }, [playlist]);

  const alreadyLeaToday = !!leaToday;
  const alreadyGauToday = !!gauToday;

  return (
    <div className="app">
      <div className="shell">
        <div className="topbar">
          <div className="brand">
            <span className="badge">💞 Avant de te revoir</span>
          </div>
          <span className="badge">📅 {todayKey}</span>
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
              <input
                className="input"
                type="date"
                value={targetDateStr}
                onChange={(e) => saveDate(e.target.value)}
              />

              <div className="result">{resultText}</div>

              {showTimer && (
                <>
                  <div className="sub">
                    Temps restant :{" "}
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>
                      {pad2(parts.hours)}:{pad2(parts.minutes)}:{pad2(parts.seconds)}
                    </strong>
                  </div>

                  <div className="timerRow">
                    <div className="tile">
                      <div className="tileLabel">Heures</div>
                      <div className="tileValue">{pad2(parts.hours)}</div>
                    </div>
                    <div className="tile">
                      <div className="tileLabel">Minutes</div>
                      <div className="tileValue">{pad2(parts.minutes)}</div>
                    </div>
                    <div className="tile">
                      <div className="tileLabel">Secondes</div>
                      <div className="tileValue">{pad2(parts.seconds)}</div>
                    </div>
                  </div>
                </>
              )}

              <div className="sep" />

              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">Mot du jour</div>
                  <div className="panelBody">{daily ? daily.love : "Débloque ton mot ✨"}</div>
                </div>

                <div className="panel">
                  <div className="panelTitle blue">Mini-défi</div>
                  <div className="panelBody">{daily ? daily.challenge : "Débloque ton mini-défi ✨"}</div>
                </div>
              </div>

              <button className="btn" onClick={unlockDaily} disabled={!targetISO || alreadyUnlockedToday}>
                {alreadyUnlockedToday
                  ? `Reviens demain (dans ${pad2(untilMidnightParts.hours)}:${pad2(untilMidnightParts.minutes)}:${pad2(untilMidnightParts.seconds)})`
                  : texts.buttonDaily}
              </button>

              <div className="heart">💞</div>

              <div className="small">
                Onglet “Playlist” = une musique Léa + une musique Gauthier par jour 🎧
              </div>
            </div>
          </>
        )}

        {/* LIEU */}
        {tab === "meet" && (
          <>
            <div className="h1">Notre retrouvailles ✈️💗</div>
            <p className="p">Ajoute le lieu + une photo + les infos de vol. Tout reste sur ton téléphone.</p>

            <div className="card">
              <div className="sectionTitle">
                <span>Lieu</span>
                <span className="badge">📍</span>
              </div>

              <div className="label">Nom du lieu :</div>
              <input
                className="input"
                value={meet.placeName}
                onChange={(e) => setMeet((m) => ({ ...m, placeName: e.target.value }))}
                placeholder="Aéroport / Gare / Hôtel…"
              />

              <div className="label">Ville :</div>
              <input
                className="input"
                value={meet.city}
                onChange={(e) => setMeet((m) => ({ ...m, city: e.target.value }))}
                placeholder="Paris"
              />

              <div className="label">Adresse (optionnel) :</div>
              <input
                className="input"
                value={meet.address}
                onChange={(e) => setMeet((m) => ({ ...m, address: e.target.value }))}
                placeholder="Terminal, hall…"
              />

              <div className="sep" />

              <div className="sectionTitle">
                <span>Photo</span>
                <span className="badge">🖼️</span>
              </div>

              {displayedImage ? (
                <img
                  src={displayedImage}
                  alt="Lieu"
                  style={{
                    width: "100%",
                    borderRadius: 16,
                    border: "1px solid rgba(90,42,74,.10)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                />
              ) : (
                <div className="small">Ajoute une image : fichier ou lien.</div>
              )}

              <div className="label">Choisir une photo :</div>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => onPickImage(e.target.files?.[0])}
              />

              <div className="label">…ou lien d’image (optionnel) :</div>
              <input
                className="input"
                value={meet.imageUrl}
                onChange={(e) => setMeet((m) => ({ ...m, imageUrl: e.target.value, imageDataUrl: "" }))}
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
                onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, airline: e.target.value } }))}
                placeholder="Air France"
              />

              <div className="label">Numéro de vol :</div>
              <input
                className="input"
                value={meet.flight.flightNumber}
                onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, flightNumber: e.target.value } }))}
                placeholder="AF1234"
              />

              <div className="row">
                <div>
                  <div className="label">Départ (aéroport) :</div>
                  <input
                    className="input"
                    value={meet.flight.departureAirport}
                    onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, departureAirport: e.target.value } }))}
                    placeholder="ORY"
                  />
                </div>
                <div>
                  <div className="label">Heure départ :</div>
                  <input
                    className="input"
                    value={meet.flight.departureTime}
                    onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, departureTime: e.target.value } }))}
                    placeholder="10:35"
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <div className="label">Arrivée (aéroport) :</div>
                  <input
                    className="input"
                    value={meet.flight.arrivalAirport}
                    onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, arrivalAirport: e.target.value } }))}
                    placeholder="CDG"
                  />
                </div>
                <div>
                  <div className="label">Heure arrivée :</div>
                  <input
                    className="input"
                    value={meet.flight.arrivalTime}
                    onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, arrivalTime: e.target.value } }))}
                    placeholder="12:05"
                  />
                </div>
              </div>

              <div className="label">Référence (optionnel) :</div>
              <input
                className="input"
                value={meet.flight.bookingRef}
                onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, bookingRef: e.target.value } }))}
                placeholder="ABC123"
              />

              <div className="label">Notes (optionnel) :</div>
              <input
                className="input"
                value={meet.flight.notes}
                onChange={(e) => setMeet((m) => ({ ...m, flight: { ...m.flight, notes: e.target.value } }))}
                placeholder="Terminal / porte / qui attend qui…"
              />

              <div className="heart">🌸</div>
              <div className="small">Tout est enregistré automatiquement.</div>
            </div>
          </>
        )}

        {/* PLAYLIST DUO */}
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
                          {leaToday.title}{leaToday.artist ? ` — ${leaToday.artist}` : ""}
                        </div>
                        {leaToday.note && <div className="sub">💬 {leaToday.note}</div>}
                        {leaToday.link && (
                          <div className="sub itemLink">
                            🔗 <a href={leaToday.link} target="_blank" rel="noreferrer">Ouvrir</a>
                          </div>
                        )}
                        <button className="btn" style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
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
                          {gauToday.title}{gauToday.artist ? ` — ${gauToday.artist}` : ""}
                        </div>
                        {gauToday.note && <div className="sub">💬 {gauToday.note}</div>}
                        {gauToday.link && (
                          <div className="sub itemLink">
                            🔗 <a href={gauToday.link} target="_blank" rel="noreferrer">Ouvrir</a>
                          </div>
                        )}
                        <button className="btn" style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
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
                <button className="btn" onClick={() => addDuoSong("lea")} disabled={!leaTitle.trim() || alreadyLeaToday}>
                  Ajouter Léa ✨
                </button>
                <button className="btn" onClick={() => addDuoSong("gauthier")} disabled={!gauTitle.trim() || alreadyGauToday}>
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
                          {s.who === "lea" ? "Léa" : "Gauthier"} — {s.title}{s.artist ? ` — ${s.artist}` : ""}
                        </div>
                        <div className="itemMeta">{s.dateKey}</div>
                      </div>
                      {s.note && <div className="sub">💬 {s.note}</div>}
                      {s.link && (
                        <div className="sub itemLink">
                          🔗 <a href={s.link} target="_blank" rel="noreferrer">Ouvrir</a>
                        </div>
                      )}
                      <button className="btn" style={{ marginTop: 10, padding: "10px 12px", fontSize: 14 }}
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
            <button
              className={`tabbtn ${tab === "home" ? "tabbtnActive" : ""}`}
              onClick={() => setTab("home")}
            >
              <div className="tabicon">🏠</div>
              Accueil
            </button>

            <button
              className={`tabbtn ${tab === "meet" ? "tabbtnActive" : ""}`}
              onClick={() => setTab("meet")}
            >
              <div className="tabicon">📍</div>
              Lieu
            </button>

            <button
              className={`tabbtn ${tab === "playlist" ? "tabbtnActive" : ""}`}
              onClick={() => setTab("playlist")}
            >
              <div className="tabicon">🎧</div>
              Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

