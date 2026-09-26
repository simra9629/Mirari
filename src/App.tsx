import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Home } from "./archive/Home";
import { NotFound } from "./archive/NotFound";
import styles from "./App.module.css";

const Stargazer = lazy(() => import("./experiences/stargazer/Stargazer").then((m) => ({ default: m.Stargazer })));
const Lockmaker = lazy(() => import("./experiences/lockmaker/Lockmaker").then((m) => ({ default: m.Lockmaker })));
const Fireflies = lazy(() => import("./experiences/fireflies/Fireflies").then((m) => ({ default: m.Fireflies })));
const AntColony = lazy(() => import("./experiences/ant-colony/AntColony").then((m) => ({ default: m.AntColony })));
const Gravity = lazy(() => import("./experiences/gravity/Gravity").then((m) => ({ default: m.Gravity })));
const Orbit = lazy(() => import("./experiences/orbit/Orbit").then((m) => ({ default: m.Orbit })));
const Lighthouse = lazy(() => import("./experiences/lighthouse/Lighthouse").then((m) => ({ default: m.Lighthouse })));
const ButtonExperience = lazy(() => import("./experiences/button/Button").then((m) => ({ default: m.ButtonExperience })));
const Tidepool = lazy(() => import("./experiences/tidepool/Tidepool").then((m) => ({ default: m.Tidepool })));
const LastFirefly = lazy(() => import("./experiences/last-firefly/LastFirefly").then((m) => ({ default: m.LastFirefly })));
const PaperCity = lazy(() => import("./experiences/paper-city/PaperCity").then((m) => ({ default: m.PaperCity })));
const Clockmaker = lazy(() => import("./experiences/clockmaker/Clockmaker").then((m) => ({ default: m.Clockmaker })));
const Parcel = lazy(() => import("./experiences/parcel/Parcel").then((m) => ({ default: m.Parcel })));
const Railway = lazy(() => import("./experiences/railway/Railway").then((m) => ({ default: m.Railway })));
const LittleAlchemist = lazy(() => import("./experiences/little-alchemist/LittleAlchemist").then((m) => ({ default: m.LittleAlchemist })));
const Ink = lazy(() => import("./experiences/ink/Ink").then((m) => ({ default: m.Ink })));
const Fold = lazy(() => import("./experiences/fold/Fold").then((m) => ({ default: m.Fold })));
const Signal = lazy(() => import("./experiences/signal/Signal").then((m) => ({ default: m.Signal })));
const PlanetHunter = lazy(() => import("./experiences/planet-hunter/PlanetHunter").then((m) => ({ default: m.PlanetHunter })));
const Moon = lazy(() => import("./experiences/moon/Moon").then((m) => ({ default: m.Moon })));
const Constellation = lazy(() => import("./experiences/constellation-art/Constellation").then((m) => ({ default: m.Constellation })));
const Rain = lazy(() => import("./experiences/rain/Rain").then((m) => ({ default: m.Rain })));
const AncientObservatory = lazy(() => import("./experiences/ancient-observatory/AncientObservatory").then((m) => ({ default: m.AncientObservatory })));
const SeriousPotato = lazy(() => import("./experiences/serious-potato/SeriousPotato").then((m) => ({ default: m.SeriousPotato })));
const Archivist = lazy(() => import("./experiences/archivist/Archivist").then((m) => ({ default: m.Archivist })));
const Paper = lazy(() => import("./experiences/paper/Paper").then((m) => ({ default: m.Paper })));
const TheClock = lazy(() => import("./experiences/the-clock/TheClock").then((m) => ({ default: m.TheClock })));
const Weather = lazy(() => import("./experiences/weather/Weather").then((m) => ({ default: m.Weather })));
const TheSock = lazy(() => import("./experiences/the-sock/TheSock").then((m) => ({ default: m.TheSock })));
const StarDetective = lazy(() => import("./experiences/star-detective/StarDetective").then((m) => ({ default: m.StarDetective })));
const ImpossibleRoom = lazy(() => import("./experiences/impossible-room/ImpossibleRoom").then((m) => ({ default: m.ImpossibleRoom })));
const SoundGarden = lazy(() => import("./experiences/sound-garden/SoundGarden").then((m) => ({ default: m.SoundGarden })));
const TheCode = lazy(() => import("./experiences/the-code/TheCode").then((m) => ({ default: m.TheCode })));
const TimeReversed = lazy(() => import("./experiences/time-reversed/TimeReversed").then((m) => ({ default: m.TimeReversed })));
const PigeonSimulator = lazy(() => import("./experiences/pigeon-simulator/PigeonSimulator").then((m) => ({ default: m.PigeonSimulator })));
const SolarSystem = lazy(() => import("./experiences/solar-system/SolarSystem").then((m) => ({ default: m.SolarSystem })));
const InkGarden = lazy(() => import("./experiences/ink-garden/InkGarden").then((m) => ({ default: m.InkGarden })));
const SilkRoad = lazy(() => import("./experiences/silk-road/SilkRoad").then((m) => ({ default: m.SilkRoad })));
const City = lazy(() => import("./experiences/city/City").then((m) => ({ default: m.City })));
const EarthSpin = lazy(() => import("./experiences/earth-spin/EarthSpin").then((m) => ({ default: m.EarthSpin })));
const MoonDisappeared = lazy(() => import("./experiences/moon-disappeared/MoonDisappeared").then((m) => ({ default: m.MoonDisappeared })));
const Cat = lazy(() => import("./experiences/cat/Cat").then((m) => ({ default: m.Cat })));

