// Hero 3D scene: a brain-like graph (two folded hemispheres, deep hubs, arcs between halves)
// swept by a scan disc. Scanned nodes glow, a few "findings" turn amber with a ring, and the
// cursor pushes the nodes around on springs. Loaded lazily by main.js, after the page is readable.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

const COLORS = {
  base: new Color("#4b5d82"),
  bright: new Color("#d6e2ff"),
  blue: new Color("#5b74b8"),
  amber: new Color("#f0a43a"),
};

const SURFACE_NODES = 600; // 400 on small screens
const FINDINGS = 9;
const PULSES = 56;
const TRAIL = [
  // size, heat of each dot, head first
  [0.42, 1],
  [0.33, 0.72],
  [0.26, 0.52],
  [0.2, 0.38],
  [0.15, 0.27],
  [0.11, 0.18],
];
const CURVE_SEGMENTS = 10;
const SCAN_PERIOD = 7.5; // seconds per sweep, top to bottom
const STILL_FRAME_TIME = 3.2; // frame shown when motion is reduced
const GRAPH_RADIUS = 2.1; // world units, scan disc slightly outside
const RING_LIFE = 0.7; // seconds
const RING_GROWTH = 1.6; // extra scale at the end of a ring's life

// Hover physics: each node sits on a spring to its rest spot and pulls on its neighbours.
// The cursor is a ray through the graph that pushes nodes off it and drags them along.
const SPRING = 29; // stiffness, about one wobble per second
const DAMPING = 2 * 0.3 * Math.sqrt(SPRING);
const COUPLING = 6.5;
const PUSH = 18;
const DRAG = 3.4;
const REACH = 0.5; // local units around the cursor ray
const MAX_OFFSET = 0.9;

// Soft round glowing point sprite; hubs get a thin halo ring.
const GLOW_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHub;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.22, 0.0, d);
    float glow = exp(-d * d * 22.0);
    float ring = vHub * smoothstep(0.03, 0.0, abs(d - 0.38)) * 0.55;
    float a = (core * 0.85 + glow * 0.55 + ring) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.75 + core * 0.6), a);
  }`;

const NODE_VERTEX = /* glsl */ `
  attribute float aHeat;
  attribute float aFound;
  attribute float aSize;
  attribute float aHub;
  attribute float aSeed;
  uniform float uPR;
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uBright;
  uniform vec3 uAmber;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHub;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = aFound * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed));
    float twinkle = 1.0 + 0.12 * sin(uTime * 1.3 + aSeed * 7.0);
    gl_PointSize = (aSize * 9.0 + aHeat * 12.0 + aFound * 2.4 + pulse * 1.2) * uPR * (7.5 / -mv.z);
    vColor = mix(mix(uBase, uBright, aHeat), uAmber, aFound);
    float depth = mix(0.45, 1.0, smoothstep(11.5, 6.0, -mv.z));
    vAlpha = clamp((0.7 + aHeat * 0.6) * twinkle + aFound, 0.0, 1.0) * depth;
    vHub = aHub;
    gl_Position = projectionMatrix * mv;
  }`;

const EDGE_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aWeight;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vFade = aWeight * mix(0.4, 1.0, smoothstep(11.5, 6.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }`;

const EDGE_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    gl_FragColor = vec4(vColor, 0.7 * vFade);
  }`;

// Fine grid fading to the rim, a crisp bright edge with a soft halo, and a faint rotating sweep.
const DISC_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const DISC_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uBright;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    vec2 g = abs(fract(vUv * 18.0) - 0.5);
    float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
    float fade = smoothstep(0.5, 0.2, r);
    float rim = smoothstep(0.012, 0.0, abs(r - 0.47));
    float halo = exp(-pow((r - 0.47) / 0.035, 2.0)) * step(r, 0.5);
    float s = fract((atan(p.y, p.x) - uTime * 1.1) / 6.2831853);
    float sweep = pow(1.0 - s, 7.0) * smoothstep(0.47, 0.05, r);
    float a = (0.12 + grid * 0.6) * fade + rim * 1.6 + halo * 0.18 + sweep * 0.16;
    vec3 col = mix(uColor * 1.3, uBright, 0.3 * max(rim, sweep));
    gl_FragColor = vec4(col, a);
  }`;

