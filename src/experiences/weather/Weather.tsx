import { useEffect, useRef, useState } from "react";
import { ExperienceLayout } from "../../components/ExperienceLayout";
import styles from "./Weather.module.css";

interface Cloud {
  x: number;
  y: number;
  scale: number;
}

interface Drop {
  x: number;
  y: number;
  speed: number;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  drift: number;
  speed: number;
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
}

interface SkyStop {
  h: number;
  top: [number, number, number];
  bottom: [number, number, number];
}

const SKY_STOPS: SkyStop[] = [
  { h: 0, top: [10, 14, 28], bottom: [21, 27, 44] },
  { h: 5, top: [10, 14, 28], bottom: [21, 27, 44] },
  { h: 6.5, top: [62, 52, 84], bottom: [232, 142, 108] },
  { h: 8.5, top: [70, 130, 210], bottom: [192, 216, 240] },
  { h: 16.5, top: [70, 130, 210], bottom: [192, 216, 240] },
  { h: 18.5, top: [58, 48, 88], bottom: [228, 118, 88] },
  { h: 20, top: [10, 14, 28], bottom: [21, 27, 44] },
  { h: 24, top: [10, 14, 28], bottom: [21, 27, 44] },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function skyColors(hour: number): { top: [number, number, number]; bottom: [number, number, number] } {
  const h = ((hour % 24) + 24) % 24;
  let a = SKY_STOPS[0];
  let b = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (h >= SKY_STOPS[i].h && h <= SKY_STOPS[i + 1].h) {
      a = SKY_STOPS[i];
      b = SKY_STOPS[i + 1];
      break;
    }
  }
  const span = b.h - a.h || 1;
  const t = (h - a.h) / span;
  const top: [number, number, number] = [
    lerp(a.top[0], b.top[0], t),
    lerp(a.top[1], b.top[1], t),
    lerp(a.top[2], b.top[2], t),
  ];
  const bottom: [number, number, number] = [
    lerp(a.bottom[0], b.bottom[0], t),
    lerp(a.bottom[1], b.bottom[1], t),
    lerp(a.bottom[2], b.bottom[2], t),
  ];
  return { top, bottom };
}

function describe(temp: number, wind: number, moisture: number, hour: number, pressure: number): string {
  const tempWord = temp < 0 ? "freezing" : temp < 10 ? "cold" : temp < 20 ? "mild" : temp < 30 ? "warm" : "hot";
  const windWord = wind < 15 ? "still air" : wind < 40 ? "a light breeze" : wind < 70 ? "strong wind" : "gale-force wind";
  const timeWord = hour < 5 || hour >= 21 ? "at night" : hour < 7 ? "at dawn" : hour < 18 ? "" : "at dusk";

  let skyWord: string;
  const stormy = pressure < 990 && wind > 45 && moisture > 55;
  if (stormy) skyWord = "a thunderstorm";
  else if (moisture > 85 && wind < 20) skyWord = "thick fog";
  else if (moisture > 75) skyWord = temp <= 2 ? "heavy snow" : "heavy rain";
  else if (moisture > 55) skyWord = temp <= 2 ? "snow flurries" : "light rain";
  else if (moisture > 30) skyWord = "an overcast sky";
  else skyWord = "clear skies";

  const parts = [skyWord.charAt(0).toUpperCase() + skyWord.slice(1), windWord, tempWord];
  const sentence = parts.join(", ") + (timeWord ? `, ${timeWord}.` : ".");
  return sentence;
}

