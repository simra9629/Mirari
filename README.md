# Mirari

A curated collection of small interactive wonders — games, puzzles,
simulations, interactive art, and stranger things — each one a small
world worth interacting with.

**42 experiences are built now**, out of the 51 described across the
project's full concept doc. The archive shell (the dark, spacious
homepage that every experience lives inside) has no "coming soon"
cards — every card here is playable.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## What's here

```
src/
├── archive/            The archive itself
│   ├── Home.tsx          Homepage — "the field of discoveries"
│   └── NotFound.tsx
│
├── experiences/         Every experience is its own isolated module
│   ├── stargazer/          An endless, procedurally generated campaign across all 88 constellations
│   │   └── constellations.ts, campaign.ts, placement.ts
│   ├── lockmaker/          Ten procedurally-generated lock mechanism types
│   ├── fireflies/          A dark field of light that follows your cursor
│   ├── ant-colony/         An emergent ant/pheromone simulation
│   ├── gravity/            A physics sandbox — drop things, change the pull
│   ├── orbit/              Real two-body gravity — launch, don't crash
│   ├── lighthouse/         Aim a beam, watch ships find their way
│   ├── button/             There is one button
│   ├── tidepool/           A tide that rises and falls on its own
│   ├── last-firefly/       A real generated maze, lit only near you
│   │   └── maze.ts           Recursive-backtracker maze generator
│   ├── paper-city/         Rotate city blocks until every road connects
│   ├── clockmaker/         One key, several gears, fixed ratios
│   ├── parcel/             Plan a route: pickup, then dropoff
│   ├── railway/            An endless, turn-based track-building game
│   ├── little-alchemist/   Property-based reaction engine, not a recipe table
│   │   └── engine.ts          States, properties, rules, lab stage progression
│   ├── ink/                A limited ink budget, a hidden shape to reveal
│   ├── fold/               A strip of panels, folded in half repeatedly
│   ├── signal/             Tune a dial until static resolves into a pattern
│   ├── planet-hunter/      Find the repeating dip in a noisy light curve
│   ├── moon/               Drag the Moon around its orbit, watch phases follow
│   ├── star-detective/     Comparative clues narrow down one mystery star
│   ├── constellation-art/  Draw your own connections between stars — they fade
│   ├── rain/               Wipe a fogged window; the fog always comes back
│   ├── ancient-observatory/ Move the sun, read the time from a shadow
│   ├── serious-potato/     A potato, exhibited with total institutional gravity
│   ├── archivist/          Classify artifacts by a rule that's never shown
│   ├── impossible-room/    Four viewpoints of a room that can't be consistent
│   ├── paper/              Fold, crumple, and tear one sheet of paper
│   ├── sound-garden/       Touch plants, pentatonic notes, a living soundscape
│   ├── the-clock/          One moment, read from a shadow, a vessel, and gears
│   ├── the-code/           A cipher wheel and Morse code, side by side
│   ├── weather/            Five controls shaping a small procedural sky
│   ├── time-reversed/      Scrub a shattering cup's timeline either direction
│   ├── the-sock/           Play a sock, feeling through the dark for its match
│   │   └── maze.ts           Its own independent maze generator
│   ├── pigeon-simulator/   Walk, eat crumbs, flee dramatically, sit somewhere odd
│   ├── solar-system/       An orrery with real relative orbital periods
│   ├── ink-garden/         Touch the page, grow a procedural botanical form
│   ├── silk-road/          Click any city, watch a good move through the network
│   ├── city/               Draw roads; buildings decide for themselves how to grow
│   ├── earth-spin/         Turn up rotation speed, watch the day compress
│   ├── moon-disappeared/   Toggle the Moon, watch the sky and tides respond
│   └── cat/                You suggest things; the cat decides
│
├── components/          Shared archive-level UI
│   ├── Logo.tsx                 The signature mark + wordmark
│   ├── ExperiencePreview.tsx    The card used on the homepage
│   ├── ExperienceLayout.tsx     Shared chrome (back button, title) for experience pages
│   └── Starfield.tsx            The quiet drifting-stars backdrop
│
├── data/
│   ├── types.ts          Experience & category metadata shape
│   ├── categories.ts
│   └── experiences.ts    The catalogue — add a row here to add a card to the homepage
│
├── styles/
│   ├── variables.css     Color system, type system (from the visual identity doc)
│   └── globals.css       Reset + base styles, focus states, reduced-motion
│
└── App.tsx               Routes — every experience is React.lazy-loaded,
                            so the initial bundle only carries the archive
                            shell plus whichever experience you actually open
```

