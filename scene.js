/* ─────────────────────────────────────────────────────────────────
   the arms — one scene for the whole page.

   In the hero, four machines stand around the nameplate and work it:
   the lead arm on the left flank, three more pinned to fixed screen
   anchors. Every one of them turns its head, leans its boom and
   pitches its head at the same point — the middle of the word — so
   the whole rig reads as one crew building one thing.

   Scroll away and the crew fades; the lead arm travels on: out beside
   the deck, into the capability seam, down the experience column, and
   settles small behind the closing line.
   ───────────────────────────────────────────────────────────────── */

const canvas = document.getElementById("scene3d");

const canRun =
  canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  const narrowAtBoot = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, narrowAtBoot ? 1.35 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  /* ── materials ─────────────────────────────────────────────────── */
  /* low metalness on purpose: metals ignore diffuse light and read as
     a black silhouette against this near-black stage */
  const steel = new THREE.MeshStandardMaterial({
    color: 0x6a5c60, metalness: 0.34, roughness: 0.44
  });
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x3a2e31, metalness: 0.36, roughness: 0.5
  });
  const graphite = new THREE.MeshStandardMaterial({
    color: 0x241c1f, metalness: 0.28, roughness: 0.58
  });
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x14100f, metalness: 0.1, roughness: 0.9
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

  /* a bolt ring: cheap, but it is what makes the machine read as built
     rather than modelled */
  function boltRing(parent, radius, y, count, size = 0.022) {
    const geo = new THREE.CylinderGeometry(size, size, size * 2.2, 6);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      const bolt = new THREE.Mesh(geo, steel);
      bolt.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
      parent.add(bolt);
    }
  }

  /* a piston: barrel fixed to the parent, rod sliding toward the joint */
  function piston(parent, x, y, z, length, lean = 0) {
    const barrel = part(new THREE.CylinderGeometry(0.052, 0.058, length * 0.55, 14), graphite);
    barrel.position.set(x, y, z);
    barrel.rotation.z = lean;
    parent.add(barrel);

    const rod = part(new THREE.CylinderGeometry(0.026, 0.026, length * 0.62, 12), steel);
    rod.position.set(x + Math.sin(lean) * length * 0.2, y - length * 0.44, z);
    parent.add(rod);

    const cap = part(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 14), steel);
    cap.position.set(x, y + length * 0.26, z);
    parent.add(cap);
  }

  /* ── one machine ───────────────────────────────────────────────── */
  function buildArm({ dial: withDial = true } = {}) {
    const rig = new THREE.Group();
    rig.rotation.y = -0.5;

    /* the base never moves: the machine is bolted to the floor */
    const base = part(new THREE.CylinderGeometry(0.72, 0.82, 0.13, 56), steel);
    base.position.y = 0.065;
    rig.add(base);

    const baseRing = part(new THREE.CylinderGeometry(0.62, 0.66, 0.06, 48), graphite);
    baseRing.position.y = 0.15;
    rig.add(baseRing);
    boltRing(rig, 0.66, 0.15, 8, 0.026);

    const plinth = part(new THREE.CylinderGeometry(0.32, 0.46, 0.3, 48), graphite);
    plinth.position.y = 0.32;
    rig.add(plinth);

    /* the tilt unit: this is the part that leans the boom at the word
       while the base stays flat on the ground */
    const tilt = new THREE.Group();
    tilt.position.y = 0.52;
    rig.add(tilt);

    /* yaw — everything above the tilt turns on the vertical axis */
    const yaw = new THREE.Group();
    tilt.add(yaw);

    const turret = part(new THREE.CylinderGeometry(0.35, 0.36, 0.26, 48), steel);
    turret.position.y = 0.1;
    yaw.add(turret);

    /* counterweight hanging off the back of the turret */
    const weight = part(new THREE.BoxGeometry(0.34, 0.3, 0.3), graphite);
    weight.position.set(0, 0.06, -0.36);
    yaw.add(weight);

    const yokeGeo = new THREE.BoxGeometry(0.1, 0.36, 0.46);
    const yokeL = part(yokeGeo, steel);
    yokeL.position.set(-0.29, 0.32, 0);
    const yokeR = part(yokeGeo, steel);
    yokeR.position.set(0.29, 0.32, 0);
    yaw.add(yokeL, yokeR);

    /* pitch — shoulder swings the upper arm */
    const pitch = new THREE.Group();
    pitch.position.y = 0.48;
    yaw.add(pitch);

    const shoulder = part(new THREE.CylinderGeometry(0.21, 0.21, 0.62, 36), graphite);
    shoulder.rotation.z = Math.PI / 2;
    pitch.add(shoulder);
    boltRing(pitch, 0.24, 0, 6, 0.02);

    const upperArm = part(new THREE.BoxGeometry(0.21, 0.94, 0.28), steel);
    upperArm.position.y = 0.5;
    pitch.add(upperArm);

    /* the boom's backbone: two plate ribs and a hydraulic ram */
    const ribGeo = new THREE.BoxGeometry(0.03, 0.8, 0.16);
    const ribL = part(ribGeo, plateMat);
    ribL.position.set(-0.12, 0.52, 0);
    const ribR = part(ribGeo, plateMat);
    ribR.position.set(0.12, 0.52, 0);
    pitch.add(ribL, ribR);
    piston(pitch, 0.155, 0.62, -0.06, 0.62, 0.04);

    /* elbow */
    const elbow = new THREE.Group();
    elbow.position.y = 0.97;
    pitch.add(elbow);

    const elbowJoint = part(new THREE.CylinderGeometry(0.17, 0.17, 0.36, 32), graphite);
    elbowJoint.rotation.z = Math.PI / 2;
    elbow.add(elbowJoint);
    boltRing(elbow, 0.2, 0, 5, 0.018);

    const forearm = part(new THREE.BoxGeometry(0.18, 0.8, 0.22), steel);
    forearm.position.y = 0.42;
    elbow.add(forearm);

    const forearmPlate = part(new THREE.BoxGeometry(0.03, 0.66, 0.13), plateMat);
    forearmPlate.position.set(0.11, 0.44, 0);
    elbow.add(forearmPlate);
    piston(elbow, -0.13, 0.5, 0.03, 0.5, -0.05);

    /* the hose bundle running the length of the arm */
    const hose = new THREE.Mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.0, 0.06, 0.16),
          new THREE.Vector3(0.13, 0.36, 0.2),
          new THREE.Vector3(0.1, 0.72, 0.17),
          new THREE.Vector3(-0.02, 0.95, 0.1)
        ]),
        22, 0.016, 6, false
      ),
      rubberMat
    );
    pitch.add(hose);

    /* wrist + gripper */
    const wrist = new THREE.Group();
    wrist.position.y = 0.83;
    elbow.add(wrist);

    const wristBody = part(new THREE.CylinderGeometry(0.12, 0.13, 0.22, 28), graphite);
    wristBody.position.y = 0.06;
    wrist.add(wristBody);

    const fingerGeo = new THREE.BoxGeometry(0.065, 0.3, 0.12);
    const fingerA = part(fingerGeo, steel);
    fingerA.position.set(-0.095, 0.3, 0);
    const fingerB = part(fingerGeo, steel);
    fingerB.position.set(0.095, 0.3, 0);
    wrist.add(fingerA, fingerB);

    /* the welding head, aimed by the wrist */
    const nozzle = part(new THREE.ConeGeometry(0.045, 0.16, 12), steel);
    nozzle.position.set(0, 0.44, 0);
    nozzle.rotation.x = Math.PI;
    wrist.add(nozzle);

    const nozzleCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.062, 0.014, 6, 20), ember
    );
    nozzleCollar.rotation.x = Math.PI / 2;
    nozzleCollar.position.y = 0.37;
    wrist.add(nozzleCollar);

    /* ember collars sitting on each axis */
    const collarGeo = new THREE.TorusGeometry(0.215, 0.014, 8, 56);
    const collarShoulder = new THREE.Mesh(collarGeo, ember);
    collarShoulder.rotation.y = Math.PI / 2;
    collarShoulder.position.x = 0.1;
    pitch.add(collarShoulder);

    const collarElbow = new THREE.Mesh(
      new THREE.TorusGeometry(0.175, 0.013, 8, 48), ember
    );
    collarElbow.rotation.y = Math.PI / 2;
    collarElbow.position.x = 0.1;
    elbow.add(collarElbow);

    /* the turn-table halo, sunk into the base plate */
    const collarBase = new THREE.Mesh(
      new THREE.TorusGeometry(0.54, 0.008, 6, 72), ember
    );
    collarBase.rotation.x = Math.PI / 2;
    collarBase.position.y = 0.14;
    rig.add(collarBase);

    /* the weld: a hot point right under the nozzle */
    const sparkMat = new THREE.MeshStandardMaterial({
      color: 0xffd9c8, emissive: 0xff3a22, emissiveIntensity: 2.4,
      metalness: 0.1, roughness: 0.6, transparent: true, opacity: 0.95
    });
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), sparkMat);
    spark.position.set(0, 0.54, 0);
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

    return { rig, tilt, yaw, pitch, elbow, wrist, fingerA, fingerB, collarBase, spark };
  }

  /* the lead arm: holds the hero, then travels the whole page */
  const lead = buildArm();
  lead.rig.scale.setScalar(0.85);
  scene.add(lead.rig);
  const { rig, yaw, pitch, elbow, wrist, fingerA, fingerB, collarBase, spark } = lead;

  /* the crew: pinned to screen positions around the nameplate */
  /* three machines stand under the word and weld up into it, so their
     heads and nozzles land on the letters */
  const CREW = [
    { x: -0.56, y: -0.44, nx: -0.64, ny: -0.36, size: 0.34, nsize: 0.19, phase: 0.0 },
    { x: 0.02, y: -0.52, nx: 0.03, ny: -0.43, size: 0.36, nsize: 0.21, phase: 2.4 },
    { x: 0.58, y: -0.46, nx: 0.66, ny: -0.37, size: 0.34, nsize: 0.19, phase: 4.1 }
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

  /* a hot working light down near the floor, so the machines glow from
     underneath the way a welding bay does */
  const bay = new THREE.PointLight(0xff5a3c, 12, 9, 2);
  bay.position.set(0, 0.35, 2.4);
  scene.add(bay);

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

  /* ── screen anchoring ──────────────────────────────────────────── */
  /* the crew is pinned to the screen, not the scene: its base lands on a
     fixed point of the viewport and it stands up from there */
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camBack = new THREE.Vector3();
  const halfTan = Math.tan((34 * Math.PI) / 360);

  function placeOnScreen(object, ndcX, ndcY, distance, aspect) {
    camera.matrixWorld.extractBasis(camRight, camUp, camBack);
    const sy = halfTan * distance;
    const sx = sy * aspect;
    object.position
      .copy(camera.position)
      .addScaledVector(camBack, -distance)
      .addScaledVector(camRight, ndcX * sx)
      .addScaledVector(camUp, ndcY * sy);
  }

  /* the point the whole crew works on: the middle of the word, at the
     depth the crew stands at */
  const focus = new THREE.Vector3();
  function focusPoint(distance) {
    camera.matrixWorld.extractBasis(camRight, camUp, camBack);
    const sy = halfTan * distance;
    const sx = sy * camera.aspect;
    /* the lead arm's pose slides the frustum, so the screen centre sits
       at -2*cur on the camera plane */
    return focus
      .copy(camera.position)
      .addScaledVector(camBack, -distance)
      .addScaledVector(camRight, -2 * cur.x * sx)
      .addScaledVector(camUp, -2 * cur.y * sy);
  }

  /* turn the machine so its boom, head and nozzle all face the target */
  const aimDir = new THREE.Vector3();
  function aimAt(arm, point, k = 1) {
    camera.matrixWorld.extractBasis(camRight, camUp, camBack);
    aimDir.copy(point).sub(arm.rig.position);
    const sx = aimDir.dot(camRight);
    const sy = aimDir.dot(camUp);
    const sz = aimDir.dot(camBack);

    /* lean the boom in the picture plane, within what the tilt unit can do */
    const lean = THREE.MathUtils.clamp(Math.atan2(-sx, sy), -0.5, 0.5);
    arm.tilt.rotation.z += (lean * k - arm.tilt.rotation.z) * 0.14;

    /* and turn the turret so the head faces it */
    const turn = Math.atan2(sx, -sz);
    arm.yaw.rotation.y += (turn * k - arm.yaw.rotation.y) * 0.14;
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

    const narrow = w < 760;

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
    const inHero = target.id === "hero";

    /* the lead arm keeps working while you read — and in the hero it is
       pointed straight at the word */
    if (inHero) {
      aimAt(lead, focusPoint(9.4));
    } else {
      yaw.rotation.y = Math.sin(t * 0.21) * 0.5 + 0.35;
      lead.tilt.rotation.z += (0 - lead.tilt.rotation.z) * 0.06;
    }
    pitch.rotation.z = -0.34 + Math.sin(t * 0.31 + 0.7) * 0.22;
    elbow.rotation.z = -0.66 + Math.sin(t * 0.39 + 2.0) * 0.3;
    wrist.rotation.z = Math.sin(t * 0.52 + 1.1) * 0.32;
    wrist.rotation.x = Math.cos(t * 0.34) * 0.18;

    const grip = 0.5 + 0.5 * Math.sin(t * 0.7);
    fingerA.position.x = -0.095 - grip * 0.05;
    fingerB.position.x = 0.095 + grip * 0.05;
    spark.material.emissiveIntensity = 1.2 + grip * 2.4;
    spark.scale.setScalar(0.7 + grip * 0.5);

    collarBase.rotation.z = -t * 0.22;

    rig.scale.setScalar(cur.scale * (w < 1200 ? 0.86 : 1));

    /* a phone has no margin to keep an arm in: the hero crew does the
       work, and the travelling arm stays off-stage */
    lead.rig.visible = !narrow;

    /* ── the crew ────────────────────────────────────────────────── */
    const wantsCrew = inHero && cur.opacity > 0.2;
    const crewFade = narrow ? 1 : 1;
    CREW.forEach((c, i) => {
      c.fade += ((wantsCrew ? crewFade : 0) - c.fade) * (1 - Math.exp(-4.2 * dt));
      const on = c.fade > 0.015;
      c.rig.visible = on;
      if (!on) return;

      const ax = narrow ? c.nx : c.x;
      const ay = narrow ? c.ny : c.y;

      /* the lead's pose slides the frustum, so the screen anchor is
         compensated by that shift to land where it was aimed */
      placeOnScreen(
        c.rig,
        ax - 2 * cur.x + pointerX * 0.012,
        ay - 2 * cur.y - pointerY * 0.016,
        8.6,
        camera.aspect
      );
      c.rig.scale.setScalar((narrow ? c.nsize : c.size) * c.fade);
      c.rig.rotation.z = 0;

      aimAt(c, focusPoint(8.6));

      const s = t + c.phase;
      c.pitch.rotation.z = -0.4 + Math.sin(s * 0.64) * 0.24;
      c.elbow.rotation.z = -0.72 + Math.sin(s * 0.74 + 1.3) * 0.3;
      c.wrist.rotation.z = Math.sin(s * 0.92) * 0.26;
      c.wrist.rotation.x = Math.cos(s * 0.6) * 0.18;

      const cg = 0.5 + 0.5 * Math.sin(s * 1.7);
      c.fingerA.position.x = -0.095 - cg * 0.05;
      c.fingerB.position.x = 0.095 + cg * 0.05;
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
