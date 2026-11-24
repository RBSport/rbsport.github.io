/* RB Sport · Experience 3D
   Centro multisport disegnato con le linee dei campi. La telecamera segue lo scroll.
   Ogni pagina dichiara i suoi punti di vista in <script type="application/json" id="cam">
   e ogni sezione [data-cam] può attivare effetti con data-fx (build lights play house terr relaunch academy sponsor). */
import * as THREE from './three.module.min.js';
import { LineSegments2 } from './LineSegments2.js';
import { LineSegmentsGeometry } from './LineSegmentsGeometry.js';
import { LineMaterial } from './LineMaterial.js';

const NAVY = 0x14223A, ORO = 0xB8975A, CREMA = 0xF2ECDF, SABBIA = 0xD9D1BF;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('scene');
const cfgEl = document.getElementById('cam');
const cfg = cfgEl ? JSON.parse(cfgEl.textContent) : { keys: [[60, 60, 90, 0, 0, -8]] };
const PAGE = document.body.dataset.page || 'index';
let ss = null; try { ss = window.sessionStorage; } catch (e) { ss = null; }
const ssGet = k => { try { return ss ? ss.getItem(k) : null; } catch (e) { return null; } };
const ssSet = (k, v) => { try { if (ss) ss.setItem(k, v); } catch (e) {} };
const ssDel = k => { try { if (ss) ss.removeItem(k); } catch (e) {} };

let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { document.documentElement.classList.add('no-gl'); }