## Philosophy: generated, not hand-built

Wherever it's possible, content is generated by a system rather than
authored level-by-level:

- **Stargazer** — no fixed level list; `campaign.ts` generates field
  size, distractor count, which of the 88 constellations appear, and
  the prompt text purely from the level number.
- **The Lockmaker** — ten mechanism types, all produced by one seeded
  generator function; every type gets harder every time it recurs.
- **The Last Firefly** / **Paper City** — share one recursive-
  backtracker maze/spanning-tree generator, used for two unrelated
  puzzles (real-time exploration vs. rotate-to-connect).
- **Little Alchemist** — no recipe table at all. Materials carry a
  state and a set of properties; general rules match on those
  properties (`hot + flammable → Ash` fires for *any* qualifying
  pair). A catch-all rule generates a name/description/color for
  anything that doesn't hit a named rule, so nearly every combination
  succeeds — verified directly: 595 out of 595 possible pairs among
  the first 35 discovered materials.
- **Coordinate hashing** (Railway's terrain, Ant Colony's
  pheromones) — deterministic coordinate hashing instead of stored
  maps, so the same "world" holds together at any scale or position
  without needing to remember it.
- **Seed hashing** — every seeded generator in the project shares one
  `makeRng` (a small LCG), fed through an integer hash first. A plain
  LCG's very first output is a smooth function of the seed, so a
  sequence of related seeds (`level * k + c`, as most generators use)
  would otherwise produce long runs of near-identical early results —
  this was a real bug in The Archivist, where it made the puzzle's
  hidden rule "color" far more often than the other options. Hashing
  the seed first fixes it everywhere at once.

The exceptions are the places where the *content itself* has to be a
creative decision — Little Alchemist's rules, each puzzle's fact
text, Little Alchemist's laboratory-stage flavor lines. Systems are
generated; specific meaning is still written.

## The 42 experiences

**Stargazer** — an endless, generated campaign across all 88 named
constellations, with "spot the planet" rounds mixed in.

**The Lockmaker** — ten mechanism types (Pin Tumbler, Lever Lock,
Wafer Tumbler, Disc Detainer, Combination Dial, Warded Lock, Tubular
Lock, Wheel Combination, Magnetic Lock, Electronic Keypad),
procedurally generated and increasingly complex.

**Fireflies** — no objective. A canvas field of ~120 small lights
that wander on their own and follow your cursor.

**Ant Colony** — click to drop food; ants find it and lay a trail
back to the nest that other ants sense and reinforce.

**Weather** — five controls — temperature, wind, moisture, time of
day, and pressure — drive a procedural sky: a sun or moon on a real
arc, stars at night, drifting clouds, rain or snow, ground-level fog,
distant hills, and lightning during genuine low-pressure storms, all
generated live from those five numbers rather than preset "modes."

**City** — a procedurally-generated river runs through every city now;
bridge it with roads. Beyond roads and parks, a civic plaza boosts
growth in a wider radius, and factories boost it sharply nearby but
cap what grows next to them at two stories. Buildings are rendered
with real shading and lit edges instead of flat squares, and a
jobs-vs-population readout tells you which way people are commuting.

**What If Gravity Were Weaker?** — drag a slider from 0.5 to 30 m/s²,
drop balls, watch the physics respond live.

