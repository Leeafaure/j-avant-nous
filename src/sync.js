export function defaultRoomState() {
  return {
    targetISO: "",
    updatedAt: Date.now(),
    daily: null,
    playlist: [],
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

