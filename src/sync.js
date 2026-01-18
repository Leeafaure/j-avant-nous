export function defaultRoomState() {
  return {
    targetISO: "",
    updatedAt: Date.now(),
    daily: null,
    playlist: [],

    // notre to-do list
    todo: [
      { text: "Se faire un câlin de 5 minutes sans rien dire", done: false },
      { text: "Regarder un coucher de soleil ensemble", done: false },
    ],
    meet: {
      placeName: "",
      city: "",
      address: "",
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
    },
  };
}

