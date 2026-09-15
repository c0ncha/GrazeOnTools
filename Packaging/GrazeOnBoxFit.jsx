import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import * as THREE from "three";

// ---------- brand tokens (from the GrazeOn SOP) ----------
const C = {
  coral: "#F76C6C",
  coralSoft: "#FCE3E0",
  ember: "#E8631E",
  ink: "#191613",
  bone: "#FBF6EF",
  muted: "#6B6259",
  line: "#E7DDD0",
  green: "#3F7A52",
  amber: "#FFF4E8",
};

const STORAGE_KEY = "grazeon-boxfit-v1";

// ---------- catalog ----------
const YOUR_BOXES = [
  { id: "y1", name: "Small (10 × 8 × 6)", dims: [10, 8, 6], source: "yours" },
  { id: "y2", name: "Master (12 × 8 × 9)", dims: [12, 8, 9], source: "yours" },
  { id: "y3", name: "Big (16 × 12 × 13)", dims: [16, 12, 13], source: "yours" },
];
const ULINE = [
  [6, 4, 4], [6, 6, 6], [8, 6, 4], [8, 8, 6], [8, 8, 8], [9, 6, 4],
  [10, 8, 6], [10, 8, 8], [10, 10, 10], [12, 8, 6], [12, 9, 6], [12, 10, 8],
  [12, 12, 6], [12, 12, 8], [12, 12, 12], [14, 10, 8], [14, 12, 10], [14, 14, 14],
  [15, 12, 10], [16, 12, 8], [16, 12, 12], [16, 16, 16], [18, 12, 12], [18, 14, 12],
  [18, 18, 18], [20, 16, 12], [20, 20, 12], [24, 18, 12], [24, 18, 18],
].map((d) => ({ id: "u" + d.join("x"), name: `Uline ${d.join(" × ")}`, dims: d, source: "uline" }));

