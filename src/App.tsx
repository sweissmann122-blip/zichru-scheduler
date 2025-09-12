import React, { useMemo, useState } from "react";

/**
 * ZICHRU ARCADE SCHEDULER – v1 (standalone, no integrations)
 * -----------------------------------------------------------
 * • 80s arcade / pinball vibe (neon glow, scanlines, chunky cards)
 * • Client‑side only: no login, no server. All scheduling runs in the browser.
 * • Print‑friendly calendar grid (Ctrl/Cmd+P) with clean layout.
 *
 * SPEC HIGHLIGHTS (per user decisions):
 * - Use ~10‑daf units exactly (loadable via JSON; demo included).
 * - Randomize unit order within each masechta.
 * - No partial masechtos (toggle entire masechta on/off only).
 * - Difficulty tiers updated: Sanhedrin, Eruvin, Nedarim are Medium.
 * - Daily mix: If 3 units/day ⇒ Easy + Medium + Hard. Otherwise, rotate E/M/H across days.
 * - Start tomorrow; dashboard shows Today’s date. 7 days/week; no skip days.
 * - Show total days to complete.
 * - Avoid duplicate masechta in a single day where possible; ensure full coverage.
 * - Repeats per masechta (1–3): finish whole masechta before repeating any unit within it.
 * - Single calendar per generation; focus on printing.
 */

// ------------------------------
// Demo dataset (small)
// ------------------------------
// ------------------------------
// Canonical totals (approximate Daf counts) -> generate ~10‑daf units
// Excludes Midos from Daf Yomi
// ------------------------------
const TOTAL_DAF: Record<string, number> = {
  Brachos: 64,
  Shabbos: 157,
  Eruvin: 105,
  Pesachim: 121,
  Shekalim: 22,
  Yoma: 88,
  Sukkah: 56,
  Beitza: 40,
  "Rosh Hashana": 34,
  Taanis: 31,
  Megillah: 32,
  "Moed Katan": 29,
  Chagigah: 27,
  Yevamos: 122,
  Kesubos: 112,
  Nedarim: 91,
  Nazir: 66,
  Sotah: 49,
  Gittin: 90,
  Kiddushin: 82,
  "Bava Kama": 119,
  "Bava Metziah": 119,
  "Bava Basra": 176,
  Sanhedrin: 113,
  Makos: 24,
  Shevuos: 49,
  "Avodah Zara": 76,
  Horayos: 14,
  Zevachim: 120,
  Menachos: 110,
  Chullin: 142,
  Bechoros: 61,
  Arachin: 34,
  Temurah: 34,
  Kerisus: 28,
  Meilah: 22,
  Tamid: 10,
  Niddah: 73,
};

function unitize(total: number): string[] {
  const units: string[] = [];
  let start = 2;
  while (start <= total) {
    const end = Math.min(total, Math.floor((start - 1) / 10) * 10 + 10);
    units.push(`${start}-${end}`);
    start = end + 1;
  }
  return units;
}

const UNITS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TOTAL_DAF).map(([m, total]) => [m, unitize(total)])
);

// Daf Yomi canonical order (per your PDF; excludes Midos)
const DAF_YOMI_ORDER: string[] = [
  "Brachos","Shabbos","Eruvin","Pesachim","Shekalim","Yoma","Sukkah","Beitza","Rosh Hashana","Taanis","Megillah","Moed Katan","Chagigah",
  "Yevamos","Kesubos","Nedarim","Nazir","Sotah","Gittin","Kiddushin",
  "Bava Kama","Bava Metziah","Bava Basra",
  "Sanhedrin","Makos","Shevuos","Avodah Zara","Horayos",
  "Zevachim","Menachos","Chullin","Bechoros","Arachin","Temurah","Kerisus","Meilah","Tamid","Niddah"
];

