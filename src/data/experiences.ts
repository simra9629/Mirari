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
  { id: "up", title: "Up!", category: "games", description: "Attach balloons to things and see if you can get them airborne.", status: "available", motif: "something ridiculous, slowly rising", accent: "#5AA8E0", route: "/experience/up" },
  { id: "dragon-school", title: "Dragon School", category: "games", description: "Train a young dragon through flight, fire, and precision lessons.", status: "available", motif: "a small dragon flying through a ring", accent: "#6FAE5A", route: "/experience/dragon-school" },
  { id: "fox-stars", title: "Fox & the Falling Stars", category: "games", description: "A fox in a quiet nocturnal landscape, collecting stars that change the rules of the world.", status: "available", motif: "a single star falling through the dark", accent: "#7C82FF", route: "/experience/fox-stars" },

  // Science
  { id: "stargazer", title: "Stargazer", category: "science", description: "Observe a real patch of night sky. Find what's actually there.", status: "available", motif: "a constellation, emerging from noise", accent: "#FFE29A", route: "/experience/stargazer" },
  { id: "planet-hunter", title: "Planet Hunter", category: "science", description: "Find planets the way astronomers really do — through evidence.", status: "available", motif: "a tiny repeating dip in the light", accent: "#5F9BFF", route: "/experience/planet-hunter" },
  { id: "moon", title: "Moon", category: "science", description: "Move the Earth, Moon, and Sun. Watch the phases make sense.", status: "available", motif: "the terminator, sliding across a sphere", accent: "#FFD36B", route: "/experience/moon" },
  { id: "star-detective", title: "Star Detective", category: "science", description: "Identify a mystery star from a sequence of comparative clues.", status: "available", motif: "one star, narrowed down by elimination", accent: "#5278D6", route: "/experience/star-detective" },
  { id: "solar-system", title: "Solar System", category: "science", description: "An orrery with real relative orbits. Click a planet to follow it.", status: "available", motif: "eight worlds, dancing around one light", accent: "#5F9BFF", route: "/experience/solar-system" },

  // Puzzles
  { id: "lockmaker", title: "The Lockmaker", category: "puzzles", description: "Open an invented mechanism by understanding, not force.", status: "available", motif: "a dark case, opened to reveal color", accent: "#B8874E", route: "/experience/lockmaker" },
  { id: "ink", title: "Ink", category: "puzzles", description: "Guide liquid ink across a page to reveal what's hidden.", status: "available", motif: "one drop, becoming a landscape", accent: "#354D9B", route: "/experience/ink" },
  { id: "fold", title: "Fold", category: "puzzles", description: "A flat shape contains more possibilities than it shows you.", status: "available", motif: "a flat plane, folding impossibly", accent: "#5274D8", route: "/experience/fold" },
  { id: "signal", title: "Signal", category: "puzzles", description: "Pull a real pattern out of a field of noise.", status: "available", motif: "one clean pulse inside static", accent: "#58D7E8", route: "/experience/signal" },
  { id: "archivist", title: "The Archivist", category: "puzzles", description: "Classify a collection of artifacts with no visible rule.", status: "available", motif: "two unrelated objects, quietly matching", accent: "#C8A968", route: "/experience/archivist" },
  { id: "impossible-room", title: "The Impossible Room", category: "puzzles", description: "Turn to look around. Something about this room doesn't add up.", status: "available", motif: "a doorway that leads back where you started", accent: "#6277D8", route: "/experience/impossible-room" },

  // Interactive art
  { id: "constellation", title: "Constellation", category: "interactive-art", description: "Draw your own relationships between points of light.", status: "available", motif: "a drawing made of light, briefly", accent: "#718DFF", route: "/experience/constellation" },
  { id: "rain", title: "Rain", category: "interactive-art", description: "Watch rain, redirect it, shelter what needs sheltering.", status: "available", motif: "a warm light through a wet window", accent: "#E1B76D", route: "/experience/rain" },
  { id: "fireflies", title: "Fireflies", category: "interactive-art", description: "A dark field, and hundreds of small independent lights.", status: "available", motif: "a landscape revealed by tiny lights", accent: "#E6F06C", route: "/experience/fireflies" },
  { id: "paper", title: "Paper", category: "interactive-art", description: "Fold it, crumple it, tear it. See what a sheet of paper does.", status: "available", motif: "one ordinary sheet, unexpectedly alive", accent: "#C7D1DF", route: "/experience/paper" },
  { id: "sound-garden", title: "Sound Garden", category: "interactive-art", description: "Touch each plant to add it to a living soundscape.", status: "available", motif: "a garden that blooms into sound", accent: "#61CED2", route: "/experience/sound-garden" },
  { id: "ink-garden", title: "Ink Garden", category: "interactive-art", description: "Touch the page. Watch a generative botanical form grow from it.", status: "available", motif: "ink, gradually becoming a garden", accent: "#9270B7", route: "/experience/ink-garden" },

  // Tiny worlds
  { id: "tidepool", title: "Tidepool", category: "tiny-worlds", description: "A whole ecosystem, inside one small pool of water.", status: "available", motif: "the tide, changing what's visible", accent: "#70C5C1", route: "/experience/tidepool" },
  { id: "ant-colony", title: "Ant Colony", category: "tiny-worlds", description: "Nudge a few ants. Watch the colony think.", status: "available", motif: "a city, hidden beneath the ground", accent: "#C98B3C", route: "/experience/ant-colony" },
  { id: "weather", title: "Weather", category: "tiny-worlds", description: "Sliders for temperature, wind, and moisture. Watch a whole sky respond.", status: "available", motif: "a small landscape under a changing sky", accent: "#83BFE5", route: "/experience/weather" },
  { id: "city", title: "City", category: "tiny-worlds", description: "Draw roads and parks. Buildings decide for themselves how to grow.", status: "available", motif: "a settlement, growing a personality of its own", accent: "#C9A15A", route: "/experience/city" },
  { id: "ecosystem", title: "Ecosystem", category: "tiny-worlds", description: "Plants, herbivores, and predators. Watch what a few simple rules do.", status: "available", motif: "a population, rising and crashing on its own", accent: "#8FAE7A", route: "/experience/ecosystem" },
  { id: "island", title: "Island", category: "tiny-worlds", description: "Plant seeds, bring the rain. Watch a barren island turn into a forest.", status: "available", motif: "a bare shape, slowly becoming a world", accent: "#7FA85F", route: "/experience/island" },
  { id: "aquarium", title: "Aquarium", category: "tiny-worlds", description: "A small schooling-fish tank you can feed and light.", status: "available", motif: "a glass world, alive without asking for attention", accent: "#4EABB2", route: "/experience/aquarium" },
  { id: "bug-hotel", title: "Bug Hotel", category: "tiny-worlds", description: "Build a hotel in an old tree. Then wait, and see what moves in.", status: "available", motif: "a tiny living world, disguised as a management game", accent: "#B7C26A", route: "/experience/bug-hotel" },
  { id: "witch-delivery", title: "The Witch's Delivery Service", category: "games", description: "Pick up a package. Fly it across a small, lively town. Something will go wrong, charmingly.", status: "available", motif: "a tiny magical adventure generator, disguised as a delivery game", accent: "#F2B45A", route: "/experience/witch-delivery" },

  // History
  { id: "lighthouse", title: "The Lighthouse", category: "history", description: "Keep the light. Watch the sea. Respond to what approaches.", status: "available", motif: "one beam, crossing a violent sea", accent: "#F0C76A", route: "/experience/lighthouse" },
  { id: "ancient-observatory", title: "The Ancient Observatory", category: "history", description: "Track the sky the way people did before telescopes.", status: "available", motif: "an instrument, aligned with the sky", accent: "#E5A95D", route: "/experience/ancient-observatory" },
  { id: "the-clock", title: "The Clock", category: "history", description: "The same moment, read from a shadow, a vessel, and a set of gears.", status: "available", motif: "four devices, all measuring one moment", accent: "#B88A45", route: "/experience/the-clock" },
  { id: "the-code", title: "The Code", category: "history", description: "Explore a substitution cipher wheel and Morse code, side by side.", status: "available", motif: "a message, hidden in plain structure", accent: "#6288D7", route: "/experience/the-code" },
  { id: "silk-road", title: "The Silk Road", category: "history", description: "Send a good outward from any city. Watch it move through the network.", status: "available", motif: "a network, lighting up city by city", accent: "#D5AD52", route: "/experience/silk-road" },
  { id: "printing-press", title: "The Printing Press", category: "history", description: "Compose reversed type in order, then press it to see it come out right.", status: "available", motif: "letters, backward, until the moment they aren't", accent: "#9B4A43", route: "/experience/printing-press" },
  { id: "cartographer", title: "The Cartographer", category: "history", description: "Build a map from reports arriving one at a time. Every choice is an interpretation.", status: "available", motif: "a blank page, filling in from secondhand reports", accent: "#8FAFBD", route: "/experience/cartographer" },

  // Experiments
  { id: "gravity-weaker", title: "What If Gravity Were Weaker?", category: "experiments", description: "Turn the dial down. Watch everything familiar go strange.", status: "available", motif: "a long, slow, wrong-feeling fall", accent: "#7C82FF", route: "/experience/gravity-weaker" },
  { id: "time-reversed", title: "What If Time Could Be Reversed?", category: "experiments", description: "Scrub a broken cup's timeline forward or backward, freely.", status: "available", motif: "shards, gathering themselves back together", accent: "#7C82FF", route: "/experience/time-reversed" },
  { id: "earth-spin", title: "What If Earth Rotated Twice as Fast?", category: "experiments", description: "Turn up the rotation speed. Watch the days get shorter.", status: "available", motif: "a sky, cycling faster than it should", accent: "#5F9BFF", route: "/experience/earth-spin" },
  { id: "moon-disappeared", title: "What If the Moon Disappeared?", category: "experiments", description: "Remove the Moon. Watch the sky and the tides respond.", status: "available", motif: "a night sky with one impossible absence", accent: "#7C82FF", route: "/experience/moon-disappeared" },
  { id: "sound-speed", title: "What If Sound Traveled Faster?", category: "experiments", description: "Clap. Watch a wavefront, its echo, and when each listener hears it.", status: "available", motif: "a ring of sound, catching up to itself", accent: "#7C82FF", route: "/experience/sound-speed" },
  { id: "plants-move", title: "What If Plants Could Move?", category: "experiments", description: "Drag the sun and water. Watch three kinds of plants react — one flees.", status: "available", motif: "a garden, quietly rearranging itself", accent: "#7FAE7A", route: "/experience/plants-move" },

  // Strange things
  { id: "serious-potato", title: "The Extremely Serious Potato", category: "strange", description: "A potato, treated with the gravity of a priceless artifact.", status: "available", motif: "one potato, lit like an artifact", accent: "#B99450", route: "/experience/serious-potato" },
  { id: "button", title: "Button", category: "strange", description: "There is one button. You are encouraged to press it.", status: "available", motif: "one button, an unreasonable amount of space", accent: "#7C82FF", route: "/experience/button" },
  { id: "the-sock", title: "The Sock", category: "strange", description: "Play as a sock, feeling your way through the dark to find your other half.", status: "available", motif: "one small shape, searching a lightless maze", accent: "#8FA6C9", route: "/experience/the-sock" },
  { id: "pigeon-simulator", title: "Pigeon Simulator", category: "strange", description: "Live the important, demanding life of a plaza pigeon.", status: "available", motif: "one bird, taking a bench it has no right to", accent: "#8B93A3", route: "/experience/pigeon-simulator" },
  { id: "cat", title: "Cat", category: "strange", description: "You don't control the cat. You can only suggest things.", status: "available", motif: "a box, and a cat that has already decided", accent: "#DFAE6B", route: "/experience/cat" },
  { id: "bureaucracy-simulator", title: "The Bureaucracy Simulator", category: "strange", description: "One simple task. An escalating, ridiculous number of requirements.", status: "available", motif: "a single stamp, guarded by ten other things", accent: "#4E6E91", route: "/experience/bureaucracy-simulator" },
];

export const featuredIds = ["stargazer", "lockmaker", "fireflies"];