// Seeded random, so the graph is the same on every visit.
function random(seed) {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (!u) u = next();
    while (!v) v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const unit = () => new Vector3(gauss(), gauss(), gauss()).normalize();
  return { next, gauss, unit };
}

// Two hemispheres. Surface nodes sit on the zero contours of a folding field, so the web
// traces sulci; deep hubs radiate a few fibers, and arcs cross between the halves.
// Edges are { a, b, bow, weight }: bow is the offset of a quadratic curve's control point.
function buildGraph(rnd, surfaceNodes) {
  const nodes = [];
  const size = [];
  const hub = [];
  const edges = [];
  const seen = new Set();
  const addNode = (p, s, h = 0) => {
    nodes.push(p);
    size.push(s);
    hub.push(h);
    return nodes.length - 1;
  };
  const addEdge = (a, b, bow = null, weight = 1) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a !== b && !seen.has(key)) {
      seen.add(key);
      edges.push({ a, b, bow, weight });
    }
  };
  const nearest = (i, list, k) =>
    list
      .filter((j) => j !== i)
      .map((j) => [j, nodes[i].distanceToSquared(nodes[j])])
      .sort((x, y) => x[1] - y[1])
      .slice(0, k)
      .map(([j]) => j);
  const sideways = (a, b, amount) => {
    const d = nodes[b].clone().sub(nodes[a]);
    return rnd
      .unit()
      .cross(d)
      .normalize()
      .multiplyScalar(d.length() * amount);
  };

  const waves = Array.from({ length: 6 }, () => ({
    k: rnd.unit(),
    f: 4.5 + rnd.next() * 2.5,
    p: rnd.next() * 6.283,
  }));
  const fold = (u) =>
    waves.reduce((s, w) => s + Math.sin(u.dot(w.k) * w.f + w.p), 0) /
    waves.length;
  // Elongated front to back (z), flat underneath, temporal lobes hanging at the sides,
  // and a clear gap between the hemispheres.
  const surface = (u, side) => {
    const s = 1 + 0.05 * fold(u);
    const x = u.x * 1.3 * s * (1 - 0.12 * Math.max(0, u.z)) + side * 0.14;
    let y = u.y * 1.5 * s;
    if (y < 0) y *= 0.7;
    y -= 0.3 * Math.max(0, -u.y) * Math.abs(u.x);
    y -= 0.1 * Math.exp(-(u.x * u.x) * 60) * Math.max(0, u.y);
    return new Vector3(x, y - 0.05, u.z * 2.02 * s);
  };

  const halves = [[], []];
  for (
    let tries = 0;
    halves[0].length + halves[1].length < surfaceNodes && tries < 300000;
    tries++
  ) {
    const u = rnd.unit();
    if (Math.abs(u.x) < 0.07) continue;
    const onLine = Math.abs(fold(u)) < 0.05;
    if (!onLine && rnd.next() > 0.02) continue;
    const side = Math.sign(u.x);
    const i = addNode(
      surface(u, side),
      onLine ? 0.6 + rnd.next() * 0.45 : 0.75 + rnd.next() * 0.4,
    );
    halves[side < 0 ? 0 : 1].push(i);
  }
  halves.forEach((list) =>
    list.forEach((i) => {
      const near = nearest(i, list, 3);
      near.slice(0, 2).forEach((j) => {
        if (nodes[i].distanceTo(nodes[j]) < 0.4) addEdge(i, j, null, 1.2);
      });
      if (rnd.next() < 0.22 && nodes[i].distanceTo(nodes[near[2]]) < 0.4)
        addEdge(i, near[2], null, 0.9);
    }),
  );

  [-1, 1].forEach((side, h) => {
    const deep = [];
    for (let k = 0; k < 4; k++) {
      const p = new Vector3(
        side * (0.45 + rnd.next() * 0.2),
        (rnd.next() - 0.5) * 0.7,
        -0.95 + k * 0.63 + rnd.gauss() * 0.08,
      );
      deep.push(addNode(p, 1.8, 1));
    }
    deep.forEach((d, k) => {
      if (k) addEdge(d, deep[k - 1], sideways(d, deep[k - 1], 0.15), 0.7);
      nearest(d, halves[h], 16)
        .filter((_, n) => n % 4 === 0)
        .forEach((j) => addEdge(d, j, sideways(d, j, 0.18), 0.35));
    });
  });

  const top = halves[0].filter((i) => nodes[i].y > 0.35);
  for (let k = 0; k < 8; k++) {
    const a = top[Math.floor(rnd.next() * top.length)];
    const mirror = nodes[a].clone();
    mirror.x *= -1;
    const b = halves[1].reduce((best, j) =>
      nodes[j].distanceToSquared(mirror) < nodes[best].distanceToSquared(mirror)
        ? j
        : best,
    );
    const mid = nodes[a].clone().add(nodes[b]).multiplyScalar(0.5);
    addEdge(a, b, new Vector3(-mid.x, -mid.y * 0.95, 0), 0.5);
  }

  const adjacency = Array.from({ length: nodes.length }, () => []);
  edges.forEach(({ a, b }, e) => {
    adjacency[a].push(e);
    adjacency[b].push(e);
  });

  const findings = [];
  while (findings.length < FINDINGS) {
    const i = Math.floor(rnd.next() * nodes.length);
    if (!hub[i] && !findings.includes(i)) findings.push(i);
  }
  return { nodes, size, hub, edges, adjacency, findings };
}