// The Boxery corrugated boxes on Amazon (one ASIN per size). [dims, label, asin]
const AMAZON = [
  [[3, 3, 3], "3 x 3 x 3", "B0FGKQZNJ2"],
  [[4, 4, 4], "4 x 4 x 4", "B075GTYVS5"],
  [[5, 5, 3], "5 x 5 x 3", "B0G4KYC6DY"],
  [[6, 4, 4], "6 x 4 x 4", "B075GWLDP5"],
  [[7, 5, 3], "7 x 5 x 3", "B075GWTWWQ"],
  [[7, 4, 4], "7 x 4 x 4", "B075GYV9GX"],
  [[8.5, 4.5, 3.125], "8 1/2 x 4 1/2 x 3 1/8", "B0G4KZ4BWM"],
  [[8, 5, 3], "8 x 5 x 3", "B0G4KYTNQ4"],
  [[6, 5, 4], "6 x 5 x 4", "B0DHYGP41W"],
  [[5, 5, 5], "5 x 5 x 5", "B075GWMZZS"],
  [[8, 4, 4], "8 x 4 x 4", "B0G4KXTP24"],
  [[7, 5, 4], "7 x 5 x 4", "B0G4KWSPPB"],
  [[10, 7, 2], "10 x 7 x 2", "B0G4KZGSW5"],
  [[8, 6, 3], "8 x 6 x 3", "B0G4KZJBMQ"],
  [[9, 4, 4], "9 x 4 x 4", "B0G4KZLK9T"],
  [[6, 6, 4], "6 x 6 x 4", "B0G4KXYBL8"],
  [[7, 7, 3], "7 x 7 x 3", "B0G4KX9L1W"],
  [[6, 5, 5], "6 x 5 x 5", "B0G4KZN5TB"],
  [[8, 5, 4], "8 x 5 x 4", "B0G4KW322P"],
  [[10, 4, 4], "10 x 4 x 4", "B075GZRSND"],
  [[7, 5, 5], "7 x 5 x 5", "B075GTCWRT"],
  [[9, 5, 4], "9 x 5 x 4", "B0G4KYR8Y5"],
  [[10, 6, 3], "10 x 6 x 3", "B0G4KZL5H9"],
  [[12, 4, 4], "12 x 4 x 4", "B075GZWCDX"],
  [[8, 6, 4], "8 x 6 x 4", "B075H1HWPW"],
  [[8, 8, 3], "8 x 8 x 3", "B0G4KX7KGS"],
  [[9.5, 6, 3.375], "9 1/2 x 6 x 3 3/8", "B0DHYHBK95"],
  [[7, 7, 4], "7 x 7 x 4", "B075GX7BK3"],
  [[5, 5, 8], "5 x 5 x 8", "B0G4L1218W"],
  [[6, 6, 6], "6 x 6 x 6", "B09PF7XNN4"],
  [[9, 6, 4], "9 x 6 x 4", "B0DHYCRH23"],
  [[14, 4, 4], "14 x 4 x 4", "B0G4KYGBLB"],
  [[9, 5, 5], "9 x 5 x 5", "B0G4L1PKQS"],
  [[10, 8, 3], "10 x 8 x 3", "B075GX2339"],
  [[8, 6, 5], "8 x 6 x 5", "B075H2D3Y3"],
  [[10, 6, 4], "10 x 6 x 4", "B0G4KZ9WP4"],
  [[7, 7, 5], "7 x 7 x 5", "B0G4KYSQTW"],
  [[10, 5, 5], "10 x 5 x 5", "B0G4KY2DMQ"],
  [[7, 6, 6], "7 x 6 x 6", "B0G4KYWV5K"],
  [[9, 7, 4], "9 x 7 x 4", "B0G4KYP81D"],
  [[8, 8, 4], "8 x 8 x 4", "B0G4L14CL5"],
  [[9, 6, 5], "9 x 6 x 5", "B0G4L1QXP8"],
  [[10, 7, 4], "10 x 7 x 4", "B075GY2MN2"],
  [[12, 6, 4], "12 x 6 x 4", "B075GT45K3"],
  [[8, 6, 6], "8 x 6 x 6", "B0G4KXDJS7"],
  [[18, 4, 4], "18 x 4 x 4", "B0G4KXHCMK"],
  [[10, 6, 5], "10 x 6 x 5", "B0G4KXNT5J"],
  [[12, 5, 5], "12 x 5 x 5", "B0G4KZQ3YT"],
  [[10, 10, 3], "10 x 10 x 3", "B0G4KZ5L68"],
  [[9, 7, 5], "9 x 7 x 5", "B075GYHT17"],
  [[10, 8, 4], "10 x 8 x 4", "B0G4L1R4YL"],
  [[8, 8, 5], "8 x 8 x 5", "B075GX79NP"],
  [[12, 9, 3], "12 x 9 x 3", "B075GYNK8B"],
  [[9, 9, 4], "9 x 9 x 4", "B0G4KYGQKG"],
  [[9, 6, 6], "9 x 6 x 6", "B0G4L1HLYD"],
  [[14, 6, 4], "14 x 6 x 4", "B075GWTWWY"],
  [[7, 7, 7], "7 x 7 x 7", "B075GT49R5"],
  [[10, 7, 5], "10 x 7 x 5", "B0G4KZG3DV"],
  [[10, 6, 6], "10 x 6 x 6", "B0G4KZN45V"],
  [[12, 10, 3], "12 x 10 x 3", "B0G4KZQ3YS"],
  [[9, 7, 6], "9 x 7 x 6", "B0G4KZ9894"],
  [[4, 4, 24], "4 x 4 x 24", "B0G4KY7Z4L"],
  [[12, 8, 4], "12 x 8 x 4", "B075GZ7Y84"],
  [[16, 6, 4], "16 x 6 x 4", "B0G4KY31LJ"],
  [[8, 8, 6], "8 x 8 x 6", "B0G4L158TW"],
  [[7, 7, 8], "7 x 7 x 8", "B0G4KYV36P"],
  [[10, 8, 5], "10 x 8 x 5", "B0G4KXJJBZ"],
  [[10, 10, 4], "10 x 10 x 4", "B0G4KZM2FV"],
  [[9, 9, 5], "9 x 9 x 5", "B0DHYGW6YH"],
  [[12, 9, 4], "12 x 9 x 4", "B0G4KYJV8H"],
  [[12, 6, 6], "12 x 6 x 6", "B075GZGZ27"],
  [[9, 7, 7], "9 x 7 x 7", "B0G4KW5DQX"],
  [[14, 10.5, 3], "14 x 10 1/2 x 3", "B0DHYGFM78"],
  [[6.625, 6.125, 10.9375], "6 5/8 x 6 1/8 x 10 15/16", "B0DHYGRQWK"],
  [[8, 8, 7], "8 x 8 x 7", "B0G4KVMB6X"],
  [[14, 8, 4], "14 x 8 x 4", "B075H2KM75"],
  [[12, 10, 4], "12 x 10 x 4", "B075H1H31K"],
  [[10, 8, 6], "10 x 8 x 6", "B075GXM6KN"],
  [[12, 8, 5], "12 x 8 x 5", "B075GYLGN3"],
  [[9, 9, 6], "9 x 9 x 6", "B0G4KZ7VY4"],
  [[12.75, 4.5, 8.5], "12 3/4 x 4 1/2 x 8 1/2", "B0DHYDGF33"],
  [[10, 7, 7], "10 x7 x 7", "B0G4KZKNHC"],
  [[10, 10, 5], "10 x 10 x 5", "B0G4KY31LH"],
  [[14, 6, 6], "14 x 6 x 6", "B0G4KYM9M7"],
  [[8, 8, 8], "8 x 8 x 8", "B0G4KXJBRH"],
  [[13, 10, 4], "13 x 10 x 4", "B0G4KZPN6R"],
  [[8.625, 6.25, 9.75], "8 5/8 x 6 1/4 x 9 3/4", "B0DHYC7HF9"],
  [[11, 7, 7], "11 x 7 x 7", "B0G4KYYQ5S"],
  [[12, 9, 5], "12 x 9 x 5", "B0G4KZDTWG"],
  [[14, 8, 5], "14 x 8 x 5", "B0G4KXXK76"],
  [[12, 12, 4], "12 x 12 x 4", "B0G4KZLV8R"],
  [[12, 8, 6], "12 x 8 x 6", "B0G4KZ3B3W"],
  [[14, 10.5, 4], "14 x 10 1/2 x 4", "B0DHYGH487"],
  [[10, 10, 6], "10 x 10 x 6", "B0G4KYZ1Y1"],
  [[13, 7, 7], "13 x 7 x 7", "B0G4KYHWSR"],
  [[10, 8, 8], "10 x 8 x 8", "B075GYQXW9"],
  [[12, 9, 6], "12 x 9 x 6", "B0G4KW533N"],
  [[13, 10, 5], "13 x 10 x 5", "B0G4KZ96BD"],
  [[14, 12, 4], "14 x 12 x 4", "B0G4L1HZTX"],
  [[12, 8, 7], "12 x 8 x 7", "B0G4KYJQ8F"],
  [[14, 7, 7], "14 x 7 x 7", "B0G4KYT4WV"],
  [[9.5, 7, 10.75], "9 1/2 x 7 x 10 3/4", "B0DHYGHB93"],
  [[13, 11, 5], "13 x 11 x 5", "B0G4KZ9SS6"],
  [[12, 12, 5], "12 x 12 x 5", "B075GYGT2Q"],
  [[12, 10, 6], "12 x 10 x 6", "B075GVPL3H"],
  [[9, 9, 9], "9 x 9 x 9", "B075GZZKTC"],
  [[14.5, 8.5, 6], "14 1/2 x 8 1/2 x 6", "B0G4KY152P"],
  [[14, 9, 6], "14 x 9 x 6", "B0G4KYXRTF"],
  [[16, 12, 4], "16 x 12 x 4", "B0G4KZ3NV8"],
  [[12, 8, 8], "12 x 8 x 8", "B075GWTTJC"],
  [[14, 14, 4], "14 x 14 x 4", "B0G4KYGBLD"],
  [[10, 10, 8], "10 x 10 x 8", "B0G4KYHJJZ"],
  [[13, 13, 5], "13 x 13 x 5", "B0G45C1RSV"],
  [[13, 11, 6], "13 x 11 x 6", "B0G4L1WVJH"],
  [[18, 12, 4], "18 x 12 x 4", "B0HF9TNLD5"],
  [[12, 12, 6], "12 x 12 x 6", "B075GS1XQD"],
  [[12, 9, 8], "12 x 9 x 8", "B0HFB2PWZB"],
  [[22, 10, 4], "22 x 10 x 4", "B0G4KZ4551"],
  [[14, 10.5, 6], "14 x 10 1/2 x 6", "B0DHYF822H"],
  [[15, 12, 5], "15 x 12 x 5", "B0G4KYTJMX"],
  [[15, 10, 6], "15 x 10 x 6", "B0GLKBRT13"],
  [[13, 10, 7], "13 x 10 x 7", "B0G4KY4GFG"],
  [[12, 10, 8], "12 x 10 x 8", "B075GWQCFY"],
  [[16, 10, 6], "16 x 10 x 6", "B0HFB2W84J"],
  [[12, 9, 9], "12 x 9 x 9", "B0G4KYS5GX"],
  [[18, 6.5, 8.5], "18 x 6 1/2 x 8 1/2", "B0DHYG65SD"],
  [[10, 10, 10], "10 x 10 x 10", "B075H3DKLR"],
  [[18, 14, 4], "18 x 14 x 4", "B0HF9ZKJZQ"],
  [[12, 12, 7], "12 x 12 x 7", "B0G4L1L7GZ"],
  [[14, 12, 6], "14 x 12 x 6", "B0G4KWH2TV"],
  [[13, 13, 6], "13 x 13 x 6", "B0H6GMVDSG"],
  [[16, 8, 8], "16 x 8 x 8", "B0G45BRNNZ"],
  [[16, 16, 4], "16 x 16 x 4", "B0DHYFPDYQ"],
  [[13, 10, 8], "13 x 10 x 8", "B0G4KYTPVM"],
  [[18, 12, 5], "18 x 12 x 5", "B0DHYH2BJH"],
  [[11, 11, 9], "11 x 11 x 9", "B0G4KYM9M6"],
  [[16, 14, 5], "16 x 14 x 5", "B0G4KYRZD2"],
  [[14, 9, 9], "14 x 9 x 9", "B0G4L1SQPJ"],
  [[16, 12, 6], "16 x 12 x 6", "B0G4KWLZXZ"],
  [[12, 12, 8], "12 x 12 x 8", "B075GP73ZV"],
  [[14, 14, 6], "14 x 14 x 6", "B0G4KXNDSG"],
  [[14, 10.5, 8], "14 x 10 1/2 x 8", "B0DHYF6PGH"],
  [[13, 13, 7], "13 x 13 x 7", "B0G4KYXRR1"],
  [[12, 10, 10], "12 x 10 x 10", "B075GWL14J"],
  [[18, 13.75, 5], "18 x 13 3/4 x 5", "B0DHYD367G"],
  [[16, 10, 8], "16 x 10 x 8", "B0DHYFJ9DG"],
  [[18, 12, 6], "18 x 12 x 6", "B0HF9R12FF"],
  [[13, 10, 10], "13 x 10 x 10", "B0G4KY3LQN"],
  [[11, 11, 11], "11 x 11 x 11", "B0G4KY7BG8"],
  [[14, 12, 8], "14 x 12 x 8", "B0G4L25DZ9"],
  [[16, 14, 6], "16 x 14 x 6", "B0HFB2PN2Y"],
  [[14, 10.5, 10], "14 x 10 1/2 x 10", "B0DHYFWL3K"],
  [[15, 10, 10], "15 x 10 x 10", "B0G4KXW275"],
  [[16, 16, 6], "16 x 16 x 6", "B0DHYFBYX2"],
  [[16, 12, 8], "16 x 12 x 8", "B0G4KYSWNH"],
  [[16, 10, 10], "16 x 10 x 10", "B0DHYFXL85"],
  [[7, 7, 33], "7 x 7 x 33", "B075GVPM13"],
  [[14, 12, 10], "14 x 12 x 10", "B0G4KYCR1P"],
  [[18, 12, 8], "18 x 12 x 8", "B0HF9X9964"],
  [[12, 12, 12], "12 x 12 x 12", "B075GY4SFZ"],
  [[17.5, 13.5, 7.5], "17 1/2 x 13 1/2 x 7 1/2", "B0DHYFW6SN"],
  [[16, 12, 10], "16 x 12 x 10", "B0G4KZRBKY"],
  [[18, 18, 6], "18 x 18 x 6", "B0G4KVJQCS"],
  [[14, 14, 10], "14 x 14 x 10", "B0G4L14ZPG"],
  [[16, 16, 8], "16 x 16 x 8", "B0DHYFHKLR"],
  [[18, 12, 10], "18 x 12 x 10", "B0HFB595ZC"],
  [[12, 12, 15], "12 x 12 x 15", "B0G4KYP81C"],
  [[13, 13, 13], "13 x 13 x 13", "B0G4KW322Q"],
  [[16, 14, 10], "16 x 14 x 10", "B0G4KXLBMS"],
  [[17, 17, 8], "17 x 17 x 8", "B0G4KYYQ5T"],
  [[18, 12, 12], "18 x 12 x 12", "B0G4KYFQZ8"],
  [[14, 14, 14], "14 x 14 x 14", "B0G4KZ6G7R"],
  [[18, 16, 10], "18 x 16 x 10", "B0G4KY12HC"],
  [[18, 14, 12], "18 x 14 x 12", "B0HF9R573R"],
  [[16, 14, 14], "16 x 14 x 14", "B0G4KZRGVC"],
  [[22, 17, 12], "22 x 17 x 12", "B0G4KYKXR6"],
  [[20, 20, 12], "20 x 20 x 12", "B0G4KXW2M5"],
  [[18, 18, 18], "18 x 18 x 18", "B0HFB7L33Q"],
  [[12, 12, 48], "12 x 12 x 48", "B075GVRZH5"],
  [[20, 20, 20], "20 x 20 x 20", "B0HFB4Y7Q9"],
].map(([d, label, asin]) => ({ id: "a" + asin, name: `Amazon ${label}`, dims: d, source: "amazon", url: `https://www.amazon.com/dp/${asin}` }));

// ---------- solver ----------
const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

function factorTriples(n) {
  const out = [];
  for (let a = 1; a <= n; a++) {
    if (n % a) continue;
    for (let b = 1; b <= n / a; b++) {
      if ((n / a) % b) continue;
      out.push([a, b, n / (a * b)]);
    }
  }
  return out;
}

// round a dimension up to the next multiple of step (0 = no rounding)
const roundUp = (v, step) => (step > 0 ? Math.ceil(v / step - 1e-9) * step : v);

// item: [x,y,z] of the thing being packed. Returns arrangements sorted tightest first.
// step rounds each suggested box side up to the nearest step (1, 0.5, or 0 for exact).
function solve(item, n, clr, step = 0) {
  if (!n || n < 1) return [];
  const seen = new Map();
  for (const [a, b, c] of factorTriples(n)) {
    for (const p of PERMS) {
      const it = [item[p[0]], item[p[1]], item[p[2]]];
      const inner = [a * it[0] + 2 * clr, b * it[1] + 2 * clr, c * it[2] + 2 * clr].map((v) => roundUp(v, step));
      const key = [...inner].sort((x, y) => x - y).map((v) => v.toFixed(3)).join("x");
      if (seen.has(key)) continue;
      seen.set(key, {
        key,
        counts: [a, b, c],
        itemDims: it,
        dims: inner,
        vol: inner[0] * inner[1] * inner[2],
        surf: 2 * (inner[0] * inner[1] + inner[1] * inner[2] + inner[0] * inner[2]),
        maxSide: Math.max(...inner),
      });
    }
  }
  return [...seen.values()].sort((x, y) => x.vol - y.vol || x.surf - y.surf || x.maxSide - y.maxSide);
}

