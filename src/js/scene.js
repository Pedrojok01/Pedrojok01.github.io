// Hero 3D scene: a code graph (modules of nodes, calls between them) swept by a scan disc.
// Scanned nodes glow, a few "findings" turn amber with a ring, and the cursor ripples the graph.
// Loaded lazily by main.js, after the page is readable.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";

const COLORS = {
  base: new Color("#4b5d82"),
  bright: new Color("#d6e2ff"),
  blue: new Color("#5b74b8"),
  amber: new Color("#f0a43a"),
};

const MODULES = 7;
const NODES = 180;
const FINDINGS = 9;
const PULSES = 34;
const SCAN_PERIOD = 7.5; // seconds per sweep, top to bottom
const SCAN_TOP = 2.4;
const SCAN_BOTTOM = -2.4;
const STILL_FRAME_TIME = 3.2; // frame shown when motion is reduced
const GRAPH_RADIUS = 2.3; // world units, scan disc slightly outside

// Soft round glowing point sprite.
const GLOW_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.22, 0.0, d);
    float glow = exp(-d * d * 22.0);
    float a = (core * 0.85 + glow * 0.55) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.75 + core * 0.6), a);
  }`;

const NODE_VERTEX = /* glsl */ `
  attribute float aHeat;
  attribute float aFound;
  attribute float aSize;
  uniform float uPR;
  uniform float uTime;
  uniform vec3 uBase;
  uniform vec3 uBright;
  uniform vec3 uAmber;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = aFound * (0.5 + 0.5 * sin(uTime * 3.0 + position.x * 4.0));
    gl_PointSize = (aSize * 9.0 + aHeat * 16.0 + aFound * 12.0 + pulse * 6.0) * uPR * (7.5 / -mv.z);
    vColor = mix(mix(uBase, uBright, aHeat), uAmber, aFound);
    vAlpha = clamp(0.55 + aHeat * 0.6 + aFound, 0.0, 1.0) * smoothstep(13.0, 6.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;

// Fine grid fading to the rim, with a bright edge.
const DISC_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const DISC_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5);
    vec2 g = abs(fract(vUv * 18.0) - 0.5);
    float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
    float fade = smoothstep(0.5, 0.2, r);
    float rim = smoothstep(0.012, 0.0, abs(r - 0.47));
    gl_FragColor = vec4(uColor * 1.3, (0.05 + grid * 0.22) * fade + rim * 0.5);
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
  return { next, gauss };
}

// Modules on a loose sphere, nodes scattered around them, 2 nearest links per node
// inside a module plus a few calls between modules.
function buildGraph(rnd) {
  const centers = [];
  for (let m = 0; m < MODULES; m++) {
    const y = 1 - ((m + 0.5) / MODULES) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = m * 2.4;
    centers.push(
      new Vector3(Math.cos(th) * r * 1.9, y * 1.85, Math.sin(th) * r * 1.9),
    );
  }
  const nodes = [];
  const moduleOf = [];
  for (let i = 0; i < NODES; i++) {
    const c = centers[i % MODULES];
    nodes.push(
      new Vector3(
        c.x + rnd.gauss() * 0.3,
        c.y + rnd.gauss() * 0.26,
        c.z + rnd.gauss() * 0.3,
      ),
    );
    moduleOf.push(i % MODULES);
  }

  const edges = [];
  const seen = new Set();
  const addEdge = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a !== b && !seen.has(key)) {
      seen.add(key);
      edges.push([a, b]);
    }
  };
  for (let i = 0; i < NODES; i++) {
    const same = [];
    for (let j = 0; j < NODES; j++) {
      if (j !== i && moduleOf[j] === moduleOf[i])
        same.push([j, nodes[i].distanceToSquared(nodes[j])]);
    }
    same.sort((a, b) => a[1] - b[1]);
    addEdge(i, same[0][0]);
    addEdge(i, same[1][0]);
    if (rnd.next() < 0.07) {
      let best = -1;
      let bestDist = Infinity;
      for (let j = 0; j < NODES; j++) {
        if (moduleOf[j] === moduleOf[i]) continue;
        const d = nodes[i].distanceToSquared(nodes[j]);
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
      addEdge(i, best);
    }
  }
  const adjacency = Array.from({ length: NODES }, () => []);
  edges.forEach(([a, b], e) => {
    adjacency[a].push(e);
    adjacency[b].push(e);
  });

  const findings = [];
  while (findings.length < FINDINGS) {
    const i = Math.floor(rnd.next() * NODES);
    if (!findings.includes(i)) findings.push(i);
  }
  return { nodes, edges, adjacency, findings };
}