function LoadingFallback() {
  return (
    <div className={styles.loading}>
      <div className={styles.loadingMark} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/experience/stargazer" element={<Stargazer />} />
        <Route path="/experience/lockmaker" element={<Lockmaker />} />
        <Route path="/experience/fireflies" element={<Fireflies />} />
        <Route path="/experience/ant-colony" element={<AntColony />} />
        <Route path="/experience/gravity-weaker" element={<Gravity />} />
        <Route path="/experience/orbit" element={<Orbit />} />
        <Route path="/experience/lighthouse" element={<Lighthouse />} />
        <Route path="/experience/button" element={<ButtonExperience />} />
        <Route path="/experience/tidepool" element={<Tidepool />} />
        <Route path="/experience/last-firefly" element={<LastFirefly />} />
        <Route path="/experience/paper-city" element={<PaperCity />} />
        <Route path="/experience/clockmaker" element={<Clockmaker />} />
        <Route path="/experience/parcel" element={<Parcel />} />
        <Route path="/experience/railway" element={<Railway />} />
        <Route path="/experience/little-alchemist" element={<LittleAlchemist />} />
        <Route path="/experience/ink" element={<Ink />} />
        <Route path="/experience/fold" element={<Fold />} />
        <Route path="/experience/signal" element={<Signal />} />
        <Route path="/experience/planet-hunter" element={<PlanetHunter />} />
        <Route path="/experience/moon" element={<Moon />} />
        <Route path="/experience/constellation" element={<Constellation />} />
        <Route path="/experience/rain" element={<Rain />} />
        <Route path="/experience/ancient-observatory" element={<AncientObservatory />} />
        <Route path="/experience/serious-potato" element={<SeriousPotato />} />
        <Route path="/experience/archivist" element={<Archivist />} />
        <Route path="/experience/paper" element={<Paper />} />
        <Route path="/experience/the-clock" element={<TheClock />} />
        <Route path="/experience/weather" element={<Weather />} />
        <Route path="/experience/the-sock" element={<TheSock />} />
        <Route path="/experience/star-detective" element={<StarDetective />} />
        <Route path="/experience/impossible-room" element={<ImpossibleRoom />} />
        <Route path="/experience/sound-garden" element={<SoundGarden />} />
        <Route path="/experience/the-code" element={<TheCode />} />
        <Route path="/experience/time-reversed" element={<TimeReversed />} />
        <Route path="/experience/pigeon-simulator" element={<PigeonSimulator />} />
        <Route path="/experience/solar-system" element={<SolarSystem />} />
        <Route path="/experience/ink-garden" element={<InkGarden />} />
        <Route path="/experience/silk-road" element={<SilkRoad />} />
        <Route path="/experience/city" element={<City />} />
        <Route path="/experience/earth-spin" element={<EarthSpin />} />
        <Route path="/experience/moon-disappeared" element={<MoonDisappeared />} />
        <Route path="/experience/cat" element={<Cat />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