// USPS Ground Advantage rules as written in the SOP (post July 12, 2026).
function postage(dims, contentsOz) {
  const r = dims.map((d) => Math.ceil(d - 1e-9));
  const cuin = r[0] * r[1] * r[2];
  const cuft = cuin / 1728;
  const actualLb = contentsOz / 16;
  const dimLb = cuft > 1 ? cuin / 139 : 0;
  const billableLb = Math.max(actualLb, dimLb);
  const cubicOk = cuft <= 0.5 && Math.max(...r) <= 22 && actualLb <= 20;
  const tier = cubicOk ? Math.ceil(cuft * 10 - 1e-9) / 10 : null;
  // rough range interpolated from the SOP's own three data points, by billable weight
  const pts = [[2, 5, 9], [4, 7, 13], [12, 12, 22]];
  const w = Math.max(1, billableLb);
  let lo, hi;
  if (w <= pts[0][0]) { lo = pts[0][1]; hi = pts[0][2]; }
  else if (w >= pts[2][0]) {
    const s = (w - 12) / 8; lo = 12 + s * 5; hi = 22 + s * 9;
  } else {
    const [p0, p1] = w <= 4 ? [pts[0], pts[1]] : [pts[1], pts[2]];
    const t = (w - p0[0]) / (p1[0] - p0[0]);
    lo = p0[1] + t * (p1[1] - p0[1]); hi = p0[2] + t * (p1[2] - p0[2]);
  }
  return { rounded: r, cuft, actualLb, dimLb, billableLb, cubicOk, tier, estLo: lo, estHi: hi, dimHit: dimLb > actualLb };
}

// does a rigid block (with clearance) fit inside a box in any rotation
function fitsIn(block, box) {
  const a = [...block].sort((x, y) => x - y);
  const b = [...box].sort((x, y) => x - y);
  return a[0] <= b[0] + 1e-9 && a[1] <= b[1] + 1e-9 && a[2] <= b[2] + 1e-9;
}
// find the rotation of block that fits inside box, return rotated block dims
function orientTo(block, box) {
  for (const p of PERMS) {
    const d = [block[p[0]], block[p[1]], block[p[2]]];
    if (d[0] <= box[0] + 1e-9 && d[1] <= box[1] + 1e-9 && d[2] <= box[2] + 1e-9) return p;
  }
  return null;
}

const f2 = (v) => (Math.round(v * 100) / 100).toString();
const dimStr = (d) => d.map(f2).join(" × ");

// ---------- 3D scene ----------
function buildScene(group, model, view, explode) {
  while (group.children.length) {
    const ch = group.children.pop();
    ch.traverse?.((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
  }
  const { unit, caseArr, packArr, outer, outerFits } = model;

  // when the chosen outer box is too small, fade the contents so the red box reads through them
  const ghost = outerFits === false;
  const unitMat = new THREE.MeshStandardMaterial({ color: C.coral, roughness: 0.75, metalness: 0, transparent: ghost, opacity: ghost ? 0.28 : 1, depthWrite: !ghost });
  const unitMat2 = new THREE.MeshStandardMaterial({ color: "#F98A8A", roughness: 0.75, metalness: 0, transparent: ghost, opacity: ghost ? 0.28 : 1, depthWrite: !ghost });
  const caseSolidMat = new THREE.MeshStandardMaterial({ color: "#E9D9C4", roughness: 0.9, transparent: ghost, opacity: ghost ? 0.3 : 1, depthWrite: !ghost });
  const caseShellMat = new THREE.MeshStandardMaterial({ color: C.ember, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const outerShellMat = new THREE.MeshStandardMaterial({ color: C.ink, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
  const edgeInk = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.4 });
  const edgeEmber = new THREE.LineBasicMaterial({ color: C.ember, transparent: true, opacity: 0.9 });
  const edgeOuter = new THREE.LineBasicMaterial({ color: ghost ? "#C62828" : C.ink, transparent: true, opacity: 0.95, depthTest: !ghost, linewidth: 1 });
  if (ghost) { outerShellMat.color.set("#C62828"); outerShellMat.opacity = 0.16; outerShellMat.depthTest = false; edgeInk.opacity = 0.18; edgeEmber.opacity = 0.35; }

  const labels = [];
  const dimMat = new THREE.LineBasicMaterial({ color: C.muted, transparent: true, opacity: 0.55 });
  // dimension lines (offset from the front-bottom-right edges) plus a label at each midpoint
  const dimMatCase = new THREE.LineBasicMaterial({ color: C.ember, transparent: true, opacity: 0.5 });
  const dimLines = (dims, center, tier, off, mat = dimMat) => {
    const [x, y, z] = dims.map((d) => d / 2);
    const [cx, cy, cz] = center;
    const seg = [];
    const tick = off * 0.45;
    // length along X: below the front bottom edge
    seg.push([cx - x, cy - y - off, cz + z], [cx + x, cy - y - off, cz + z]);
    seg.push([cx - x, cy - y - off - tick, cz + z], [cx - x, cy - y - off + tick, cz + z]);
    seg.push([cx + x, cy - y - off - tick, cz + z], [cx + x, cy - y - off + tick, cz + z]);
    // height along Y: to the right of the front right edge
    seg.push([cx + x + off, cy - y, cz + z], [cx + x + off, cy + y, cz + z]);
    seg.push([cx + x + off - tick, cy - y, cz + z], [cx + x + off + tick, cy - y, cz + z]);
    seg.push([cx + x + off - tick, cy + y, cz + z], [cx + x + off + tick, cy + y, cz + z]);
    // depth along Z: along the bottom right edge
    seg.push([cx + x + off, cy - y, cz - z], [cx + x + off, cy - y, cz + z]);
    seg.push([cx + x + off - tick, cy - y, cz - z], [cx + x + off + tick, cy - y, cz - z]);
    const g = new THREE.BufferGeometry().setFromPoints(seg.map((v) => new THREE.Vector3(...v)));
    group.add(new THREE.LineSegments(g, mat));
    labels.push({ text: f2(dims[0]) + '"', pos: [cx, cy - y - off * 1.9, cz + z], tier });
    labels.push({ text: f2(dims[1]) + '"', pos: [cx + x + off * 2.1, cy, cz + z], tier });
    labels.push({ text: f2(dims[2]) + '"', pos: [cx + x + off * 2.1, cy - y - off * 0.6, cz], tier });
  };

  const box = (dims, mat, edge, pos) => {
    const g = new THREE.BoxGeometry(dims[0], dims[1], dims[2]);
    const m = new THREE.Mesh(g, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    group.add(m);
    if (edge) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edge);
      e.position.copy(m.position);
      group.add(e);
    }
    return m;
  };

  // fill one case at position `origin` (its center). caseDims are the case's own oriented dims.
  const fillCase = (origin, caseDims, unitOriented, counts, ex) => {
    const [A, B, Cc] = counts;
    const gap = unitOriented.map((d) => d * 0.35 * ex);
    let k = 0;
    for (let i = 0; i < A; i++) for (let j = 0; j < B; j++) for (let l = 0; l < Cc; l++) {
      const pos = [
        origin[0] + (i - (A - 1) / 2) * (unitOriented[0] + gap[0]),
        origin[1] + (j - (B - 1) / 2) * (unitOriented[1] + gap[1]),
        origin[2] + (l - (Cc - 1) / 2) * (unitOriented[2] + gap[2]),
      ];
      box(unitOriented, (k++ % 2) ? unitMat2 : unitMat, edgeInk, pos);
    }
  };

  if (view === "unit") {
    box(unit, unitMat, edgeInk, [0, 0, 0]);
    const r = Math.hypot(...unit) / 2;
    dimLines(unit, [0, 0, 0], 0, r * 0.12);
    return { radius: r, labels };
  }

  if (view === "case") {
    if (!caseArr) return { radius: 6, labels };
    fillCase([0, 0, 0], caseArr.dims, caseArr.itemDims, caseArr.counts, explode);
    box(caseArr.dims, caseShellMat, edgeEmber, [0, 0, 0]);
    const r = (Math.hypot(...caseArr.dims) / 2) * (1 + explode * 0.6);
    dimLines(caseArr.dims, [0, 0, 0], 0, r * 0.1);
    if (explode < 0.05) {
      // label one unit so the scale of the contents is readable
      const u = caseArr.itemDims, cnt = caseArr.counts;
      const first = [-(cnt[0] - 1) / 2 * u[0], -(cnt[1] - 1) / 2 * u[1], (cnt[2] - 1) / 2 * u[2]];
      labels.push({ text: `unit ${dimStr(u)}"`, pos: [first[0], first[1] + u[1] / 2 + r * 0.06, first[2] + u[2] / 2], tier: 2 });
    }
    return { radius: r, labels };
  }

  // pack or nested
  if (!packArr || !caseArr) return { radius: 8, labels };
  const [A, B, Cc] = packArr.counts;
  const cd = packArr.itemDims; // oriented case dims inside the pack
  const gap = cd.map((d) => d * 0.5 * explode);
  // the case arrangement inside the pack may be rotated relative to the case solver's own axes
  const perm = orientTo(caseArr.dims, cd) || [0, 1, 2];
  const unitOriented = [caseArr.itemDims[perm[0]], caseArr.itemDims[perm[1]], caseArr.itemDims[perm[2]]];
  const countsOriented = [caseArr.counts[perm[0]], caseArr.counts[perm[1]], caseArr.counts[perm[2]]];

  for (let i = 0; i < A; i++) for (let j = 0; j < B; j++) for (let l = 0; l < Cc; l++) {
    const pos = [
      (i - (A - 1) / 2) * (cd[0] + gap[0]),
      (j - (B - 1) / 2) * (cd[1] + gap[1]),
      (l - (Cc - 1) / 2) * (cd[2] + gap[2]),
    ];
    if (view === "nested") {
      fillCase(pos, cd, unitOriented, countsOriented, explode * 0.5);
      box(cd, caseShellMat, edgeEmber, pos);
    } else {
      box(cd, caseSolidMat, edgeEmber, pos);
    }
  }
  const od = outer || packArr.dims;
  const outerMesh = box(od, outerShellMat, edgeOuter, [0, 0, 0]);
  if (ghost) { outerMesh.renderOrder = 10; group.children[group.children.length - 1].renderOrder = 11; }
  const r = (Math.hypot(...od) / 2) * (1 + explode * 0.5);
  dimLines(od, [0, 0, 0], 0, r * 0.09);
  // label the front-bottom-right case so the case size reads against the outer box
  const firstCase = [(A - 1) / 2 * (cd[0] + gap[0]), -(B - 1) / 2 * (cd[1] + gap[1]), (Cc - 1) / 2 * (cd[2] + gap[2])];
  labels.push({ text: `case ${dimStr(cd)}"`, pos: [firstCase[0], firstCase[1] + cd[1] / 2 + r * 0.05, firstCase[2] + cd[2] / 2], tier: 1 });
  // per-side case dimensions, smaller and in ember so they read apart from the outer box dims
  dimLines(cd, firstCase, 3, r * 0.04, dimMatCase);
  return { radius: r, labels };
}

function Viewer({ model, view, explode, caption }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    scene.add(new THREE.HemisphereLight(0xffffff, 0xd9cdbb, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.55);
    dl.position.set(8, 14, 10);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.25);
    dl2.position.set(-10, -4, -6);
    scene.add(dl2);

    const group = new THREE.Group();
    scene.add(group);

    const s = stateRef.current;
    Object.assign(s, { scene, camera, renderer, group, theta: 0.65, phi: 1.05, dist: 40, radius: 10, dragging: false, lx: 0, ly: 0, alive: true, labels: [] });

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const onDown = (e) => { s.dragging = true; s.lx = e.clientX; s.ly = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
    const onMove = (e) => {
      if (!s.dragging) return;
      s.theta -= (e.clientX - s.lx) * 0.008;
      s.phi = Math.min(Math.PI - 0.15, Math.max(0.15, s.phi - (e.clientY - s.ly) * 0.008));
      s.lx = e.clientX; s.ly = e.clientY;
    };
    const onUp = () => { s.dragging = false; };
    const onWheel = (e) => { e.preventDefault(); s.dist = Math.min(s.radius * 8, Math.max(s.radius * 1.2, s.dist * (1 + Math.sign(e.deltaY) * 0.08))); };
    const c = renderer.domElement;
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    c.addEventListener("wheel", onWheel, { passive: false });

    const loop = () => {
      if (!s.alive) return;
      camera.position.set(
        s.dist * Math.sin(s.phi) * Math.sin(s.theta),
        s.dist * Math.cos(s.phi),
        s.dist * Math.sin(s.phi) * Math.cos(s.theta)
      );
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      // place the dimension labels over their 3D anchor points
      const w = el.clientWidth, h = el.clientHeight;
      for (const lb of s.labels) {
        const v = new THREE.Vector3(...lb.pos).project(camera);
        if (v.z > 1 || v.z < -1) { lb.el.style.display = "none"; continue; }
        lb.el.style.display = "block";
        lb.el.style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      }
      requestAnimationFrame(loop);
    };
    loop();

    return () => {
      s.alive = false;
      ro.disconnect();
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", onUp);
      c.removeEventListener("pointercancel", onUp);
      c.removeEventListener("wheel", onWheel);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  const labelsRef = useRef(null);
  const [showDims, setShowDims] = useState(true);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.group) return;
    const { radius, labels } = buildScene(s.group, model, view, explode);
    const target = Math.max(4, radius) * 2.6;
    s.radius = Math.max(4, radius);
    s.dist = target;
    // rebuild label elements
    const host = labelsRef.current;
    if (host) {
      host.innerHTML = "";
      s.labels = (labels || []).filter(() => showDims).map((lb) => {
        const d = document.createElement("span");
        d.textContent = lb.text;
        const tierStyle = [
          { fontSize: "11px", color: C.ink, fontWeight: "700" },
          { fontSize: "10px", color: C.ember, fontWeight: "700" },
          { fontSize: "9px", color: C.muted, fontWeight: "600" },
          { fontSize: "9px", color: C.ember, fontWeight: "600" },
        ][lb.tier] || {};
        Object.assign(d.style, { position: "absolute", left: 0, top: 0, whiteSpace: "nowrap", pointerEvents: "none",
          padding: "0 4px", borderRadius: "3px", background: "rgba(251,246,239,0.85)", fontVariantNumeric: "tabular-nums", lineHeight: "1.3" }, tierStyle);
        host.appendChild(d);
        return { el: d, pos: lb.pos };
      });
    }
  }, [model, view, explode, showDims]);

  const wrapRef = useRef(null);
  const [isFull, setIsFull] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const recenter = () => {
    const s = stateRef.current;
    s.theta = 0.65; s.phi = 1.05; s.dist = s.radius * 2.6;
  };
  const toggleFull = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  const vbtn = {
    fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
    border: `1px solid ${C.line}`, background: "rgba(255,255,255,0.92)", color: C.ink,
  };

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: isFull ? "100vh" : 420, background: C.bone, borderRadius: isFull ? 0 : 10, overflow: "hidden", border: `1px solid ${C.line}` }}>
      <div ref={mountRef} className="absolute inset-0" />
      <div ref={labelsRef} className="absolute inset-0" style={{ pointerEvents: "none", overflow: "hidden" }} />
      <div className="absolute right-3 top-3 flex gap-1">
        <button onClick={() => setShowDims(!showDims)} style={{ ...vbtn, background: showDims ? C.ink : vbtn.background, color: showDims ? "#fff" : C.ink, borderColor: showDims ? C.ink : C.line }} className="focus:outline-none focus:ring-2 focus:ring-orange-300">Dimensions</button>
        <button onClick={recenter} style={vbtn} className="focus:outline-none focus:ring-2 focus:ring-orange-300">Recenter</button>
        <button onClick={toggleFull} style={vbtn} className="focus:outline-none focus:ring-2 focus:ring-orange-300">{isFull ? "Exit full screen" : "Full screen"}</button>
      </div>
      <div className="absolute left-3 bottom-3 text-xs" style={{ color: C.muted, lineHeight: 1.45, pointerEvents: "none" }}>
        {caption}
      </div>
      <div className="absolute right-3 bottom-3 text-xs" style={{ color: C.muted, pointerEvents: "none" }}>drag to rotate · scroll to zoom</div>
    </div>
  );
}