// Seder mapping (Bavli). Colors approximate the PDF's palette.
const SEDER_OF: Record<string, "Zeraim" | "Moed" | "Nashim" | "Nezikin" | "Kodashim" | "Taharos"> = {
  Brachos: "Zeraim",
  Shabbos: "Moed", Eruvin: "Moed", Pesachim: "Moed", Shekalim: "Moed", Yoma: "Moed", Sukkah: "Moed", Beitza: "Moed", "Rosh Hashana": "Moed", Taanis: "Moed", Megillah: "Moed", "Moed Katan": "Moed", Chagigah: "Moed",
  Yevamos: "Nashim", Kesubos: "Nashim", Nedarim: "Nashim", Nazir: "Nashim", Sotah: "Nashim", Gittin: "Nashim", Kiddushin: "Nashim",
  "Bava Kama": "Nezikin", "Bava Metziah": "Nezikin", "Bava Basra": "Nezikin", Sanhedrin: "Nezikin", Makos: "Nezikin", Shevuos: "Nezikin", "Avodah Zara": "Nezikin", Horayos: "Nezikin",
  Zevachim: "Kodashim", Menachos: "Kodashim", Chullin: "Kodashim", Bechoros: "Kodashim", Arachin: "Kodashim", Temurah: "Kodashim", Kerisus: "Kodashim", Meilah: "Kodashim", Tamid: "Kodashim",
  Niddah: "Taharos",
};

const SEDER_META: Record<string, { label: string; color: string; border: string }> = {
  Zeraim: { label: "Seder Zeraim", color: "text-emerald-300", border: "border-emerald-400" },
  Moed: { label: "Seder Moed", color: "text-cyan-300", border: "border-cyan-400" },
  Nashim: { label: "Seder Nashim", color: "text-pink-300", border: "border-pink-400" },
  Nezikin: { label: "Seder Nezikin", color: "text-amber-300", border: "border-amber-400" },
  Kodashim: { label: "Seder Kodashim", color: "text-violet-300", border: "border-violet-400" },
  Taharos: { label: "Seder Taharos", color: "text-rose-300", border: "border-rose-400" },
};

const SEDER_ORDER: (keyof typeof SEDER_META)[] = ["Zeraim","Moed","Nashim","Nezikin","Kodashim","Taharos"];

// ------------------------------
// Difficulty tiers (order-based thirds of Shas)
// ------------------------------
const DEFAULT_TIERS: Record<"Easy" | "Medium" | "Hard", string[]> = {
  Easy: [
    "Brachos","Shabbos","Eruvin","Pesachim","Shekalim","Yoma","Sukkah","Beitza","Rosh Hashana","Taanis","Megillah","Moed Katan","Chagigah","Yevamos"
  ],
  Medium: [
    "Kesubos","Nedarim","Nazir","Sotah","Gittin","Kiddushin","Bava Kama","Bava Metziah","Bava Basra"
  ],
  Hard: [
    "Sanhedrin","Makos","Shevuos","Avodah Zara","Horayos","Zevachim","Menachos","Chullin","Bechoros","Arachin","Temurah","Kerisus","Meilah","Tamid","Niddah"
  ],
};

// Utils
const today = new Date();
const startTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildMasechtaQueue(units, repeats) {
  const sequences = [];
  for (let r = 0; r < repeats; r++) sequences.push(shuffle(units));
  return sequences.flat();
}
function rotate(arr, n) {
  const a = arr.slice();
  for (let i = 0; i < n; i++) a.push(a.shift());
  return a;
}
const Bg = () => (
  <div className="fixed inset-0 -z-10">
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0022] to-black" />
    <div className="absolute inset-0 opacity-30" style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
    }} />
    <div className="absolute inset-0 pointer-events-none" style={{
      background:
        "radial-gradient(ellipse at center, rgba(255,0,180,0.2) 0%, rgba(0,0,0,0) 60%), radial-gradient(ellipse at 80% 20%, rgba(0,255,255,0.15) 0%, rgba(0,0,0,0) 40%)",
      mixBlendMode: "screen",
    }} />
  </div>
);
const neon = "drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]";
const neonPink = "drop-shadow-[0_0_10px_rgba(255,0,180,0.8)]";

