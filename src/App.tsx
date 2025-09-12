import React, { useMemo, useState } from "react";

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
  "Brach