const coarse = matchMedia('(pointer: coarse)').matches;
const low = coarse || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 1.6));
  document.documentElement.classList.toggle('gl-low', low);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NAVY);
  scene.fog = new THREE.Fog(NAVY, 70, 240);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1600);

  /* ---------------- strumenti ---------------- */
  const sets = [], fatMats = [];
  class LineSet {
    constructor(color, opacity = 1, width = 0) { this.p = []; this.color = color; this.opacity = opacity; this.width = width; }
    seg(a, b) { this.p.push(a[0], a[1], a[2], b[0], b[1], b[2]); return this; }
    poly(pts, closed) { for (let i = 0; i < pts.length - 1; i++) this.seg(pts[i], pts[i + 1]); if (closed) this.seg(pts[pts.length - 1], pts[0]); return this; }
    rect(cx, cz, w, d, y = .03) { const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2; return this.poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], true); }
    ln(x1, z1, x2, z2, y = .03) { return this.seg([x1, y, z1], [x2, y, z2]); }
    vert(x, z, h, y0 = 0) { return this.seg([x, y0, z], [x, y0 + h, z]); }
    circle(cx, cz, r, n = 56, y = .03, a0 = 0, a1 = Math.PI * 2) { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]); } return this.poly(pts, false); }
    box(cx, cy, cz, w, h, d) {
      const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      this.poly([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], true);
      this.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], true);
      [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => this.seg([x, y0, z], [x, y1, z]));
      return this;
    }
    /* rete verticale tra due punti a terra, da y0 a y1, con maglia */
    mesh(x1, z1, x2, z2, y0, y1, step) {
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(L / step));
      for (let i = 0; i <= n; i++) { const f = i / n; this.seg([x1 + (x2 - x1) * f, y0, z1 + (z2 - z1) * f], [x1 + (x2 - x1) * f, y1, z1 + (z2 - z1) * f]); }
      const m = Math.max(1, Math.round((y1 - y0) / step));
      for (let j = 0; j <= m; j++) { const y = y0 + (y1 - y0) * j / m; this.seg([x1, y, z1], [x2, y, z2]); }
      return this;
    }
    build(parent = scene) {
      if (this.width) {
        const g = new LineSegmentsGeometry(); g.setPositions(this.p);
        this.count = this.p.length / 3; this.segs = this.count / 2;
        this.mat = new LineMaterial({ color: this.color, linewidth: this.width, transparent: true, opacity: this.opacity, depthWrite: false });
        this.mat.fog = true;
        fatMats.push(this.mat);
        this.obj = new LineSegments2(g, this.mat); parent.add(this.obj); sets.push(this); return this;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      this.count = this.p.length / 3;
      this.mat = new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: this.opacity, depthWrite: false });
      this.obj = new THREE.LineSegments(g, this.mat); parent.add(this.obj); sets.push(this); return this;
    }
    reveal(r) {
      if (this.width) { this.obj.geometry.instanceCount = Math.max(0, Math.floor(this.segs * r)); return; }
      this.obj.geometry.setDrawRange(0, Math.max(0, Math.floor(this.count * r / 2) * 2));
    }
  }
  const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity >= 1 });
  function plane(w, d, mat, x, y, z, rx = -Math.PI / 2, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); scene.add(m); return m;
  }

  /* ---------------- terreno ---------------- */
  plane(1600, 1600, basic(0x111d33), 0, -.02, 0);
  const grid = new THREE.GridHelper(800, 160, ORO, ORO);
  grid.material.transparent = true; grid.material.opacity = .045; grid.position.y = -.01; scene.add(grid);

  const main = new LineSet(ORO, .95, low ? 1.4 : 1.7);     // linee di gioco
  const frame_ = new LineSet(CREMA, .42);  // strutture e recinzioni
  const fine = new LineSet(CREMA, .14);   // reti e maglie
  const soft = new LineSet(SABBIA, .16);  // percorsi, parcheggio, verde
  const roof = new LineSet(CREMA, .3);
  const poles = new LineSet(CREMA, .5);

  const SURF = 0x182a47, COURT = 0x1d3354;

  /* ---------- tennis, campo centrale (0,0) ---------- */
  plane(38, 20, basic(SURF), 0, 0, 0);
  const tennisMat = basic(COURT);
  plane(23.77, 10.97, tennisMat, 0, .005, 0);
  {
    const L = 23.77 / 2, W = 10.97 / 2, S = 8.23 / 2, SV = 6.4;
    main.rect(0, 0, 23.77, 10.97).ln(-L, -S, L, -S).ln(-L, S, L, S).ln(-SV, -S, -SV, S).ln(SV, -S, SV, S).ln(-SV, 0, SV, 0).ln(-L, 0, -L + .3, 0).ln(L, 0, L - .3, 0);
    frame_.vert(0, -W - .9, 1.07).vert(0, W + .9, 1.07).seg([0, 1.07, -W - .9], [0, .914, 0]).seg([0, .914, 0], [0, 1.07, W + .9]).vert(0, 0, .914);
    fine.mesh(0, -W - .9, 0, W + .9, .05, .95, .32);
    plane(12.8, 1, basic(CREMA, .08), 0, .5, 0, 0, Math.PI / 2);
    // sedia arbitro e panchine
    const cz = -W - 2.2;
    frame_.box(0, 1.1, cz, .8, 2.2, .8).box(0, 2.3, cz, .9, .2, .9).seg([-.4, 1.6, cz + .4], [-.4, 2.3, cz + .4]);
    [-2.6, 2.6].forEach(x => frame_.box(x, .45, cz, 2, .9, .5));
    // recinzione con maglia
    frame_.rect(0, 0, 36, 18, .03).rect(0, 0, 36, 18, 3.2);
    for (let x = -18; x <= 18; x += 3) { frame_.vert(x, -9, 3.2); frame_.vert(x, 9, 3.2); }
    for (let z = -9; z <= 9; z += 3) { frame_.vert(-18, z, 3.2); frame_.vert(18, z, 3.2); }
    fine.mesh(-18, -9, 18, -9, 0, 3.2, .8).mesh(-18, 9, 18, 9, 0, 3.2, .8).mesh(-18, -9, -18, 9, 0, 3.2, .8).mesh(18, -9, 18, 9, 0, 3.2, .8);
  }

  /* ---------- padel, tre campi coperti ---------- */
  const padelX = [-13, 0, 13], PZ = -32;
  plane(40, 24, basic(SURF), 0, 0, PZ);
  const glass = basic(CREMA, .055);
  padelX.forEach(cx => {
    plane(10, 20, basic(COURT), cx, .005, PZ);
    main.rect(cx, PZ, 10, 20).ln(cx - 5, PZ - 6.95, cx + 5, PZ - 6.95).ln(cx - 5, PZ + 6.95, cx + 5, PZ + 6.95).ln(cx, PZ - 6.95, cx, PZ + 6.95);
    frame_.seg([cx - 5.3, .92, PZ], [cx, .88, PZ]).seg([cx, .88, PZ], [cx + 5.3, .92, PZ]).vert(cx - 5.3, PZ, .92).vert(cx + 5.3, PZ, .92);
    fine.mesh(cx - 5.3, PZ, cx + 5.3, PZ, .05, .88, .3);
    plane(10.6, .9, basic(CREMA, .07), cx, .45, PZ, 0, 0);
    // fondi: vetro 3 m e rete fino a 4 m
    [-10, 10].forEach(e => {
      const z = PZ + e;
      frame_.seg([cx - 5, 3, z], [cx + 5, 3, z]).seg([cx - 5, 4, z], [cx + 5, 4, z]);
      for (let x = -5; x <= 5; x += 2.5) frame_.vert(cx + x, z, 4);
      fine.mesh(cx - 5, z, cx + 5, z, 3, 4, .5);
      plane(10, 3, glass, cx, 1.5, z, 0, 0);
    });
    // laterali: 2 m di vetro con rete fino a 4 m, poi rete 3 m, porte a metà campo
    [-5, 5].forEach(s => {
      const x = cx + s;
      [-1, 1].forEach(d => {
        const zEnd = PZ + d * 10, zIn = PZ + d * 8, zMid = PZ + d * 1;
        frame_.seg([x, 3, zEnd], [x, 3, zIn]).seg([x, 4, zEnd], [x, 4, zIn]).vert(x, zIn, 4).seg([x, 4, zIn], [x, 3, zIn - d * 2]);
        plane(2, 3, glass, x, 1.5, zEnd - d, 0, Math.PI / 2);
        fine.mesh(x, zEnd, x, zIn, 3, 4, .5).mesh(x, zIn, x, zMid, 0, 3, .5);
        frame_.seg([x, 3, zIn], [x, 3, zMid]);
        for (let k = 0; k <= 3; k++) frame_.vert(x, zIn - d * k * 7 / 3, 3);
      });
    });
  });
  // copertura ad archi
  {
    const R = 20, z0 = PZ - 12, z1 = PZ + 12;
    for (let z = z0; z <= z1 + .01; z += 4) {
      const pts = []; for (let i = 0; i <= 40; i++) { const x = -R + 2 * R * i / 40; pts.push([x, 4.5 + 6 * Math.sqrt(Math.max(0, 1 - (x / R) ** 2)), z]); }
      roof.poly(pts, false); roof.vert(-R, z, 4.5); roof.vert(R, z, 4.5);
    }
    [-1, -.85, -.7, -.5, -.25, 0, .25, .5, .7, .85, 1].forEach(f => { const x = f * R; const y = 4.5 + 6 * Math.sqrt(Math.max(0, 1 - f * f)); roof.seg([x, y, z0], [x, y, z1]); });
  }

  /* ---------- calcio a 5 (44,-4) ---------- */
  const FX = 44, FZ = -4;
  plane(30, 48, basic(SURF), FX, 0, FZ);
  plane(22, 40, basic(COURT), FX, .005, FZ);
  main.rect(FX, FZ, 22, 40).ln(FX - 11, FZ, FX + 11, FZ).circle(FX, FZ, 3).rect(FX, FZ - 17, 12, 6).rect(FX, FZ + 17, 12, 6)
    .circle(FX, FZ - 14, .15, 8).circle(FX, FZ + 14, .15, 8).circle(FX, FZ, .15, 8)
    .circle(FX - 11, FZ - 20, .6, 8, .03, 0, Math.PI / 2).circle(FX + 11, FZ - 20, .6, 8, .03, Math.PI / 2, Math.PI)
    .circle(FX - 11, FZ + 20, .6, 8, .03, -Math.PI / 2, 0).circle(FX + 11, FZ + 20, .6, 8, .03, Math.PI, Math.PI * 1.5);
  [-1, 1].forEach(s => {
    const z = FZ + s * 20, zb = z + s * 1;
    frame_.vert(FX - 1.5, z, 2).vert(FX + 1.5, z, 2).seg([FX - 1.5, 2, z], [FX + 1.5, 2, z]).seg([FX - 1.5, 2, z], [FX - 1.5, 0, zb]).seg([FX + 1.5, 2, z], [FX + 1.5, 0, zb]).seg([FX - 1.5, .03, zb], [FX + 1.5, .03, zb]);
    for (let x = -1.5; x <= 1.51; x += .3) fine.seg([FX + x, 2, z], [FX + x, 0, zb]);
    for (let f = .2; f < 1; f += .2) fine.seg([FX - 1.5, 2 - 2 * f, z + s * f], [FX + 1.5, 2 - 2 * f, z + s * f]);
  });
  [[FX - 11, FZ - 20], [FX + 11, FZ - 20], [FX - 11, FZ + 20], [FX + 11, FZ + 20]].forEach(([x, z]) => frame_.vert(x, z, 1.2).seg([x, 1.2, z], [x + .5, 1, z]).seg([x + .5, 1, z], [x, .85, z]));
  [-4, 4].forEach(dz => frame_.box(FX + 12.6, .6, FZ + dz, .9, 1.2, 3.4));
  frame_.rect(FX, FZ, 28, 46, 4);
  for (let z = -23; z <= 23; z += 4.6) { frame_.vert(FX - 14, FZ + z, 4); frame_.vert(FX + 14, FZ + z, 4); }
  for (let x = -14; x <= 14; x += 4.67) { frame_.vert(FX + x, FZ - 23, 4); frame_.vert(FX + x, FZ + 23, 4); }
  fine.mesh(FX - 14, FZ - 23, FX + 14, FZ - 23, 0, 4, 1).mesh(FX - 14, FZ + 23, FX + 14, FZ + 23, 0, 4, 1).mesh(FX - 14, FZ - 23, FX - 14, FZ + 23, 0, 4, 1).mesh(FX + 14, FZ - 23, FX + 14, FZ + 23, 0, 4, 1);

  /* ---------- beach volley (-40,12) ---------- */
  const BX = -40, BZ = 12;
  const sandMat = basic(SABBIA, .16);
  plane(24, 15, sandMat, BX, .004, BZ);
  main.rect(BX, BZ, 16, 8);
  frame_.vert(BX, BZ - 4.8, 2.55).vert(BX, BZ + 4.8, 2.55).seg([BX, 2.43, BZ - 4.8], [BX, 2.43, BZ + 4.8]).seg([BX, 1.43, BZ - 4.8], [BX, 1.43, BZ + 4.8]);
  frame_.vert(BX, BZ - 4, .8, 2.43).vert(BX, BZ + 4, .8, 2.43);
  fine.mesh(BX, BZ - 4.8, BX, BZ + 4.8, 1.43, 2.43, .2);
  frame_.rect(BX, BZ, 24, 15, .4);
  for (let x = -12; x <= 12; x += 4) { frame_.vert(BX + x, BZ - 7.5, .4); frame_.vert(BX + x, BZ + 7.5, .4); }
  {
    const pts = []; for (let i = 0; i < (low ? 300 : 900); i++) pts.push(BX + (Math.random() - .5) * 23.5, .02, BZ + (Math.random() - .5) * 14.5);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: SABBIA, size: .07, transparent: true, opacity: .45 })));
  }

  /* ---------- club house (-38,-14) ---------- */
  const CX = -38, CZ = -14;
  const house = new THREE.Mesh(new THREE.BoxGeometry(16, 5, 10), basic(0x0f1a2e));
  house.position.set(CX, 2.5, CZ); scene.add(house);
  const hEdges = new THREE.LineSegments(new THREE.EdgesGeometry(house.geometry), new THREE.LineBasicMaterial({ color: CREMA, transparent: true, opacity: .62 }));
  hEdges.position.copy(house.position); scene.add(hEdges);
  // terrazza, parapetto e pensilina d'ingresso
  frame_.rect(CX, CZ, 19, 13, 5.3).vert(CX - 9.5, CZ + 6.5, 5.3).vert(CX + 9.5, CZ + 6.5, 5.3).vert(CX + 9.5, CZ - 6.5, 5.3).vert(CX - 9.5, CZ - 6.5, 5.3);
  frame_.rect(CX, CZ, 15, 9, 6.3);
  for (let x = -7.5; x <= 7.5; x += 1.5) { frame_.vert(CX + x, CZ - 4.5, 1, 5.3); frame_.vert(CX + x, CZ + 4.5, 1, 5.3); }
  frame_.box(CX + 9.4, 3.3, CZ + 3.4, 3, .15, 3.6).vert(CX + 10.8, CZ + 1.7, 3.2).vert(CX + 10.8, CZ + 5.1, 3.2);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xE3C88E, transparent: true, opacity: .08, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) plane(2.2, 1.8, winMat, CX - 6 + i * 3, 2.6, CZ + 5.02, 0, 0);
  for (let i = 0; i < 3; i++) plane(2.2, 1.8, winMat, CX + 8.02, 2.6, CZ - 3 + i * 3, 0, Math.PI / 2);
  plane(2, 3, winMat, CX + 8.03, 1.5, CZ + 3.4, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) frame_.rect(CX - 6 + i * 3, CZ + 7.4, 1.6, .9, .03);   // tavoli in terrazza esterna
  for (let i = 0; i < 5; i++) frame_.vert(CX - 6 + i * 3, CZ + 7.4, .75).rect(CX - 6 + i * 3, CZ + 7.4, 1.6, .9, .75);

  /* ---------- parcheggio, ingresso, verde, percorsi ---------- */
  soft.rect(-50, 32, 28, 16);
  for (let x = -64; x <= -36; x += 2.5) { soft.ln(x, 24, x, 29); soft.ln(x, 35, x, 40); }
  soft.ln(-64, 32, -36, 32);
  frame_.vert(-53, 46, 2.6).vert(-47, 46, 2.6).seg([-53, 2.6, 46], [-47, 2.6, 46]);
  soft.rect(2, -6, 140, 104);
  [[-22, -10.6, -30, -10.6], [-22, -10.6, -22, 24], [-22, 6, -18, 6], [-22, 12, -28, 12], [-22, -20, -22, -10.6], [-22, -20, -20, -20], [-50, 46, -50, 40], [-36, 32, -22, 24], [18, 0, 30, 0], [18, 8, 20, 20.5], [-22, 24, 6, 24]].forEach(([a, b, c, d]) => soft.ln(a, b, c, d));
  const trees = [[-62, 18], [-62, 6], [-62, -6], [-62, -18], [-62, -30], [-56, -44], [-44, -52], [-30, -52], [26, -50], [40, -40], [62, -36], [66, 24], [66, 36], [-30, 40], [-6, 40], [-6, 30], [-66, 44], [62, 10], [-50, -30], [8, -14]];
  trees.forEach(([x, z]) => { soft.circle(x, z, 2.2, 20, 3.6).circle(x, z, 1.3, 14, 4.4); soft.vert(x, z, 4.4); });

  /* ---------- pali luce e luci ---------- */
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(246,226,186,1)'); r.addColorStop(.1, 'rgba(232,204,150,.75)'); r.addColorStop(.35, 'rgba(200,168,108,.12)'); r.addColorStop(1, 'rgba(184,151,90,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const glowMat = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending });
  [[-18, -9], [18, -9], [-18, 9], [18, 9], [FX - 14, FZ - 23], [FX + 14, FZ - 23], [FX - 14, FZ + 23], [FX + 14, FZ + 23], [BX - 12, BZ - 7.5], [BX + 12, BZ + 7.5], [-36, 24], [-64, 40]].forEach(([x, z]) => {
    poles.vert(x, z, 10).box(x, 10.1, z, .9, .2, .5);
    const s = new THREE.Sprite(glowMat); s.position.set(x, 10, z); s.scale.set(2.6, 2.6, 1); scene.add(s);
  });
  const padelGlow = new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  padelX.forEach(cx => [-6, 0, 6].forEach(dz => { const s = new THREE.Sprite(padelGlow); s.position.set(cx, 8.6, PZ + dz); s.scale.set(2.2, 2.2, 1); scene.add(s); }));

  /* ---------- nuova area (build) ---------- */
  const IX = 20, IZ = 33;
  const plot = new LineSet(CREMA, .3);
  plot.rect(IX, IZ, 28, 25, .03);
  [[-14, -12.5], [14, -12.5], [-14, 12.5], [14, 12.5]].forEach(([x, z]) => plot.vert(IX + x, IZ + z, 1.4).seg([IX + x - .4, 1.4, IZ + z], [IX + x + .4, 1.4, IZ + z]));
  for (let x = -14; x < 14; x += 2) plot.ln(IX + x, IZ - 13.2, IX + x + 1, IZ - 13.2);
  const newCourt = new LineSet(ORO, 1, low ? 1.6 : 2), newWalls = new LineSet(CREMA, .55);
  [IZ - 5.6, IZ + 5.6].forEach(cz => {
    newCourt.rect(IX, cz, 20, 10).ln(IX, cz - 5, IX, cz + 5).ln(IX - 6.95, cz - 5, IX - 6.95, cz + 5).ln(IX + 6.95, cz - 5, IX + 6.95, cz + 5).ln(IX - 6.95, cz, IX + 6.95, cz);
    [-10, 10].forEach(e => { newWalls.seg([IX + e, 3, cz - 5], [IX + e, 3, cz + 5]).seg([IX + e, 4, cz - 5], [IX + e, 4, cz + 5]); for (let z = -5; z <= 5.01; z += 2.5) newWalls.vert(IX + e, cz + z, 4); });
    [-5, 5].forEach(s => { newWalls.seg([IX - 10, 3, cz + s], [IX + 10, 3, cz + s]); for (let x = -10; x <= 10.01; x += 2.5) newWalls.vert(IX + x, cz + s, 3); });
  });
  const newSurf = [IZ - 5.6, IZ + 5.6].map(cz => plane(20, 10, basic(COURT, 0), IX, .006, cz));

  /* ---------- territorio (terr) ---------- */
  const terr = new LineSet(ORO, 0);
  [[150, -60], [-170, 40], [90, 170], [-110, -150], [210, 90], [-40, 210], [30, -200], [-230, -40], [180, -170]].forEach(([x, z]) => {
    terr.rect(x, z, 10, 10, .05).rect(x, z, 4, 4, .05); terr.vert(x, z, 14); terr.ln(0, 0, x, z, .05);
  });
  [220, 340, 460].forEach(s => terr.rect(0, 0, s, s, .04));

  /* ---------- academy: coni, scaletta, porticine ---------- */
  const acad = new LineSet(ORO, 0);
  const cone = (x, z) => { acad.seg([x - .22, .02, z], [x, .45, z]).seg([x + .22, .02, z], [x, .45, z]).seg([x, .02, z - .22], [x, .45, z]).seg([x, .02, z + .22], [x, .45, z]); };
  for (let i = 0; i < 6; i++) cone(FX - 6, FZ - 14 + i * 2.2);
  for (let i = 0; i < 6; i++) cone(FX + 6 + (i % 2 ? 1.2 : -1.2), FZ - 14 + i * 2.2);
  for (let i = 0; i < 8; i++) acad.rect(FX, FZ + 6 + i * .6, 1.2, .6, .03);
  [[FX - 6, FZ + 12], [FX + 6, FZ + 12]].forEach(([x, z]) => acad.vert(x - .8, z, 1).vert(x + .8, z, 1).seg([x - .8, 1, z], [x + .8, 1, z]));
  for (let i = 0; i < 5; i++) cone(-4 + i * 2, -3.5);  // anche sul tennis
  for (let i = 0; i < 5; i++) cone(-4 + i * 2, 3.5);

  /* ---------- sponsor: teli sulle recinzioni ---------- */
  const sponsorMat = basic(ORO, 0);
  const banners = [];
  [-12, -4, 4, 12].forEach(x => banners.push(plane(6, 1.1, sponsorMat, x, 1.1, -9.03, 0, 0)));
  [-12, -4, 4, 12].forEach(x => banners.push(plane(6, 1.1, sponsorMat, x, 1.1, 9.03, 0, 0)));
  padelX.forEach(cx => banners.push(plane(8, 1, sponsorMat, cx, 3.5, PZ + 10.03, 0, 0)));
  [-14, -4, 6, 16].forEach(z => banners.push(plane(7, 1.2, sponsorMat, FX - 14.03, 1.2, FZ + z, 0, Math.PI / 2)));
  // bandiere a goccia all'ingresso
  const flags = new LineSet(ORO, 0);
  [-55, -45].forEach(x => { flags.vert(x, 47.5, 4.2); const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12; pts.push([x + .9 * Math.sin(a * Math.PI) * (1 - a * .3), 1 + 3.2 * a, 47.5]); } flags.poly(pts, false); });

  /* ---------- rilancio: scansione sul campo centrale ---------- */
  const scanMat = basic(ORO, 0);
  const scanner = plane(.15, 12, scanMat, 0, .02, 0);
  const scanWall = plane(12, 2.5, basic(ORO, 0), 0, 1.25, 0, 0, Math.PI / 2);

  /* ---------- palline in gioco ---------- */
  const ballMat = new THREE.MeshBasicMaterial({ color: CREMA, transparent: true, opacity: 0 });
  const ballGeo = new THREE.SphereGeometry(.17, 12, 12);
  const mkBall = () => { const b = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: CREMA, transparent: true, opacity: 0 })); scene.add(b); return b; };
  const padelBalls = padelX.map(mkBall), tennisBall = mkBall(), footBall = mkBall(), beachBall = mkBall();
  const acadBalls = [0, 1, 2, 3].map(() => { const b = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: CREMA, transparent: true, opacity: 0 })); scene.add(b); return b; });

  [main, frame_, fine, soft, roof, poles].forEach(s => s.build());
  plot.build(); newCourt.build(); newWalls.build(); terr.build(); acad.build(); flags.build();
  newCourt.reveal(0); newWalls.reveal(0);


  /* ---------------- giocatori come tracciamento ---------------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const markGeo = new THREE.RingGeometry(.15, .25, 24); markGeo.rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(.07, 12); dotGeo.rotateX(-Math.PI / 2);
  const TRAIL = 30;
  function mkPlayer(color, x, z) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(markGeo, mat); m.position.set(x, .07, z); scene.add(m);
    const d = new THREE.Mesh(dotGeo, mat); d.position.set(x, .071, z); scene.add(d);
    const arr = new Float32Array(TRAIL * 3); for (let i = 0; i < TRAIL; i++) { arr[i * 3] = x; arr[i * 3 + 1] = .06; arr[i * 3 + 2] = z; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const lmat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const line = new THREE.Line(g, lmat); line.frustumCulled = false; scene.add(line);
    return { m, d, mat, lmat, arr, g, x, z, tx: x, tz: z, sp: rnd(.7, 1.2), jx: rnd(-1, 1), jz: rnd(-1, 1) };
  }
  function movePlayer(p, dt, w) {
    const k = 1 - Math.pow(.03, dt * p.sp);
    p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k;
    p.m.position.x = p.d.position.x = p.x; p.m.position.z = p.d.position.z = p.z;
    p.mat.opacity = .95 * w; p.lmat.opacity = .38 * w;
  }
  function pushTrail(p) { p.arr.copyWithin(3, 0, (TRAIL - 1) * 3); p.arr[0] = p.x; p.arr[2] = p.z; p.g.attributes.position.needsUpdate = true; }

  const games = [];
  padelX.forEach((cx, i) => {
    const pl = [mkPlayer(ORO, cx - 2.5, PZ - 7), mkPlayer(ORO, cx + 2.5, PZ - 7), mkPlayer(CREMA, cx - 2.5, PZ + 7), mkPlayer(CREMA, cx + 2.5, PZ + 7)];
    games.push({ id: 'padel' + i, pl, ball: padelBalls[i], w: 0, update(t, b) {
      pl.forEach((p, k) => {
        const side = k < 2 ? -1 : 1, lane = k % 2 ? 1 : -1, near = Math.sign(b.z - PZ) === side;
        p.tx = Math.min(cx + 4.3, Math.max(cx - 4.3, cx + lane * 2.4 + (b.x - cx) * .45 + p.jx * .4));
        p.tz = PZ + side * (near ? 6.6 + Math.sin(t * .7 + k) * .5 : 3.4 + p.jz * .6);
      });
    } });
  });
  {
    const pl = [mkPlayer(ORO, -12.4, 0), mkPlayer(CREMA, 12.4, 0)];
    games.push({ id: 'tennis', pl, ball: tennisBall, w: 0, update(t, b) {
      pl.forEach((p, k) => { const side = k ? 1 : -1; p.tx = side * (12.3 + (Math.sign(b.x) === side ? .7 : -.7)); p.tz = b.z * .9 + p.jz * .4; });
    } });
  }
  {
    const pl = [mkPlayer(ORO, BX - 5, BZ - 1.8), mkPlayer(ORO, BX - 3, BZ + 1.8), mkPlayer(CREMA, BX + 5, BZ - 1.8), mkPlayer(CREMA, BX + 3, BZ + 1.8)];
    games.push({ id: 'beach', pl, ball: beachBall, w: 0, update(t, b) {
      pl.forEach((p, k) => { const side = k < 2 ? -1 : 1, near = Math.sign(b.x - BX) === side; p.tx = BX + side * (near ? (k % 2 ? 3.2 : 5.6) : (k % 2 ? 1.4 : 4.4)); p.tz = BZ + (k % 2 ? 1.8 : -1.8) + (b.z - BZ) * .5; });
    } });
  }
  // calcio a 5: passaggi tra giocatori, possesso che cambia
  const fA = [[0, -18], [-5, -10], [5, -10], [-4, -2], [4, -2]], fB = fA.map(([x, z]) => [-x, -z]);
  const foot = { pl: [...fA.map(([x, z]) => mkPlayer(ORO, FX + x, FZ + z)), ...fB.map(([x, z]) => mkPlayer(CREMA, FX + x, FZ + z))], form: [...fA, ...fB], from: 1, to: 3, t0: 0, dur: 1.2, w: 0, id: 'foot' };
  function footStep(t) {
    if (t - foot.t0 < foot.dur) return;
    foot.from = foot.to;
    const team = foot.from < 5 ? 0 : 1, base = (Math.random() < .74 ? team : 1 - team) * 5;
    let n = foot.from; while (n === foot.from || (n % 5 === 0 && Math.random() < .75)) n = base + Math.floor(Math.random() * 5);
    foot.to = n; foot.t0 = t; foot.dur = rnd(.9, 1.7);
  }

  /* ---------------- cantiere della nuova area ---------------- */
  const dig = plane(28, 25, basic(SABBIA, 0), IX, .004, IZ);
  const newGlassMat = basic(CREMA, 0);
  const newGlass = new THREE.Group(); scene.add(newGlass);
  [IZ - 5.6, IZ + 5.6].forEach(cz => [-10, 10].forEach(e => { const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), newGlassMat); m.rotation.y = Math.PI / 2; m.position.set(IX + e, 1.5, cz); newGlass.add(m); }));
  const newRoof = new LineSet(CREMA, .32);
  for (let x = -10; x <= 10.01; x += 4) {
    const pts = []; for (let i = 0; i <= 30; i++) { const z = -11.5 + 23 * i / 30; pts.push([IX + x, 4.5 + 5 * Math.sqrt(Math.max(0, 1 - (z / 11.5) ** 2)), IZ + z]); }
    newRoof.poly(pts, false); newRoof.vert(IX + x, IZ - 11.5, 4.5); newRoof.vert(IX + x, IZ + 11.5, 4.5);
  }
  [-1, -.6, 0, .6, 1].forEach(fz => { const z = fz * 11.5, y = 4.5 + 5 * Math.sqrt(Math.max(0, 1 - fz * fz)); newRoof.seg([IX - 10, y, IZ + z], [IX + 10, y, IZ + z]); });
  newRoof.build(); newRoof.reveal(0);
  // gru di cantiere
  const crane = new THREE.Group(); crane.position.set(IX + 17, 0, IZ - 13); scene.add(crane);
  const mast = new LineSet(CREMA, 0), jibSet = new LineSet(ORO, 0);
  for (let y = 0; y < 22; y += 2) { mast.rect(0, 0, 1.4, 1.4, y); mast.seg([-.7, y, -.7], [.7, y + 2, .7]); }
  [[-.7, -.7], [.7, -.7], [.7, .7], [-.7, .7]].forEach(([x, z]) => mast.seg([x, 0, z], [x, 22, z]));
  mast.build(crane);
  const jib = new THREE.Group(); jib.position.y = 22; crane.add(jib);
  jibSet.seg([-7, 0, 0], [19, 0, 0]).seg([-7, 1.2, 0], [12, 1.2, 0]).seg([0, 0, 0], [0, 4, 0]).seg([0, 4, 0], [19, 0, 0]).seg([0, 4, 0], [-7, 1.2, 0]);
  for (let x = -6; x < 19; x += 2) jibSet.seg([x, 0, 0], [x + 1, 1.2 * (x + 1 < 12 ? 1 : 0), 0]);
  jibSet.box(-6, -.6, 0, 2, 1.2, 1.6).seg([13, 0, 0], [13, -12, 0]).box(13, -12.4, 0, .8, .8, .8);
  jibSet.build(jib);



  /* ---------------- cornici dei luoghi (menu e mappa) ---------------- */
  const AREAS = { tennis: [0, 0, 38, 20], padel: [0, -32, 42, 26], calcio: [44, -4, 30, 48], beach: [-40, 12, 26, 17], club: [-38, -14, 21, 15], ingresso: [-50, 36, 32, 24], area: [20, 33, 30, 27], tutto: [2, -6, 140, 104] };
  const frames = {};
  for (const [name, [cx, cz, w, d]] of Object.entries(AREAS)) {
    const s = new LineSet(ORO, 0, 2), x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, L = Math.min(5, w / 5), y = .09, H = name === 'tutto' ? 0 : 3;
    [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]].forEach(([x, z, sx, sz]) => { s.seg([x, y, z], [x + sx * L, y, z]).seg([x, y, z], [x, y, z + sz * L]); if (H) s.seg([x, y, z], [x, H, z]); });
    s.build(); frames[name] = { s, v: 0 };
  }
  let hl = null;

  /* ---------------- telecamera ---------------- */
  const sections = [...document.querySelectorAll('[data-cam]')];
  const keys = cfg.keys;
  const V = (a, o = 0) => new THREE.Vector3(a[o], a[o + 1], a[o + 2]);
  const P = keys.map(k => V(k)), T = keys.map(k => V(k, 3));
  const N = Math.max(1, P.length - 1);
  const single = P.length === 1;
  const posCurve = single ? null : new THREE.CatmullRomCurve3(P, false, 'centripetal', .5);
  const tgtCurve = single ? null : new THREE.CatmullRomCurve3(T, false, 'centripetal', .5);
  const fxOf = sections.map(s => (s.dataset.fx || '').split(/\s+/).filter(Boolean));

  let f = 0, fS = 0; const fVel = { v: 0 };
  const mouse = { x: 0, y: 0 }, mS = { x: 0, y: 0 };
  let looping = false, lastAct = performance.now();
  const wake = () => { lastAct = performance.now(); if (!looping && !document.hidden) { looping = true; clock.getDelta(); renderer.setAnimationLoop(frame); } };
  addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; wake(); } }, { passive: true });
  addEventListener('touchmove', () => wake(), { passive: true });

  let mids = [], maxScroll = 1;
  function layout() { mids = sections.map(s => s.getBoundingClientRect().top + scrollY + s.offsetHeight * .5); maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight); }
  function measure() {
    if (!sections.length) return;
    if (!mids.length) layout();
    const c = scrollY + innerHeight * .5;
    if (c <= mids[0]) f = 0;
    else if (c >= mids[mids.length - 1]) f = mids.length - 1;
    else for (let i = 0; i < mids.length - 1; i++) if (c >= mids[i] && c < mids[i + 1]) { f = i + (c - mids[i]) / (mids[i + 1] - mids[i]); break; }
  }
  addEventListener('scroll', () => { measure(); wake(); }, { passive: true });
  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    layout(); measure(); wake();
    if (w === lastW && Math.abs(h - lastH) < 2) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 700 ? 60 : 42; camera.updateProjectionMatrix();
    fatMats.forEach(m => m.resolution.set(w, h));
  }
  const clock = new THREE.Clock();
  addEventListener('resize', resize); resize();
  if ('ResizeObserver' in window) new ResizeObserver(() => { layout(); measure(); }).observe(document.body);
  addEventListener('load', () => { layout(); measure(); });

  function damp(cur, tgt, st, dt, vel) {
    const o = 2 / st, x = o * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - tgt, tmp = (vel.v + o * ch) * dt;
    vel.v = (vel.v - o * tmp) * e; return tgt + (ch + tmp) * e;
  }
  const easeIO = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const fx = { build: 0, lights: 0, play: 0, house: 0, terr: 0, relaunch: 0, academy: 0, sponsor: 0, plan: 0 };

  /* ---- messa a fuoco: mappa esplorabile e selettore degli interlocutori ---- */
  const focus = { idx: -1, key: null, fx: [], P: new THREE.Vector3(), T: new THREE.Vector3(), w: 0, target: 0, moving: false };
  const hotWrap = document.querySelector('.hotspots');
  const hots = hotWrap ? [...hotWrap.querySelectorAll('.hotspot')].map(el => ({ el, v: new THREE.Vector3(...el.dataset.anchor.split(',').map(Number)) })) : [];
  const exploreIdx = sections.findIndex(s => s.hasAttribute('data-explore'));

  /* ---- voli ---- */
  const camP = new THREE.Vector3(), camT = new THREE.Vector3(), scrP = new THREE.Vector3(), scrT = new THREE.Vector3();
  const ftP = new THREE.Vector3(), ftT = new THREE.Vector3();
  let flight = null, blend = 1;
  const flyP = new THREE.Vector3(), flyT = new THREE.Vector3(), ctrl = new THREE.Vector3();
  function flyTo(key, dur, cb, lift) {
    const tp = V(key), tt = V(key, 3), dist = camP.distanceTo(tp);
    ctrl.copy(camP).add(tp).multiplyScalar(.5); ctrl.y += lift !== undefined ? lift : Math.max(16, dist * .4);
    flight = { fp: camP.clone(), ft: camT.clone(), tp, tt, c: ctrl.clone(), t0: performance.now(), dur, cb, done: false };
    wake();
  }
  const arrive = ssGet('rb-arrive') === PAGE;
  const seen = ssGet('rb-seen') === '1';
  let intro = 2;
  camP.copy(P[0]); camT.copy(T[0]);
  let from = null; try { from = JSON.parse(ssGet('rb-from') || 'null'); } catch (e) { from = null; }
  if (arrive && from && from.length === 6 && !reduce) {
    camP.set(from[0], from[1], from[2]); camT.set(from[3], from[4], from[5]);
    flyTo(keys[0], 950, null, 8);
  } else if (!arrive && !seen && !reduce) {
    intro = 0;
    const k0 = keys[0];
    camP.set(k0[0] * 1.6 - 60, k0[1] * 2.2 + 90, k0[2] * 1.6 + 120); camT.set(k0[3], k0[4], k0[5]);
    flyTo(k0, 2600, null, 10);
  }
  ssSet('rb-seen', '1'); ssDel('rb-arrive'); ssDel('rb-from');

  window.RB = {
    flyTo: (key, dur, cb) => { if (reduce) { cb && cb(); return; } blend = 0; flyTo(key, dur, cb); },
    highlight: name => { hl = name; wake(); },
    pose: () => [camP.x, camP.y, camP.z, camT.x, camT.y, camT.z],
    focus: (section, key, list) => {
      const idx = sections.indexOf(section);
      if (key) { if (focus.target === 0) { focus.P.copy(scrP); focus.T.copy(scrT); } focus.idx = idx; focus.key = key; focus.fx = list || []; focus.target = 1; }
      else focus.target = 0;
      wake();
    },
    ready: false, low
  };

  const cWorn = new THREE.Color(0x26324a), cNew = new THREE.Color(0x24406c), cBase = new THREE.Color(COURT);
  const skyA = new THREE.Color(0x1a2b47), skyB = new THREE.Color(0x0e1829), skyM = new THREE.Color(0x24395b), sky = new THREE.Color();
  let trailClock = 0;
  let firstFrame = true, time = 0;
  const tmpV = new THREE.Vector3();

  function frame() {
    const dt = Math.min(clock.getDelta(), .05); time += dt; const t = time;
    fS = reduce ? f : damp(fS, f, .3, dt, fVel);
    const km = 1 - Math.pow(.02, dt);
    mS.x += (mouse.x - mS.x) * km; mS.y += (mouse.y - mS.y) * km;

    if (single) {
      const k0 = keys[0], a = reduce ? .6 : t * .03 + .6, r = Math.hypot(k0[0] - k0[3], k0[2] - k0[5]);
      scrT.set(k0[3], k0[4], k0[5]); scrP.set(k0[3] + Math.cos(a) * r, k0[1], k0[5] + Math.sin(a) * r);
    } else {
      const u = Math.min(1, Math.max(0, fS / N));
      posCurve.getPoint(u, scrP); tgtCurve.getPoint(u, scrT);
      if (cfg.style === 'orbit') {
        const a = Math.sin(fS * Math.PI * 2) * .22, dx = scrP.x - scrT.x, dz = scrP.z - scrT.z, c = Math.cos(a), sn = Math.sin(a);
        scrP.x = scrT.x + dx * c - dz * sn; scrP.z = scrT.z + dx * sn + dz * c;
      }
      if (cfg.style === 'walk') scrP.y += Math.abs(Math.sin(fS * Math.PI * 7)) * .07;
    }

    // messa a fuoco sulla sezione attiva
    focus.w += (focus.target - focus.w) * (1 - Math.pow(.03, dt));
    let fw = 0;
    if (focus.idx >= 0 && focus.key) {
      ftP.set(focus.key[0], focus.key[1], focus.key[2]); ftT.set(focus.key[3], focus.key[4], focus.key[5]);
      const g = 1 - Math.pow(.04, dt);
      focus.P.lerp(ftP, g); focus.T.lerp(ftT, g);
      focus.moving = focus.P.distanceToSquared(ftP) > .01 || Math.abs(focus.w - focus.target) > .005;
      const prox = Math.max(0, 1 - Math.abs(fS - focus.idx) * 1.7);
      fw = easeIO(Math.min(1, focus.w)) * easeIO(prox);
      scrP.lerp(focus.P, fw); scrT.lerp(focus.T, fw);
    } else focus.moving = false;

    if (!reduce) {
      const amp = Math.min(1, scrP.y / 25) * .45 + .08;
      scrP.x += Math.sin(t * .13) * amp + mS.x * 2.2 * amp;
      scrP.y += Math.sin(t * .11) * amp * .3 - mS.y * 1.1 * amp;
      scrP.z += Math.cos(t * .12) * amp;
    }

    if (flight) {
      const u = Math.min(1, (performance.now() - flight.t0) / flight.dur), e = easeIO(u), ie = 1 - e;
      flyP.set(ie * ie * flight.fp.x + 2 * ie * e * flight.c.x + e * e * flight.tp.x,
               ie * ie * flight.fp.y + 2 * ie * e * flight.c.y + e * e * flight.tp.y,
               ie * ie * flight.fp.z + 2 * ie * e * flight.c.z + e * e * flight.tp.z);
      flyT.copy(flight.ft).lerp(flight.tt, e);
      camP.copy(flyP); camT.copy(flyT);
      if (intro < 1) intro = u;
      if (u >= 1 && !flight.done) { flight.done = true; const cb = flight.cb; if (cb) cb(); else { flight = null; blend = 0; } }
    } else {
      blend = Math.min(1, blend + dt / .9);
      const a = blend >= 1 ? 1 : 1 - Math.pow(.015, dt);
      camP.lerp(scrP, a); camT.lerp(scrT, a);
    }
    camera.position.copy(camP); camera.lookAt(camT);

    // effetti: quelli della sezione più quelli della messa a fuoco
    for (const k in fx) fx[k] = 0;
    fxOf.forEach((list, i) => { const w = Math.max(0, 1 - Math.abs(fS - i)); list.forEach(k => { if (k in fx) fx[k] = Math.max(fx[k], w * (1 - fw)); }); });
    focus.fx.forEach(k => { if (k in fx) fx[k] = Math.max(fx[k], fw); });

    if (intro <= 1) { const e = easeIO(Math.min(1, intro * 1.15)); [main, frame_, fine, soft, roof, poles, plot].forEach((s, i) => s.reveal(Math.min(1, Math.max(0, e * 1.5 - i * .07)))); if (intro >= 1) intro = 2; }

    // dal tramonto alla sera, man mano che si scorre
    const p = Math.min(1, scrollY / maxScroll);
    if (!cfg.day) { sky.copy(skyA).lerp(skyB, p); scene.background.copy(sky); scene.fog.color.copy(sky); }

    const far = Math.min(1, Math.max(0, (camP.y - 10) / 45));
    fine.mat.opacity = (low ? .11 : .15) * (1 - far * .85);
    frame_.mat.opacity = .42 - .12 * far;

    // giornata del centro (Home): lo scroll è il tempo
    const day = cfg.day ? p : -1;
    const occ = day < 0 ? {} : {
      tennis: ss(.04, .12, day), padel0: ss(.1, .18, day), padel1: ss(.38, .46, day), padel2: ss(.52, .6, day),
      beach: ss(.16, .24, day) * (1 - ss(.68, .76, day)), foot: ss(.6, .68, day), academy: ss(.28, .36, day) * (1 - ss(.54, .6, day)),
      lights: ss(.55, .72, day), house: ss(.42, .6, day)
    };
    if (cfg.day) {
      if (day < .5) sky.copy(skyM).lerp(skyA, day * 2); else sky.copy(skyA).lerp(skyB, (day - .5) * 2);
      scene.background.copy(sky); scene.fog.color.copy(sky);
    }

    // cantiere: scavo, sottofondo, manto, linee, vetrate, copertura
    const b = fx.build, ph = (a, z) => Math.min(1, Math.max(0, (b - a) / (z - a)));
    dig.material.opacity = .2 * ph(0, .15) * (1 - ph(.35, .5));
    newSurf.forEach(m => { m.material.opacity = ph(.2, .35); m.position.y = -.5 + .506 * easeIO(ph(.2, .4)); });
    newCourt.reveal(easeIO(ph(.35, .58)));
    const wall = Math.max(.001, easeIO(ph(.58, .78)));
    newWalls.reveal(wall > .002 ? 1 : 0); newWalls.obj.scale.y = wall; newGlass.scale.y = wall; newGlassMat.opacity = .06 * ph(.58, .7);
    newRoof.reveal(easeIO(ph(.78, .97)));
    const cr = ph(.02, .1) * (1 - ph(.9, 1));
    mast.mat.opacity = .5 * cr; jibSet.mat.opacity = .85 * cr; jib.rotation.y = -.6 + b * 2.4 + Math.sin(t * .3) * .05;
    plot.mat.opacity = .22 + .3 * fx.build;


    const L = Math.max(fx.lights, fx.sponsor * .7, occ.lights || 0);
    padelGlow.opacity = .6 * L; glowMat.opacity = .1 + .22 * (cfg.day ? 0 : p) + .55 * L;

    // gioco: palline e giocatori
    const play = Math.max(fx.play, fx.sponsor * .6);
    let anyPlay = 0;
    padelBalls.forEach((bl, i) => { const q = t * 1.25 + i * 1.7; bl.position.set(padelX[i] + 2.2 * Math.sin(t * .6 + i * 2), .35 + 2.1 * Math.abs(Math.cos(q)), PZ + 7.5 * Math.sin(q)); });
    { const q = t * .95; tennisBall.position.set(10.5 * Math.sin(q), .4 + 2.4 * Math.abs(Math.cos(q)), 2.2 * Math.sin(t * .5)); }
    { const q = t * 1.1; beachBall.position.set(BX + 6 * Math.sin(q), .6 + 3.2 * Math.abs(Math.cos(q)), BZ + 1.5 * Math.sin(t * .4)); }
    trailClock += dt; const doTrail = trailClock > .07; if (doTrail) trailClock = 0;
    games.forEach(g => {
      const w = Math.max(play, occ[g.id] || 0); g.w = w; anyPlay = Math.max(anyPlay, w);
      g.ball.material.opacity = w;
      if (w < .01) { g.pl.forEach(p => { p.mat.opacity = 0; p.lmat.opacity = 0; }); return; }
      g.update(t, g.ball.position); g.pl.forEach(p => { movePlayer(p, dt, w); if (doTrail) pushTrail(p); });
    });
    {
      const w = Math.max(play, occ.foot || 0); foot.w = w; anyPlay = Math.max(anyPlay, w);
      footBall.material.opacity = w;
      if (w > .01) {
        footStep(t);
        const a = foot.pl[foot.from], c = foot.pl[foot.to], u = easeIO(Math.min(1, (t - foot.t0) / foot.dur));
        const bx = a.x + (c.x - a.x) * u, bz = a.z + (c.z - a.z) * u;
        footBall.position.set(bx, .22 + Math.sin(u * Math.PI) * .5, bz);
        foot.pl.forEach((p, k) => {
          const [fx0, fz0] = foot.form[k];
          p.tx = FX + fx0 * (k % 5 === 0 ? .4 : 1) + (bx - FX) * (k % 5 === 0 ? .25 : .45) + Math.sin(t * .8 + k) * .8;
          p.tz = FZ + fz0 + (bz - FZ) * (k % 5 === 0 ? .1 : .35) + Math.cos(t * .6 + k * 2) * .8;
          if (k === foot.to) { p.tx += (bx - p.tx) * .3; p.tz += (bz - p.tz) * .3; }
          p.tx = Math.min(FX + 10.5, Math.max(FX - 10.5, p.tx)); p.tz = Math.min(FZ + 19.5, Math.max(FZ - 19.5, p.tz));
          movePlayer(p, dt, w); if (doTrail) pushTrail(p);
        });
      } else foot.pl.forEach(p => { p.mat.opacity = 0; p.lmat.opacity = 0; });
    }
    fx.academy = Math.max(fx.academy, occ.academy || 0);

    acad.mat.opacity = .95 * fx.academy;
    acadBalls.forEach((bl, i) => {
      bl.material.opacity = fx.academy;
      const ph = t * .9 + i * 1.6, s = (Math.sin(ph) + 1) / 2;
      if (i < 2) bl.position.set(FX + (i ? 6 : -6) + (i ? Math.sin(ph * 2) * 1.2 : 0), .22, FZ - 14 + s * 11);
      else bl.position.set(-4 + (i - 2) * 8 * s, .35 + 1.2 * Math.abs(Math.sin(ph * 2)), (i === 2 ? -1 : 1) * (3.5 - 3 * s));
    });

    winMat.opacity = .08 + .25 * (cfg.day ? 0 : p) + .6 * Math.max(fx.house, fx.lights * .3, occ.house || 0);

    terr.mat.opacity = .75 * fx.terr;
    scene.fog.far = 240 + fx.terr * 560; scene.fog.near = 70 + fx.terr * 130;
    grid.material.opacity = (.045 + .05 * fx.terr) * (1 - far * .4);

    const rl = fx.relaunch;
    scanMat.opacity = .9 * rl; scanWall.material.opacity = .07 * rl;
    const sx = -11.9 + 23.8 * ((t * .22) % 1);
    scanner.position.x = sx; scanWall.position.x = sx;
    tennisMat.color.copy(cBase).lerp(cWorn, rl * .6);
    if (rl > .02) tennisMat.color.lerp(cNew, rl * Math.min(1, ((t * .22) % 1) * 1.2));

    sponsorMat.opacity = .55 * fx.sponsor;
    flags.mat.opacity = .9 * Math.max(fx.sponsor, fx.house * .6);

    let hlMoving = false;
    for (const [name, fr] of Object.entries(frames)) {
      const target = hl === name ? 1 : 0;
      fr.v += (target - fr.v) * (1 - Math.pow(.004, dt));
      if (Math.abs(target - fr.v) > .01 || target) hlMoving = true;
      fr.s.mat.opacity = fr.v * (.8 + .2 * Math.sin(t * 3));
    }

    // punti della mappa proiettati sullo schermo
    if (hotWrap) {
      const prox = exploreIdx >= 0 ? Math.max(0, 1 - Math.abs(fS - exploreIdx) * 2.2) : 0;
      hotWrap.classList.toggle('live', prox > .6 && !flight);
      if (prox > .05) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        hots.forEach(o => {
          tmpV.copy(o.v).project(camera);
          const vis = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05;
          o.el.style.transform = `translate3d(${((tmpV.x + 1) / 2 * w).toFixed(1)}px,${((1 - tmpV.y) / 2 * h).toFixed(1)}px,0)`;
          o.el.classList.toggle('off', !vis);
        });
      }
    }

    renderer.render(scene, camera);
    if (firstFrame) { firstFrame = false; window.RB.ready = true; document.dispatchEvent(new Event('rb:ready')); }

    // rendering solo quando serve: fermo se nulla si muove
    const anim = anyPlay > .02 || fx.academy > .02 || rl > .02 || hlMoving || focus.moving || flight || intro <= 1 || Math.abs(f - fS) > .0005;
    if (!anim && performance.now() - lastAct > 2600) { looping = false; renderer.setAnimationLoop(null); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { looping = false; renderer.setAnimationLoop(null); } else wake(); });
  measure();
  wake();
}
