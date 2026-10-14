// A tiny fake Web Audio graph, to check that the master routing redirects connections to the speakers.
class FakeParam { value = 1; setTargetAtTime(v: number) { this.value = v; } }
class AudioNode { context: any; links: any[] = []; constructor(ctx: any) { this.context = ctx; } connect(d: any) { this.links.push(d); return d; } }
class AudioDestinationNode extends AudioNode {}
class GainNode extends AudioNode { gain = new FakeParam(); }
class Ctx { destination = new AudioDestinationNode(this); currentTime = 0; state = "running"; createGain() { return new GainNode(this); } }
Object.assign(globalThis, { AudioNode, AudioDestinationNode, window: globalThis, localStorage: { s: {} as any, getItem(k: string) { return this.s[k] ?? null; }, setItem(k: string, v: string) { this.s[k] = v; } } });
const A = await import("../src/lib/audio");
A.installAudioMaster(); A.installAudioMaster();
const ctx: any = new Ctx();
const osc = new AudioNode(ctx), g = ctx.createGain();
osc.connect(g);                        // ordinary connection: untouched
g.connect(ctx.destination);            // to the speakers: should be redirected to the master
const master = g.links[0];
console.log("redirected to a master gain:", master instanceof GainNode && master !== g && master.links[0] === ctx.destination);
const g2 = ctx.createGain(); g2.connect(ctx.destination);
console.log("second node shares the same master:", g2.links[0] === master);
console.log("normal links untouched:", osc.links[0] === g);
A.setAudioPrefs({ volume: 0.5 }); console.log("volume 0.5 → gain", master.gain.value);
A.setAudioPrefs({ muted: true }); console.log("muted → gain", master.gain.value);
A.setAudioPrefs({ muted: false, volume: 1 }); console.log("restored → gain", master.gain.value, "prefs saved:", !!(globalThis as any).localStorage.s["mirari:audio"]);