// Pointer in normalized device coords (-1..1, y up). Mouse hover and touch drag.
// x/y are smoothed slowly (camera sway), fx/fy quickly (physics).
function trackPointer(el) {
  const p = { x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, amp: 0 };
  p.inside = false;
  p.entered = true;
  const set = (e) => {
    const r = el.getBoundingClientRect();
    p.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    p.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
    if (!p.inside) p.entered = true;
    p.inside = true;
  };
  el.addEventListener("pointermove", set);
  el.addEventListener("pointerdown", set);
  el.addEventListener("pointerleave", () => (p.inside = false));
  el.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") p.inside = false;
  });
  p.step = () => {
    p.x += (p.tx - p.x) * 0.08;
    p.y += (p.ty - p.y) * 0.08;
    p.fx += (p.tx - p.fx) * 0.3;
    p.fy += (p.ty - p.fy) * 0.3;
    p.amp += ((p.inside ? 1 : 0) - p.amp) * 0.05;
  };
  return p;
}

export function start(hero) {
  const canvas = hero.querySelector("canvas");
  const hudFound = hero.querySelector('[data-hud="found"]');
  const hudNodes = hero.querySelector('[data-hud="nodes"]');
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const small = window.matchMedia("(max-width: 760px)").matches;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.7, 8.2);
  camera.lookAt(0, 0, 0);
  const group = new Group();
  scene.add(group);

  const rnd = random(5);
  const { nodes, size, hub, edges, adjacency, findings } = buildGraph(
    rnd,
    small ? 400 : SURFACE_NODES,
  );
  const count = nodes.length;
  if (hudNodes) hudNodes.textContent = String(count);
  const findingIndex = new Int16Array(count).fill(-1);
  findings.forEach((i, k) => (findingIndex[i] = k));

  // Nodes
  const rest = new Float32Array(count * 3);
  nodes.forEach((n, i) => n.toArray(rest, i * 3));
  const pos = rest.slice();
  const heat = new Float32Array(count);
  const found = new Float32Array(count);
  const seed = new Float32Array(count).map(() => rnd.next() * 6.283);
  const nodeGeo = new BufferGeometry();
  nodeGeo.setAttribute("position", new BufferAttribute(pos, 3));
  nodeGeo.setAttribute("aHeat", new BufferAttribute(heat, 1));
  nodeGeo.setAttribute("aFound", new BufferAttribute(found, 1));
  nodeGeo.setAttribute(
    "aSize",
    new BufferAttribute(Float32Array.from(size), 1),
  );
  nodeGeo.setAttribute("aHub", new BufferAttribute(Float32Array.from(hub), 1));
  nodeGeo.setAttribute("aSeed", new BufferAttribute(seed, 1));
  const blend = {
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  };
  const nodeMat = new ShaderMaterial({
    uniforms: {
      uPR: { value: pixelRatio },
      uTime: { value: 0 },
      uBase: { value: COLORS.base },
      uBright: { value: COLORS.bright },
      uAmber: { value: COLORS.amber },
    },
    vertexShader: NODE_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    ...blend,
  });

  // Edges, curved ones split into segments
  const segments = edges.map((e) => (e.bow ? CURVE_SEGMENTS : 1));
  const vertices = segments.reduce((s, n) => s + n, 0) * 2;
  const lengths = edges.map(
    (e) => nodes[e.a].distanceTo(nodes[e.b]) * (e.bow ? 1.15 : 1),
  );
  const edgePos = new Float32Array(vertices * 3);
  const edgeCol = new Float32Array(vertices * 3);
  const edgeGeo = new BufferGeometry();
  edgeGeo.setAttribute("position", new BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute("aColor", new BufferAttribute(edgeCol, 3));
  // Faint edges get less alpha, not a darker color: the canvas is composited over the
  // page, so a line darker than the background would show as a dark stroke.
  edgeGeo.setAttribute(
    "aWeight",
    new BufferAttribute(
      Float32Array.from(
        edges.flatMap((e, k) => Array(segments[k] * 2).fill(e.weight)),
      ),
      1,
    ),
  );

  // Pulses walking along the edges, each with a fading trail
  const pulses = Array.from({ length: PULSES }, () => ({
    edge: Math.floor(rnd.next() * edges.length),
    forward: rnd.next() < 0.5,
    u: rnd.next(),
    speed: 0.45 + rnd.next() * 0.45, // local units per second
  }));
  const dots = PULSES * TRAIL.length;
  const pulsePos = new Float32Array(dots * 3);
  const pulseGeo = new BufferGeometry();
  pulseGeo.setAttribute("position", new BufferAttribute(pulsePos, 3));
  pulseGeo.setAttribute(
    "aSize",
    new BufferAttribute(
      Float32Array.from({ length: dots }, (_, d) => TRAIL[d % TRAIL.length][0]),
      1,
    ),
  );
  pulseGeo.setAttribute(
    "aHeat",
    new BufferAttribute(
      Float32Array.from({ length: dots }, (_, d) => TRAIL[d % TRAIL.length][1]),
      1,
    ),
  );
  ["aFound", "aHub", "aSeed"].forEach((name) =>
    pulseGeo.setAttribute(name, new BufferAttribute(new Float32Array(dots), 1)),
  );

  group.add(
    new LineSegments(
      edgeGeo,
      new ShaderMaterial({
        vertexShader: EDGE_VERTEX,
        fragmentShader: EDGE_FRAGMENT,
        ...blend,
      }),
    ),
    new Points(nodeGeo, nodeMat),
    new Points(pulseGeo, nodeMat),
  );

  // Scan disc, sweeping from just above the graph to just below it
  const discMat = new ShaderMaterial({
    uniforms: {
      uColor: { value: COLORS.blue },
      uBright: { value: COLORS.bright },
      uTime: { value: 0 },
    },
    vertexShader: DISC_VERTEX,
    fragmentShader: DISC_FRAGMENT,
    side: DoubleSide,
    ...blend,
  });
  const disc = new Mesh(new PlaneGeometry(4.3, 4.3), discMat);
  disc.rotation.x = -Math.PI / 2;
  group.add(disc);
  const ys = nodes.map((n) => n.y);
  const scanTop = Math.max(...ys) + 0.35;
  const scanBottom = Math.min(...ys) - 0.35;

  // Rings around new findings, billboarded in world space
  const ringGeo = new RingGeometry(0.1, 0.109, 64);
  const rings = findings.map(() => {
    const mesh = new Mesh(
      ringGeo,
      new MeshBasicMaterial({
        color: COLORS.amber,
        opacity: 0,
        ...blend,
      }),
    );
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, age: Infinity };
  });

  // Faint dust for depth
  const DUST = 220;
  const dustPos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (rnd.next() - 0.5) * 22;
    dustPos[i * 3 + 1] = (rnd.next() - 0.5) * 12;
    dustPos[i * 3 + 2] = -rnd.next() * 12 - 2;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3));
  scene.add(
    new Points(
      dustGeo,
      new PointsMaterial({
        color: 0x5b74b8,
        size: 0.03,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    ),
  );

  // Center the graph on the .hero-art box and size it to fit.
  const art = hero.querySelector(".hero-art");
  const ndc = new Vector3();
  const layout = () => {
    const heroRect = hero.getBoundingClientRect();
    const box = art.getBoundingClientRect();
    const cx = box.left + box.width / 2 - heroRect.left;
    const cy = box.top + box.height / 2 - heroRect.top;
    // Cast a ray through the box center and place the graph where it meets the z = 0 plane.
    ndc
      .set(
        (cx / heroRect.width) * 2 - 1,
        -((cy / heroRect.height) * 2 - 1),
        0.5,
      )
      .unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const dist = -camera.position.z / dir.z;
    group.position.copy(camera.position).addScaledVector(dir, dist);
    const worldPerPixel =
      (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / heroRect.height;
    group.scale.setScalar(
      ((Math.min(box.width, box.height) / 2) * worldPerPixel) / GRAPH_RADIUS,
    );
  };
  const resize = () => {
    const w = hero.clientWidth;
    const h = hero.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    layout();
  };

  // Spring state, in the graph's local space
  const pointer = trackPointer(hero);
  const offset = new Float32Array(count * 3);
  const velocity = new Float32Array(count * 3);
  const force = new Float32Array(count * 3);
  const accel = new Float32Array(count * 3);
  const touch = new Float32Array(count);
  const neighbours = adjacency.map((list, i) =>
    list.map((e) => (edges[e].a === i ? edges[e].b : edges[e].a)),
  );
  const raycaster = new Raycaster();
  const toLocal = new Matrix4();
  const rayOrigin = new Vector3();
  const rayDir = new Vector3();
  const cursor = new Vector3();
  const lastCursor = new Vector3();
  const cursorVel = new Vector3();
  const move = new Vector3();
  const ndc2 = new Vector2();

  const push = (dt) => {
    ndc2.set(pointer.fx, pointer.fy);
    raycaster.setFromCamera(ndc2, camera);
    toLocal.copy(group.matrixWorld).invert();
    rayOrigin.copy(raycaster.ray.origin).applyMatrix4(toLocal);
    rayDir.copy(raycaster.ray.direction).transformDirection(toLocal);
    // Cursor velocity, measured where the ray passes the graph center
    cursor.copy(rayOrigin).addScaledVector(rayDir, -rayOrigin.dot(rayDir));
    if (pointer.entered || dt <= 0) {
      lastCursor.copy(cursor);
      cursorVel.set(0, 0, 0);
      pointer.entered = false;
    }
    move
      .copy(cursor)
      .sub(lastCursor)
      .divideScalar(Math.max(dt, 1e-3))
      .clampLength(0, 9);
    cursorVel.lerp(move, 0.35);
    lastCursor.copy(cursor);

    const pushK = PUSH * pointer.amp;
    const dragK = DRAG * pointer.amp;
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const wx = pos[o] - rayOrigin.x;
      const wy = pos[o + 1] - rayOrigin.y;
      const wz = pos[o + 2] - rayOrigin.z;
      const along = wx * rayDir.x + wy * rayDir.y + wz * rayDir.z;
      const px = wx - rayDir.x * along;
      const py = wy - rayDir.y * along;
      const pz = wz - rayDir.z * along;
      const d = Math.sqrt(px * px + py * py + pz * pz) || 1e-4;
      const f = Math.exp(-(d * d) / (REACH * REACH));
      force[o] = (px * pushK * f) / d + cursorVel.x * dragK * f;
      force[o + 1] = (py * pushK * f) / d + cursorVel.y * dragK * f;
      force[o + 2] = (pz * pushK * f) / d + cursorVel.z * dragK * f;
      touch[i] = f * pointer.amp * 0.85;
    }
    // Fixed small steps keep the springs stable at any frame rate.
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < count; i++) {
        const o = i * 3;
        let lx = 0;
        let ly = 0;
        let lz = 0;
        for (const j of neighbours[i]) {
          lx += offset[j * 3] - offset[o];
          ly += offset[j * 3 + 1] - offset[o + 1];
          lz += offset[j * 3 + 2] - offset[o + 2];
        }
        accel[o] =
          force[o] - SPRING * offset[o] - DAMPING * velocity[o] + COUPLING * lx;
        accel[o + 1] =
          force[o + 1] -
          SPRING * offset[o + 1] -
          DAMPING * velocity[o + 1] +
          COUPLING * ly;
        accel[o + 2] =
          force[o + 2] -
          SPRING * offset[o + 2] -
          DAMPING * velocity[o + 2] +
          COUPLING * lz;
      }
      for (let j = 0; j < count * 3; j++) {
        velocity[j] += accel[j] * h;
        offset[j] += velocity[j] * h;
      }
    }
    for (let i = 0; i < count; i++) {
      const o = i * 3;
      const len = Math.hypot(offset[o], offset[o + 1], offset[o + 2]);
      if (len > MAX_OFFSET) {
        offset[o] *= MAX_OFFSET / len;
        offset[o + 1] *= MAX_OFFSET / len;
        offset[o + 2] *= MAX_OFFSET / len;
      }
      pos[o] = rest[o] + offset[o];
      pos[o + 1] = rest[o + 1] + offset[o + 1];
      pos[o + 2] = rest[o + 2] + offset[o + 2];
      // Moving nodes glow
      const speed = Math.hypot(velocity[o], velocity[o + 1], velocity[o + 2]);
      touch[i] = Math.max(touch[i], Math.min(1, speed * 0.45));
    }
  };

  // Point at u (0..1) along edge e, following its curve.
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const along = (out, e, u) => {
    const { bow } = edges[e];
    a.fromArray(pos, edges[e].a * 3);
    b.fromArray(pos, edges[e].b * 3);
    if (!bow) return out.copy(a).lerp(b, u);
    c.copy(a).add(b).multiplyScalar(0.5).add(bow);
    const iu = 1 - u;
    return out
      .copy(a)
      .multiplyScalar(iu * iu)
      .addScaledVector(c, 2 * iu * u)
      .addScaledVector(b, u * u);
  };

  const v = new Vector3();
  const color = new Color();
  let lastCount = -1;

  const frame = (t, dt) => {
    pointer.step();
    group.rotation.y = t * 0.1 + pointer.x * 0.15;
    group.rotation.x = -pointer.y * 0.08;
    group.updateMatrixWorld();
    nodeMat.uniforms.uTime.value = t;
    discMat.uniforms.uTime.value = t;

    const phase = (t % SCAN_PERIOD) / SCAN_PERIOD;
    const sweep = Math.min(phase / 0.82, 1);
    const scanY =
      scanTop + (scanBottom - scanTop) * (sweep * sweep * (3 - 2 * sweep));
    disc.position.y = scanY;
    const resetting = phase > 0.9;

    push(dt);

    let foundCount = 0;
    for (let i = 0; i < count; i++) {
      const dyScan = rest[i * 3 + 1] - scanY;
      const hit = Math.exp(-dyScan * dyScan * 9);
      heat[i] = Math.max(heat[i] * 0.93, hit, touch[i]);
      if (findingIndex[i] >= 0 && hit > 0.55 && found[i] < 0.5 && !resetting) {
        found[i] = 1;
        rings[findingIndex[i]].age = 0;
      }
      if (resetting) found[i] = Math.max(0, found[i] - 0.03);
      if (found[i] > 0.5) foundCount++;
    }
    if (hudFound && foundCount !== lastCount) {
      hudFound.textContent = String(foundCount);
      lastCount = foundCount;
    }

    let vertex = 0;
    edges.forEach((edge, e) => {
      const ha = heat[edge.a];
      const hb = heat[edge.b];
      const amber = found[edge.a] > 0.5 && found[edge.b] > 0.5;
      for (let s = 0; s < segments[e]; s++) {
        for (let end = 0; end < 2; end++) {
          const u = (s + end) / segments[e];
          along(v, e, u).toArray(edgePos, vertex * 3);
          color
            .copy(COLORS.base)
            .multiplyScalar(1.25)
            .lerp(COLORS.bright, (ha + (hb - ha) * u) * 0.65);
          if (amber) color.lerp(COLORS.amber, 0.5);
          color.toArray(edgeCol, vertex * 3);
          vertex++;
        }
      }
    });

    pulses.forEach((p, k) => {
      p.u += (p.speed / Math.max(lengths[p.edge], 0.08)) * dt;
      if (p.u >= 1) {
        const { a: from, b: to } = edges[p.edge];
        const at = p.forward ? to : from;
        const next =
          adjacency[at][Math.floor(rnd.next() * adjacency[at].length)];
        p.edge = next;
        p.forward = edges[next].a === at;
        p.u = 0;
      }
      TRAIL.forEach((_, j) => {
        const u = Math.max(
          0,
          p.u - (j * 0.045) / Math.max(lengths[p.edge], 0.08),
        );
        along(v, p.edge, p.forward ? u : 1 - u).toArray(
          pulsePos,
          (k * TRAIL.length + j) * 3,
        );
      });
    });

    rings.forEach((r, k) => {
      r.age += dt;
      const life = r.age / RING_LIFE;
      r.mesh.visible = life < 1;
      if (!r.mesh.visible) return;
      const ease = 1 - Math.pow(1 - life, 3);
      r.mesh.material.opacity = Math.pow(1 - life, 1.5) * 0.55;
      r.mesh.scale.setScalar((1 + ease * RING_GROWTH) * group.scale.x);
      r.mesh.position
        .fromArray(pos, findings[k] * 3)
        .applyMatrix4(group.matrixWorld);
      r.mesh.quaternion.copy(camera.quaternion);
    });

    nodeGeo.attributes.position.needsUpdate = true;
    nodeGeo.attributes.aHeat.needsUpdate = true;
    nodeGeo.attributes.aFound.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.aColor.needsUpdate = true;
    pulseGeo.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  };

  resize();
  new ResizeObserver(() => {
    resize();
    if (reduceMotion) frame(STILL_FRAME_TIME, 0);
  }).observe(hero);

  hero.classList.add("is-live");
  if (reduceMotion) {
    frame(STILL_FRAME_TIME, 0);
    return;
  }

  // Run only while the hero is on screen and the tab is visible.
  let visible = false;
  let raf = 0;
  let last = 0;
  let t = 0;
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    frame(t, dt);
    raf = requestAnimationFrame(tick);
  };
  const run = (on) => {
    cancelAnimationFrame(raf);
    if (on) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    run(visible && !document.hidden);
  }).observe(hero);
  document.addEventListener("visibilitychange", () =>
    run(visible && !document.hidden),
  );
}
