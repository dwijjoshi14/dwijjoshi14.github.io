/* ─────────────────────────────────────────────────────────────────
   hero scene — a three-axis arm, built from primitives, lit hard
   and articulated slowly. Sits between the galaxy and the copy.
   ───────────────────────────────────────────────────────────────── */

const canvas = document.getElementById("scene3d");

const canRun =
  canvas &&
  window.matchMedia("(min-width: 761px)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canRun) boot();

async function boot() {
  let THREE;
  try {
    THREE = await import("three");
  } catch (err) {
    /* no three.js (offline, blocked CDN) — the galaxy stands alone */
    console.warn("hero scene skipped:", err);
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);

  /* ── materials ─────────────────────────────────────────────────── */
  /* low metalness on purpose: metals ignore diffuse light and read as
     a black silhouette against this near-black stage */
  const steel = new THREE.MeshStandardMaterial({
    color: 0x5d5054, metalness: 0.32, roughness: 0.46
  });
  const graphite = new THREE.MeshStandardMaterial({
    color: 0x241c1f, metalness: 0.28, roughness: 0.58
  });
  const ember = new THREE.MeshStandardMaterial({
    color: 0xff3b30, emissive: 0xff1e14, emissiveIntensity: 1.7,
    metalness: 0.2, roughness: 0.45
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xff4d40, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const dialMat = new THREE.LineBasicMaterial({
    color: 0xff2e2e, transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  /* part = mesh + its wireframe edges, so every face reads as a drawing */
  function part(geometry, material) {
    const mesh = new THREE.Mesh(geometry, material);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      edgeMat
    );
    mesh.add(edges);
    return mesh;
  }

  /* ── the assembly ──────────────────────────────────────────────── */
  const rig = new THREE.Group();
  rig.rotation.y = -0.5;
  rig.scale.setScalar(0.85);
  scene.add(rig);

  const base = part(new THREE.CylinderGeometry(0.66, 0.76, 0.11, 56), steel);
  base.position.y = 0.055;
  rig.add(base);

  const plinth = part(new THREE.CylinderGeometry(0.3, 0.42, 0.32, 48), graphite);
  plinth.position.y = 0.27;
  rig.add(plinth);

  /* yaw — everything above the plinth turns on the vertical axis */
  const yaw = new THREE.Group();
  yaw.position.y = 0.5;
  rig.add(yaw);

  const turret = part(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 48), steel);
  turret.position.y = 0.1;
  yaw.add(turret);

  const yokeGeo = new THREE.BoxGeometry(0.1, 0.36, 0.46);
  const yokeL = part(yokeGeo, steel);
  yokeL.position.set(-0.27, 0.32, 0);
  const yokeR = part(yokeGeo, steel);
  yokeR.position.set(0.27, 0.32, 0);
  yaw.add(yokeL, yokeR);

  /* pitch — shoulder swings the upper arm */
  const pitch = new THREE.Group();
  pitch.position.y = 0.48;
  yaw.add(pitch);

  const shoulder = part(new THREE.CylinderGeometry(0.2, 0.2, 0.56, 36), graphite);
  shoulder.rotation.z = Math.PI / 2;
  pitch.add(shoulder);

  const upperArm = part(new THREE.BoxGeometry(0.2, 0.94, 0.27), steel);
  upperArm.position.y = 0.5;
  pitch.add(upperArm);

  /* elbow */
  const elbow = new THREE.Group();
  elbow.position.y = 0.97;
  pitch.add(elbow);

  const elbowJoint = part(new THREE.CylinderGeometry(0.16, 0.16, 0.32, 32), graphite);
  elbowJoint.rotation.z = Math.PI / 2;
  elbow.add(elbowJoint);

  const forearm = part(new THREE.BoxGeometry(0.17, 0.8, 0.21), steel);
  forearm.position.y = 0.42;
  elbow.add(forearm);

  /* wrist + gripper */
  const wrist = new THREE.Group();
  wrist.position.y = 0.83;
  elbow.add(wrist);

  const wristBody = part(new THREE.CylinderGeometry(0.11, 0.12, 0.2, 28), graphite);
  wristBody.position.y = 0.06;
  wrist.add(wristBody);

  const fingerGeo = new THREE.BoxGeometry(0.06, 0.28, 0.11);
  const fingerA = part(fingerGeo, steel);
  fingerA.position.set(-0.09, 0.28, 0);
  const fingerB = part(fingerGeo, steel);
  fingerB.position.set(0.09, 0.28, 0);
  wrist.add(fingerA, fingerB);

  /* ember collars sitting on each axis */
  const collarGeo = new THREE.TorusGeometry(0.205, 0.014, 8, 56);
  const collarShoulder = new THREE.Mesh(collarGeo, ember);
  collarShoulder.rotation.y = Math.PI / 2;
  collarShoulder.position.x = 0.09;
  pitch.add(collarShoulder);

  const collarElbow = new THREE.Mesh(
    new THREE.TorusGeometry(0.165, 0.013, 8, 48), ember
  );
  collarElbow.rotation.y = Math.PI / 2;
  collarElbow.position.x = 0.09;
  elbow.add(collarElbow);

  const collarBase = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.01, 6, 72), ember
  );
  collarBase.rotation.x = Math.PI / 2;
  collarBase.position.y = 0.13;
  rig.add(collarBase);

  /* ── the dial the arm stands on ────────────────────────────────── */
  const dial = new THREE.Group();
  dial.position.y = 0.004;

  [0.92, 1.32, 1.78].forEach((radius) => {
    const pts = [];
    for (let i = 0; i <= 120; i += 1) {
      const a = (i / 120) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    dial.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dialMat));
  });

  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const long = i % 4 === 0;
    const inner = long ? 1.52 : 1.64;
    dial.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * inner, 0, Math.sin(a) * inner),
        new THREE.Vector3(Math.cos(a) * 1.78, 0, Math.sin(a) * 1.78)
      ]),
      dialMat
    ));
  }
  rig.add(dial);

  /* ── light ─────────────────────────────────────────────────────── */
  scene.add(new THREE.AmbientLight(0x2a161a, 1.3));

  const key = new THREE.DirectionalLight(0xfff1ea, 3.1);
  key.position.set(3.4, 6, 4.2);
  scene.add(key);

  const rim = new THREE.PointLight(0xff2e2e, 26, 16, 2);
  rim.position.set(-4.2, 2.6, -3.6);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9db4ff, 0.9);
  fill.position.set(-3.4, 1.2, 3);
  scene.add(fill);

  /* front fill: keeps the body from reading as a flat silhouette */
  const front = new THREE.DirectionalLight(0xffffff, 0.95);
  front.position.set(2.2, 2.4, 6);
  scene.add(front);

  /* ── framing ───────────────────────────────────────────────────── */
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* slide the frustum left so the arm sits right of the copy column */
    camera.setViewOffset(w, h, -w * 0.13, 0, w, h);
    camera.updateProjectionMatrix();
    /* on tighter screens the copy columns crowd in — shrink instead of collide */
    rig.scale.setScalar(w < 1200 ? 0.7 : 0.85);
  }
  resize();

  /* ── pointer + scroll ──────────────────────────────────────────── */
  let pointerX = 0, pointerY = 0, aimX = 0, aimY = 0;

  window.addEventListener("pointermove", (e) => {
    aimX = (e.clientX / window.innerWidth) * 2 - 1;
    aimY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollP = 0, scrollTarget = 0;

  function readScroll() {
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
  }
  window.addEventListener("scroll", readScroll, { passive: true });
  readScroll();

  /* ── loop ──────────────────────────────────────────────────────── */
  const clock = new THREE.Clock();
  let elapsed = 0;
  let raf = 0;
  let running = false;
  let first = true;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    scrollP += (scrollTarget - scrollP) * 0.07;
    pointerX += (aimX - pointerX) * 0.05;
    pointerY += (aimY - pointerY) * 0.05;

    const t = elapsed;

    /* the arm keeps working while you read */
    yaw.rotation.y = Math.sin(t * 0.21) * 0.52 + scrollP * 0.7;
    pitch.rotation.z = -0.28 + Math.sin(t * 0.31 + 0.7) * 0.22 - scrollP * 0.18;
    elbow.rotation.z = -0.62 + Math.sin(t * 0.39 + 2.0) * 0.3 + scrollP * 0.2;
    wrist.rotation.z = Math.sin(t * 0.52 + 1.1) * 0.32;
    wrist.rotation.x = Math.cos(t * 0.34) * 0.18;

    const grip = 0.5 + 0.5 * Math.sin(t * 0.7);
    fingerA.position.x = -0.09 - grip * 0.05;
    fingerB.position.x = 0.09 + grip * 0.05;

    dial.rotation.y = t * 0.05 + scrollP * 0.4;

    /* camera orbits as the hero is scrolled through */
    const angle = 0.42 + scrollP * 1.5 + pointerX * 0.2;
    const radius = 6.9 - scrollP * 1.2;
    const height = 2.15 + scrollP * 0.45 - pointerY * 0.2;

    camera.position.set(
      Math.sin(angle) * radius,
      height,
      Math.cos(angle) * radius
    );
    camera.lookAt(0, 1.12, 0);

    /* own the fade: ease in on load, dissolve as the work block climbs over the hero */
    const reveal = Math.min(1, elapsed / 1.3);
    const recede = Math.max(0, 1 - scrollP * 2.6);
    canvas.style.opacity = String(reveal * recede);

    renderer.render(scene, camera);

    if (first) {
      first = false;
      canvas.classList.add("is-live");
    }
  }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    clock.getDelta();
    frame();
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  /* render only while the hero is on screen */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !document.hidden) start();
          else stop();
        });
      },
      { threshold: 0.02 }
    ).observe(canvas);
  } else {
    start();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("resize", resize, { passive: true });

  start();
}