// ---------- small UI pieces ----------
const inputStyle = {
  width: "100%", padding: "6px 8px", border: `1px solid ${C.line}`, borderRadius: 6, background: "#fff",
  color: C.ink, fontSize: 13, fontVariantNumeric: "tabular-nums",
};

function Num({ label, value, onChange, step = 0.25, min = 0, suffix }) {
  return (
    <label className="block" style={{ fontSize: 11, color: C.muted }}>
      <span>{label}</span>
      <div className="relative">
        <input
          type="number" step={step} min={min} value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
          style={inputStyle} className="focus:outline-none focus:ring-2 focus:ring-orange-300"
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2" style={{ fontSize: 10, color: C.muted }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="focus:outline-none focus:ring-2 focus:ring-orange-300"
      style={{
        fontSize: 11, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
        border: `1px solid ${active ? C.ember : C.line}`,
        background: active ? C.ember : "#fff", color: active ? "#fff" : C.ink, fontWeight: active ? 700 : 500,
      }}>{children}</button>
  );
}

function Level({ n, title, children }) {
  return (
    <section style={{ position: "relative", paddingLeft: 30, paddingBottom: 18 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 22, height: 22, borderRadius: 11, background: C.ink, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
      <div style={{ position: "absolute", left: 10.5, top: 24, bottom: 0, width: 1, background: C.line }} />
      <h2 style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, lineHeight: "22px", marginBottom: 8 }}>{title}</h2>
      {children}
    </section>
  );
}

