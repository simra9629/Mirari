import type { Experience } from "./types";

export const experiences: Experience[] = [
  // Games
  { id: "last-firefly", title: "The Last Firefly", category: "games", description: "Carry the final source of light through a world gone dark.", status: "available", motif: "a single point of gold, moving", accent: "#FFD86B", route: "/experience/last-firefly" },
  { id: "orbit", title: "Orbit", category: "games", description: "Launch objects into stable — or spectacularly unstable — orbits.", status: "available", motif: "a curved trail around a dark planet", accent: "#5E8CFF", route: "/experience/orbit" },
  { id: "paper-city", title: "Paper City", category: "games", description: "Fold, rotate, and reconnect a city built from a single sheet.", status: "available", motif: "a city rising from a fold", accent: "#7FA0C9", route: "/experience/paper-city" },
  { id: "clockmaker", title: "The Clockmaker", category: "games", description: "Restore broken clocks with their own private, strange logic.", status: "available", motif: "a silent mechanism, beginning to turn", accent: "#B88A45", route: "/experience/clockmaker" },
  { id: "parcel", title: "Parcel", category: "games", description: "Plan routes and get strange deliveries where they need to go.", status: "available", motif: "a red parcel crossing a tiny map", accent: "#E64D4D", route: "/experience/parcel" },
  { id: "railway", title: "The Railway", category: "games", description: "Build a rail network across a landscape that grows with you.", status: "available", motif: "a train crossing a curved bridge", accent: "#C64C4B", route: "/experience/railway" },
  { id: "little-alchemist", title: "Little Alchemist", category: "games", description: "Combine fictional materials and see what happens.", status: "available", motif: "two substances colliding in glass", accent: "#F56FA8", route: "/experience/little-alchemist" },

  // Science
  { id: "stargazer", title: "Stargazer", category: "science", description: "Observe a real patch of night sky. Find what's actually there.", status: "available", motif: "a constellation, emerging from noise", accent: "#FFE29A", route: "/experience/stargazer" },
  { id: "planet-hunter", title: "Planet Hunter", category: "science", description: "Find planets the way astronomers really do — through evidence.", status: "available", motif: "a tiny repeating dip in the light", accent: "#5F9BFF", route: "/experience/planet-hunter" },
  { id: "moon", title: "Moon", category: "science", description: "Move the Earth, Moon, and Sun. Watch the phases make sense.", status: "available", motif: "the terminator, sliding across a sphere", accent: "#FFD36B", route: "/experience/moon" },

  // Puzzles
  { id: "lockmaker", title: "The Lockmaker", category: "puzzles", description: "Open an invented mechanism by understanding, not force.", status: "available", motif: "a dark case, opened to reveal color", accent: "#B8874E", route: "/experience/lockmaker" },
  { id: "ink", title: "Ink", category: "puzzles", description: "Guide liquid ink across a page to reveal what's hidden.", status: "available", motif: "one drop, becoming a landscape", accent: "#354D9B", route: "/experience/ink" },
  { id: "fold", title: "Fold", category: "puzzles", description: "A flat shape contains more possibilities than it shows you.", status: "available", motif: "a flat plane, folding impossibly", accent: "#5274D8", route: "/experience/fold" },
  { id: "signal", title: "Signal", category: "puzzles", description: "Pull a real pattern out of a field of noise.", status: "available", motif: "one clean pulse inside static", accent: "#58D7E8", route: "/experience/signal" },

  // Interactive art
  { id: "constellation", title: "Constellation", category: "interactive-art", description: "Draw your own relationships between points of light.", status: "available", motif: "a drawing made of light, briefly", accent: "#718DFF", route: "/experience/constellation" },
  { id: "rain", title: "Rain", category: "interactive-art", description: "Watch rain, redirect it, shelter what needs sheltering.", status: "available", motif: "a warm light through a wet window", accent: "#E1B76D", route: "/experience/rain" },
  { id: "fireflies", title: "Fireflies", category: "interactive-art", description: "A dark field, and hundreds of small independent lights.", status: "available", motif: "a landscape revealed by tiny lights", accent: "#E6F06C", route: "/experience/fireflies" },

  // Tiny worlds
  { id: "tidepool", title: "Tidepool", category: "tiny-worlds", description: "A whole ecosystem, inside one small pool of water.", status: "available", motif: "the tide, changing what's visible", accent: "#70C5C1", route: "/experience/tidepool" },
  { id: "ant-colony", title: "Ant Colony", category: "tiny-worlds", description: "Nudge a few ants. Watch the colony think.", status: "available", motif: "a city, hidden beneath the ground", accent: "#C98B3C", route: "/experience/ant-colony" },

  // History
  { id: "lighthouse", title: "The Lighthouse", category: "history", description: "Keep the light. Watch the sea. Respond to what approaches.", status: "available", motif: "one beam, crossing a violent sea", accent: "#F0C76A", route: "/experience/lighthouse" },
  { id: "ancient-observatory", title: "The Ancient Observatory", category: "history", description: "Track the sky the way people did before telescopes.", status: "available", motif: "an instrument, aligned with the sky", accent: "#E5A95D", route: "/experience/ancient-observatory" },

  // Experiments
  { id: "gravity-weaker", title: "What If Gravity Were Weaker?", category: "experiments", description: "Turn the dial down. Watch everything familiar go strange.", status: "available", motif: "a long, slow, wrong-feeling fall", accent: "#7C82FF", route: "/experience/gravity-weaker" },

  // Strange things
  { id: "serious-potato", title: "The Extremely Serious Potato", category: "strange", description: "A potato, treated with the gravity of a priceless artifact.", status: "available", motif: "one potato, lit like an artifact", accent: "#B99450", route: "/experience/serious-potato" },
  { id: "button", title: "Button", category: "strange", description: "There is one button. You are encouraged to press it.", status: "available", motif: "one button, an unreasonable amount of space", accent: "#7C82FF", route: "/experience/button" },
];

export const featuredIds = ["stargazer", "lockmaker", "fireflies"];
