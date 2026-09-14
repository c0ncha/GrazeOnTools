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

// item: [x,y,z] of the thing being packed. Returns arrangements sorted tightest first.
function solve(item, n, clr) {
  if (!n || n < 1) return [];
  const seen = new Map();
  for (const [a, b, c] of factorTriples(n)) {
    for (const p of PERMS) {
      const it = [item[p[0]], item[p[1]], item[p[2]]];
      const inner = [a * it[0] + 2 * clr, b * it[1] + 2 * clr, c * it[2] + 2 * clr];
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
  const dimLines = (dims, center, tier, off) => {
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
    group.add(new THREE.LineSegments(g, dimMat));
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
  customBoxes: [],
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

  const caseOptions = useMemo(() => solve(unitDims, Math.max(1, Math.round(st.caseQty)), st.caseClr || 0), [unitDims, st.caseQty, st.caseClr]);
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

  const packOptions = useMemo(() => caseArr ? solve(caseArr.dims, Math.max(1, Math.round(st.packQty)), st.packClr || 0) : [], [caseArr, st.packQty, st.packClr]);
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
  const catalog = useMemo(() => [...YOUR_BOXES, ...st.customBoxes.map((b) => ({ ...b, source: "custom" })), ...ULINE], [st.customBoxes]);
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
  const mineRanked = stockRanked.filter((r) => r.box.source !== "uline");
  const ulineFit = stockRanked.filter((r) => r.box.source === "uline" && r.fits);
  const [showAllUline, setShowAllUline] = useState(false);

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
        <div style={{ fontSize: 11, color: C.muted, minWidth: 60, textAlign: "right" }}>{saveNote}</div>
      </header>

      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(280px, 330px) minmax(0, 1fr)" }}>
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
          <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
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
                    <div style={{ color: C.muted }}>Round up to {p.rounded.join(" × ")} for the label.</div>
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
                      <div style={{ fontWeight: bold ? 800 : 600 }}>{r.box.name}</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>
                        {r.fits ? <>{f2(r.voidPct)}% void · {r.p.cubicOk ? `cubic ${r.p.tier.toFixed(1)}` : `${Math.ceil(r.p.billableLb)} lb${r.p.dimHit ? " DIM" : ""}`}</> : <span style={{ color: "#C62828" }}>too small for this pack</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {r.box.source === "yours" && badge("yours", "good")}
                      {r.box.source === "custom" && badge("custom", "warn")}
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
                  </div>
                );
              })()}

              <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Add a box (interior, inches)</div>
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
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12, background: C.amber, borderRadius: 8, padding: "8px 11px", fontSize: 11, color: C.ink, lineHeight: 1.5 }}>
            Postage rules follow the SOP after the July 12, 2026 USPS change: dimensions round up to the whole inch, DIM weight uses divisor 139 only over 1 cu ft, and cubic pricing needs 0.5 cu ft or less with no side over 22 inches. Dollar ranges are interpolated from the SOP's own table, so treat them as a ranking, not a quote. All cases in a pack are placed in the same orientation; mixed rotations aren't solved.
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) { .grid[style*="minmax(280px"] { grid-template-columns: 1fr !important; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>
    </div>
  );
}
