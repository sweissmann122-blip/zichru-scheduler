import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "./supabase";


/** ZICHRU SCHEDULER – App.tsx (full replacement)
 * - Units-per-day pills (1–6)
 * - Reviews-per-masechta pills (1–3)
 * - Seder “Toggle all” buttons
 * - Order-based tiers (first/next/last third of Shas by dapim)
 * - Robust scheduler keeps exact units/day (fills from other tiers if a pool runs out)
 * - Calendar cards + B/W month-grid print (opens in new tab)
 */

// ------------------------------
// Canonical daf counts (Daf Yomi – no Midos)
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

// Daf Yomi order (matches your PDF; excludes Midos)
const DAF_YOMI_ORDER: string[] = [
  "Brachos",
  "Shabbos",
  "Eruvin",
  "Pesachim",
  "Shekalim",
  "Yoma",
  "Sukkah",
  "Beitza",
  "Rosh Hashana",
  "Taanis",
  "Megillah",
  "Moed Katan",
  "Chagigah",
  "Yevamos",
  "Kesubos",
  "Nedarim",
  "Nazir",
  "Sotah",
  "Gittin",
  "Kiddushin",
  "Bava Kama",
  "Bava Metziah",
  "Bava Basra",
  "Sanhedrin",
  "Makos",
  "Shevuos",
  "Avodah Zara",
  "Horayos",
  "Zevachim",
  "Menachos",
  "Chullin",
  "Bechoros",
  "Arachin",
  "Temurah",
  "Kerisus",
  "Meilah",
  "Tamid",
  "Niddah",
];

// Seder mapping (Bavli)
const SEDER_OF: Record<
  string,
  "Zeraim" | "Moed" | "Nashim" | "Nezikin" | "Kodashim" | "Taharos"
> = {
  Brachos: "Zeraim",

  Shabbos: "Moed",
  Eruvin: "Moed",
  Pesachim: "Moed",
  Shekalim: "Moed",
  Yoma: "Moed",
  Sukkah: "Moed",
  Beitza: "Moed",
  "Rosh Hashana": "Moed",
  Taanis: "Moed",
  Megillah: "Moed",
  "Moed Katan": "Moed",
  Chagigah: "Moed",

  Yevamos: "Nashim",
  Kesubos: "Nashim",
  Nedarim: "Nashim",
  Nazir: "Nashim",
  Sotah: "Nashim",
  Gittin: "Nashim",
  Kiddushin: "Nashim",

  "Bava Kama": "Nezikin",
  "Bava Metziah": "Nezikin",
  "Bava Basra": "Nezikin",
  Sanhedrin: "Nezikin",
  Makos: "Nezikin",
  Shevuos: "Nezikin",
  "Avodah Zara": "Nezikin",
  Horayos: "Nezikin",

  Zevachim: "Kodashim",
  Menachos: "Kodashim",
  Chullin: "Kodashim",
  Bechoros: "Kodashim",
  Arachin: "Kodashim",
  Temurah: "Kodashim",
  Kerisus: "Kodashim",
  Meilah: "Kodashim",
  Tamid: "Kodashim",

  Niddah: "Taharos",
};

const SEDER_META: Record<
  string,
  { label: string; color: string; border: string }
> = {
  Zeraim: { label: "Seder Zeraim", color: "text-emerald-300", border: "border-emerald-400" },
  Moed: { label: "Seder Moed", color: "text-cyan-300", border: "border-cyan-400" },
  Nashim: { label: "Seder Nashim", color: "text-pink-300", border: "border-pink-400" },
  Nezikin: { label: "Seder Nezikin", color: "text-amber-300", border: "border-amber-400" },
  Kodashim: { label: "Seder Kodashim", color: "text-violet-300", border: "border-violet-400" },
  Taharos: { label: "Seder Taharos", color: "text-rose-300", border: "border-rose-400" },
};

const SEDER_ORDER: (keyof typeof SEDER_META)[] = [
  "Zeraim",
  "Moed",
  "Nashim",
  "Nezikin",
  "Kodashim",
  "Taharos",
];

