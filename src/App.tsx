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
// Difficulty tiers (editable later if desired)
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
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildMasechtaQueue(units: string[], repeats: number): string[] {
  const sequences: string[][] = [];
  for (let r = 0; r < repeats; r++) sequences.push(shuffle(units));
  return sequences.flat();
}
function rotate<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = 0; i < n; i++) a.push(a.shift() as T);
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
  const [unitsPerDay, setUnitsPerDay] = useState<number>(3);
  const [data, setData] = useState<Record<string, string[]>>({ ...UNITS });
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const t: Record<string, boolean> = {};
    DAF_YOMI_ORDER.forEach((m) => { if (UNITS[m]) t[m] = true; });
    return t;
  });
  const [repeats, setRepeats] = useState<Record<string, number>>(() => {
    const r: Record<string, number> = {};
    DAF_YOMI_ORDER.forEach((m) => { if (UNITS[m]) r[m] = 1; });
    return r;
  });
    const [calendar, setCalendar] = useState<null | { date: Date; items: { masechta: string; unit: string; tier: string }[] }[]>(null);

  const ensureStateForData = (dataset: Record<string, string[]>) => {
    setToggles((prev) => {
      const n: Record<string, boolean> = { ...prev };
      Object.keys(dataset).forEach((m) => { if (!(m in n)) n[m] = true; });
      Object.keys(n).forEach((k) => { if (!(k in dataset)) delete n[k]; });
      return n;
    });
    setRepeats((prev) => {
      const n: Record<string, number> = { ...prev };
      Object.keys(dataset).forEach((m) => { if (!(m in n)) n[m] = 1; });
      Object.keys(n).forEach((k) => { if (!(k in dataset)) delete n[k]; });
      return n;
    });
  };

  function prepareSchedule() {
    const start = startTomorrow();
    const pools: Record<string, { masechta: string; tier: string; queue: string[] }[]> = { Easy: [], Medium: [], Hard: [] };

    const includedMasechtos = Object.keys(data).filter((m) => toggles[m]);
    const tierOf = (m: string): keyof typeof tiers => {
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
    const basePatterns: (keyof typeof tiers)[][] = unitsPerDay === 3
      ? Array(totalDays).fill(["Easy", "Medium", "Hard"])
      : buildRotatingPatterns(unitsPerDay, totalDays);

    const days: { date: Date; items: { masechta: string; unit: string; tier: string }[] }[] = [];
    const poolIndex: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
    Object.keys(pools).forEach((t) => { pools[t] = shuffle(pools[t]); });

    for (let d = 0; d < totalDays; d++) {
      const date = new Date(start); date.setDate(start.getDate() + d);
      const assigned: { masechta: string; unit: string; tier: string }[] = [];
      const seenToday = new Set<string>();

      // Helper to pick from a specific tier; if allowDup=false, avoid same masechta twice in a day
      const tryPickFromTier = (tier: keyof typeof tiers, allowDup = false) => {
        const pool = pools[tier];
        if (!pool || pool.length === 0) return false;
        for (let tries = 0; tries < pool.length; tries++) {
          const idx = (poolIndex[tier] + tries) % pool.length;
          const candidate = pool[idx];
          if (candidate.queue.length === 0) continue;
          if (!allowDup && seenToday.has(candidate.masechta)) continue;
          const unit = candidate.queue.shift()!;
          assigned.push({ masechta: candidate.masechta, unit, tier });
          seenToday.add(candidate.masechta);
          poolIndex[tier] = (idx + 1) % pool.length;
          return true;
        }
        return false;
      };

      // Fill exactly unitsPerDay items, using preferred pattern but falling back to any available tiers
      while (assigned.length < unitsPerDay) {
        const preferred = basePatterns[d][assigned.length % basePatterns[d].length];
        if (tryPickFromTier(preferred, false)) continue;
        const order: (keyof typeof tiers)[] = rotate(["Easy","Medium","Hard"], d % 3);
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
        if (!got) break; // nothing left anywhere
      }
      days.push({ date, items: assigned });
      const remaining = Object.values(pools).flat().reduce((acc, item) => acc + item.queue.length, 0);
      if (remaining === 0) break;
    }

    setCalendar(days);
    // bring calendar into view for the user
    try { document.getElementById('calendarTop')?.scrollIntoView({ behavior: 'smooth' }); } catch (e) {}
  }

  function buildRotatingPatterns(units: number, dayCount: number): (keyof typeof tiers)[][] {
    const base: (keyof typeof tiers)[] = ["Easy", "Medium", "Hard"];
    const patterns: (keyof typeof tiers)[][] = [];
    for (let d = 0; d < dayCount; d++) {
      const rotated = rotate(base, d % base.length);
      const p: (keyof typeof tiers)[] = [];
      for (let i = 0; i < units; i++) p.push(rotated[i % rotated.length]);
      patterns.push(p);
    }
    return patterns;
  }

  function openBWWindow() {
    if (!calendar || calendar.length === 0) { alert('Prepare a schedule first.'); return; }

    // Group by month without using modern assignment operators (broader runtime support)
    const map: Record<string, {date: Date; items: {masechta:string; unit:string}[]}[]> = {};
    for (const d of calendar) {
      const dt = new Date(d.date);
      const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
      if (!map[key]) map[key] = [];
      map[key].push({ date: dt, items: d.items.map(x => ({ masechta: x.masechta, unit: x.unit })) });
    }
    const keys = Object.keys(map).sort();

    const monthName = (y:number,m:number) => new Date(y,m,1).toLocaleString(undefined, { month:'long', year:'numeric' });
    const weeksInMonth = (y:number,m:number) => {
      const first = new Date(y,m,1); const last = new Date(y,m+1,0);
      const startIdx = first.getDay(); // 0=Sun
      const days = last.getDate();
      const cells = Array(42).fill(null).map((_,i)=>{
        const dayNum = i - startIdx + 1;
        return (dayNum>=1 && dayNum<=days) ? dayNum : null;
      });
      return { cells };
    };

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Zichru Schedule</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial; color:#000; background:#fff;}
        .month{page-break-after:always; margin:16px auto; width:1000px;}
        h2{font-size:22px; text-align:center; margin:8px 0 6px;}
        table{border-collapse:collapse; width:100%;}
        th,td{border:1px solid #000; padding:6px; vertical-align:top;}
        th{font-size:12px;}
        td{height:120px;}
        .day{font-weight:700; font-size:12px; margin-bottom:4px;}
        ul{margin:0; padding-left:16px;}
        li{font-size:12px;}
        @media print { .month{page-break-inside:avoid;} }
      </style></head><body>`;

    for (const key of keys) {
      const [yStr,mStr] = key.split('-'); const y = parseInt(yStr,10); const m = parseInt(mStr,10)-1;
      const { cells } = weeksInMonth(y,m);
      const byDay: Record<number, {masechta:string; unit:string}[]> = {};
      for (const {date, items} of map[key]) {
        const dd = date.getDate();
        if (!byDay[dd]) byDay[dd] = [];
        byDay[dd] = byDay[dd].concat(items);
      }
      html += `<div class="month"><h2>${monthName(y,m)}</h2><table><thead><tr>` +
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<th>${d}</th>`).join('') +
        `</tr></thead><tbody>`;
      for (let row=0; row<6; row++) {
        html += '<tr>';
        for (let col=0; col<7; col++) {
          const day = cells[row*7+col];
          if (!day) { html += '<td></td>'; continue; }
          const items = byDay[day]||[];
          html += `<td><div class="day">${day}</div><ul>` + items.map(it=>`<li>${it.masechta} ${it.unit}</li>`).join('') + `</ul></td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }

    html += '<script>window.onload=function(){try{window.focus();window.print()}catch(e){}}<\/script></body></html>';

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if (!w) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(() => { try { w.focus(); w.print(); } catch { /* no-op */ } }, 300);
    }
  }

  const totalSelectedUnits = useMemo(() => {
    return Object.keys(data)
      .filter((m) => toggles[m])
      .reduce((acc, m) => acc + data[m].length * (repeats[m] ?? 1), 0);
  }, [data, toggles, repeats]);

  const totalDaysNeeded = useMemo(() => {
    if (unitsPerDay <= 0) return 0;
    return Math.ceil(totalSelectedUnits / unitsPerDay);
  }, [totalSelectedUnits, unitsPerDay]);

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
        {/* Controls */}
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

            {/* Vertical list in Daf Yomi order, grouped by Seder */}
            <div className="space-y-6">
              {SEDER_ORDER.map((seder) => {
                const group = DAF_YOMI_ORDER.filter((m) => data[m] && SEDER_OF[m] === seder);
                const meta = SEDER_META[seder];
                return (
                  <div key={seder}>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`text-sm font-extrabold tracking-wide uppercase ${meta.color}`}>{meta.label}</div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextState = group.some((m) => !toggles[m]);
                          setToggles((prev) => {
                            const n = { ...prev } as Record<string, boolean>;
                            group.forEach((m) => { n[m] = nextState; });
                            return n;
                          });
                        }}
                        className="text-xs px-2 py-1 rounded-full border border-white/30 bg-white/10 hover:bg-white/20"
                        title="Toggle entire seder on/off"
                      >
                        Toggle all
                      </button>
                    </div>
                      <label className="flex items-center gap-2 text-xs opacity-90">
                        <input
                          type="checkbox"
                          checked={group.every((m) => !!toggles[m])}
                          onChange={() => {
                            const nextState = group.some((m) => !toggles[m]);
                            setToggles((prev) => {
                              const n = { ...prev } as Record<string, boolean>;
                              group.forEach((m) => { n[m] = nextState; });
                              return n;
                            });
                          }}
                        />
                        <span>Toggle all</span>
                      </label>
                    </div>
                    <ul className="divide-y divide-white/10">
                      {group.map((m) => (
                        <li key={m} className={`flex items-center justify-between py-2 pl-2 border-l-4 ${meta.border}`}>
                          <label className="flex items-center gap-3">
                            <input type="checkbox" checked={!!toggles[m]} onChange={() => setToggles({ ...toggles, [m]: !toggles[m] })} />
                            <span>{m}</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-200">reviews</span>
                            <div className="flex gap-1">
                              {[1,2,3].map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setRepeats({ ...repeats, [m]: n })}
                                  className={`px-2 py-0.5 rounded-full border text-xs ${ (repeats[m] ?? 1)===n ? 'bg-cyan-300 text-black border-cyan-200' : 'bg-white/10 text-white border-white/20' }`}
                                  aria-pressed={(repeats[m] ?? 1)===n}
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

        {/* Calendar grid */}
        <section id="calendarTop" className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-2xl font-extrabold ${neon}`}>Generated Calendar</h2>
            <button
              onClick={openBWWindow}
              className="screen-only inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-white text-black font-bold uppercase tracking-wide border border-black/30 hover:bg-slate-200"
              title="Download a black & white PDF in calendar format"
            >Open B/W PDF</button>
          </div>

          {!calendar && (
            <p className="text-center opacity-80">Click <b>Prepare Schedule</b> to generate your calendar starting tomorrow.</p>
          )}

          {calendar && calendar.length === 0 && (
            <p className="text-center opacity-80">No units selected. Turn on some masechtos.</p>
          )}

          {calendar && calendar.length > 0 && (
            <>
              {/* Screen view cards */}
              <div className="screen-only grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calendar.map((day, idx) => (
                  <div key={idx} className="rounded-2xl p-4 bg-black/40 border border-cyan-400/30 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-bold text-cyan-300">{day.date.toLocaleDateString()}</div>
                      <div className="text-xs opacity-70">Day {idx + 1}</div>
                    </div>
                    <ul className="space-y-2">
                      {day.items.map((it, j) => (
                        <li key={j} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                          <span className="font-semibold">{it.masechta} <span className="opacity-80">{it.unit}</span></span>
                          <span className={`text-xs uppercase tracking-wide px-2 py-0.5 rounded border ${
                            it.tier === "Easy" ? "border-cyan-300 text-cyan-300" : it.tier === "Medium" ? "border-yellow-300 text-yellow-300" : "border-pink-300 text-pink-300"
                          }`}>{it.tier}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Print-only B/W month calendars */}
              <div className="print-only print-bw" style={{ display: 'none' }}>
                {(() => {
                  // Group days by month (YYYY-MM)
                  const map: Record<string, {date: Date; items: {masechta:string; unit:string}[]}[]> = {};
                  for (const d of calendar) {
                    const dt = new Date(d.date);
                    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
                    (map[key] ||= []).push({ date: dt, items: d.items.map(x => ({masechta:x.masechta, unit:x.unit})) });
                  }
                  const keys = Object.keys(map).sort();
                  const monthName = (y:number,m:number) => new Date(y,m,1).toLocaleString(undefined, { month:'long', year:'numeric' });

                  const weeksInMonth = (y:number,m:number) => {
                    const first = new Date(y,m,1); const last = new Date(y,m+1,0);
                    const startIdx = first.getDay(); // 0=Sun
                    const days = last.getDate();
                    const cells = Array(42).fill(null).map((_,i)=>{
                      const dayNum = i - startIdx + 1;
                      return (dayNum>=1 && dayNum<=days) ? dayNum : null;
                    });
                    return { cells };
                  };

                  return keys.map((key) => {
                    const [yStr,mStr] = key.split('-'); const y = parseInt(yStr,10); const m = parseInt(mStr,10)-1;
                    const { cells } = weeksInMonth(y,m);
                    // Map date->items
                    const byDay: Record<number, {masechta:string; unit:string}[]> = {};
                    for (const {date, items} of map[key]) {
                      byDay[date.getDate()] = (byDay[date.getDate()]||[]).concat(items);
                    }
                    return (
                      <div key={key} style={{ pageBreakAfter: 'always' }}>
                        <div className="text-center font-bold text-2xl mb-2">{monthName(y,m)}</div>
                        <table className="w-full border-collapse mb-6">
                          <thead>
                            <tr>
                              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                                <th key={d} className="border p-1 text-sm">{d}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({length:6}).map((_,row)=> (
                              <tr key={row}>
                                {cells.slice(row*7,(row+1)*7).map((day, col) => (
                                  <td key={col} className="align-top border p-2 h-32">
                                    {day && (
                                      <div>
                                        <div className="font-bold text-sm mb-1">{day}</div>
                                        <ul className="text-xs space-y-1">
                                          {(byDay[day]||[]).map((it, i)=> (
                                            <li key={i}>{it.masechta} {it.unit}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}
        </section>
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .screen-only { display: none !important; }
          .print-only { display: block !important; }
          .print-bw, .print-bw *, .pdf-bw, .pdf-bw * {
            color: #000 !important;
            background: #fff !important;
            border-color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
            filter: none !important;
          }
          header, button, input, select { filter: none !important; box-shadow: none !important; }
          table { page-break-inside: avoid; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          td, th { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
