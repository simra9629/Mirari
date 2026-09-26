export interface Planet {
  name: string;
  color: string;
  orbitRadius: number; // visual, not to scale
  periodDays: number; // real orbital period
  dotRadius: number; // visual, roughly relative
  fact: string;
}

export const PLANETS: Planet[] = [
  { name: "Mercury", color: "#9a938a", orbitRadius: 34, periodDays: 88, dotRadius: 2.6, fact: "A year here lasts 88 Earth days." },
  { name: "Venus", color: "#e0b877", orbitRadius: 48, periodDays: 225, dotRadius: 4, fact: "Spins backward, and so slowly that its day is longer than its year." },
  { name: "Earth", color: "#5f9bff", orbitRadius: 64, periodDays: 365.25, dotRadius: 4.2, fact: "The only planet here with one large moon and a lot of water." },
  { name: "Mars", color: "#c1583f", orbitRadius: 82, periodDays: 687, dotRadius: 3, fact: "Home to Olympus Mons, the tallest volcano in the solar system." },
  { name: "Jupiter", color: "#d9a066", orbitRadius: 112, periodDays: 4333, dotRadius: 9, fact: "So massive that it and the Sun orbit a point just outside the Sun's surface." },
  { name: "Saturn", color: "#e8d9a8", orbitRadius: 142, periodDays: 10759, dotRadius: 8, fact: "Its rings are made of ice and rock, and are barely 10 meters thick in places." },
  { name: "Uranus", color: "#8fd6e0", orbitRadius: 168, periodDays: 30687, dotRadius: 6, fact: "Rotates on its side — its axis points almost directly at the Sun." },
  { name: "Neptune", color: "#4a6fd6", orbitRadius: 190, periodDays: 60190, dotRadius: 5.8, fact: "Has the fastest winds recorded in the solar system, over 2,000 km/h." },
];