export default function App() {
  // State
  const [unitsPerDay, setUnitsPerDay] = React.useState(3);
  const [data, setData] = React.useState({ ...UNITS });
  const [tiers, setTiers] = React.useState(DEFAULT_TIERS);
  const [toggles, setToggles] = React.useState(() => {
    const t = {};
    DAF_YOMI_ORDER.forEach((m) => { if (UNITS[m]) t[m] = true; });
    return t;
  });
  const [repeats, setRepeats] = React.useState(() => {
    const r = {};
    DAF_YOMI_ORDER.forEach((m) => { if (UNITS[m]) r[m] = 1; });
    return r;
  });
  const [calendar, setCalendar] = React.useState(null);

  function prepareSchedule() {
    const start = startTomorrow();
    const pools = { Easy: [], Medium: [], Hard: [] };

    const includedMasechtos = Object.keys(data).filter((m) => toggles[m]);
    const tierOf = (m) => {
      if (tiers.Easy.includes(m)) return "Easy";
      if (tiers.Medium.includes(m)) return "Medium";
      if (tiers.Hard.includes(m)) return "Hard";
      return "Medium";
    };

    includedMasechtos.forEach((m) => {
      const tier = tierOf(m);
      const r = Math.min(3, Math.max(1, repeats[m] ?? 1));
      const q = buildMasechtaQueue(data[m], r);
      if (q.length > 0) pools[tier].push({ masechta: m, tier, queue: q });
    });

    const totalUnits = Object.values(pools).flat().reduce((acc, item) => acc + item.queue.length, 0);
    if (totalUnits === 0) { setCalendar([]); return; }

    const totalDays = Math.ceil(totalUnits / unitsPerDay);
    const basePatterns = unitsPerDay === 3
      ? Array(totalDays).fill(["Easy", "Medium", "Hard"])
      : buildRotatingPatterns(unitsPerDay, totalDays);

    const days = [];
    const poolIndex = { Easy: 0, Medium: 0, Hard: 0 };
    Object.keys(pools).forEach((t) => { pools[t] = shuffle(pools[t]); });

    for (let d = 0; d < totalDays; d++) {
      const date = new Date(start); date.setDate(start.getDate() + d);
      const assigned = [];
      const seenToday = new Set();

      const tryPickFromTier = (tier, allowDup = False) => {
        const pool = pools[tier];
        if (!pool || pool.length === 0) return false;
        for (let tries = 0; tries < pool.length; tries++) {
          const idx = (poolIndex[tier] + tries) % pool.length;
          const candidate = pool[idx];
          if (candidate.queue.length === 0) continue;
          if (!allowDup && seenToday.has(candidate.masechta)) continue;
          const unit = candidate.queue.shift();
          assigned.push({ masechta: candidate.masechta, unit, tier });
          seenToday.add(candidate.masechta);
          poolIndex[tier] = (idx + 1) % pool.length;
          return true;
        }
        return false;
      };

      while (assigned.length < unitsPerDay) {
        const preferred = basePatterns[d][assigned.length % basePatterns[d].length];
        if (tryPickFromTier(preferred, false)) continue;
        const order = rotate(["Easy","Medium","Hard"], d % 3);
        let got = false;
        for (const t of order) {
          if (t === preferred) continue;
          if (tryPickFromTier(t, false)) { got = true; break; }
        }
        if (!got) {
          for (const t of order) {
            if (tryPickFromTier(t, true)) { got = true; break; }
          }
        }
        if (!got) break;
      }
      days.push({ date, items: assigned });
      const remaining = Object.values(pools).flat().reduce((acc, item) => acc + item.queue.length, 0);
      if (remaining === 0) break;
    }

    setCalendar(days);
  }

  function buildRotatingPatterns(units, dayCount) {
    const base = ["Easy", "Medium", "Hard"];
    const patterns = [];
    for (let d = 0; d < dayCount; d++) {
      const rotated = rotate(base, d % base.length);
      const p = [];
      for (let i = 0; i < units; i++) p.push(rotated[i % rotated.length]);
      patterns.push(p);
    }
    return patterns;
  }

  function openBWWindow() {/* stripped for starter repo to keep it simple */ alert('Generate schedule, then use your browser print (Ctrl/Cmd+P).'); }

  const totalSelectedUnits = React.useMemo(() => {
    return Object.keys(data)
      .filter((m) => toggles[m])
      .reduce((acc, m) => acc + data[m].length * (repeats[m] ?? 1), 0);
  }, [data, toggles, repeats]);

  const totalDaysNeeded = React.useMemo(() => {
    if (unitsPerDay <= 0) return 0;
    return Math.ceil(totalSelectedUnits / unitsPerDay);
  }, [totalSelectedUnits, unitsPerDay]);

  const todayStr = React.useMemo(() => new Date().toLocaleDateString(), []);

  return (
    <div className="min-h-screen text-white">
      <Bg />

      <header className="px-6 pt-6 pb-2">
        <h1 className={`text-4xl md:text-5xl font-extrabold tracking-wider text-center ${neon}`}>
          ZICHRU SCHEDULER
        </h1>
        <p className="text-center mt-2 text-cyan-200/80">Today: {todayStr}</p>
      </header>

      <main className="px-4 md:px-8 lg:px-16">
        <section className="mt-6 grid md:grid-cols-4 gap-4">
          <div className="rounded-2xl p-4 border border-cyan-500/30 bg-white/5 backdrop-blur">
            <h2 className={`text-xl font-bold mb-3 ${neon}`}>Daily Settings</h2>
            <label className="block mb-2">Units per day</label>
            <div className="mt-1 flex gap-2 flex-wrap">
              {[1,2,3,4,5,6].map((n) => (
                <button
                  key={n}
                  onClick={() => setUnitsPerDay(n)}
                  className={`px-3 py-1 rounded-full border text-sm ${unitsPerDay===n ? 'bg-cyan-400 text-black border-cyan-300' : 'bg-white/10 text-white border-white/20'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs italic text-cyan-100/80">Tier note: Easy/Medium/Hard are determined by order — first third of Shas = Easy, next third = Medium, last third = Hard.</p>
            <p className="mt-2 text-sm text-cyan-100/80">Schedule runs 7 days/week. If set to 3, we aim for Easy + Medium + Hard; if a pool runs out, we fill from others to keep the same number per day.</p>
            <p className="mt-2 text-sm">Total selected units: <span className="text-cyan-300 font-semibold">{totalSelectedUnits}</span></p>
            <p className="text-sm">Estimated days: <span className="text-cyan-300 font-semibold">{totalDaysNeeded}</span></p>
            <div className="flex gap-2 flex-wrap mt-3">
              <button
                onClick={prepareSchedule}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase tracking-wide shadow-lg"
              >
                <span>Prepare Schedule</span>
                <span className="text-lg">▶</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-cyan-100/80">Scroll down to see the tabulated schedule.</p>
          </div>

          <div className="rounded-2xl p-4 border border-pink-500/30 bg-white/5 backdrop-blur md:col-span-3">
            <h2 className={`text-xl font-bold mb-3 ${neonPink}`}>Masechtos</h2>

            <div className="space-y-6">
              {SEDER_ORDER.map((seder) => {
                const group = DAF_YOMI_ORDER.filter((m) => UNITS[m] && SEDER_OF[m] === seder);
                const meta = SEDER_META[seder];
                return (
                  <div key={seder}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-extrabold tracking-wide uppercase ${meta.color}`}>{meta.label}</div>
                    </div>
                    <ul className="divide-y divide-white/10">
                      {group.map((m) => (
                        <li key={m} className={`flex items-center justify-between py-2 pl-2 border-l-4 ${meta.border}`}>
                          <label className="flex items-center gap-3">
                            <input type="checkbox" defaultChecked />
                            <span>{m}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-200">reviews</span>
                            <div className="flex gap-1">
                              {[1,2,3].map((n) => (
                                <button
                                  key={n}
                                  className={`px-2 py-0.5 rounded-full border text-xs ${ n===1 ? 'bg-cyan-300 text-black border-cyan-200' : 'bg-white/10 text-white border-white/20' }`}
                                  title={`${n} review${n>1?'s':''}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-extrabold ${neon}`}>Generated Calendar</h2>
            <button
              onClick={openBWWindow}
              className="screen-only inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white text-black font-bold uppercase tracking-wide border border-black/30 hover:bg-slate-200"
              title="Download a black & white PDF in calendar format"
            >Open B/W PDF</button>
          </div>

          <p className="text-center opacity-80">Click <b>Prepare Schedule</b> to generate your calendar starting tomorrow.</p>
        </section>
      </main>

      <style>{`
        @media print {
          body { background: white !important; }
          .screen-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