// ------------------------------
// Helpers
// ------------------------------
function unitize(total: number): string[] {
  const units: string[] = [];
  let start = 2;
  while (start <= total) {
    const end = Math.min(total, Math.floor((start - 1) / 10) * 10 + 10); // 2-10, 11-20, ...
    units.push(`${start}-${end}`);
    start = end + 1;
  }
  return units;
}

const UNITS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TOTAL_DAF).map(([masechta, total]) => [masechta, unitize(total)])
);

function sumDaf(names: string[]) {
  return names.reduce((acc, m) => acc + (TOTAL_DAF[m] || 0), 0);
}

function splitByOrderThirds(): Record<"Easy" | "Medium" | "Hard", string[]> {
  const total = sumDaf(DAF_YOMI_ORDER);
  const target = Math.round(total / 3); // ≈ 914
  const Easy: string[] = [];
  const Medium: string[] = [];
  const Hard: string[] = [];

  let bucket = Easy;
  let running = 0;
  for (const m of DAF_YOMI_ORDER) {
    const n = TOTAL_DAF[m] || 0;
    if (bucket === Easy && running + n > target) {
      bucket = Medium;
      running = 0;
    } else if (bucket === Medium && running + n > target) {
      bucket = Hard;
      running = 0;
    }
    bucket.push(m);
    running += n;
  }
  return { Easy, Medium, Hard };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function rotate<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = 0; i < n; i++) a.push(a.shift() as T);
  return a;
}
function buildMasechtaQueue(units: string[], repeats: number): string[] {
  const seq: string[][] = [];
  for (let r = 0; r < repeats; r++) seq.push(shuffle(units));
  return seq.flat();
}
const startTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
};

// BG + styling helpers
const Bg = () => (
  <div className="fixed inset-0 -z-10">
    <div className="absolute inset-0 bg-gradient-to-br from-black via-[#0a0022] to-black" />
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px)",
      }}
    />
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(255,0,180,0.2) 0%, rgba(0,0,0,0) 60%), radial-gradient(ellipse at 80% 20%, rgba(0,255,255,0.15) 0%, rgba(0,0,0,0) 40%)",
        mixBlendMode: "screen",
      }}
    />
  </div>
);
const neon = "drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]";
const neonPink = "drop-shadow-[0_0_10px_rgba(255,0,180,0.8)]";

// ------------------------------
// App
// ------------------------------
type Tier = "Easy" | "Medium" | "Hard";
type DayItem = { masechta: string; unit: string; tier: Tier };
type Day = { date: Date; items: DayItem[] };

