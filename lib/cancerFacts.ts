// Country cancer facts from the GLOBOCAN fact sheets (IARC/WHO), built by
// scripts/build-cancer-facts.py into /data/cancer-facts.json. Loaded on first
// use so it never weighs on the first paint.

type Pool = { y: number; f: string[] };
type FactsFile = { africa: Pool; countries: Record<string, Pool>; who: string[] };
export type CancerFact = { text: string; source: string };

let file: FactsFile | null = null;
let loading: Promise<FactsFile | null> | null = null;

export function loadCancerFacts(): Promise<FactsFile | null> {
  if (file) return Promise.resolve(file);
  loading ??= fetch("/data/cancer-facts.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((f: FactsFile | null) => (file = f))
    .catch(() => {
      loading = null; // try again next time
      return null;
    });
  return loading;
}

const globocan = (y: number) => `GLOBOCAN ${y} · IARC/WHO`;

/** Every fact we can show for a country, admin's own first. Africa-wide when there's no sheet. */
export function factsFor(iso2: string | null, adminFact?: string | null): CancerFact[] {
  const out: CancerFact[] = adminFact ? [{ text: adminFact, source: "" }] : [];
  if (!file) return out;
  const pool = (iso2 && file.countries[iso2]) || file.africa;
  out.push(...pool.f.map((text) => ({ text, source: globocan(pool.y) })));
  if (!iso2 || !file.countries[iso2]) out.push(...file.who.map((text) => ({ text, source: "WHO" })));
  return out;
}

/** A random fact for the country, avoiding `not` (the one shown last) when there's a choice. */
export function randomFact(iso2: string | null, adminFact?: string | null, not?: string): CancerFact | null {
  const all = factsFor(iso2, adminFact);
  const pool = all.length > 1 ? all.filter((f) => f.text !== not) : all;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