export function Weather() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [temperature, setTemperature] = useState(18);
  const [wind, setWind] = useState(10);
  const [moisture, setMoisture] = useState(25);
  const [hour, setHour] = useState(13);
  const [pressure, setPressure] = useState(1013);
  const tempRef = useRef(temperature);
  const windRef = useRef(wind);
  const moistureRef = useRef(moisture);
  const hourRef = useRef(hour);
  const pressureRef = useRef(pressure);
  const reducedMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    tempRef.current = temperature;
  }, [temperature]);
  useEffect(() => {
    windRef.current = wind;
  }, [wind]);
  useEffect(() => {
    moistureRef.current = moisture;
  }, [moisture]);
  useEffect(() => {
    hourRef.current = hour;
  }, [hour]);
  useEffect(() => {
    pressureRef.current = pressure;
  }, [pressure]);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas = canvasRaw as HTMLCanvasElement;
    const ctxRaw = canvas.getContext("2d");
    if (!ctxRaw) return;
    const ctx = ctxRaw as CanvasRenderingContext2D;

    let width = 0;
    let height = 0;
    let raf = 0;
    let clouds: Cloud[] = [];
    let drops: Drop[] = [];
    let flakes: Flake[] = [];
    let stars: Star[] = [];
    let snowGround = 0;
    let lightning = 0;
    let nextLightningCheck = 0;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    function seed() {
      clouds = Array.from({ length: 14 }, () => ({ x: rand(0, width), y: rand(height * 0.08, height * 0.38), scale: rand(0.6, 1.5) }));
      drops = Array.from({ length: 180 }, () => ({ x: rand(0, width), y: rand(0, height), speed: rand(300, 500) }));
      flakes = Array.from({ length: 140 }, () => ({ x: rand(0, width), y: rand(0, height), r: rand(1.2, 3), drift: rand(-10, 10), speed: rand(20, 55) }));
      stars = Array.from({ length: 90 }, () => ({ x: rand(0, width), y: rand(0, height * 0.55), r: rand(0.5, 1.6), phase: rand(0, Math.PI * 2) }));
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function drawCloud(c: Cloud, opacity: number, tint: string) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(c.scale, c.scale);
      ctx.fillStyle = tint.replace("ALPHA", String(opacity));
      const lobes: [number, number, number][] = [[-30, 0, 26], [0, -12, 32], [32, 0, 26], [-8, 8, 24], [18, 10, 22]];
      for (const [lx, ly, lr] of lobes) {
        ctx.beginPath();
        ctx.arc(lx, ly, lr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawHills(groundY: number, dim: number) {
      const layers = [
        { amp: 18, base: 0.62, shade: 0.5 },
        { amp: 26, base: 0.78, shade: 0.68 },
      ];
      for (const layer of layers) {
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let x = 0; x <= width; x += 20) {
          const y = groundY - layer.amp * Math.sin(x / 240 + layer.base * 3) - layer.amp;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, groundY);
        ctx.closePath();
        const shade = Math.round(40 * layer.shade * (1 - dim * 0.5) + 10);
        ctx.fillStyle = `rgba(${shade}, ${shade + 14}, ${shade + 8}, 1)`;
        ctx.fill();
      }
    }

    let lastT = performance.now();

    function draw(t: number) {
      const dt = Math.min((t - lastT) / 1000, 0.05);
      lastT = t;

      const temp = tempRef.current;
      const windVal = windRef.current;
      const moist = moistureRef.current;
      const hourVal = hourRef.current;
      const pressureVal = pressureRef.current;

      const isNightHour = hourVal < 6 || hourVal >= 19;
      const twilight = Math.min(1, Math.max(0, 1 - Math.min(Math.abs(hourVal - 6), Math.abs(hourVal - 18)) / 1.5));
      const skyDim = Math.min(1, moist / 90);
      const groundY = height * 0.82;

      const isCold = temp <= 2;
      const isRaining = !isCold && moist > 45;
      const isSnowing = isCold && moist > 35;
      const stormy = isRaining && pressureVal < 990 && windVal > 45;

      // Sky.
      const { top, bottom } = skyColors(hourVal);
      const dimmed = (c: [number, number, number], fade: number): [number, number, number] => [
        lerp(c[0], 60 + fade * 20, skyDim * 0.7),
        lerp(c[1], 62 + fade * 20, skyDim * 0.7),
        lerp(c[2], 68 + fade * 20, skyDim * 0.7),
      ];
      const topC = dimmed(top, 0);
      const bottomC = dimmed(bottom, 0.1);
      const sky = ctx.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, `rgb(${topC[0]}, ${topC[1]}, ${topC[2]})`);
      sky.addColorStop(1, `rgb(${bottomC[0]}, ${bottomC[1]}, ${bottomC[2]})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, groundY);

      // Stars, visible at night, fading with moisture and dawn/dusk.
      if (isNightHour || twilight > 0.4) {
        const starVisibility = (isNightHour ? 1 : 0) * Math.max(0, 1 - moist / 60);
        if (starVisibility > 0.02) {
          for (const s of stars) {
            const tw = reducedMotion.current ? 1 : 0.6 + Math.sin(t / 800 + s.phase) * 0.4;
            ctx.fillStyle = `rgba(240, 244, 255, ${starVisibility * tw})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Sun or moon, fading as moisture rises.
      const dayFrac = Math.max(0, Math.min(1, (hourVal - 5) / 14)); // 0 at 5am, 1 at 7pm
      const arcX = width * (0.12 + dayFrac * 0.76);
      const arcY = height * (0.55 - Math.sin(dayFrac * Math.PI) * 0.42);
      const bodyOpacity = Math.max(0, 1 - moist / 55);
      if (bodyOpacity > 0.02) {
        const isSun = !isNightHour;
        const color: [number, number, number] = isSun ? [255, 226, 154] : [214, 222, 240];
        const grad = ctx.createRadialGradient(arcX, arcY, 0, arcX, arcY, isSun ? 90 : 60);
        grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${bodyOpacity})`);
        grad.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
        ctx.fillStyle = grad;
        const r = isSun ? 90 : 60;
        ctx.fillRect(arcX - r, arcY - r, r * 2, r * 2);
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${bodyOpacity})`;
        ctx.beginPath();
        ctx.arc(arcX, arcY, isSun ? 20 : 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lightning flash, only during a real storm.
      if (stormy && !reducedMotion.current) {
        nextLightningCheck -= dt;
        if (nextLightningCheck <= 0) {
          nextLightningCheck = rand(1.5, 4.5);
          if (Math.random() < 0.6) lightning = 1;
        }
      }
      lightning = Math.max(0, lightning - dt * 3.2);
      if (lightning > 0.01) {
        ctx.fillStyle = `rgba(230, 236, 255, ${lightning * 0.5})`;
        ctx.fillRect(0, 0, width, groundY);
      }

      // Distant hills.
      drawHills(groundY, skyDim);

      // Clouds.
      const cloudTint = stormy ? "rgba(70, 76, 90, ALPHA)" : "rgba(220, 226, 236, ALPHA)";
      const cloudCount = Math.round((moist / 100) * clouds.length);
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        if (!reducedMotion.current) {
          c.x += (windVal * 0.4 + 4) * dt;
          if (c.x > width + 60) c.x = -60;
        }
        if (i < cloudCount) drawCloud(c, Math.min(0.9, 0.4 + moist / 130), cloudTint);
      }

      // Precipitation.
      if (isRaining) {
        ctx.strokeStyle = "rgba(210, 224, 236, 0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const active = Math.round((Math.min(moist, 100) / 100) * drops.length);
        for (let i = 0; i < active; i++) {
          const d = drops[i];
          if (!reducedMotion.current) {
            d.y += d.speed * dt;
            d.x += windVal * 0.3 * dt;
            if (d.y > groundY) {
              d.y = -10;
              d.x = rand(0, width);
            }
          }
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x + windVal * 0.05, d.y + 10);
        }
        ctx.stroke();
        snowGround = Math.max(0, snowGround - dt * 0.15);
      } else if (isSnowing) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        const active = Math.round((Math.min(moist, 100) / 100) * flakes.length);
        for (let i = 0; i < active; i++) {
          const f = flakes[i];
          if (!reducedMotion.current) {
            f.y += f.speed * dt;
            f.x += (f.drift + windVal * 0.25) * dt;
            if (f.y > groundY) {
              f.y = -6;
              f.x = rand(0, width);
            }
            if (f.x < 0) f.x = width;
            if (f.x > width) f.x = 0;
          }
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        snowGround = Math.min(1, snowGround + dt * 0.06);
      } else {
        snowGround = Math.max(0, snowGround - dt * 0.1);
      }

      // Ground.
      const groundShade = isNightHour ? 0.55 : 1;
      ctx.fillStyle = `rgba(${Math.round(60 * groundShade)}, ${Math.round(82 * groundShade)}, ${Math.round(56 * groundShade)}, 1)`;
      ctx.fillRect(0, groundY, width, height - groundY);
      if (snowGround > 0.01) {
        ctx.fillStyle = `rgba(240, 245, 250, ${snowGround * 0.9})`;
        ctx.fillRect(0, groundY, width, height - groundY);
      }
      if (isRaining) {
        ctx.fillStyle = `rgba(20, 30, 26, ${Math.min(0.35, moist / 260)})`;
        ctx.fillRect(0, groundY, width, height - groundY);
      }

      // A small tree, swaying with the wind.
      const trunkX = width * 0.16;
      const sway = reducedMotion.current ? 0 : Math.sin(t / 700) * Math.min(0.35, windVal / 180);
      ctx.save();
      ctx.translate(trunkX, groundY);
      ctx.rotate(sway);
      ctx.fillStyle = "#5a4128";
      ctx.fillRect(-4, -46, 8, 46);
      ctx.fillStyle = isCold && snowGround > 0.3 ? "#cbe0d6" : isNightHour ? "#2c4a33" : "#3f6b45";
      ctx.beginPath();
      ctx.arc(-6, -60, 20, 0, Math.PI * 2);
      ctx.arc(10, -64, 22, 0, Math.PI * 2);
      ctx.arc(2, -50, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Fog.
      if (moist > 78 && windVal < 22) {
        const fogOpacity = Math.min(0.55, (moist - 78) / 40);
        ctx.fillStyle = `rgba(200, 205, 215, ${fogOpacity})`;
        ctx.fillRect(0, 0, width, height);
      }

      // Vignette.
      const vignette = ctx.createRadialGradient(width / 2, height * 0.5, height * 0.3, width / 2, height * 0.5, height * 0.9);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.28)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  function formatHour(h: number) {
    const rounded = Math.round(h);
    const period = rounded >= 12 ? "PM" : "AM";
    const h12 = rounded % 12 === 0 ? 12 : rounded % 12;
    return `${h12}${period}`;
  }

  return (
    <ExperienceLayout title="Weather" category="Tiny World" accent="#83bfe5" background="#111823">
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <div className={styles.hud}>
          <div className={styles.hudEyebrow}>{describe(temperature, wind, moisture, hour, pressure)}</div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Temperature</span>
            <input
              type="range"
              className={styles.slider}
              min={-20}
              max={40}
              step={1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              aria-label="Temperature"
            />
            <span className={styles.sliderValue}>{temperature}°C</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Wind</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={1}
              value={wind}
              onChange={(e) => setWind(parseFloat(e.target.value))}
              aria-label="Wind"
            />
            <span className={styles.sliderValue}>{wind}</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Moisture</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={100}
              step={1}
              value={moisture}
              onChange={(e) => setMoisture(parseFloat(e.target.value))}
              aria-label="Moisture"
            />
            <span className={styles.sliderValue}>{moisture}%</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Time of day</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={24}
              step={0.5}
              value={hour}
              onChange={(e) => setHour(parseFloat(e.target.value))}
              aria-label="Time of day"
            />
            <span className={styles.sliderValue}>{formatHour(hour)}</span>
          </div>

          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Pressure</span>
            <input
              type="range"
              className={styles.slider}
              min={960}
              max={1040}
              step={1}
              value={pressure}
              onChange={(e) => setPressure(parseFloat(e.target.value))}
              aria-label="Pressure"
            />
            <span className={styles.sliderValue}>{pressure} hPa</span>
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
