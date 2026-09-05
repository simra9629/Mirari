import { Routes, Route } from "react-router-dom";
import { Home } from "./archive/Home";
import { NotFound } from "./archive/NotFound";
import { Stargazer } from "./experiences/stargazer/Stargazer";
import { Lockmaker } from "./experiences/lockmaker/Lockmaker";
import { Fireflies } from "./experiences/fireflies/Fireflies";
import { AntColony } from "./experiences/ant-colony/AntColony";
import { Gravity } from "./experiences/gravity/Gravity";
import { Orbit } from "./experiences/orbit/Orbit";
import { Lighthouse } from "./experiences/lighthouse/Lighthouse";
import { ButtonExperience } from "./experiences/button/Button";
import { Tidepool } from "./experiences/tidepool/Tidepool";
import { LastFirefly } from "./experiences/last-firefly/LastFirefly";
import { PaperCity } from "./experiences/paper-city/PaperCity";
import { Clockmaker } from "./experiences/clockmaker/Clockmaker";
import { Parcel } from "./experiences/parcel/Parcel";
import { Railway } from "./experiences/railway/Railway";
import { LittleAlchemist } from "./experiences/little-alchemist/LittleAlchemist";
import { Ink } from "./experiences/ink/Ink";
import { Fold } from "./experiences/fold/Fold";
import { Signal } from "./experiences/signal/Signal";
import { PlanetHunter } from "./experiences/planet-hunter/PlanetHunter";
import { Moon } from "./experiences/moon/Moon";
import { Constellation } from "./experiences/constellation-art/Constellation";
import { Rain } from "./experiences/rain/Rain";
import { AncientObservatory } from "./experiences/ancient-observatory/AncientObservatory";
import { SeriousPotato } from "./experiences/serious-potato/SeriousPotato";

export default function App() {
  return (
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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
