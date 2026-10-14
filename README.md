# Mirari

A curated collection of small interactive wonders — games, puzzles,
simulations, interactive art, and stranger things — each one a small
world worth interacting with.

**55 experiences are built now** — every experience in the project's
full concept doc except Deep Field. The archive shell (the dark,
spacious homepage that every experience lives inside) has no "coming
soon" cards — every card here is playable.

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

The archive is a plain static site. There is also an *optional* tiny
server (no dependencies) that adds progress sync and visit counts, and
serves the built site — see [Archive systems](#archive-systems) below.

```bash
npm run server    # API (+ dist/ if built) on http://localhost:8787
npm start         # build, then serve everything from one process
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
│   ├── up/                 Attach balloons to things and see if you can get them airborne
│   ├── dragon-school/      Train a young dragon through flight, fire, and precision lessons
│   ├── fox-stars/          A fox in a quiet nocturnal landscape, collecting stars that change the rules
│   ├── bug-hotel/          A miniature ecosystem simulation inside an old tree
│   │   └── data.ts, engine.ts, render.ts, audio.ts
│   ├── witch-delivery/     A magical flying arcade game — a courier witch in a compact town
│   │   └── data.ts, world.ts, engine.ts, render.ts, audio.ts
│   ├── little-alchemist/   Property-based reaction engine, plus the painted lab (lab/)
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
│   ├── cat/                You suggest things; the cat decides
│   ├── printing-press/     Compose reversed type, press it to read it right
│   ├── cartographer/       Build a map as reports arrive, one at a time
│   ├── ecosystem/          Plants, herbivores, predators — real population swings
│   ├── island/             Plant seeds, bring rain, watch a forest spread on its own
│   ├── aquarium/           A small schooling-fish tank you can feed and light
│   ├── sound-speed/        A wavefront, its echo, and when each listener hears it
│   ├── plants-move/        Drag the sun and water; one kind of plant flees danger
│   └── bureaucracy-simulator/ One stamp, guarded by an escalating number of forms
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
├── components/          Shared shell: ExperienceLayout, Logo, ExperiencePreview,
│   │                      Transition (per-experience page transitions),
│   │                      SoundControl (master volume), SyncPanel (progress backup)
├── lib/
│   ├── audio.ts          The shared audio system: master volume / mute, interface sounds
│   ├── sync.ts           Optional progress sync (inert without the server)
│   └── rng.ts
│
├── styles/
│   ├── variables.css     Color system, type system (from the visual identity doc)
│   └── globals.css       Reset + base styles, focus states, reduced-motion
│
└── App.tsx               Routes — every experience is React.lazy-loaded,
                            so the initial bundle only carries the archive
                            shell plus whichever experience you actually open

server/                  The optional backend (progress sync, visit counts, static hosting)
scripts/                 Headless checks: bughotel-sim.ts, witch-sim.ts, audio-routing-check.ts, sync-test.ts
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

## The 55 experiences

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

**City** — a procedurally-generated river runs through every city;
bridge it with roads. Roads, parks, a plaza, a school, a hospital,
and factories each shape growth differently nearby — schools and
hospitals specifically raise the odds nearby buildings upgrade rather
than sparking new ones, factories cap what grows next to them at two
stories, and commercial buildings (a second source of jobs, alongside
factories) cluster more near the plaza. The grid itself has no fixed
edge — it expands outward on its own once building or road reaches
close to its current boundary, so a city really can grow without end.

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

**What If Sound Traveled Faster?** — clap, and a real wavefront
expands outward at a speed you control; three listeners flash and
log an arrival time as it reaches them, and a wall reflects it back
as a genuine second, later arrival — an actual echo, not a sound
effect. Push the speed near-instant and the two arrivals collapse
into one, exactly as they should.

**What If Plants Could Move?** — drag a sun and a water droplet
around a small garden; sun-seeking and water-seeking plants slowly
creep toward whichever you moved. Click anywhere else to place a
danger marker, and the skittish plants scatter — remove it and they
drift back, slowly.

**Tidepool** — the tide rises and falls on its own; crabs come out
onto the exposed rocks at low tide and duck away as the water
returns.

**Ecosystem** — a real, if tiny, food web: plants regrow based on
sunlight and rainfall sliders, herbivores that eat them reproduce or
starve, predators that eat the herbivores do the same. Nothing is
scripted to crash or stabilize — it just does, out of the same dozen
rules every time.

**Island** — starts barren. Click bare land to plant a seed; from
there, growth spreads to neighboring land on its own, faster with
rain toggled on, through four visible stages from sand to full
forest. Birds arrive once enough of the island is green.

**Aquarium** — ten to twenty fish with real flocking behavior
(cohesion, separation, alignment) in a lit tank; click to drop food
and the nearest fish peel off to eat it, drag the light slider and
the whole tank's mood shifts with it.

**Orbit** — drag and release to launch a body around a fixed planet
under real inverse-square gravity.

**The Lighthouse** — drag to aim a beam at ships crossing the sea;
hold it on one long enough and it's "guided." No fail state.

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

**The Printing Press** — every letter shows reversed, the way real
type had to sit in the frame; click them in reading order into the
composing stick, and only once you press the page does it come out
correctly oriented.

**The Cartographer** — reports arrive one at a time ("mountains rise
in the north," "a river runs to the sea") and each unlocks a feature
you place yourself. Nothing is graded — the point is that someone
else, working from the same reports, would have drawn a different
map entirely.

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

**The Bureaucracy Simulator** — one task ("obtain a stamp") behind
ten escalating requirements, some with a fake processing queue for
comedic effect. Push far enough into the absurdity and a quiet
shortcut appears for anyone who goes looking for one.

**Up!** — attach balloons to things and see if you can get them
airborne.

**Dragon School** — train a young dragon through flight, fire, and
precision lessons.

**Fox & the Falling Stars** — a fox in a quiet nocturnal landscape,
collecting stars that change the rules of the world.

**Bug Hotel** — a tiny living world disguised as a management game.
You furnish a hotel inside an old tree — bark, twigs, leaves, stones,
flowers, seeds, water, shade, lanterns — and then wait to see what
moves in. There is no score. 25 species arrive, feed, shelter, hide,
breed, hunt, flee, build webs, run hives and colonies, pupate, and
leave if they're uncomfortable; all of it generated from species
*properties* (preferred warmth, humidity and light, food, shelter,
activity period, predators) rather than scripted per creature. The tree
opens up over six stages as you discover species; day, night, seasons
and weather (rain, heat, cold, wind, storm) change the habitat. A field
journal fills in only as you look closely — zoom into a chamber, follow
a creature, watch it at different hours — and rare and strange species
show as "Unknown…" with a hint until properly identified. Rare events
(Moth Night, Glowworm Bloom, Living Moss, the Golden Beetle, the
Impossible Visitor) need specific conditions. Simulation and rendering
are separate layers (`engine.ts` is pure TypeScript with no DOM, and is
exercised headlessly by `scripts/bughotel-sim.ts`). Keyboard, reduced
motion, species marks (outlines + two-letter codes, so nothing depends
on colour) and optional procedural sound are built in; progress is
saved automatically.

**The Witch's Delivery Service** — a magical flying arcade game. You're
a young courier witch in a compact, side-scrolling town of six districts
(Old Town, Riverside, Witchwood, University District, Hill District,
Harbor). Pick up a package, fly it to its destination, deliver it —
except the package is the source of the gameplay. 22 packages, each its
own bit of play: a cake that melts (and is upside down if you spin), a
singing teapot that attracts birds, a sleeping cloud you must not wake,
an invisible umbrella that only opens in rain, a box of frogs that
escape, a pocket thunderstorm, a dragon egg that can hatch on your hat,
a parcel trying to get back to its sender — and, later, a bottled
dream, a shadow that pulls you down, Yesterday (your controls arrive a
moment late), a miniature ocean that sloshes, a lost reflection that
moves against you, a cloud that refuses to be delivered, and a box
larger than its box. Weather (rain, wind, fog, snow, thunderstorm,
magical storm) changes during a delivery. Routes matter — street level,
rooftops, river, forest, underground tunnels, high air and Cloud Lane —
and shortcuts (the Clocktower, the Great Chimneys, the Witch Path wind
tunnel) reward exploring. Failure is playful: birds steal the parcel for
a few seconds, you land in a fountain, the cake arrives upside down.
Progression is the delivery service growing: new districts, customers,
packages, weather, six broom upgrades that change *how* you fly, and
seven secrets (none required). Controls are keyboard (WASD/arrows,
Shift boost, Space chime), pointer (hold to fly toward it) or touch.
Headless autopilot tests (`scripts/witch-sim.ts`) deliver every package
and fly every pickup/drop-off pair.

All continuous simulations (Fireflies, Ant Colony, Gravity, Orbit,
The Lighthouse, Tidepool, The Last Firefly, The Railway, Signal,
Constellation, Rain, Weather, The Sock, Sound Garden, Pigeon
Simulator, Bug Hotel, The Witch's Delivery Service, Star Detective, Solar System, Silk Road, Earth Spin, Moon
Disappeared, Cat, Ink Garden, City, Ecosystem, Island, Aquarium,
Plants Could Move) respect `prefers-reduced-motion` by freezing
ongoing/animated movement. What If Sound Traveled Faster? is the one
exception — the wavefront animation is the entire interaction, not
ambient decoration, so it isn't gated behind the setting.

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

The laboratory itself is painted: a hand-painted-feeling stone room
(procedural stone, plaster and plank textures with brush strokes and
grime) behind the bench. It grows with you — each of the seven stages
adds a piece (shelves and herbs; a brick furnace with a live fire; a
grinding table with mortar and millstone; a glass greenhouse whose
plants sway; a copper still with bubbling flasks; an observatory oculus
and an orrery; and, last, a drawer that is bigger inside, a staircase on
the ceiling, and books that float), revealed with GSAP timelines. Every
material you discover appears as a jar on the shelf. Combining things
makes the lab answer — the furnace flares under Heat, frost forms under
Cool, dust rises under Grind, new discoveries flash — and the lab has
its own Web Audio layer (crackling fire, bubbling, a clink of glass, a
discovery chime) that is silent until you turn it on.

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

## Archive systems

Four things sit above the individual experiences.

**Page transitions.** Every experience enters, and leaves, in its own
way (`components/Transition.tsx`). The way is chosen by what kind of
thing it is — games open an iris from where you pressed, puzzles flip a
grid of tiles, science sweeps a measuring line, tiny worlds bloom,
interactive art swells like ink, history draws a curtain, experiments
close venetian blinds, strange things twist shut — with a few
hand-picked exceptions (the Witch's Delivery Service swoops, Little
Alchemist is ink, Stargazer scans). It's tinted with the experience's
own accent, and leaving mirrors entering. Cards and the back link use
`TLink`; ctrl/⌘-click and browser back/forward still behave normally.
With reduced motion it's a short cross-fade.

**Audio.** One master level for the whole archive (`lib/audio.ts`).
Experiences still synthesize their own sound with Web Audio (Sound
Garden, The Code, Bug Hotel, the Witch's Delivery Service, Little
Alchemist's lab…), but anything that reaches a context's speakers is
routed through a single master gain, so the speaker button (home page
and every experience) mutes or sets the volume for all of it — including
experiences written before the system existed. It also has an opt-in
layer of quiet interface sounds (hover ticks, selection, page-turn
whooshes), off by default. Each experience still starts silent until you
turn its own sound on. `scripts/audio-routing-check.ts` checks the
routing against a fake Web Audio graph.

**Progress sync (optional backend).** The archive works as a static
site, and every experience saves to the browser. The optional server in
`server/` (Node, no dependencies, one JSON file) adds progress backup —
a 12-character code, no accounts — so saves can be carried between
devices, plus visit counts. It also serves `dist/` with SPA fallback, so
`npm start` is a complete deployment. When the server isn't reachable
the sync button simply doesn't appear. See `server/README.md` for the
API and its limits. `scripts/sync-test.ts` runs two simulated devices
against a live server.

**Little Alchemist's laboratory.** See the section above.

## Not built yet

Every category is complete except Science, which is missing one
experience: **Deep Field**. It was built once, then removed
intentionally — not something that's still pending.