**What If Time Could Be Reversed?** — three deterministic timelines,
frame by frame: a cup falling and shattering, rain landing in a
puddle, footprints appearing in sand. Scrub or hit play in either
direction — everything runs backward for free, because "reversed" is
just the same recorded motion read the other way.

**What If Earth Rotated Twice as Fast?** — a rotation-speed slider
(1–6×) compresses the day/night cycle in real time, with a running
clock and day counter, and escalating captions distinguishing the
simplified visual from what actually spinning a planet that fast
would do.

**What If the Moon Disappeared?** — a single toggle drives two linked
views at once: a night sky where removing the Moon genuinely reveals
more faint stars (less moonlight washing them out), and a tide gauge
whose swing visibly weakens without it, since the Sun alone still
raises a much smaller tide.

**Orbit** — drag and release to launch a body around a fixed planet
under real inverse-square gravity.

**The Lighthouse** — drag to aim a beam at ships crossing the sea;
hold it on one long enough and it's "guided." No fail state.

**Tidepool** — the tide rises and falls on its own; crabs come out
onto the exposed rocks at low tide and duck away as the water
returns.

**The Last Firefly** — a real maze, generated fresh each level via
recursive backtracking. Your light only reaches so far; the goal is
a faint, barely-visible glimmer somewhere out in the dark.

**Paper City** — a grid of road tiles, scrambled to random rotations.
Click to rotate a tile 90°; a road lights gold exactly when both
sides of a shared edge connect. Reuses The Last Firefly's maze
generator for a completely different puzzle.

**The Clockmaker** — a gear train where one shared control drives
every gear at its own fixed ratio. You can't set any gear directly —
only find the turn count where all of them land on target at once.

**Parcel** — plan a delivery route on an open grid: click adjacent
cells to build a path, reach the pickup before the dropoff counts.
Obstacle layouts are verified solvable via a real BFS check.

**The Railway** — no fixed destination — pick between two
randomly-offered track pieces each turn and the track just keeps
growing, through procedurally-named towns every few pieces.

**Little Alchemist** — a genuine property-based reaction engine (see
below), with environmental conditions, a discovery journal, and a
laboratory that progresses through 7 stages as you discover more.

**Ink** — a hidden shape (blob, ring, or zigzag, depending on level)
sits under a blank grid; a shrinking budget of ink drops reveals it.

**Fold** — a real strip-folding simulation. A row of panels halves
with every fold; every target is brute-force verified achievable.

**Signal** — one slider, a grid of pure static. Four different hidden
pattern types (rings, grid, spiral, stripes) resolve as you tune in.

**The Archivist** — every artifact shows two visible traits at first
(a colour and a symbol), a third (size) joining from case 3 onward;
only one is the real rule that determines a match, and it's never
labeled which. Testing pairs and remembering the results is how you
actually deduce it — a genuine, fair logic puzzle, not a
memory-guessing game with a random label slapped on afterward.

**The Impossible Room** — turn through four hand-authored viewpoints
of the same room, hunting for details only visible from one specific
angle each. Later cases add anomalies that don't even exist yet —
a ceiling crack that only opens up once you've found the mirror — and
a decoy or two that lead nowhere. Find everything real and a door
that wasn't there opens, leading back into the room, exactly as it
should.

**Planet Hunter** — a real light curve, mostly noise, with a genuine
periodic dip pattern and several decoy one-off dips that don't
repeat — the actual transit method astronomers use.

