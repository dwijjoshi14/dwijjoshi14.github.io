/* ─────────────────────────────────────────────────────────────────
   the arm — one scene for the whole page.
   It holds the hero, then travels: out beside the deck, into the
   capability seam, down the experience column, and settles small
   behind the closing line. The camera pans, zooms and orbits between
   those poses while the model keeps articulating the whole way.

   In the hero the same arm is joined by a crew of three: they are
   pinned to fixed screen positions around the nameplate so the name
   is being built from every side, then they fade as you scroll and
   the lead arm carries on alone.
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
    console.warn("arm scene skipped:", err);
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

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
  /* One builder, so the crew is the same machine as the lead arm —
     same proportions, same light. */
  function buildArm({ dial: withDial = true } = {}) {
    const rig = new THREE.Group();
    rig.rotation.y = -0.5;

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

    /* the turn-table halo, sunk into the base plate */
    const collarBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.008, 6, 72), ember
    );
    collarBase.rotation.x = Math.PI / 2;
    collarBase.position.y = 0.12;
    rig.add(collarBase);

    /* the weld: a hot point right between the fingers */
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffd9c8, emissive: 0xff3a22, emissiveIntensity: 2.4,
      metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.95
    });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), sparkMat);
    spark.position.set(0, 0.45, 0);
    wrist.add(spark);

    /* ── the dial the arm stands on ──────────────────────────────── */
    if (withDial) {
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
    }

    return { rig, yaw, pitch, elbow, wrist, fingerA, fingerB, collarBase, spark };
  }

  /* the lead arm: holds the hero, then travels the whole page */
  const lead = buildArm();
  lead.rig.scale.setScalar(0.85);
  scene.add(lead.rig);
  const { rig, yaw, pitch, elbow, wrist, fingerA, fingerB, collarBase, spark } = lead;

  /* the crew: pinned to screen positions around the nameplate */
  const CREW = [
    { x: -0.44, y: 0.44, size: 0.4, phase: 0.0, spin: 0.7, lean: 0.34 },
    { x: 0.7, y: 0.27, size: 0.4, phase: 2.4, spin: -0.9, lean: -0.42 },
    { x: 0.56, y: -0.57, size: 0.42, phase: 4.1, spin: 1.2, lean: -0.28 }
  ].map((cfg) => ({ ...cfg, ...buildArm({ dial: false }), fade: 0 }));

  CREW.forEach((c) => {
    c.rig.visible = false;
    scene.add(c.rig);
  });

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

  /* ── poses: where the arm stands in each section ───────────────── */
  /* x / y shift the frustum (fractions of the viewport), radius is the
     orbit distance, height the camera elevation, look the aim point,
     scale the model itself, opacity the whole layer. */
  const POSES = [
    { id: "hero", x: -0.45, y: 0.02, angle: 0.66, radius: 9.2, height: 2.0, look: 1.02, scale: 0.62, opacity: 1.0 },
    { id: "work", x: -0.27, y: 0.04, angle: 0.95, radius: 9.8, height: 2.1, look: 1.0, scale: 0.74, opacity: 0.92 },
    { id: "capability", x: 0.26, y: 0.42, angle: 2.1, radius: 11.2, height: 2.0, look: 0.9, scale: 0.58, opacity: 0.38 },
    { id: "experience", x: 0.4, y: -0.06, angle: 3.1, radius: 10.4, height: 1.8, look: 0.79, scale: 0.58, opacity: 0.6 },
    { id: "contact", x: 0.0, y: 0.04, angle: 3.85, radius: 12, height: 1.6, look: 0.73, scale: 0.5, opacity: 0.3 }
  ];
  const stops = POSES.map((pose) => ({
    ...pose,
    el: document.getElementById(pose.id)
  }));
  const layer = document.getElementById("sceneLayer");
  let ghost = false;

  /* the arm eases toward whichever section owns the middle of the screen */
  let target = stops[0];
  let lastPick = 0;
  function pick() {
    const now = performance.now();
    if (now - lastPick < 180) return;
    lastPick = now;
    const probe = window.scrollY + window.innerHeight * 0.55;
    let chosen = stops[0];
    for (const stop of stops) {
      if (!stop.el) continue;
      if (probe >= stop.el.getBoundingClientRect().top + window.scrollY) chosen = stop;
    }
    target = chosen;

    /* in the hero the arm sits in the scene; below it, it becomes a hologram */
    const wantsGhost = chosen.id !== "hero";
    if (wantsGhost !== ghost) {
      ghost = wantsGhost;
      layer?.classList.toggle("is-ghost", ghost);
    }
  }

  const cur = { ...POSES[0] };

  /* ── pointer ───────────────────────────────────────────────────── */
  let pointerX = 0, pointerY = 0, aimX = 0, aimY = 0;

  window.addEventListener("pointermove", (e) => {
    aimX = (e.clientX / window.innerWidth) * 2 - 1;
    aimY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  /* ── framing ───────────────────────────────────────────────────── */
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
  }
  resize();

  /* the crew is pinned to the screen, not the scene: its base lands on a
     fixed point of the viewport and it stands up from there */
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camBack = new THREE.Vector3();
  const halfH = Math.tan((34 * Math.PI) / 360);

  function placeOnScreen(object, ndcX, ndcY, distance, aspect) {
    camera.matrixWorld.extractBasis(camRight, camUp, camBack);
    const sy = halfH * distance;
    const sx = sy * aspect;
    object.position
      .copy(camera.position)
      .addScaledVector(camBack, -distance)
      .addScaledVector(camRight, ndcX * sx)
      .addScaledVector(camUp, ndcY * sy);
  }

  /* ── loop ──────────────────────────────────────────────────────── */
  const clock = new THREE.Clock();
  let elapsed = 0;
  let raf = 0;
  let running = false;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    pick();

    /* frame-rate independent ease, so the travel feels the same at 60 and 144 */
    const k = 1 - Math.exp(-3.6 * dt);
    cur.x += (target.x - cur.x) * k;
    cur.y += (target.y - cur.y) * k;
    cur.angle += (target.angle - cur.angle) * k;
    cur.radius += (target.radius - cur.radius) * k;
    cur.height += (target.height - cur.height) * k;
    cur.look += (target.look - cur.look) * k;
    cur.scale += (target.scale - cur.scale) * k;
    cur.opacity += (target.opacity - cur.opacity) * k;

    pointerX += (aimX - pointerX) * 0.05;
    pointerY += (aimY - pointerY) * 0.05;

    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) resize();

    camera.aspect = w / h;
    /* slide the frustum so the arm stands where the section leaves room */
    camera.setViewOffset(w, h, -w * (cur.x + pointerX * 0.012), -h * (cur.y - pointerY * 0.018), w, h);
    camera.updateProjectionMatrix();

    camera.position.set(
      Math.sin(cur.angle) * cur.radius,
      cur.height,
      Math.cos(cur.angle) * cur.radius
    );
    camera.lookAt(0, cur.look, 0);
    camera.updateMatrixWorld();

    const t = elapsed;

    /* the arm keeps working while you read */
    yaw.rotation.y = Math.sin(t * 0.21) * 0.5 + 0.35;
    pitch.rotation.z = -0.28 + Math.sin(t * 0.31 + 0.7) * 0.22;
    elbow.rotation.z = -0.62 + Math.sin(t * 0.39 + 2.0) * 0.3;
    wrist.rotation.z = Math.sin(t * 0.52 + 1.1) * 0.32;
    wrist.rotation.x = Math.cos(t * 0.34) * 0.18;

    const grip = 0.5 + 0.5 * Math.sin(t * 0.7);
    fingerA.position.x = -0.09 - grip * 0.05;
    fingerB.position.x = 0.09 + grip * 0.05;
    spark.material.emissiveIntensity = 1.2 + grip * 2.4;
    spark.scale.setScalar(0.7 + grip * 0.5);

    collarBase.rotation.z = -t * 0.22;

    rig.scale.setScalar(cur.scale * (w < 1200 ? 0.86 : 1));

    /* ── the crew ────────────────────────────────────────────────── */
    const chef = target.id === "hero" ? 1 : 0;
    CREW.forEach((c) => {
      c.fade += (chef - c.fade) * (1 - Math.exp(-4.2 * dt));
      const on = c.fade > 0.015;
      c.rig.visible = on;
      if (!on) return;

      /* the lead's pose slides the frustum, so the screen anchor is
         compensated by that shift to land where it was aimed */
      placeOnScreen(
        c.rig,
        c.x - 2 * cur.x + pointerX * 0.012,
        c.y - 2 * cur.y - pointerY * 0.016,
        8.6,
        camera.aspect
      );
      c.rig.scale.setScalar(c.size * c.fade * (w < 1200 ? 0.88 : 1));
      c.rig.rotation.z = c.lean * 0.5;
      c.rig.rotation.y = Math.sin(t * 0.3 + c.phase) * 0.5 + c.spin;

      const s = t + c.phase;
      c.yaw.rotation.y = Math.sin(s * 0.46) * 0.34;
      c.pitch.rotation.z = -0.5 + Math.sin(s * 0.64) * 0.3;
      c.elbow.rotation.z = -0.78 + Math.sin(s * 0.74 + 1.3) * 0.34;
      c.wrist.rotation.z = Math.sin(s * 0.92) * 0.3;
      c.wrist.rotation.x = Math.cos(s * 0.6) * 0.2;

      const cg = 0.5 + 0.5 * Math.sin(s * 1.7);
      c.fingerA.position.x = -0.09 - cg * 0.05;
      c.fingerB.position.x = 0.09 + cg * 0.05;
      c.spark.material.emissiveIntensity = 1.0 + cg * 3.2;
      c.spark.scale.setScalar(0.6 + cg * 0.7);
      c.spark.material.opacity = 0.75 + cg * 0.25;
    });

    /* ease in on load, then follow the section's own opacity */
    const reveal = Math.min(1, elapsed / 1.4);
    canvas.style.opacity = (cur.opacity * reveal).toFixed(3);

    renderer.render(scene, camera);
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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("load", resize, { once: true });

  start();
}
