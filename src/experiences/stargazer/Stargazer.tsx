import { useMemo, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import { Starfield } from "../../components/Starfield";
import { constellations } from "./constellations";
import { getLevel } from "./campaign";
import { getAnchors, placeConstellation, generateDistractors, type PlacedStar } from "./placement";
import styles from "./Stargazer.module.css";

function useFindLevel(levelNumber: number) {
  return useMemo(() => {
    const level = getLevel(levelNumber);
    const defs = level.constellationIds
      .map((id) => constellations.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));
    const anchors = getAnchors(defs.length);
    const placedStars: PlacedStar[] = [];
    const edges: { edge: [string, string]; constellationId: string }[] = [];

    defs.forEach((def, i) => {
      const placed = placeConstellation(def, anchors[i]);
      placedStars.push(...placed.stars);
      placed.edges.forEach((e) => edges.push({ edge: e, constellationId: def.id }));
    });

    const distractors = generateDistractors(level.distractorCount, levelNumber);
    return { level, defs, stars: [...placedStars, ...distractors], edges };
  }, [levelNumber]);
}

function usePlanetLevel(levelNumber: number) {
  return useMemo(() => {
    const level = getLevel(levelNumber);
    const stars = generateDistractors(level.distractorCount, levelNumber + 10000).map((s) => ({
      ...s,
      id: `star-${levelNumber}-${s.id}`,
    }));
    const planetPick = (levelNumber * 37 + 11) % stars.length;
    const withPlanet = stars.map((s, i) =>
      i === planetPick ? { ...s, target: true, size: s.size + 1 } : s,
    );
    return { level, stars: withPlanet };
  }, [levelNumber]);
}

export function Stargazer() {
  const [levelNumber, setLevelNumber] = useState(1);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [missId, setMissId] = useState<string | null>(null);

  const level = getLevel(levelNumber);
  const isPlanetLevel = level.kind === "planet";

  const findData = useFindLevel(levelNumber);
  const planetData = usePlanetLevel(levelNumber);

  const targetIds = useMemo(() => {
    if (isPlanetLevel) return planetData.stars.filter((s) => s.target).map((s) => s.id);
    return findData.stars.filter((s) => s.target).map((s) => s.id);
  }, [isPlanetLevel, findData, planetData]);

  const complete = found.size === targetIds.length;

  const foundConstellationIds = useMemo(() => {
    if (isPlanetLevel) return new Set<string>();
    const byConstellation = new Map<string, string[]>();
    findData.stars
      .filter((s) => s.target && s.constellationId)
      .forEach((s) => {
        const list = byConstellation.get(s.constellationId!) ?? [];
        list.push(s.id);
        byConstellation.set(s.constellationId!, list);
      });
    const complete = new Set<string>();
    byConstellation.forEach((ids, cid) => {
      if (ids.every((id) => found.has(id))) complete.add(cid);
    });
    return complete;
  }, [isPlanetLevel, findData, found]);

  function handleStarClick(id: string, isTarget: boolean) {
    if (complete) return;
    if (isTarget) {
      setFound((prev) => new Set(prev).add(id));
    } else {
      setMissId(id);
      window.setTimeout(() => setMissId((cur) => (cur === id ? null : cur)), 420);
    }
  }

  const visibleEdges = useMemo(() => {
    if (isPlanetLevel) return [];
    return findData.edges
      .filter((e) => foundConstellationIds.has(e.constellationId))
      .map(({ edge: [aId, bId], constellationId }) => {
        const a = findData.stars.find((s) => s.id === aId)!;
        const b = findData.stars.find((s) => s.id === bId)!;
        return { a, b, constellationId };
      });
  }, [isPlanetLevel, findData, foundConstellationIds]);

  function resetLevel() {
    setFound(new Set());
    setMissId(null);
  }

  function nextLevel() {
    setLevelNumber((n) => n + 1);
    setFound(new Set());
    setMissId(null);
  }

  const fieldScale = level.fieldScale;
  const activeStars = isPlanetLevel ? planetData.stars : findData.stars;
  const foundNamedCount = isPlanetLevel
    ? found.size
    : findData.defs.filter((d) => foundConstellationIds.has(d.id)).length;
  const totalNamed = isPlanetLevel ? 1 : findData.defs.length;

  return (
    <ExperienceLayout
      title="Stargazer"
      category="Science · Observation"
      accent="#FFE29A"
      background="#030611"
    >
      <div className={styles.sky}>
        <div className={styles.canvasLayer}>
          <Starfield density={0.00014} />
        </div>

        <div
          className={styles.field}
          style={{
            width: `${fieldScale * 100}%`,
            height: `${fieldScale * 100}%`,
          }}
        >
          <svg className={styles.lines} aria-hidden="true">
            {visibleEdges.map(({ a, b }, i) => (
              <line
                key={i}
                x1={`${a.x * 100}%`}
                y1={`${a.y * 100}%`}
                x2={`${b.x * 100}%`}
                y2={`${b.y * 100}%`}
                stroke="#FFE29A"
                strokeOpacity={0.55}
                strokeWidth={1.4}
              />
            ))}
          </svg>

          {activeStars.map((star) => {
            const isFound = star.target && found.has(star.id);
            const cls = [
              styles.starButton,
              isFound ? styles.found : "",
              missId === star.id ? styles.miss : "",
              isPlanetLevel && !star.target ? styles.twinkleStar : "",
              isPlanetLevel && star.target ? styles.planetStar : "",
            ]
              .filter(Boolean)
              .join(" ");
            const label = star.target && !isPlanetLevel ? star.name : "";
            return (
              <button
                key={star.id}
                type="button"
                className={cls}
                style={{ left: `${star.x * 100}%`, top: `${star.y * 100}%` }}
                onClick={() => handleStarClick(star.id, star.target)}
                aria-label={
                  star.target
                    ? isPlanetLevel
                      ? isFound
                        ? "The planet — found"
                        : "Unidentified point of light"
                      : isFound
                        ? `${star.name} — found`
                        : "Unidentified star"
                    : "Unidentified star"
                }
              >
                <span
                  className={styles.starDot}
                  style={{
                    width: `${6 + star.size * 2.4}px`,
                    height: `${6 + star.size * 2.4}px`,
                  }}
                />
                {label && <span className={styles.label}>{label}</span>}
              </button>
            );
          })}
        </div>

        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>Level {levelNumber}</div>
          <p className={styles.hudPrompt}>{level.prompt}</p>
          <div className={styles.progress}>
            {isPlanetLevel
              ? `${found.size} / 1 planet found`
              : `${foundNamedCount} / ${totalNamed} constellations · ${found.size} / ${targetIds.length} stars`}
          </div>
        </div>

        {complete && (
          <div className={styles.completePanel} role="status">
            <div className={styles.completeTitle}>
              {isPlanetLevel
                ? "You found the planet."
                : findData.defs.length > 1
                  ? "You found them all."
                  : `You found ${findData.defs[0]?.name}.`}
            </div>
            <p className={styles.completeFact}>
              {isPlanetLevel
                ? "Planets don't twinkle the way stars do — their light comes from a small, steady disk, while a star's light is a single point easily disturbed by moving air."
                : findData.defs.map((d) => d.fact).join(" ")}
            </p>
            <div className={styles.completeActions}>
              <button type="button" className={styles.resetButton} onClick={resetLevel}>
                Look again
              </button>
              <button type="button" className={styles.nextButton} onClick={nextLevel}>
                Next region of sky →
              </button>
            </div>
          </div>
        )}
      </div>
    </ExperienceLayout>
  );
}