**Moon** — drag the Moon around its orbit; two linked views (a
top-down diagram and what you'd see from Earth) are driven by one
shared, mathematically-correct phase calculation.

**Star Detective** — a field that grows from 9 to 24 stars as cases
progress, with three comparative clue types now (colour, motion, and
brightness rank) that always narrow to exactly one target — genuine
deduction, not a lucky guess. Later cases ask you to identify two or
three separate targets from the same field before the case closes.

**Solar System** — an orrery with all eight planets on their real
relative orbital periods (Mercury visibly laps Neptune many times
over), a 0–20× speed control, and click-to-follow with a fact panel
per planet.

**Constellation** — drag between stars to connect them into whatever
shape you want. No right answer, and every line fades after a while.

**Rain** — rain falls past a fogged window with warm light behind
it; drag to wipe a clear streak. The fog slowly returns on its own.

**Paper** — a single sheet you can fold in two directions, crumple,
and tear repeatedly, rendered as real SVG geometry rather than a
texture swap — each tear splits off another genuinely separate,
jagged-edged piece (up to four), and "Flatten" smooths the sheet back
to full size but leaves faint ghost creases and a permanent residual
wrinkle behind — paper remembers.

**Sound Garden** — three plant voices now: low reeds (sine pads),
mid-range flowers (triangle plucks), and bright bells (a detuned
sine pair), all drawn from the same pentatonic scale so nothing can
sound wrong together. Touching one sends a real expanding ripple out
from your finger, fireflies drift through the dark, and an ambient
hum can be left running underneath everything.

**Ink Garden** — the one experience that isn't dark: a paper-cream
page, exactly per the design doc's own palette for it. Every touch
picks from five genuinely different growth archetypes — a small
sprout, a shrub, a tall tree, a dense thicket, a drooping vine — each
with its own depth, branch count, and lean, so the page doesn't fill
up with the same plant over and over.

**The Ancient Observatory** — drag the sun across the sky and read
the time from a gnomon's shadow — the same geometry a real sundial
uses, including the shadow lengthening near dawn and dusk.

**The Clock** — one shared, scrubbable time-of-day drives four tabs
at once: a gnomon's shadow, a draining water vessel, an analog gear
face, and a plain digital readout — the same moment, translated
through four different eras of measuring it.

**The Code** — a Caesar-cipher wheel with a real rotating inner ring
(shift the wheel, watch your message re-encode live); a Morse tab
that blinks your message on an actual lamp with a real synced telegraph
beep, timed to real dot/dash/gap durations; and a third tab with an
invented symbol cipher — 26 unambiguous glyphs, each a generated
combination of a frame and a dot.

**The Silk Road** — click any of eight historical trade cities and
watch a good ripple outward across the whole network, city by city,
each hop timed to the real pixel distance of that route. Goods
accumulate visibly at every city they pass through.

**The Extremely Serious Potato** — a potato, spotlit on a pedestal
behind a velvet rope, with an absurdly self-serious museum placard.
Click it for another line; drag it to turn it.

**Button** — there is one button. Pressing it does nothing, in a
different way each time, drawn from a shuffled bank of reactions.

**The Sock** — an actual maze-crawler, but a sock doesn't give off
light, so the mechanic is different: you feel your way by touch
(walls stay in memory once you've bumped into them) and by static
cling, which builds the closer you get to your other half — a real
"getting warmer" signal computed from actual maze distance, not
straight-line distance. Find it, and the next drawer is a little
bigger.

**Pigeon Simulator** — free-roam a small plaza as a pigeon: claim
crumbs, flee dramatically (and briefly, and uncontrollably) whenever
a patrolling pedestrian gets too close, and sit wherever a pigeon has
no business sitting.

**Cat** — an autonomous cat with its own mood (napping, curious,
playful, aloof) that changes on its own timer regardless of you, and
a strong, weighted preference for the box over everywhere else — if
it fits, it sits. Expression and ear posture change with mood, a
successful pet leaves it briefly content with its eyes closed, and
you can skip the buttons entirely and just click the cat itself.

All continuous simulations (Fireflies, Ant Colony, Gravity, Orbit,
The Lighthouse, Tidepool, The Last Firefly, The Railway, Signal,
Constellation, Rain, Weather, The Sock, Sound Garden, Pigeon
Simulator, Star Detective, Solar System, Silk Road, Earth Spin, Moon
Disappeared, Cat, Ink Garden, City) respect `prefers-reduced-motion`
by freezing ongoing/animated movement.

## Little Alchemist, in more detail

Every material has a `state` (solid, liquid, gas, powder, organic,
crystalline, energy) and a set of `properties` (hot, cold, wet, dry,
organic, celestial, flammable, and so on). Reactions are resolved by
general rules matching on those properties — "anything celestial +
anything else → a lunar variant of it" is one rule that produces
Lunar Ember, Lunar Tide, Lunar Frost, and more, the same way it would
in the design doc's own headline example.

Four environmental conditions (Heat, Cool, Grind, Wait) inject their
own property into the mix before any rule runs, so the same two
materials can produce different results — Tide + Root normally makes
Moss, but under Heat it makes Ash instead. Wait only does something
when paired with something celestial or luminous (a one-off rule
produces "Yesterday"); otherwise it's inert, so it's worth actually
discovering rather than a fourth default choice.

The interaction model is deliberately close to neal.fun's *Infinite
Craft*: an open bench rather than fixed slots. Drag any discovered
material up from the shelf and drop it anywhere on the bench; drag
one bench item onto another to combine them (or tap one, then tap a
second, if dragging is awkward on your device). A result pops the two
inputs into whatever they made, with a toast announcing it — "New
discovery" the first time, no badge on repeats. Every material has an
emoji (base ones hand-picked, generated ones derived from whichever
property drove the name), so the bench reads at a glance the way
Infinite Craft's does, rather than needing colored swatches.

The laboratory itself progresses through 7 named stages tied to
discovery count (Workbench → Furnace → Grinding Table → Greenhouse →
Advanced Apparatus → Astronomical Wing → The Impossible Wing), and
the four conditions unlock gradually alongside it rather than all
being available on day one. A discovery journal lists every material
grouped by how many reactions removed it is from the base 8, each
with the specific pair that first produced it.

This is the one place that's an exception to "generated, not
hand-built" in that the *rules* were designed by hand — the
materials, names, and outcomes are genuinely generated by those
rules at runtime, not looked up in a table.

## Visual identity

Implements the palette and type system from the project's art direction:

- **Background** — Void Navy `#070A12` → Deep Midnight `#0B1020` → Abyss Blue `#111A30`
- **Signature accent** — Mirari Periwinkle `#7C82FF`, used sparingly
- **Display type** — Space Grotesk · **Body** — IBM Plex Sans · **Data/labels** — IBM Plex Mono
- **Logo** — `components/Logo.tsx`: a small orbiting mark paired with a gradient wordmark.

The archive stays dark and restrained; each *experience* brings its
own palette. Cards on the homepage show category only — no estimated
duration; that field was dropped from the `Experience` type entirely.

## Adding a new experience

1. Create `src/experiences/<slug>/` with its own component, styles, and data.
2. Add a row to `src/data/experiences.ts` — set `status: "available"`
   and a `route` once it's playable.
3. Add a `<Route>` for it in `src/App.tsx`.

There's no catalogue row left with `status: "coming-soon"` right now
— any new experience is a genuinely new addition, not filling in a
gap.

## Not built yet

This slice deliberately stops short of the full original spec, which
describes 51 experiences across 8 categories. 42 are built —
Interactive Art and Puzzles are both complete. The rest, by category:

- **Science** — Deep Field.
- **History & Culture** — The Printing Press, The Cartographer.
- **Tiny Worlds** — Ecosystem, Island, Aquarium.
- **Experiments** — What If Sound Traveled Faster?, What If Plants
  Could Move?
- **Strange Things** — The Bureaucracy Simulator.

Beyond the catalogue itself:

- No page-transition choreography per experience (section 11 of the
  visual identity doc — each experience entering/exiting its own
  way). Currently a plain route change.
- No audio system wired up yet.
- No backend — everything is static/frontend-only for now.
- Little Alchemist doesn't yet have the fully illustrated physical
  laboratory environment (hand-painted textures, GSAP animation,
  Web Audio) described in its design doc — the property-based
  engine, conditions, journal, and stage progression are built; the
  art direction is a lighter, scoped pass rather than full production.
