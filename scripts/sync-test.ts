import { JSDOM } from "jsdom";
const BASE = "http://localhost:8793";
const realFetch = globalThis.fetch;
(globalThis as any).fetch = (u: any, i: any) => realFetch(typeof u === "string" && u.startsWith("/") ? BASE + u : u, i);
function device(name: string) {
  const dom = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  const w: any = dom.window;
  return { w, activate() { for (const k of ["window", "localStorage", "Storage", "CustomEvent", "navigator"]) Object.defineProperty(globalThis, k, { value: w[k], configurable: true, writable: true }); w.matchMedia = () => ({ matches: false }); }, name };
}
const A = device("A"), B = device("B");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

A.activate();
const a = await import("../src/lib/sync.ts?a");
a.startSync(); await sleep(300);
console.log("A status:", a.getInfo().status);
A.w.localStorage.setItem("mirari:bug-hotel:v1", JSON.stringify({ day: 3 }));
A.w.localStorage.setItem("not-mirari", "ignored");
const code = await a.enable();
console.log("A code:", code, "keys:", a.getInfo().keys);

B.activate();
const b = await import("../src/lib/sync.ts?b");
b.startSync(); await sleep(300);
const n = await b.join(String(code).toLowerCase().replace(/(.{4})/g, "$1 "));
console.log("B restored saves:", n, "->", B.w.localStorage.getItem("mirari:bug-hotel:v1"), "| leaked non-mirari key:", B.w.localStorage.getItem("not-mirari"));

// B plays on; the change should flow to A
await sleep(10);
B.w.localStorage.setItem("mirari:bug-hotel:v1", JSON.stringify({ day: 7 }));
await b.pushNow();
A.activate();
await a.pushNow();    // A pulls what B pushed (the merge response applies newer remote saves)
console.log("A now sees day:", A.w.localStorage.getItem("mirari:bug-hotel:v1"));

// an old save from a stale device must not overwrite the newer one
await sleep(10);
const info = await b.join("ZZZZZZZZZZZZ");
console.log("bad code rejected:", info === -1, "|", b.getInfo().error);
await a.disable(true);
const gone = await fetch(`/api/sync/${code}`); console.log("after 'delete backup', server says:", gone.status);
process.exit(0);