// Pointer in normalized device coords (-1..1, y up), smoothed. Mouse hover and touch drag.
function trackPointer(el) {
  const p = { x: 0, y: 0, tx: 0, ty: 0, inside: false, amp: 0 };
  const set = (e) => {
    const r = el.getBoundingClientRect();
    p.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    p.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
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
    p.amp += ((p.inside ? 1 : 0) - p.amp) * 0.05;
  };
  return p;
}

export function start(hero) {
  const canvas = hero.querySelector("canvas");
  const hudFound = hero.querySelector('[data-hud="found"]');
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 1.7, 8.2);
  camera.lookAt(0, 0, 0);
  const group = new Group();
  scene.add(group);

  const rnd = random(7);
  const { nodes, edges, adjacency, findings } = buildGraph(rnd);
  const isFinding = new Uint8Array(NODES);
  findings.forEach((i) => (isFinding[i] = 1));

  // Nodes
  const pos = new Float32Array(NODES * 3);
  const heat = new Float32Array(NODES);
  const found = new Float32Array(NODES);
  const size = new Float32Array(NODES);
  for (let i = 0; i < NODES; i++) {
    nodes[i].toArray(pos, i * 3);
    size[i] = 0.7 + rnd.next() * 0.6;
  }
  const nodeGeo = new BufferGeometry();
  nodeGeo.setAttribute("position", new BufferAttribute(pos, 3));
  nodeGeo.setAttribute("aHeat", new BufferAttribute(heat, 1));
  nodeGeo.setAttribute("aFound", new BufferAttribute(found, 1));
  nodeGeo.setAttribute("aSize", new BufferAttribute(size, 1));
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
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  group.add(new Points(nodeGeo, nodeMat));

  // Edges
  const edgePos = new Float32Array(edges.length * 6);
  const edgeCol = new Float32Array(edges.length * 6);
  const edgeGeo = new BufferGeometry();
  edgeGeo.setAttribute("position", new BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute("color", new BufferAttribute(edgeCol, 3));
  group.add(
    new LineSegments(
      edgeGeo,
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
  );

  // Pulses walking along the edges
  const pulses = Array.from({ length: PULSES }, () => ({
    edge: Math.floor(rnd.next() * edges.length),
    forward: rnd.next() < 0.5,
    u: rnd.next(),
    speed: 0.5 + rnd.next() * 0.7,
  }));
  const pulsePos = new Float32Array(PULSES * 3);
  const pulseGeo = new BufferGeometry();
  pulseGeo.setAttribute("position", new BufferAttribute(pulsePos, 3));
  pulseGeo.setAttribute(
    "aHeat",
    new BufferAttribute(new Float32Array(PULSES).fill(0.9), 1),
  );
  pulseGeo.setAttribute(
    "aFound",
    new BufferAttribute(new Float32Array(PULSES), 1),
  );
  pulseGeo.setAttribute(
    "aSize",
    new BufferAttribute(new Float32Array(PULSES).fill(0.35), 1),
  );
  group.add(new Points(pulseGeo, nodeMat));

  // Scan disc
  const disc = new Mesh(
    new PlaneGeometry(4.6, 4.6),
    new ShaderMaterial({
      uniforms: { uColor: { value: COLORS.blue } },
      vertexShader: DISC_VERTEX,
      fragmentShader: DISC_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  group.add(disc);

  // Rings around new findings, billboarded in world space
  const rings = findings.map(() => {
    const mesh = new Mesh(
      new RingGeometry(0.1, 0.12, 48),
      new MeshBasicMaterial({
        color: COLORS.amber,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
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

  const pointer = trackPointer(hero);
  const v = new Vector3();
  const outward = new Vector3();
  const color = new Color();
  const current = nodes.map((n) => n.clone());
  let lastCount = -1;

  const frame = (t, dt) => {
    pointer.step();
    group.rotation.y = t * 0.1 + pointer.x * 0.15;
    group.rotation.x = -pointer.y * 0.08;
    group.updateMatrixWorld();
    nodeMat.uniforms.uTime.value = t;

    const phase = (t % SCAN_PERIOD) / SCAN_PERIOD;
    const sweep = Math.min(phase / 0.82, 1);
    const scanY =
      SCAN_TOP + (SCAN_BOTTOM - SCAN_TOP) * (sweep * sweep * (3 - 2 * sweep));
    disc.position.y = scanY;
    const resetting = phase > 0.9;

    let count = 0;
    for (let i = 0; i < NODES; i++) {
      // Hover ripple: distance to the cursor on screen, pushed outward from the graph center.
      v.copy(nodes[i]).applyMatrix4(group.matrixWorld).project(camera);
      const dx = (v.x - pointer.x) * camera.aspect;
      const dy = v.y - pointer.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const swell = Math.exp(-d * d * 28) * pointer.amp;
      const wave =
        Math.sin(d * 26 - t * 6.5) * Math.exp(-d * 4.5) * pointer.amp;
      outward.copy(nodes[i]).normalize();
      current[i]
        .copy(nodes[i])
        .addScaledVector(outward, swell * 0.45 + wave * 0.1);
      current[i].toArray(pos, i * 3);

      const dyScan = nodes[i].y - scanY;
      const hit = Math.exp(-dyScan * dyScan * 9);
      heat[i] = Math.max(
        heat[i] * 0.93,
        hit,
        swell * 0.9,
        Math.max(wave, 0) * 0.5,
      );
      if (isFinding[i] && hit > 0.55 && found[i] < 0.5 && !resetting) {
        found[i] = 1;
        rings[findings.indexOf(i)].age = 0;
      }
      if (resetting) found[i] = Math.max(0, found[i] - 0.03);
      if (found[i] > 0.5) count++;
    }
    if (hudFound && count !== lastCount) {
      hudFound.textContent = String(count);
      lastCount = count;
    }

    edges.forEach(([a, b], e) => {
      color
        .copy(COLORS.base)
        .multiplyScalar(0.55)
        .lerp(COLORS.bright, Math.max(heat[a], heat[b]) * 0.55);
      if (found[a] > 0.5 && found[b] > 0.5) color.lerp(COLORS.amber, 0.6);
      current[a].toArray(edgePos, e * 6);
      current[b].toArray(edgePos, e * 6 + 3);
      color.toArray(edgeCol, e * 6);
      color.toArray(edgeCol, e * 6 + 3);
    });

    pulses.forEach((p, k) => {
      p.u += p.speed * dt;
      if (p.u >= 1) {
        const [a, b] = edges[p.edge];
        const at = p.forward ? b : a;
        const next =
          adjacency[at][Math.floor(rnd.next() * adjacency[at].length)];
        p.edge = next;
        p.forward = edges[next][0] === at;
        p.u = 0;
      }
      const [a, b] = edges[p.edge];
      const from = p.forward ? current[a] : current[b];
      const to = p.forward ? current[b] : current[a];
      v.copy(from)
        .lerp(to, p.u)
        .toArray(pulsePos, k * 3);
    });

    rings.forEach((r, k) => {
      r.age += dt;
      const life = r.age / 1.6;
      r.mesh.visible = life < 1;
      if (!r.mesh.visible) return;
      r.mesh.material.opacity = (1 - life) * 0.9;
      r.mesh.scale.setScalar((1 + life * 4) * group.scale.x);
      r.mesh.position
        .copy(current[findings[k]])
        .applyMatrix4(group.matrixWorld);
      r.mesh.quaternion.copy(camera.quaternion);
    });

    nodeGeo.attributes.position.needsUpdate = true;
    nodeGeo.attributes.aHeat.needsUpdate = true;
    nodeGeo.attributes.aFound.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.color.needsUpdate = true;
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
