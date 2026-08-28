// This file stands in for a real backend/JSON endpoint. In src/App.vue it is
// loaded through a simulated async fetch (fetchEvents) rather than imported
// and rendered directly, so the UI genuinely reflects an async, dynamic data
// load rather than static hard-coded markup (Business Requirement B.2).

export const rawEvents = [
  {
    id: "evt-001",
    title: "Sunshine Reserve Community Planting Day",
    suburb: "Sunshine",
    date: "2026-09-14",
    time: "9:00 AM \u2013 12:00 PM",
    description:
      "Join local volunteers planting 200 native trees and shrubs to restore habitat along the creek corridor. Gloves, tools and morning tea provided.",
    spotsTotal: 40,
    spotsTaken: 28,
    ratings: [5, 4, 5, 4, 3, 5],
    tone: "moss",
  },
  {
    id: "evt-002",
    title: "Footscray Laneway Greening",
    suburb: "Footscray",
    date: "2026-09-22",
    time: "10:00 AM \u2013 1:00 PM",
    description:
      "Help transform a bare laneway into a green pocket with climbing plants, raised garden beds and native groundcover.",
    spotsTotal: 25,
    spotsTaken: 15,
    ratings: [4, 4, 5],
    tone: "ochre",
  },
  {
    id: "evt-003",
    title: "Werribee Biodiversity Walk & Plant-Out",
    suburb: "Werribee",
    date: "2026-09-29",
    time: "8:30 AM \u2013 11:30 AM",
    description:
      "A guided biodiversity walk followed by a hands-on plant-out session to extend habitat for local woodland birds.",
    spotsTotal: 40,
    spotsTaken: 40,
    ratings: [5, 5, 5, 4, 5, 5, 4],
    tone: "forest",
  },
  {
    id: "evt-004",
    title: "Braybrook Schoolyard Canopy Project",
    suburb: "Braybrook",
    date: "2026-10-05",
    time: "1:00 PM \u2013 4:00 PM",
    description:
      "Family-friendly planting session adding shade trees to a local primary school yard. Children welcome alongside a guardian.",
    spotsTotal: 30,
    spotsTaken: 9,
    ratings: [4, 5],
    tone: "moss",
  },
  {
    id: "evt-005",
    title: "Maidstone Wetlands Restoration",
    suburb: "Maidstone",
    date: "2026-10-12",
    time: "9:00 AM \u2013 12:30 PM",
    description:
      "Weeding and indigenous grass planting around the Maidstone wetlands to support frog and waterbird habitat.",
    spotsTotal: 35,
    spotsTaken: 21,
    ratings: [3, 4, 4, 5],
    tone: "ochre",
  },
  {
    id: "evt-006",
    title: "Yarraville Street Tree Blitz",
    suburb: "Yarraville",
    date: "2026-10-18",
    time: "9:30 AM \u2013 12:00 PM",
    description:
      "A street-by-street planting blitz aiming to lift local canopy cover ahead of summer. No experience necessary.",
    spotsTotal: 50,
    spotsTaken: 44,
    ratings: [5, 4, 4, 4, 5],
    tone: "forest",
  },
];