function ArrangementPick({ options, selectedKey, onPick, itemLabel }) {
  if (!options.length) return null;
  const show = options.slice(0, 5);
  return (
    <div className="mt-2">
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Suggested arrangements, tightest first</div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
        {show.map((o, i) => {
          const on = o.key === selectedKey;
          return (
            <button key={o.key} onClick={() => onPick(o.key)}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-300"
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer",
                background: on ? C.coralSoft : i % 2 ? C.bone : "#fff", borderTop: i ? `1px solid ${C.line}` : "none", color: C.ink }}>
              <span>
                <span style={{ fontWeight: on ? 800 : 600 }}>{o.counts.join(" × ")}</span>
                <span style={{ color: C.muted }}> {itemLabel}</span>
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: on ? "#9c3b34" : C.muted, fontWeight: on ? 700 : 500 }}>{dimStr(o.dims)} in</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- main ----------
const DEFAULTS = {
  unit: { l: 8, w: 6, h: 1, oz: 2.3 },
  caseQty: 12, caseClr: 0.125, caseCustom: false, caseDims: { l: 8.25, w: 6.25, h: 12.25 }, casePick: null,
  packQty: 2, packClr: 0.25, packPick: null,
  roundStep: 0, // 0 = exact, 0.5 = nearest half inch, 1 = nearest inch
  customBoxes: [],
  hiddenDefaults: [],
  savedCases: [],
};

export default function GrazeOnBoxFit() {
  const [st, setSt] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [layout, setLayout] = useState("nested"); // nested | levels
  const [tab, setTab] = useState("pack"); // unit | case | pack
  const [explode, setExplode] = useState(0);
  const [outerOverride, setOuterOverride] = useState(null); // {name, dims}
  const [newBox, setNewBox] = useState({ name: "", l: "", w: "", h: "" });
  const [caseName, setCaseName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  // local helper (boxfit.py) makes /api/search available when the page is served over http
  const [online, setOnline] = useState(false);
  useEffect(() => {
    if (!/^https?:$/.test(window.location.protocol)) return;
    fetch("/api/ping").then((r) => r.json()).then((j) => setOnline(!!j.ok)).catch(() => {});
  }, []);
  const [q, setQ] = useState({ l: "", w: "", h: "" });
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(null);
  const [searchErr, setSearchErr] = useState("");
  const wholeInch = (dims) => dims.map((v) => Math.ceil(v - 1e-9));
  const runSearch = async (dims) => {
    const d = dims || [parseFloat(q.l), parseFloat(q.w), parseFloat(q.h)];
    if (d.some((v) => !v || v <= 0)) { setSearchErr("Enter all three sides."); return; }
    if (dims) setQ({ l: d[0], w: d[1], h: d[2] });
    setSearching(true); setSearchErr(""); setFound(null);
    try {
      const r = await fetch(`/api/search?l=${d[0]}&w=${d[1]}&h=${d[2]}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setFound(j);
    } catch (e) { setSearchErr("Search failed: " + (e.message || e)); }
    setSearching(false);
  };
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const saveCase = () => {
    const d = [st.caseDims.l, st.caseDims.w, st.caseDims.h];
    if (d.some((v) => !v || v <= 0)) return;
    const name = caseName.trim() || `${st.caseQty}-ct ${d.map(f2).join(" × ")}`;
    up({ savedCases: [...(st.savedCases || []), { id: "sc" + Date.now(), name, dims: { l: d[0], w: d[1], h: d[2] }, qty: st.caseQty, clr: st.caseClr }] });
    setCaseName("");
  };
  const loadCase = (c) => {
    up({ caseCustom: true, caseDims: { ...c.dims }, caseQty: c.qty, caseClr: c.clr, casePick: null, packPick: null });
    setOuterOverride(null);
  };
  const [saveNote, setSaveNote] = useState("");

  const up = (patch) => setSt((s) => ({ ...s, ...patch }));

  // load
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage?.get(STORAGE_KEY, false);
        if (r?.value) setSt({ ...DEFAULTS, ...JSON.parse(r.value) });
      } catch (e) { /* first run */ }
      setLoaded(true);
    })();
  }, []);
  // save (debounced)
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        await window.storage?.set(STORAGE_KEY, JSON.stringify(st), false);
        setSaveNote("Saved");
        setTimeout(() => setSaveNote(""), 1200);
      } catch (e) { setSaveNote("Not saved"); }
    }, 600);
    return () => clearTimeout(t);
  }, [st, loaded]);

  const unitDims = useMemo(() => [st.unit.l || 0.01, st.unit.w || 0.01, st.unit.h || 0.01], [st.unit]);

  const caseOptions = useMemo(() => solve(unitDims, Math.max(1, Math.round(st.caseQty)), st.caseClr || 0, st.roundStep || 0), [unitDims, st.caseQty, st.caseClr, st.roundStep]);
  const caseArr = useMemo(() => {
    if (st.caseCustom) {
      const d = [st.caseDims.l || 0.01, st.caseDims.w || 0.01, st.caseDims.h || 0.01];
      // find the best suggested arrangement that fits inside the custom case, for drawing the units
      const fit = caseOptions.find((o) => fitsIn(o.dims, d));
      if (fit) {
        const p = orientTo(fit.dims, d) || [0, 1, 2];
        return { key: "custom", counts: [fit.counts[p[0]], fit.counts[p[1]], fit.counts[p[2]]], itemDims: [fit.itemDims[p[0]], fit.itemDims[p[1]], fit.itemDims[p[2]]], dims: d, vol: d[0] * d[1] * d[2], custom: true, fits: true };
      }
      return { key: "custom", counts: [1, 1, 1], itemDims: unitDims, dims: d, vol: d[0] * d[1] * d[2], custom: true, fits: false };
    }
    return caseOptions.find((o) => o.key === st.casePick) || caseOptions[0] || null;
  }, [st.caseCustom, st.caseDims, st.casePick, caseOptions, unitDims]);

  const packOptions = useMemo(() => caseArr ? solve(caseArr.dims, Math.max(1, Math.round(st.packQty)), st.packClr || 0, st.roundStep || 0) : [], [caseArr, st.packQty, st.packClr, st.roundStep]);
  const packArr = useMemo(() => packOptions.find((o) => o.key === st.packPick) || packOptions[0] || null, [packOptions, st.packPick]);

  const totalBags = Math.round(st.caseQty) * Math.round(st.packQty);
  const contentsOz = totalBags * (st.unit.oz || 0);
  const contentVol = unitDims[0] * unitDims[1] * unitDims[2] * totalBags;

  // --- compare: tightest
  const tightest = packOptions[0] || null;

  // --- compare: cheapest postage
  const cheapest = useMemo(() => {
    const scored = packOptions.map((o) => ({ o, p: postage(o.dims, contentsOz) }));
    scored.sort((a, b) => {
      if (a.p.cubicOk !== b.p.cubicOk) return a.p.cubicOk ? -1 : 1;
      if (a.p.cubicOk && a.p.tier !== b.p.tier) return a.p.tier - b.p.tier;
      const ba = Math.ceil(a.p.billableLb), bb = Math.ceil(b.p.billableLb);
      if (ba !== bb) return ba - bb;
      return a.o.vol - b.o.vol;
    });
    return scored[0] || null;
  }, [packOptions, contentsOz]);

  // --- compare: stock
  const catalog = useMemo(() => [...YOUR_BOXES.filter((b) => !(st.hiddenDefaults || []).includes(b.id)), ...st.customBoxes.map((b) => ({ ...b, source: "custom" })), ...ULINE, ...AMAZON], [st.customBoxes, st.hiddenDefaults]);
  const stockRanked = useMemo(() => {
    if (!packOptions.length) return [];
    const out = [];
    for (const b of catalog) {
      const bv = b.dims[0] * b.dims[1] * b.dims[2];
      // best arrangement for this box = the tightest one that fits (options are already sorted tightest first)
      const best = packOptions.find((o) => fitsIn(o.dims, b.dims)) || null;
      out.push({ box: b, arr: best, fits: !!best, vol: bv, voidPct: 100 * (1 - contentVol / bv), p: postage(b.dims, contentsOz) });
    }
    out.sort((a, b) => (a.fits === b.fits ? a.vol - b.vol : a.fits ? -1 : 1));
    return out;
  }, [catalog, packOptions, contentVol, contentsOz]);
  const mineRanked = stockRanked.filter((r) => r.box.source === "yours" || r.box.source === "custom");
  const ulineFit = stockRanked.filter((r) => r.box.source === "uline" && r.fits);
  const amazonFit = stockRanked.filter((r) => r.box.source === "amazon" && r.fits); // least void first
  const [showAllUline, setShowAllUline] = useState(false);
  const [showAllAmazon, setShowAllAmazon] = useState(false);

  // --- optimize: for the current quantities, try every case arrangement x pack arrangement x catalog box.
  // Per box, keep the combo with the smallest pack footprint. Void is a property of the box, so ranking by
  // void is ranking fitting boxes by volume; "cheapest" uses the same postage ordering as the Cheapest card.
  const [optSort, setOptSort] = useState("void"); // void | cost
  const [optSource, setOptSource] = useState("all"); // all | yours | uline | amazon
  const [showAllOpt, setShowAllOpt] = useState(false);
  const optimized = useMemo(() => {
    const n = Math.max(1, Math.round(st.packQty));
    const byBox = new Map();
    for (const ca of caseOptions) {
      for (const pa of solve(ca.dims, n, st.packClr || 0, st.roundStep || 0)) {
        for (const b of catalog) {
          if (!fitsIn(pa.dims, b.dims)) continue;
          const prev = byBox.get(b.id);
          if (prev && prev.packArr.vol <= pa.vol) continue;
          const bv = b.dims[0] * b.dims[1] * b.dims[2];
          byBox.set(b.id, { box: b, caseArr: ca, packArr: pa, vol: bv, voidPct: 100 * (1 - contentVol / bv), p: postage(b.dims, contentsOz) });
        }
      }
    }
    const out = [...byBox.values()];
    out.sort((a, b) => {
      if (optSort === "cost") {
        if (a.p.cubicOk !== b.p.cubicOk) return a.p.cubicOk ? -1 : 1;
        if (a.p.cubicOk && a.p.tier !== b.p.tier) return a.p.tier - b.p.tier;
        const ba = Math.ceil(a.p.billableLb), bb = Math.ceil(b.p.billableLb);
        if (ba !== bb) return ba - bb;
      }
      return a.vol - b.vol;
    });
    return out;
  }, [caseOptions, catalog, st.packQty, st.packClr, st.roundStep, contentVol, contentsOz, optSort]);
  const optShown = optimized.filter((r) => optSource === "all" || r.box.source === optSource || (optSource === "yours" && r.box.source === "custom"));
  const applyOpt = (r) => {
    up({ caseCustom: false, casePick: r.caseArr.key, packPick: r.packArr.key });
    setOuterOverride({ name: r.box.name, dims: r.box.dims });
  };
  const isOptCurrent = (r) => !st.caseCustom && caseArr?.key === r.caseArr.key && packArr?.key === r.packArr.key && isShown(r.box.dims);

  const packPostage = packArr ? postage(packArr.dims, contentsOz) : null;

  // the outer box drawn in 3D
  const outerDims = outerOverride?.dims || null;
  const model = useMemo(() => {
    let o = null, fits = true;
    if (outerDims && packArr) {
      const p = orientTo(packArr.dims, outerDims);
      if (p) {
        // rotate the outer box to sit around the arrangement's axes
        const inv = [0, 0, 0]; p.forEach((v, i) => { inv[v] = i; });
        o = [outerDims[inv[0]], outerDims[inv[1]], outerDims[inv[2]]];
      } else {
        // doesn't fit: align largest side to largest side so the overflow is visible
        fits = false;
        const order = [0, 1, 2].sort((a, b) => packArr.dims[b] - packArr.dims[a]);
        const sortedBox = [...outerDims].sort((a, b) => b - a);
        o = [0, 0, 0]; order.forEach((axis, i) => { o[axis] = sortedBox[i]; });
      }
    }
    return { unit: unitDims, caseArr, packArr, outer: o, outerFits: fits };
  }, [unitDims, caseArr, packArr, outerDims]);

  const view = layout === "nested" ? "nested" : tab;

  const caption = (() => {
    if (view === "unit") return <>Unit {dimStr(unitDims)} in · {st.unit.oz} oz</>;
    if (view === "case") return caseArr ? <>Case of {st.caseQty}: {caseArr.counts.join(" × ")} units · {dimStr(caseArr.dims)} in{caseArr.custom && !caseArr.fits ? " · units do not fit this case" : ""}</> : null;
    if (!packArr) return null;
    const od = outerOverride ? `${outerOverride.name} ${dimStr(outerOverride.dims)}` : `suggested ${dimStr(packArr.dims)}`;
    return <>{st.packQty} cases · {packArr.counts.join(" × ")} · outer {od} in · {totalBags} bags · {f2(contentsOz / 16)} lb{model.outerFits === false ? <span style={{ color: "#C62828", fontWeight: 700 }}> · does not fit, needs {dimStr(packArr.dims)}</span> : null}</>;
  })();

  const addBox = () => {
    const d = [parseFloat(newBox.l), parseFloat(newBox.w), parseFloat(newBox.h)];
    if (d.some((v) => !v || v <= 0)) return;
    const name = newBox.name.trim() || `Custom ${d.join(" × ")}`;
    up({ customBoxes: [...st.customBoxes, { id: "c" + Date.now(), name, dims: d }] });
    setNewBox({ name: "", l: "", w: "", h: "" });
  };

  const badge = (text, tone) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: tone === "good" ? "#E3EFE6" : tone === "warn" ? C.amber : C.coralSoft, color: tone === "good" ? C.green : tone === "warn" ? "#9a5a12" : "#9c3b34" }}>{text}</span>
  );

  const ShowBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} className="focus:outline-none focus:ring-2 focus:ring-orange-300"
      style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, cursor: "pointer", border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : "#fff", color: active ? "#fff" : C.ink }}>
      {children}
    </button>
  );

  const isShown = (dims) => outerOverride ? dimStr(outerOverride.dims) === dimStr(dims) : false;

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif", color: C.ink, background: "#fff", minHeight: "100%", padding: "18px 18px 28px" }}>
      <header className="flex flex-wrap items-end justify-between gap-2" style={{ borderBottom: `3px solid ${C.ink}`, paddingBottom: 8, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>GRAZE<span style={{ color: C.ember }}>ON</span> box fit</h1>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Set the bag, build the case, size the case pack. Compare tightest, cheapest to ship, and what's on the shelf.</div>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 11, color: C.muted, minWidth: 44, textAlign: "right" }}>{saveNote}</span>
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-haspopup="true" className="focus:outline-none focus:ring-2 focus:ring-orange-300"
              style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${menuOpen ? C.ink : C.line}`, background: menuOpen ? C.ink : "#fff", color: menuOpen ? "#fff" : C.ink }}>
              Options {menuOpen ? "▴" : "▾"}
            </button>
            {menuOpen && (
              <div role="menu" style={{ position: "absolute", right: 0, top: "100%", marginTop: 6, width: 340, maxWidth: "calc(100vw - 36px)", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(25,22,19,0.14)", padding: 12, zIndex: 30, fontSize: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Suggested box sizes</div>
                <div className="flex flex-wrap items-center gap-1" style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted, marginRight: 4 }}>Round each side up to</span>
                  {[[0, "Exact"], [0.5, "½ in"], [1, "1 in"]].map(([v, l]) => (
                    <Chip key={v} active={(st.roundStep || 0) === v} onClick={() => { up({ roundStep: v, casePick: null, packPick: null }); setOuterOverride(null); }}>{l}</Chip>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45 }}>Applies to suggested case and case-pack boxes. Custom case sizes stay as typed.</div>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: "14px 0 6px" }}>Your custom boxes</div>
                <div className="grid grid-cols-3 gap-1">
                  {["l", "w", "h"].map((k) => (
                    <input key={k} type="number" step={0.25} min={0} placeholder={k.toUpperCase()} value={newBox[k]} onChange={(e) => setNewBox({ ...newBox, [k]: e.target.value })}
                      style={{ ...inputStyle, padding: "5px 6px", fontSize: 12 }} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label={`Box ${k}`} />
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  <input type="text" placeholder="Name (optional)" value={newBox.name} onChange={(e) => setNewBox({ ...newBox, name: e.target.value })}
                    style={{ ...inputStyle, padding: "5px 6px", fontSize: 12 }} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Box name" />
                  <button onClick={addBox} className="focus:outline-none focus:ring-2 focus:ring-orange-300"
                    style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", background: C.ember, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>Add box</button>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Interior inches. Custom boxes show up under "Your boxes" and in Best box and config.</div>
                {st.customBoxes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {st.customBoxes.map((b) => (
                      <span key={b.id} style={{ fontSize: 10, background: C.bone, border: `1px solid ${C.line}`, borderRadius: 20, padding: "1px 6px 1px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {b.name}
                        <button onClick={() => up({ customBoxes: st.customBoxes.filter((x) => x.id !== b.id) })} aria-label={`Remove ${b.name}`}
                          style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {(st.hiddenDefaults || []).length > 0 && (
                  <button onClick={() => up({ hiddenDefaults: [] })} style={{ fontSize: 11, color: C.ember, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: "6px 0 0", textDecoration: "underline" }}>
                    Restore {st.hiddenDefaults.length} hidden default {st.hiddenDefaults.length === 1 ? "box" : "boxes"}
                  </button>
                )}

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: "14px 0 6px" }}>Online search</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                  {online ? "Connected to the local helper. Find boxes online is live." : <>To search Amazon and the web for a size, run <code style={{ background: C.bone, padding: "1px 5px", borderRadius: 4 }}>python3 boxfit.py</code> in the Packaging folder. It opens this tool with search turned on.</>}
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, margin: "14px 0 6px" }}>How the numbers work</div>
                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
                  Postage follows the SOP after the July 12, 2026 USPS change: dimensions round up to the whole inch, DIM weight uses divisor 139 only over 1 cu ft, and cubic pricing needs 0.5 cu ft or less with no side over 22 inches. Dollar ranges are interpolated from the SOP's table, so treat them as a ranking, not a quote. All cases in a pack share one orientation; mixed rotations aren't solved.
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(300px, 350px) minmax(0, 1fr)" }}>
        {/* ---------------- controls ---------------- */}
        <div>
          <Level n={1} title="Unit">
            <div className="grid grid-cols-4 gap-2">
              <Num label="Length" value={st.unit.l} onChange={(v) => up({ unit: { ...st.unit, l: v } })} suffix="in" />
              <Num label="Width" value={st.unit.w} onChange={(v) => up({ unit: { ...st.unit, w: v } })} suffix="in" />
              <Num label="Depth" value={st.unit.h} onChange={(v) => up({ unit: { ...st.unit, h: v } })} suffix="in" />
              <Num label="Weight" value={st.unit.oz} onChange={(v) => up({ unit: { ...st.unit, oz: v } })} step={0.1} suffix="oz" />
            </div>
          </Level>

          <Level n={2} title="Case">
            <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Units per case</span>
              {[8, 12].map((q) => <Chip key={q} active={st.caseQty === q} onClick={() => up({ caseQty: q, casePick: null })}>{q}</Chip>)}
              <input type="number" min={1} step={1} value={st.caseQty} onChange={(e) => up({ caseQty: Math.max(1, parseInt(e.target.value || "1", 10)), casePick: null })}
                style={{ ...inputStyle, width: 64 }} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Units per case" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Num label="Clearance per side (gap + board)" value={st.caseClr} onChange={(v) => up({ caseClr: v })} step={0.0625} suffix="in" />
              <label className="block" style={{ fontSize: 11, color: C.muted }}>
                <span>Case dimensions</span>
                <div className="flex gap-1" style={{ marginTop: 0 }}>
                  <Chip active={!st.caseCustom} onClick={() => up({ caseCustom: false })}>Suggested</Chip>
                  <Chip active={st.caseCustom} onClick={() => up({ caseCustom: true, caseDims: caseArr && !caseArr.custom ? { l: +f2(caseArr.dims[0]), w: +f2(caseArr.dims[1]), h: +f2(caseArr.dims[2]) } : st.caseDims })}>Custom</Chip>
                </div>
              </label>
            </div>
            {st.caseCustom ? (
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Num label="Length" value={st.caseDims.l} onChange={(v) => up({ caseDims: { ...st.caseDims, l: v } })} suffix="in" />
                <Num label="Width" value={st.caseDims.w} onChange={(v) => up({ caseDims: { ...st.caseDims, w: v } })} suffix="in" />
                <Num label="Height" value={st.caseDims.h} onChange={(v) => up({ caseDims: { ...st.caseDims, h: v } })} suffix="in" />
                {caseArr && !caseArr.fits && <div className="col-span-3" style={{ fontSize: 11, color: "#9c3b34" }}>{st.caseQty} units don't fit in this case with the current clearance.</div>}
                <div className="col-span-3 flex gap-1">
                  <input type="text" placeholder="Name this case (optional)" value={caseName} onChange={(e) => setCaseName(e.target.value)}
                    style={{ ...inputStyle, padding: "5px 6px", fontSize: 12 }} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Case name" />
                  <button onClick={saveCase} className="focus:outline-none focus:ring-2 focus:ring-orange-300"
                    style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "none", background: C.ember, color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>Save case</button>
                </div>
              </div>
            ) : (
              <ArrangementPick options={caseOptions} selectedKey={caseArr?.key} onPick={(k) => up({ casePick: k })} itemLabel="units" />
            )}
            {(st.savedCases || []).length > 0 && (
              <div className="mt-2">
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Saved cases</div>
                <div className="flex flex-wrap gap-1">
                  {st.savedCases.map((c) => {
                    const on = st.caseCustom && st.caseDims.l === c.dims.l && st.caseDims.w === c.dims.w && st.caseDims.h === c.dims.h && st.caseQty === c.qty;
                    return (
                      <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 2, borderRadius: 20, border: `1px solid ${on ? C.ember : C.line}`, background: on ? C.coralSoft : "#fff" }}>
                        <button onClick={() => loadCase(c)} title={`${c.qty} units · ${[c.dims.l, c.dims.w, c.dims.h].map(f2).join(" × ")} in`}
                          className="focus:outline-none focus:ring-2 focus:ring-orange-300"
                          style={{ fontSize: 11, fontWeight: on ? 700 : 500, padding: "3px 4px 3px 10px", background: "none", border: "none", cursor: "pointer", color: on ? "#9c3b34" : C.ink, borderRadius: 20 }}>{c.name}</button>
                        <button onClick={() => up({ savedCases: st.savedCases.filter((x) => x.id !== c.id) })} aria-label={`Remove ${c.name}`}
                          style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 13, lineHeight: 1, padding: "0 7px 0 2px" }}>×</button>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </Level>

          <Level n={3} title="Case pack">
            <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: C.muted }}>Cases per pack</span>
              {[2, 4, 6, 12].map((q) => <Chip key={q} active={st.packQty === q} onClick={() => { up({ packQty: q, packPick: null }); setOuterOverride(null); }}>{q}</Chip>)}
              <input type="number" min={1} step={1} value={st.packQty} onChange={(e) => { up({ packQty: Math.max(1, parseInt(e.target.value || "1", 10)), packPick: null }); setOuterOverride(null); }}
                style={{ ...inputStyle, width: 64 }} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label="Cases per pack" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Num label="Clearance per side (gap + board)" value={st.packClr} onChange={(v) => up({ packClr: v })} step={0.0625} suffix="in" />
              <div style={{ fontSize: 11, color: C.muted, paddingTop: 16 }}>{totalBags} bags · {f2(contentsOz / 16)} lb contents</div>
            </div>
            <ArrangementPick options={packOptions} selectedKey={packArr?.key} onPick={(k) => { up({ packPick: k }); setOuterOverride(null); }} itemLabel="cases" />
          </Level>

          <Level n={4} title="Best box and config">
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 1.45 }}>Every case and pack arrangement for {st.caseQty} per case × {st.packQty} per pack, tried against every box.</div>
            <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 4 }}>
              <label className="block" style={{ fontSize: 11, color: C.muted }}>
                <span>Rank by</span>
                <select value={optSort} onChange={(e) => setOptSort(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: "5px 6px" }} className="focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="void">Least void</option>
                  <option value="cost">Cheapest to ship</option>
                </select>
              </label>
              <label className="block" style={{ fontSize: 11, color: C.muted }}>
                <span>Boxes from</span>
                <select value={optSource} onChange={(e) => { setOptSource(e.target.value); setShowAllOpt(false); }} style={{ ...inputStyle, fontSize: 12, padding: "5px 6px" }} className="focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="all">All</option>
                  <option value="yours">Yours + custom</option>
                  <option value="uline">Uline</option>
                  <option value="amazon">Amazon</option>
                </select>
              </label>
            </div>
            {optShown.length ? (
              <div style={{ fontSize: 12 }}>
                {(showAllOpt ? optShown : optShown.slice(0, 5)).map((r, i) => {
                  const cur = isOptCurrent(r);
                  return (
                    <div key={r.box.id} className="flex items-start justify-between gap-2" style={{ padding: "7px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                      <div style={{ lineHeight: 1.4, minWidth: 0 }}>
                        <div style={{ fontWeight: i === 0 ? 800 : 700 }}>
                          {r.box.url ? <a href={r.box.url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: "underline", textDecorationColor: C.line, textUnderlineOffset: 2 }}>{r.box.name}</a> : r.box.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1" style={{ fontSize: 11, color: C.muted, margin: "2px 0" }}>
                          {r.box.source === "yours" && badge("yours", "good")}
                          {r.box.source === "custom" && badge("custom", "warn")}
                          {r.box.source === "amazon" && badge("amazon", "warn")}
                          {r.p.cubicOk ? badge(`cubic ${r.p.tier.toFixed(1)}`, "good") : badge(`${Math.ceil(r.p.billableLb)} lb${r.p.dimHit ? " DIM" : ""}`, r.p.dimHit ? "bad" : "warn")}
                          <span>{f2(r.voidPct)}% void</span>
                          {r.box.perBox != null && <span>· ${r.box.perBox.toFixed(2)}/box</span>}
                        </div>
                        <div style={{ color: C.muted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>Case {r.caseArr.counts.join(" × ")} → {dimStr(r.caseArr.dims)}</div>
                        <div style={{ color: C.muted, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>Pack {r.packArr.counts.join(" × ")} → {dimStr(r.packArr.dims)}</div>
                      </div>
                      <ShowBtn active={cur} onClick={() => applyOpt(r)}>{cur ? "In use" : "Use"}</ShowBtn>
                    </div>
                  );
                })}
                {optShown.length > 5 && (
                  <button onClick={() => setShowAllOpt(!showAllOpt)} style={{ fontSize: 11, color: C.ember, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}>
                    {showAllOpt ? "Show fewer" : `Show all ${optShown.length} boxes that work`}
                  </button>
                )}
              </div>
            ) : <div style={{ fontSize: 12, color: C.muted }}>No box in this list fits {st.packQty} cases of {st.caseQty} in any arrangement.</div>}
          </Level>
        </div>

        {/* ---------------- 3D + compare ---------------- */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
            <div className="flex" style={{ border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
              {[["nested", "Nested"], ["levels", "By level"]].map(([k, l]) => (
                <button key={k} onClick={() => setLayout(k)} className="focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-300"
                  style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", cursor: "pointer", border: "none", background: layout === k ? C.ink : "#fff", color: layout === k ? "#fff" : C.ink }}>{l}</button>
              ))}
            </div>
            {layout === "levels" && (
              <div className="flex gap-1">
                {[["unit", "Unit"], ["case", "Case"], ["pack", "Case pack"]].map(([k, l]) => <Chip key={k} active={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
              </div>
            )}
            <label className="flex items-center gap-2 ml-auto" style={{ fontSize: 11, color: C.muted }}>
              Explode
              <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(parseFloat(e.target.value))} style={{ width: 110, accentColor: C.ember }} aria-label="Explode view" />
            </label>
          </div>

          <Viewer model={model} view={view} explode={explode} caption={caption} />

          {outerOverride && (
            <div className="flex items-center gap-2" style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
              Showing {outerOverride.name} around the current arrangement.
              <button onClick={() => setOuterOverride(null)} style={{ fontSize: 11, color: C.ember, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Back to suggested box</button>
            </div>
          )}

          {/* compare */}
          <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
            <div className="flex flex-col gap-3">
            {/* tightest */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${C.coral}`, display: "inline-block", paddingBottom: 2, marginBottom: 8 }}>Tightest fit</h3>
              {tightest ? (() => {
                const p = postage(tightest.dims, contentsOz);
                const voidPct = 100 * (1 - contentVol / tightest.vol);
                return (
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{dimStr(tightest.dims)} in</div>
                    <div style={{ color: C.muted }}>{tightest.counts.join(" × ")} cases · {f2(p.cuft)} cu ft · {f2(voidPct)}% void</div>
                    {p.rounded.join("x") !== tightest.dims.map((v) => +f2(v)).join("x") && <div style={{ color: C.muted }}>Round up to {p.rounded.join(" × ")} for the label.</div>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.cubicOk ? badge(`Cubic tier ${p.tier.toFixed(1)}`, "good") : badge("Not cubic", "warn")}
                      {p.dimHit && badge("DIM weight applies", "bad")}
                    </div>
                    <div className="mt-2"><ShowBtn active={!outerOverride} onClick={() => setOuterOverride(null)}>{!outerOverride ? "Shown in 3D" : "Show in 3D"}</ShowBtn></div>
                  </div>
                );
              })() : <div style={{ fontSize: 12, color: C.muted }}>Set a case and pack quantity.</div>}
            </div>

            {/* cheapest */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${C.coral}`, display: "inline-block", paddingBottom: 2, marginBottom: 8 }}>Cheapest to ship</h3>
              {cheapest ? (
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{dimStr(cheapest.o.dims)} in</div>
                  <div style={{ color: C.muted }}>{cheapest.o.counts.join(" × ")} cases · billed at {Math.ceil(cheapest.p.billableLb)} lb{cheapest.p.dimHit ? " (DIM)" : ""}</div>
                  <div style={{ color: C.muted }}>Rough Ground Advantage: ${Math.round(cheapest.p.estLo)} to ${Math.round(cheapest.p.estHi)} by zone. Confirm in Pirate Ship.</div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cheapest.p.cubicOk ? badge(`Cubic tier ${cheapest.p.tier.toFixed(1)}`, "good") : badge("Not cubic", "warn")}
                    {cheapest.p.cuft > 1 ? badge("Over 1 cu ft", "warn") : badge("Under 1 cu ft", "good")}
                  </div>
                  {tightest && cheapest.o.key === tightest.key && <div style={{ color: C.green, marginTop: 4, fontWeight: 600 }}>Same box as the tightest fit.</div>}
                  <div className="mt-2">
                    <ShowBtn active={packArr?.key === cheapest.o.key && !outerOverride} onClick={() => { up({ packPick: cheapest.o.key }); setOuterOverride(null); }}>
                      {packArr?.key === cheapest.o.key && !outerOverride ? "Shown in 3D" : "Show in 3D"}
                    </ShowBtn>
                  </div>
                </div>
              ) : <div style={{ fontSize: 12, color: C.muted }}>Set a case and pack quantity.</div>}
            </div>

            </div>

            {/* stock */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${C.coral}`, display: "inline-block", paddingBottom: 2, marginBottom: 8 }}>Nearest stock box</h3>
              {(() => {
                const showBox = (r) => {
                  if (r.fits && r.arr && r.arr.key !== packArr?.key) up({ packPick: r.arr.key });
                  setOuterOverride({ name: r.box.name, dims: r.box.dims });
                };
                const Row = ({ r, i, bold }) => (
                  <div className="flex items-start justify-between gap-2" style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none", opacity: r.fits ? 1 : 0.8 }}>
                    <div style={{ lineHeight: 1.4 }}>
                      <div style={{ fontWeight: bold ? 800 : 600 }}>
                        {r.box.url ? <a href={r.box.url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink, textDecoration: "underline", textDecorationColor: C.line, textUnderlineOffset: 2 }}>{r.box.name}</a> : r.box.name}
                      </div>
                      <div style={{ color: C.muted, fontSize: 11 }}>
                        {r.fits ? <>{f2(r.voidPct)}% void · {r.p.cubicOk ? `cubic ${r.p.tier.toFixed(1)}` : `${Math.ceil(r.p.billableLb)} lb${r.p.dimHit ? " DIM" : ""}`}</> : <span style={{ color: "#C62828" }}>too small for this pack</span>}
                        {r.box.perBox != null && <> · ${r.box.perBox.toFixed(2)}/box{r.box.pack ? ` (${r.box.pack}-pk)` : ""}</>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1">
                        {r.box.source === "yours" && badge("yours", "good")}
                        {r.box.source === "custom" && badge("custom", "warn")}
                        {r.box.source === "amazon" && badge("amazon", "warn")}
                        {(r.box.source === "custom" || r.box.source === "yours") && (
                          <button title={r.box.source === "custom" ? "Remove this box" : "Hide this box (restore from Options)"} aria-label={`Remove ${r.box.name}`}
                            onClick={() => { if (isShown(r.box.dims)) setOuterOverride(null); r.box.source === "custom" ? up({ customBoxes: st.customBoxes.filter((x) => x.id !== r.box.id) }) : up({ hiddenDefaults: [...(st.hiddenDefaults || []), r.box.id] }); }}
                            style={{ border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", color: C.muted, fontSize: 12, lineHeight: 1, width: 18, height: 18, borderRadius: 9, padding: 0 }}>×</button>
                        )}
                      </div>
                      <ShowBtn active={isShown(r.box.dims)} onClick={() => showBox(r)}>{isShown(r.box.dims) ? "Shown" : "Show"}</ShowBtn>
                    </div>
                  </div>
                );
                return (
                  <div style={{ fontSize: 12 }}>
                    {mineRanked.length > 0 && (
                      <>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Your boxes</div>
                        {mineRanked.map((r, i) => <Row key={r.box.id} r={r} i={i} bold={r.fits && i === 0} />)}
                      </>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 2 }}>Closest Uline stock</div>
                    {ulineFit.length ? (
                      <>
                        {(showAllUline ? ulineFit : ulineFit.slice(0, 3)).map((r, i) => <Row key={r.box.id} r={r} i={i} bold={i === 0} />)}
                        {ulineFit.length > 3 && (
                          <button onClick={() => setShowAllUline(!showAllUline)} style={{ fontSize: 11, color: C.ember, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}>
                            {showAllUline ? "Show fewer" : `Show all ${ulineFit.length} that fit`}
                          </button>
                        )}
                      </>
                    ) : <div style={{ color: C.muted }}>Nothing in the Uline list fits this pack.</div>}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 2 }}>On Amazon (The Boxery), least void first</div>
                    {amazonFit.length ? (
                      <>
                        {(showAllAmazon ? amazonFit : amazonFit.slice(0, 3)).map((r, i) => <Row key={r.box.id} r={r} i={i} bold={i === 0} />)}
                        {amazonFit.length > 3 && (
                          <button onClick={() => setShowAllAmazon(!showAllAmazon)} style={{ fontSize: 11, color: C.ember, fontWeight: 700, background: "none", border: "none", cursor: "pointer", padding: "4px 0", textDecoration: "underline" }}>
                            {showAllAmazon ? "Show fewer" : `Show all ${amazonFit.length} that fit`}
                          </button>
                        )}
                      </>
                    ) : <div style={{ color: C.muted }}>Nothing on the Amazon list fits this pack.</div>}
                  </div>
                );
              })()}

            </div>
          </div>


          {/* find online */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginTop: 12 }}>
            <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, borderBottom: `2px solid ${C.coral}`, display: "inline-block", paddingBottom: 2 }}>Find boxes online</h3>
              <span style={{ fontSize: 11, color: C.muted }}>
                {online ? "Searches Amazon and the web for an exact size and shows price per box." : <>Needs the local helper. Run <code style={{ background: C.bone, padding: "1px 5px", borderRadius: 4 }}>python3 boxfit.py</code> in the Packaging folder and use the tab it opens.</>}
              </span>
            </div>
            {online && (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  {[["l", "Length"], ["w", "Width"], ["h", "Height"]].map(([k, l]) => (
                    <label key={k} className="block" style={{ fontSize: 11, color: C.muted, width: 80 }}>
                      <span>{l}</span>
                      <input type="number" step={0.5} min={0} value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
                        style={inputStyle} className="focus:outline-none focus:ring-2 focus:ring-orange-300" aria-label={`Search ${l}`} />
                    </label>
                  ))}
                  <button onClick={() => runSearch()} disabled={searching} className="focus:outline-none focus:ring-2 focus:ring-orange-300"
                    style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 6, border: "none", background: searching ? C.muted : C.ember, color: "#fff", cursor: searching ? "default" : "pointer" }}>
                    {searching ? "Searching…" : "Search"}
                  </button>
                  <div className="flex flex-wrap items-center gap-1" style={{ fontSize: 11, color: C.muted, marginLeft: 6, paddingBottom: 6 }}>
                    <span style={{ marginRight: 2 }}>Fill from</span>
                    {tightest && <Chip onClick={() => runSearch(wholeInch(tightest.dims))}>Tightest fit</Chip>}
                    {cheapest && <Chip onClick={() => runSearch(wholeInch(cheapest.o.dims))}>Cheapest</Chip>}
                    {packArr && outerOverride && <Chip onClick={() => runSearch(wholeInch(outerOverride.dims))}>Shown box</Chip>}
                  </div>
                </div>
                {searchErr && <div style={{ fontSize: 12, color: "#C62828", marginTop: 8 }}>{searchErr}</div>}
                {found && !searching && (() => {
                  const added = (b) => st.customBoxes.some((x) => x.url === b.url);
                  const addFound = (b) => {
                    const pk = b.pack ? ` (${b.pack}-pk)` : "";
                    const name = `${b.source === "amazon" ? "Amazon" : b.source} ${b.dims.map(f2).join(" × ")}${pk}`;
                    up({ customBoxes: [...st.customBoxes, { id: "c" + Date.now(), name, dims: b.dims, url: b.url, price: b.price ?? null, perBox: b.perBox ?? null, pack: b.pack ?? null }] });
                  };
                  const fitsPack = (d) => packOptions.some((o) => fitsIn(o.dims, d));
                  return (
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
                        {found.boxes.length ? `${found.boxes.length} priced listing${found.boxes.length === 1 ? "" : "s"} for ${found.want.map(f2).join(" × ")} in, cheapest per box first` : `No priced listings for ${found.want.map(f2).join(" × ")} in. Try the next whole inch up on one side.`}
                      </div>
                      {found.boxes.map((b, i) => {
                        const p = postage(b.dims, contentsOz);
                        const on = added(b);
                        return (
                          <div key={b.url + i} className="flex items-start justify-between gap-2" style={{ padding: "6px 0", borderTop: i ? `1px solid ${C.line}` : "none" }}>
                            <div style={{ minWidth: 0, lineHeight: 1.4 }}>
                              <a href={b.url} target="_blank" rel="noopener noreferrer" title={b.title} style={{ color: C.ink, fontWeight: i === 0 ? 800 : 600, textDecoration: "underline", textDecorationColor: C.line, textUnderlineOffset: 2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 520 }}>{b.title}</a>
                              <div className="flex flex-wrap items-center gap-1" style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                {badge(b.source, "warn")}
                                {b.fit === "exact" ? badge("exact size", "good") : badge("a bit larger", "warn")}
                                {!fitsPack(b.dims) && badge("too small for this pack", "bad")}
                                {p.cubicOk ? badge(`cubic ${p.tier.toFixed(1)}`, "good") : badge(`${Math.ceil(p.billableLb)} lb${p.dimHit ? " DIM" : ""}`, p.dimHit ? "bad" : "warn")}
                                {b.sponsored && badge("sponsored", "warn")}
                                <span style={{ fontVariantNumeric: "tabular-nums" }}>{b.dims.map(f2).join(" × ")} in{b.pack ? ` · pack of ${b.pack}` : ""}{b.price != null ? ` · $${b.price.toFixed(2)}` : ""}{b.perBox != null ? <b style={{ color: C.ink }}> · ${b.perBox.toFixed(2)}/box</b> : ""}</span>
                              </div>
                            </div>
                            <ShowBtn active={on} onClick={() => { if (!on) addFound(b); }}>{on ? "Added" : "Add"}</ShowBtn>
                          </div>
                        );
                      })}
                      {found.links.length > 0 && (
                        <>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: 2 }}>Elsewhere on the web (no price pulled)</div>
                          <div className="flex flex-wrap gap-1">
                            {found.links.map((l, i) => (
                              <a key={l.url + i} href={l.url} target="_blank" rel="noopener noreferrer" title={l.title}
                                style={{ fontSize: 11, color: C.ink, background: C.bone, border: `1px solid ${C.line}`, borderRadius: 20, padding: "2px 9px", textDecoration: "none", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.source}: {l.title}
                              </a>
                            ))}
                          </div>
                        </>
                      )}
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Prices as of {found.fetchedAt}. Pack counts and sizes are read from listing titles, so double-check before ordering.</div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) { .grid[style*="minmax(300px, 350px)"] { grid-template-columns: 1fr !important; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>
    </div>
  );
}