export default function App() {
  const ORDER_TIERS = useMemo(splitByOrderThirds, []);
  const [unitsPerDay, setUnitsPerDay] = useState<number>(3);
  const [data] = useState<Record<string, string[]>>({ ...UNITS });
  const [tiers] = useState<Record<Tier, string[]>>(ORDER_TIERS);

  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const t: Record<string, boolean> = {};
    DAF_YOMI_ORDER.forEach((m) => (t[m] = !!UNITS[m]));
    return t;
  });
  const [repeats, setRepeats] = useState<Record<string, number>>(() => {
    const r: Record<string, number> = {};
    DAF_YOMI_ORDER.forEach((m) => (r[m] = 1));
    return r;
  });
  const [calendar, setCalendar] = useState<Day[] | null>(null);

  const totalSelectedUnits = useMemo(() => {
    return Object.keys(data)
      .filter((m) => toggles[m])
      .reduce((acc, m) => acc + data[m].length * (repeats[m] ?? 1), 0);
  }, [data, toggles, repeats]);

  const totalDaysNeeded = useMemo(() => {
    if (unitsPerDay <= 0) return 0;
    return Math.ceil(totalSelectedUnits / unitsPerDay);
  }, [totalSelectedUnits, unitsPerDay]);

  function buildRotatingPatterns(units: number, dayCount: number): Tier[][] {
    const base: Tier[] = ["Easy", "Medium", "Hard"];
    const patterns: Tier[][] = [];
    for (let d = 0; d < dayCount; d++) {
      const rotated = rotate(base, d % base.length);
      const p: Tier[] = [];
      for (let i = 0; i < units; i++) p.push(rotated[i % rotated.length]);
      patterns.push(p);
    }
    return patterns;
  }

  function prepareSchedule() {
    const start = startTomorrow();
    const pools: Record<Tier, { masechta: string; tier: Tier; queue: string[] }[]> = {
      Easy: [],
      Medium: [],
      Hard: [],
    };
    const tierOf = (m: string): Tier =>
      tiers.Easy.includes(m) ? "Easy" : tiers.Medium.includes(m) ? "Medium" : "Hard";

    // Build pools (respect toggles + repeats)
    for (const m of Object.keys(data)) {
      if (!toggles[m]) continue;
      const tier = tierOf(m);
      const r = Math.min(3, Math.max(1, repeats[m] ?? 1));
      const q = buildMasechtaQueue(data[m], r);
      if (q.length) pools[tier].push({ masechta: m, tier, queue: q });
    }

    // Determine total days
    const totalUnits = (["Easy", "Medium", "Hard"] as Tier[]).reduce(
      (acc, t) => acc + pools[t].reduce((a, b) => a + b.queue.length, 0),
      0
    );
    if (totalUnits === 0) {
      setCalendar([]);
      return;
    }
    const totalDays = Math.ceil(totalUnits / unitsPerDay);
    const basePatterns =
      unitsPerDay === 3 ? Array.from({ length: totalDays }, () => ["Easy", "Medium", "Hard"] as Tier[]) : buildRotatingPatterns(unitsPerDay, totalDays);

    // Shuffle pools + round-robin indexes
    const poolIndex: Record<Tier, number> = { Easy: 0, Medium: 0, Hard: 0 };
    (["Easy", "Medium", "Hard"] as Tier[]).forEach((t) => (pools[t] = shuffle(pools[t])));

    const days: Day[] = [];
    for (let d = 0; d < totalDays; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + d);

      const assigned: DayItem[] = [];
      const seenToday = new Set<string>();

      const tryPickFromTier = (tier: Tier, allowDup = false) => {
        const pool = pools[tier];
        if (!pool || pool.length === 0) return false;
        for (let tries = 0; tries < pool.length; tries++) {
          const idx = (poolIndex[tier] + tries) % pool.length;
          const cand = pool[idx];
          if (cand.queue.length === 0) continue;
          if (!allowDup && seenToday.has(cand.masechta)) continue;
          const unit = cand.queue.shift()!;
          assigned.push({ masechta: cand.masechta, unit, tier });
          seenToday.add(cand.masechta);
          poolIndex[tier] = (idx + 1) % pool.length;
          return true;
        }
        return false;
      };

      while (assigned.length < unitsPerDay) {
        const preferred = basePatterns[d][assigned.length % basePatterns[d].length];
        if (tryPickFromTier(preferred, false)) continue;

        // fallback: other tiers (no dup)
        let got = false;
        for (const t of rotate<Tier>(["Easy", "Medium", "Hard"], d % 3)) {
          if (t === preferred) continue;
          if (tryPickFromTier(t, false)) {
            got = true;
            break;
          }
        }
        // final fallback: allow same-masechta twice in one day if that’s all that’s left
        if (!got) {
          for (const t of rotate<Tier>(["Easy", "Medium", "Hard"], d % 3)) {
            if (tryPickFromTier(t, true)) {
              got = true;
              break;
            }
          }
        }
        if (!got) break; // absolutely nothing left anywhere
      }

      days.push({ date, items: assigned });

      // stop early if we’re truly out
      const remaining =
        pools.Easy.reduce((a, b) => a + b.queue.length, 0) +
        pools.Medium.reduce((a, b) => a + b.queue.length, 0) +
        pools.Hard.reduce((a, b) => a + b.queue.length, 0);
      if (remaining === 0) break;
    }

    setCalendar(days);
    // bring calendar into view
    try {
      document.getElementById("calendarTop")?.scrollIntoView({ behavior: "smooth" });
    } catch {}
  }

  // Open simple B/W month grid in a new tab and call print()
  function openBWWindow() {
    if (!calendar || calendar.length === 0) {
      alert("Prepare a schedule first.");
      return;
    }
    // Group by YYYY-MM
    const byMonth: Record<string, { date: Date; items: { masechta: string; unit: string }[] }[]> =
      {};
    for (const d of calendar) {
      const dt = new Date(d.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      byMonth[key] = byMonth[key] || [];
      byMonth[key].push({
        date: dt,
        items: d.items.map((x) => ({ masechta: x.masechta, unit: x.unit })),
      });
    }
    const keys = Object.keys(byMonth).sort();

    const monthName = (y: number, m: number) =>
      new Date(y, m, 1).toLocaleString(undefined, { month: "long", year: "numeric" });

    const weeksInMonth = (y: number, m: number) => {
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const startIdx = first.getDay(); // 0=Sun
      const days = last.getDate();
      const cells = Array(42)
        .fill(null)
        .map((_, i) => {
          const dayNum = i - startIdx + 1;
          return dayNum >= 1 && dayNum <= days ? dayNum : null;
        });
      return { cells };
    };

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Zichru Schedule</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#000;background:#fff;}
        .month{page-break-after:always;margin:16px auto;width:1000px;}
        h2{font-size:22px;text-align:center;margin:8px 0 6px;}
        table{border-collapse:collapse;width:100%;}
        th,td{border:1px solid #000;padding:6px;vertical-align:top;}
        th{font-size:12px;} td{height:120px;}
        .day{font-weight:700;font-size:12px;margin-bottom:4px;}
        ul{margin:0;padding-left:16px;} li{font-size:12px;}
        @media print { .month{page-break-inside:avoid;} }
      </style></head><body>`;

    for (const key of keys) {
      const [yStr, mStr] = key.split("-");
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10) - 1;
      const { cells } = weeksInMonth(y, m);

      const itemsByDay: Record<number, { masechta: string; unit: string }[]> = {};
      for (const { date, items } of byMonth[key]) {
        const dd = date.getDate();
        itemsByDay[dd] = (itemsByDay[dd] || []).concat(items);
      }

      html += `<div class="month"><h2>${monthName(y, m)}</h2><table><thead><tr>${
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<th>${d}</th>`).join("")
      }</tr></thead><tbody>`;

      for (let row = 0; row < 6; row++) {
        html += "<tr>";
        for (let col = 0; col < 7; col++) {
          const day = cells[row * 7 + col];
          if (!day) {
            html += "<td></td>";
            continue;
          }
          const items = itemsByDay[day] || [];
          html += `<td><div class="day">${day}</div><ul>${items
            .map((it) => `<li>${it.masechta} ${it.unit}</li>`)
            .join("")}</ul></td>`;
        }
        html += "</tr>";
      }
      html += "</tbody></table></div>";
    }

    html +=
      '<script>window.onload=function(){try{window.focus();window.print()}catch(e){}}<\/script></body></html>';

    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) alert("Pop-up blocked. Please allow pop-ups for this site.");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => {
        try {
          w.focus();
          w.print();
        } catch {}
      }, 300);
    }
  }

  const todayStr = useMemo(() => new Date().toLocaleDateString(), []);

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
          {/* Daily settings */}
          <div className="rounded-2xl p-4 border border-cyan-500/30 bg-white/5 backdrop-blur">
            <h2 className={`text-xl font-bold mb-3 ${neon}`}>Daily Settings</h2>

            <label className="block mb-2">Units per day</label>
            <div className="mt-1 flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setUnitsPerDay(n)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    unitsPerDay === n
                      ? "bg-cyan-400 text-black border-cyan-300"
                      : "bg-white/10 text-white border-white/20"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs italic text-cyan-100/80">
              Tier note: Easy/Medium/Hard are determined by order — first third of Shas = Easy, next
              third = Medium, last third = Hard.
            </p>
            <p className="mt-2 text-sm text-cyan-100/80">
              Schedule runs 7 days/week. If set to 3, we aim for Easy + Medium + Hard; if a pool
              runs out, we fill from others to keep the same number per day.
            </p>
            <p className="mt-2 text-sm">
              Total selected units:{" "}
              <span className="text-cyan-300 font-semibold">{totalSelectedUnits}</span>
            </p>
            <p className="text-sm">
              Estimated days:{" "}
              <span className="text-cyan-300 font-semibold">{totalDaysNeeded}</span>
            </p>

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

          {/* Masechtos list */}
          <div className="rounded-2xl p-4 border border-pink-500/30 bg-white/5 backdrop-blur md:col-span-3">
            <h2 className={`text-xl font-bold mb-3 ${neonPink}`}>Masechtos</h2>

            <div className="space-y-6">
              {SEDER_ORDER.map((seder) => {
                const group = DAF_YOMI_ORDER.filter((m) => UNITS[m] && SEDER_OF[m] === seder);
                const meta = SEDER_META[seder];
                const allOn = group.every((m) => !!toggles[m]);
                return (
                  <div key={seder}>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`text-sm font-extrabold tracking-wide uppercase ${meta.color}`}
                      >
                        {meta.label}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = group.some((m) => !toggles[m]);
                          setToggles((prev) => {
                            const n = { ...prev } as Record<string, boolean>;
                            group.forEach((m) => (n[m] = nextState));
                            return n;
                          });
                        }}
                        className={`text-xs px-2 py-1 rounded-full border ${
                          allOn
                            ? "border-white/30 bg-white/20"
                            : "border-white/30 bg-white/10 hover:bg-white/20"
                        }`}
                        title="Toggle entire seder on/off"
                      >
                        Toggle all
                      </button>
                    </div>

                    <ul className="divide-y divide-white/10">
                      {group.map((m) => (
                        <li
                          key={m}
                          className={`flex items-center justify-between py-2 pl-2 border-l-4 ${meta.border}`}
                        >
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={!!toggles[m]}
                              onChange={(e) =>
                                setToggles({ ...toggles, [m]: e.target.checked })
                              }
                            />
                            <span>{m}</span>
                          </label>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-200">reviews</span>
                            <div className="flex gap-1">
                              {[1, 2, 3].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setRepeats({ ...repeats, [m]: n })}
                                  className={`px-2 py-0.5 rounded-full border text-xs ${
                                    (repeats[m] ?? 1) === n
                                      ? "bg-cyan-300 text-black border-cyan-200"
                                      : "bg-white/10 text-white border-white/20"
                                  }`}
                                  aria-pressed={(repeats[m] ?? 1) === n}
                                  title={`${n} review${n > 1 ? "s" : ""}`}
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

        {/* Calendar */}
        <section id="calendarTop" className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-extrabold ${neon}`}>Generated Calendar</h2>
            <button
              onClick={openBWWindow}
              className="screen-only inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white text-black font-bold uppercase tracking-wide border border-black/30 hover:bg-slate-200"
              title="Open a black & white printable calendar"
            >
              Open B/W PDF
            </button>
          </div>

          {!calendar && (
            <p className="text-center opacity-80">
              Click <b>Prepare Schedule</b> to generate your calendar starting tomorrow.
            </p>
          )}

          {calendar && calendar.length === 0 && (
            <p className="text-center opacity-80">No units selected. Turn on some masechtos.</p>
          )}

          {calendar && calendar.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calendar.map((day, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl p-4 bg-black/40 border border-cyan-400/30 shadow-[0_0_20px_rgba(0,255,255,0.2)]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-bold text-cyan-300">
                      {day.date.toLocaleDateString()}
                    </div>
                    <div className="text-xs opacity-70">Day {idx + 1}</div>
                  </div>
                  <ul className="space-y-2">
                    {day.items.map((it, j) => (
                      <li
                        key={j}
                        className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10"
                      >
                        <span className="font-semibold">
                          {it.masechta} <span className="opacity-80">{it.unit}</span>
                        </span>
                        <span
                          className={`text-xs uppercase tracking-wide px-2 py-0.5 rounded border ${
                            it.tier === "Easy"
                              ? "border-cyan-300 text-cyan-300"
                              : it.tier === "Medium"
                              ? "border-yellow-300 text-yellow-300"
                              : "border-pink-300 text-pink-300"
                          }`}
                        >
                          {it.tier}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Minimal print CSS */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .screen-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
