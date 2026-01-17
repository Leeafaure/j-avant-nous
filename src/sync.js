// Helpers pour synchroniser un "room" (code couple) dans Firestore

export function normalizeRoomCode(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Valeur par défaut de tout ce qu'on synchronise
export function defaultRoomState() {
  return {
    // date
    targetISO: "",

    // daily (mot+défi) partagé
    daily: null,

    // lieu + vol
    meet: {
      placeName: "Notre lieu de retrouvailles",
      city: "",
      address: "",
      imageDataUrl: "",  // on évite de sync (trop lourd)
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
    },

    // playlist DUO partagée
    // [{dateKey, who, title, artist, link, note, addedAt}]
    playlist: [],

    // meta
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };
}
