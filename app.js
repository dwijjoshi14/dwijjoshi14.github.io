/* ------------------------------------------------------------------
   dwij joshi — motion layer
   One ticker, react-spring-style solvers, Lenis glide, scroll triggers,
   spring text reveals, a pinned horizontal track and a scrubbed seam.
------------------------------------------------------------------- */

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const MOBILE_TRACK = window.matchMedia("(max-width: 900px)");

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── ticker ────────────────────────────────────────────────────── */
const ticker = new Set();
let rafId = 0;

function loop(now) {
  for (const sub of Array.from(ticker)) {
    if (now - sub.last < sub.interval) continue;
    const dt = sub.last ? Math.min(0.064, (now - sub.last) / 1000) : 1 / 60;
    sub.last = now;
    sub.fn(dt, now);
  }
  rafId = ticker.size ? requestAnimationFrame(loop) : 0;
}

function subscribe(fn, interval = 0) {
  const sub = { fn, interval, last: 0 };
  ticker.add(sub);
  if (!rafId) rafId = requestAnimationFrame(loop);
  return () => ticker.delete(sub);
}

/* ── smooth scroll ─────────────────────────────────────────────── */
let lenis = null;
if (!REDUCED) {
  try {
    const mod = await import("lenis");
    const Lenis = mod.default;
    lenis = new Lenis({
      lerp: 0.095,
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });
    subscribe((_dt, now) => lenis.raf(now), 0);
  } catch (err) {
    lenis = null;
  }
}

function goTo(target) {
  if (!target) return;
  if (lenis) {
    lenis.scrollTo(target, {
      offset: 0,
      duration: 1.5,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  } else {
    target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
  }
}

/* ── spring solver (react-spring's damped spring, mass 1) ──────── */
class Spring {
  constructor(value, { tension = 170, friction = 26, precision = 0.0008 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.tension = tension;
    this.friction = friction;
    this.precision = precision;
    this.resting = true;
  }
  to(target) {
    this.target = target;
    this.resting = false;
    return this;
  }
  update(dt) {
    if (this.resting) return true;
    const steps = Math.min(64, Math.max(1, Math.ceil(dt * 1000)));
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      this.velocity += (-this.tension * (this.value - this.target) - this.friction * this.velocity) * h;
      this.value += this.velocity * h;
      if (Math.abs(this.velocity) < 0.01 && Math.abs(this.target - this.value) < this.precision) {
        this.value = this.target;
        this.velocity = 0;
        this.resting = true;
        return true;
      }
    }
    return false;
  }
}

const running = new Set();

function animate({
  from = 0,
  to = 1,
  tension = 170,
  friction = 26,
  delay = 0,
  onUpdate,
  onRest,
} = {}) {
  if (REDUCED) {
    onUpdate?.(to);
    onRest?.();
    return;
  }
  const spring = new Spring(from, { tension, friction });
  spring.to(to);
  running.add({ spring, delay, onUpdate, onRest });
}

subscribe((dt) => {
  for (const item of Array.from(running)) {
    if (item.delay > 0) {
      item.delay -= dt * 1000;
      continue;
    }
    const resting = item.spring.update(dt);
    item.onUpdate?.(item.spring.value);
    if (resting) {
      running.delete(item);
      item.onRest?.();
    }
  }
}, 0);

/* ── in-view gate ──────────────────────────────────────────────── */
function inView(el, cb, { margin = "0px 0px -12% 0px", once = true } = {}) {
  if (!el) return;
  if (!("IntersectionObserver" in window)) {
    cb();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        cb();
        if (once) io.disconnect();
      }
    },
    { rootMargin: margin }
  );
  io.observe(el);
}

/* ── text engine ───────────────────────────────────────────────── */
function revealText(
  el,
  { by = "word", stagger = 55, tension = 170, friction = 26, delay = 0, distance = 0.34, auto = true } = {}
) {
  if (!el) return { start() {} };
  const raw = (el.textContent || "").replace(/\s+/g, " ").trim();

  // Keep the red <em> accent: each part of the line carries its own colour.
  const parts = [];
  el.childNodes.forEach((node) => {
    if (node.nodeType === 3) parts.push({ text: node.nodeValue || "", em: false });
    else if (node.nodeName === "EM") parts.push({ text: node.textContent || "", em: true });
    else parts.push({ text: node.textContent || "", em: false });
  });

  el.textContent = "";
  el.classList.add("reveal-text");
  el.setAttribute("aria-label", raw);

  const units = [];
  const makeUnit = (segments) => {
    const outer = document.createElement("span");
    outer.className = "rt-u";
    outer.setAttribute("aria-hidden", "true");
    const inner = document.createElement("span");
    inner.className = "rt-i";
    segments.forEach((seg) => {
      if (!seg.em) {
        inner.appendChild(document.createTextNode(seg.text));
        return;
      }
      const mark = document.createElement("em");
      mark.className = "is-em";
      mark.textContent = seg.text;
      inner.appendChild(mark);
    });
    inner.style.opacity = "0";
    inner.style.transform = `translate3d(0, ${distance}em, 0)`;
    outer.appendChild(inner);
    units.push(inner);
    return outer;
  };

  // Words are split by whitespace only: a mid-word <em> ("experi<em>ence</em>")
  // stays inside its word instead of becoming a separate, gap-separated unit.
  const words = [];
  let breakBefore = true;
  parts.forEach((part) => {
    const text = part.text;
    const leading = /^\s/.test(text);
    const trailing = /\s$/.test(text);
    const pieces = text.trim().split(/\s+/).filter(Boolean);
    pieces.forEach((word, i) => {
      if (i > 0 || leading || breakBefore || words.length === 0) words.push({ segments: [] });
      words[words.length - 1].segments.push({ text: word, em: part.em });
    });
    if (pieces.length) breakBefore = trailing;
  });

  if (by === "char") {
    words.forEach(({ segments }) => {
      const wrap = document.createElement("span");
      wrap.className = "rt-word";
      segments.forEach((seg) => {
        Array.from(seg.text).forEach((ch) => wrap.appendChild(makeUnit([{ text: ch, em: seg.em }])));
      });
      el.appendChild(wrap);
    });
  } else {
    words.forEach(({ segments }) => el.appendChild(makeUnit(segments)));
  }

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    units.forEach((unit, i) => {
      animate({
        tension,
        friction,
        delay: delay + i * stagger,
        onUpdate: (p) => {
          unit.style.opacity = String(p);
          unit.style.transform = `translate3d(0, ${(1 - p) * distance}em, 0)`;
        },
        onRest: () => {
          unit.style.willChange = "";
        },
      });
    });
  };

  if (auto) inView(el, start, { margin: "0px 0px -8% 0px" });
  return { start };
}

/* ── scroll triggers ───────────────────────────────────────────── */
const triggers = [];

function addTrigger(el, start, end, onProgress) {
  if (!el) return;
  triggers.push({ el, start, end, onProgress, last: -1 });
}

function posesFor(rect, vh) {
  const half = rect.height / 2;
  return {
    top_top: rect.top,
    center_top: rect.top + half,
    bottom_top: rect.bottom,
    top_bottom: rect.top - vh,
    center_bottom: rect.top + half - vh,
    bottom_bottom: rect.bottom - vh,
    top_center: rect.top - vh / 2,
    center_center: rect.top + half - vh / 2,
    bottom_center: rect.bottom - vh / 2,
  };
}

subscribe(() => {
  const vh = window.innerHeight;
  for (const trigger of triggers) {
    const rect = trigger.el.getBoundingClientRect();
    if (rect.bottom < -vh || rect.top > vh * 2) continue;
    const poses = posesFor(rect, vh);
    const start = poses[trigger.start];
    const end = poses[trigger.end];
    const length = Math.abs(start - end) || 1;
    const progress = clamp01(1 - (start + length) / length);
    if (Math.abs(progress - trigger.last) < 0.0005) continue;
    trigger.last = progress;
    trigger.onProgress(progress);
  }
}, 12);

/* ── loading veil + entrance ───────────────────────────────────── */
const veil = $("#veil");
const veilInner = $("#veilInner");
const veilPct = $("#veilPct");
const veilMeter = $("#veilMeter");
const heroReveals = [];

/* the nameplate is still on the jig: a weld pass and a build counter */
function startBuild() {
  const host = $("#heroIdentity");
  const pct = $("#rigPct");
  if (!host) return;
  if (REDUCED) {
    if (pct) pct.textContent = "100";
    return;
  }
  host.classList.add("is-welding");
  animate({
    tension: 44,
    friction: 27,
    onUpdate: (p) => {
      if (pct) pct.textContent = String(Math.round(clamp01(p) * 100)).padStart(2, "0");
    },
    onRest: () => {
      if (pct) pct.textContent = "100";
    },
  });
}

function bootVeil() {
  if (!veil) {
    document.body.classList.add("is-entered");
    heroReveals.forEach((r) => r.start());
    startBuild();
    return;
  }

  if (REDUCED) {
    veil.classList.add("is-gone");
    veil.remove();
    document.body.classList.add("is-entered");
    heroReveals.forEach((r) => r.start());
    startBuild();
    return;
  }

  const progress = new Spring(0, { tension: 12, friction: 30 });
  progress.to(0.68);

  let removed = false;
  const paint = () => {
    const p = clamp01(progress.value);
    if (veilMeter) veilMeter.style.transform = `scaleX(${p})`;
    if (veilPct) {
      const pct = Math.round(p * 100) >= 99 ? 100 : Math.round(p * 100);
      veilPct.textContent = String(pct).padStart(2, "0");
    }
  };

  const stopPaint = subscribe((dt) => {
    if (removed) return;
    progress.update(dt);
    paint();
  }, 0);

  const exit = () => {
    if (removed) return;
    // beat 1 — the veil's own content clears
    veilInner?.classList.add("is-cleared");
    setTimeout(() => {
      if (removed) return;
      // beat 2 — the veil lifts and the page begins
      veil.classList.add("is-gone");
      document.body.classList.add("is-entered");
      heroReveals.forEach((r, i) => setTimeout(() => r.start(), i * 90));
      startBuild();
      setTimeout(() => {
        removed = true;
        stopPaint();
        veil.remove();
      }, 950);
    }, 430);
  };

  const ready = Promise.race([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 1600)),
  ]);

  ready.then(() => {
    progress.tension = 170;
    progress.friction = 26;
    progress.to(1);
    const watch = subscribe(() => {
      if (removed || progress.resting) {
        watch();
        setTimeout(exit, 140);
      }
    }, 30);
  });
}

/* ── hero contour field ────────────────────────────────────────── */
let fieldPaused = false;

function initField() {
  const canvas = $("#field");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let visible = true;
  const pointer = { x: 0, y: 0, active: false };

  /* ── the galaxy: a red spiral of dust with a live core ─────────── */
  const RAYS = 4;
  const stars = [];
  const dust = [];
  for (let i = 0; i < 3000; i += 1) {
    const t = Math.pow(Math.random(), 0.56);
    stars.push({
      t,
      a0:
        ((i % RAYS) / RAYS) * Math.PI * 2 +
        t * 4.4 +
        (Math.random() - 0.5) * (0.1 + t * 0.44),
      spin: 0.05 + 0.45 / (0.55 + t * 4.5),
      wob: Math.random() * Math.PI * 2,
      size: Math.random() < 0.06 ? 2 : 1,
      bright: 0.18 + Math.random() * 0.82,
      spark: Math.random() < 0.5,
      tw: Math.random() * Math.PI * 2,
    });
  }
  for (let i = 0; i < 240; i += 1) {
    dust.push({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() < 0.15 ? 2 : 1,
      bright: 0.1 + Math.random() * 0.4,
      tw: Math.random() * Math.PI * 2,
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const narrow = w < 760;
    cx = w * (narrow ? 0.56 : 0.68);
    cy = h * (narrow ? 0.28 : 0.5);
    R = Math.min(w, h) * (narrow ? 1.05 : 0.84);
  }

  function draw(time) {
    const t = time / 1000;
    ctx.clearRect(0, 0, w, h);

    /* core bloom */
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
    core.addColorStop(0, "rgba(255,120,90,.22)");
    core.addColorStop(0.16, "rgba(255,46,46,.1)");
    core.addColorStop(1, "rgba(255,46,46,0)");
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, w, h);

    /* flattened disc haze under the arms */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.46);
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.94);
    haze.addColorStop(0, "rgba(255,128,96,.17)");
    haze.addColorStop(0.38, "rgba(255,46,46,.075)");
    haze.addColorStop(1, "rgba(255,46,46,0)");
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.94, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";

    /* the bright nucleus */
    const nucleus = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.11);
    nucleus.addColorStop(0, "rgba(255,228,210,.5)");
    nucleus.addColorStop(0.3, "rgba(255,96,74,.3)");
    nucleus.addColorStop(1, "rgba(255,46,46,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = nucleus;
    ctx.fillRect(cx - R * 0.12, cy - R * 0.12, R * 0.24, R * 0.24);

    /* far dust */
    for (let i = 0; i < dust.length; i += 1) {
      const d = dust[i];
      const tw = 0.55 + 0.45 * Math.sin(t * 1.1 + d.tw);
      ctx.globalAlpha = d.bright * tw * 0.75;
      ctx.fillStyle = "#ff2e2e";
      ctx.fillRect((d.x * w + t * 3) % w, d.y * h, d.size, d.size);
    }

    /* spiral arms */
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      const r = (0.05 + s.t * 0.95) * R;
      const a = s.a0 + t * s.spin;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 0.46 + Math.sin(a * 1.9 + s.wob) * R * 0.014;
      if (px < -40 || px > w + 40 || py < -40 || py > h + 40) continue;
      const tw = 0.62 + 0.38 * Math.sin(t * 1.5 + s.tw);
      const fade = 1 - s.t * 0.26;
      ctx.globalAlpha = Math.min(1, (0.4 + s.bright * 0.6) * tw * fade);
      ctx.fillStyle = s.spark ? "#ff8f7c" : "#ff2e2e";
      const size = s.t < 0.28 ? s.size + 1 : s.size;
      ctx.fillRect(px, py, size, size);
    }

    /* pointer light */
    if (pointer.active) {
      const rad = Math.min(w, h) * 0.42;
      const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, rad);
      halo.addColorStop(0, "rgba(255,96,78,.20)");
      halo.addColorStop(0.4, "rgba(255,46,46,.07)");
      halo.addColorStop(1, "rgba(255,46,46,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = halo;
      ctx.fillRect(pointer.x - rad, pointer.y - rad, rad * 2, rad * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  window.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.active = e.pointerType !== "touch";
  }, { passive: true });

  new IntersectionObserver((entries) => {
    for (const entry of entries) visible = entry.isIntersecting;
  }, { rootMargin: "0px" }).observe($("#hero") || canvas);

  resize();
  window.addEventListener("resize", resize);

  subscribe((_dt, now) => {
    if (!visible || fieldPaused || document.hidden) return;
    draw(now);
  }, 0);

  if (REDUCED) {
    draw(0);
    fieldPaused = true;
  }
}

/* ── chequered seam dissolve ───────────────────────────────────── */
function initSeam(canvas) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const label = getComputedStyle(document.documentElement).getPropertyValue("--red").trim() || "#ff2e2e";
  const CELL = 10;
  const KERB_ROWS = 1;
  const LIFT = 0.22;

  const noise = (x, y) => {
    let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
  };

  let w = 0;
  let h = 0;

  function size() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let lastProgress = -1;
  let current = 0;
  function render(progress) {
    current = progress;
    if (Math.abs(progress - lastProgress) < 0.001) return;
    lastProgress = progress;
    ctx.clearRect(0, 0, w, h);
    const columns = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    // one chequered kerb row, then a dissolve measured in pixels so the
    // fade looks the same at every viewport height
    const lift = (1 - clamp01(progress)) * LIFT;
    const SPAN = 62;

    for (let y = 0; y < rows; y += 1) {
      const py = y * CELL + lift * CELL;
      const solid = y < KERB_ROWS;
      const fade = solid ? 1 : Math.max(0, 1 - py / SPAN);
      if (!solid && fade <= 0) break;

      for (let x = 0; x < columns; x += 1) {
        if ((x + y) % 2 !== 0) continue;
        if (!solid && noise(x, y) > fade) continue;
        ctx.fillStyle = noise(x + 101, y + 57) < 0.1 ? "#ff7a6b" : label;
        ctx.globalAlpha = solid ? 1 : 0.2 + fade * 0.8;
        ctx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  size();
  render(0);
  window.addEventListener("resize", () => {
    size();
    lastProgress = -1;
    render(current);
  });
  return render;
}

/* ── orchestrate ───────────────────────────────────────────────── */
function init() {
  /* rail + nav active state */
  const sections = $$("[data-section]");
  const railLinks = $$(".rail a");
  const navLinks = $$(".nav a");

  const setActive = (id) => {
    railLinks.forEach((a) => a.classList.toggle("is-active", a.dataset.rail === id));
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
  };

  if ("IntersectionObserver" in window) {
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  /* anchors */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href.length < 2) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      closeSheet();
      goTo(target);
    });
  });

  /* progress bar + masthead auto-hide */
  const masthead = $("#masthead");
  const progressFill = $("#progressFill");
  let lastY = window.scrollY;

  subscribe(() => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (progressFill) progressFill.style.transform = `scaleX(${max > 0 ? clamp01(y / max) : 0})`;
    if (Math.abs(y - lastY) > 3) {
      masthead?.classList.toggle("is-hidden", y > lastY && y > 220);
      lastY = y;
    }
  }, 24);

  /* mobile sheet */
  const sheet = $("#sheet");
  const burger = $("#burger");
  function closeSheet() {
    if (!sheet) return;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    burger?.setAttribute("aria-expanded", "false");
    document.body.classList.remove("menu-open");
    lenis?.start();
  }
  burger?.addEventListener("click", () => {
    const open = !sheet?.classList.contains("is-open");
    sheet?.classList.toggle("is-open", open);
    sheet?.setAttribute("aria-hidden", String(!open));
    burger.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
    if (open) lenis?.stop();
    else lenis?.start();
  });
  $("#sheetClose")?.addEventListener("click", closeSheet);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
    if (e.matches) closeSheet();
  });

  /* hero entrance reveals */
  const heroTitle = revealText($("#heroName"), {
    by: "char",
    stagger: 42,
    tension: 190,
    friction: 24,
    delay: 220,
    distance: 0.3,
    auto: false,
  });
  heroReveals.push(heroTitle);

  // three blocks are already welded in; the rest land as the rig passes over
  const heroGlyphs = $$("#heroName .rt-i");
  heroGlyphs.forEach((glyph, i) => {
    if (i === 0 || i === 4 || i === 8) glyph.classList.add("is-block");
  });

  // the gantry rail spans the nameplate exactly, not the whole column
  const heroIdentity = $("#heroIdentity");
  const fitRig = () => {
    const last = heroGlyphs[heroGlyphs.length - 1];
    if (!heroIdentity || !last) return;
    const w = Math.round(last.getBoundingClientRect().right - heroIdentity.getBoundingClientRect().left);
    if (w > 120) heroIdentity.style.setProperty("--rig-w", `${w}px`);
  };
  fitRig();
  window.addEventListener("resize", fitRig, { passive: true });
  if (document.fonts) document.fonts.ready.then(fitRig);
  setTimeout(fitRig, 400);

  const heroLede = revealText($(".hero-lede"), {
    by: "word",
    stagger: 14,
    tension: 150,
    friction: 26,
    delay: 520,
    distance: 0.28,
    auto: false,
  });
  heroReveals.push(heroLede);

  // The veil may already be gone (reduced motion, or the fallback timer).
  if (document.body.classList.contains("is-entered")) {
    heroReveals.forEach((r) => r.start());
  }

  /* hero recede under the work block */
  const heroInner = $("#heroInner");
  const heroShade = $("#heroShade");
  const hero = $("#hero");
  const fieldCanvas = $("#field");

  addTrigger($("#work"), "top_bottom", "top_top", (p) => {
    if (heroInner) {
      heroInner.style.transform = `translate3d(0, ${-p * 5}vh, 0) scale(${1 - 0.07 * p})`;
      heroInner.style.visibility = p > 0.995 ? "hidden" : "visible";
    }
    if (heroShade) heroShade.style.opacity = (0.62 * p).toFixed(3);
    if (fieldCanvas) {
      fieldCanvas.style.transform = `translate3d(0, ${p * 8}vh, 0)`;
      fieldCanvas.style.opacity = (1 - p).toFixed(3);
    }
    fieldPaused = p > 0.985;
  });

  /* the work deck — pinned, scroll-dealt, draggable */
  const pin = $(".work-pin");
  const deck = $("#deck");
  const cards = $$(".deck-card");
  const deckIndexEl = $("#deckIndex");
  const deckDots = $$(".deck-dots button");
  const LAST = Math.max(1, cards.length - 1);
  let deckStep = 420;
  let deckW = 460;
  let deckTarget = 0;
  let deckPos = 0;
  let frontIndex = -1;
  let tracking = false;
  let tiltX = 0;
  let tiltY = 0;
  let tiltTX = 0;
  let tiltTY = 0;
  let sheenX = 50;
  let sheenY = 0;
  const cardState = new Array(cards.length).fill("");
  const dims = cards.map((card) => {
    const dim = document.createElement("span");
    dim.className = "card-dim";
    dim.setAttribute("aria-hidden", "true");
    card.appendChild(dim);
    // Cards with no screenshot get a schematic band so the deck stays even.
    if (!card.querySelector(".card-shot")) {
      const art = document.createElement("div");
      art.className = "card-art";
      art.setAttribute("aria-hidden", "true");
      card.querySelector(".card-name")?.insertAdjacentElement("afterend", art);
    }
    return dim;
  });

  function measureDeck() {
    if (!pin) return;
    deckW = deck ? deck.offsetWidth : 460;
    if (MOBILE_TRACK.matches) {
      pin.style.height = "";
      return;
    }
    deckStep = Math.max(300, Math.min(640, window.innerHeight * 0.58));
    pin.style.height = `${Math.round(window.innerHeight + LAST * deckStep)}px`;
  }

  measureDeck();
  window.addEventListener("resize", measureDeck);
  if (document.fonts) document.fonts.ready.then(measureDeck);

  addTrigger(pin, "top_top", "bottom_bottom", (p) => {
    if (!MOBILE_TRACK.matches) deckTarget = clamp01(p) * LAST;
  });

  if (deck && FINE) {
    deck.addEventListener("pointermove", (e) => {
      const r = deck.getBoundingClientRect();
      tiltTX = (e.clientX - r.left) / r.width - 0.5;
      tiltTY = (e.clientY - r.top) / r.height - 0.5;
      sheenX = (tiltTX + 0.5) * 100;
      sheenY = (tiltTY + 0.5) * 100;
    }, { passive: true });
    deck.addEventListener("pointerleave", () => {
      tiltTX = 0;
      tiltTY = 0;
    });

    /* drag the top card sideways: the deck deals and the pin follows */
    let drag = null;
    deck.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || MOBILE_TRACK.matches) return;
      drag = { x: e.clientX, y: window.scrollY };
      deck.classList.add("is-dragging");
      try { deck.setPointerCapture(e.pointerId); } catch (err) {}
    });
    deck.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const travel = Math.max(1, pin.offsetHeight - window.innerHeight);
      const base = pin.getBoundingClientRect().top + window.scrollY;
      const y = drag.y - ((e.clientX - drag.x) / Math.max(260, deckW)) * travel;
      const clamped = Math.min(base + travel, Math.max(base, y));
      if (lenis) lenis.scrollTo(clamped, { immediate: true });
      else window.scrollTo(0, clamped);
    });
    const releaseDrag = () => {
      drag = null;
      deck.classList.remove("is-dragging");
    };
    deck.addEventListener("pointerup", releaseDrag);
    deck.addEventListener("pointercancel", releaseDrag);
    deck.addEventListener("pointerleave", releaseDrag);
  }

  function scrollToCard(i) {
    if (!pin) return;
    const idx = Math.max(0, Math.min(LAST, i));
    const travel = Math.max(1, pin.offsetHeight - window.innerHeight);
    const base = pin.getBoundingClientRect().top + window.scrollY;
    const top = base + (idx / LAST) * travel;
    if (lenis) lenis.scrollTo(top, { duration: 1.05, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top, behavior: REDUCED ? "auto" : "smooth" });
  }

  $("#deckNext")?.addEventListener("click", () => scrollToCard(Math.round(deckPos) + 1));
  $("#deckPrev")?.addEventListener("click", () => scrollToCard(Math.round(deckPos) - 1));
  deckDots.forEach((dot, i) => dot.addEventListener("click", () => scrollToCard(i)));

  // The glide lives here, not in the trigger: a trigger only fires when the
  // scroll progress moves, so easing inside it would stop short of the target.
  subscribe(() => {
    if (!pin || !cards.length || MOBILE_TRACK.matches) return;
    deckPos = REDUCED ? deckTarget : lerp(deckPos, deckTarget, 0.15);
    if (Math.abs(deckTarget - deckPos) < 0.0015) deckPos = deckTarget;
    tiltX = lerp(tiltX, tiltTX, 0.09);
    tiltY = lerp(tiltY, tiltTY, 0.09);

    // The top card is always the one at floor(deckPos): it slides away as the
    // fraction grows, so the deck rests perfectly square between cards.
    const idx = Math.min(LAST, Math.floor(deckPos + 0.0001));
    const frac = Math.max(0, Math.min(1, deckPos - idx));
    const near = 1 - Math.min(1, Math.abs(frac - 0.5) * 1.4);

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const rel = i - idx;
      let x = 0;
      let y = 0;
      let rot = 0;
      let scale = 1;
      let op = 1;
      let z = 100;
      let dim = 0;
      let hidden = rel < 0;

      if (rel === 0) {
        // picked up and carried off the top of the deck
        x = frac * deckW * 1.55;
        y = -frac * 34;
        rot = frac * 10;
        scale = 1 + frac * 0.035;
        op = frac < 0.38 ? 1 : Math.max(0, 1 - (frac - 0.38) / 0.46);
        z = 120 + Math.round(frac * 10);
      } else if (rel > 0) {
        const b = rel - 1;
        x = b * 3;
        y = b * 18;
        rot = (i % 2 ? 1 : -1) * b * 1.4;
        scale = 1 - b * 0.034;
        z = 100 - rel * 8;
        dim = Math.min(0.8, b * 0.28);
        hidden = rel > 5;
      }

      let transform =
        `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ` +
        `rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      if (rel === 0 && near > 0.02) {
        transform += ` rotateX(${(-tiltY * 7 * near).toFixed(2)}deg) rotateY(${(tiltX * 9 * near).toFixed(2)}deg)`;
      }

      const state = `${transform}|${op.toFixed(3)}|${z}|${hidden ? 1 : 0}|${dim.toFixed(2)}`;
      if (cardState[i] !== state) {
        cardState[i] = state;
        card.style.transform = transform;
        card.style.opacity = op.toFixed(3);
        card.style.zIndex = String(z);
        card.style.visibility = hidden ? "hidden" : "visible";
        if (dims[i]) dims[i].style.opacity = dim.toFixed(2);
      }
      if (rel === 0 && near > 0.2) {
        card.style.setProperty("--mx", `${sheenX.toFixed(1)}%`);
        card.style.setProperty("--my", `${sheenY.toFixed(1)}%`);
      }
    }

    // The counter follows the card that is centred, which flips halfway
    // through a deal rather than at its end.
    const shown = Math.min(LAST, Math.round(deckPos));
    if (shown !== frontIndex) {
      frontIndex = shown;
      cards.forEach((card, i) => card.classList.toggle("is-front", i === shown));
      const label = String(shown + 1).padStart(2, "0");
      if (deckIndexEl && deckIndexEl.textContent !== label) deckIndexEl.textContent = label;
      deckDots.forEach((dot, i) => dot.classList.toggle("is-on", i === shown));
    }

    // The cards run full-bleed past the fixed furniture while the deck is pinned.
    const box = pin.getBoundingClientRect();
    const nowTracking = box.top < window.innerHeight * 0.52 && box.bottom > window.innerHeight * 0.12;
    if (nowTracking !== tracking) {
      tracking = nowTracking;
      document.body.classList.toggle("is-tracking", nowTracking);
    }
  }, 0);

  /* stat counters */
  $$(".stat").forEach((stat) => {
    const target = Number(stat.dataset.count);
    const suffix = stat.dataset.suffix || "";
    const number = $(".stat-n", stat);
    if (!target || !number) return;
    inView(stat, () => {
      animate({
        tension: 118,
        friction: 26,
        onUpdate: (p) => {
          number.textContent = Math.round(target * clamp01(p)) + suffix;
        },
        onRest: () => {
          number.textContent = target + suffix;
        },
      });
    }, { margin: "0px 0px -18% 0px" });
  });

  /* section headings */
  $$(".work-title, .section-title, .contact-title, .exp-head .section-title").forEach((el) => {
    revealText(el, { by: "word", stagger: 80, tension: 160, friction: 26, distance: 0.3 });
  });

  /* generic in-view rows */
  $$(".work-head, .exp-head, .cap-copy, .sk-group, .tl-entry, .contact-sub, .contact-links").forEach((el) => {
    inView(el, () => {
      el.classList.add("is-in");
    }, { margin: "0px 0px -10% 0px" });
  });

  /* timeline: thread draw + expanders */
  const expSection = $("#experience");
  const thread = $("#tlThread");
  const rail = $(".tl-rail");
  const tlNode = $("#tlNode");
  const tlEntries = $$(".tl-entry");
  let nodeY = 0;
  let nodeReady = false;
  let nodeOn = false;

  subscribe(() => {
    if (!expSection || !thread) return;
    const rect = expSection.getBoundingClientRect();
    const p = clamp01((window.innerHeight - rect.top) / (window.innerHeight + rect.height));
    thread.style.transform = `scaleY(${p.toFixed(4)})`;

    // a read head that rides the rail to whichever role owns the middle of the screen
    if (tlNode && rail && tlEntries.length) {
      const mid = window.innerHeight * 0.48;
      let best = tlEntries[0];
      let bestD = Infinity;
      for (const el of tlEntries) {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height * 0.5 - mid);
        if (d < bestD) { bestD = d; best = el; }
      }
      const rr = rail.getBoundingClientRect();
      const y = best.getBoundingClientRect().top + 13 - rr.top;
      nodeY = nodeReady ? nodeY + (y - nodeY) * 0.16 : y;
      nodeReady = true;
      tlNode.style.transform = `translateY(${nodeY.toFixed(1)}px) rotate(45deg)`;
      const on = rr.top < window.innerHeight - 40 && rr.bottom > 40;
      if (on !== nodeOn) {
        nodeOn = on;
        tlNode.classList.toggle("is-on", on);
      }
    }
  }, 16);

  $$(".tl-entry").forEach((entry) => {
    const toggle = $(".tl-toggle", entry);
    const head = $(".tl-head", entry);
    const onActivate = () => {
      const isOpen = entry.classList.contains("is-open");
      $$(".tl-entry").forEach((other) => {
        other.classList.remove("is-open");
        const t = $(".tl-toggle", other);
        if (t) t.textContent = "expand";
      });
      if (!isOpen) {
        entry.classList.add("is-open");
        if (toggle) toggle.textContent = "close";
      }
    };
    head?.addEventListener("click", onActivate);
    entry.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    });
    head?.setAttribute("tabindex", "0");
    head?.setAttribute("role", "button");
  });

  /* cursor */
  if (FINE) {
    document.body.classList.add("cursor-on");
    const dot = $("#cDot");
    const ring = $("#cRing");
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let seen = false;

    window.addEventListener("pointermove", (e) => {
      x = e.clientX;
      y = e.clientY;
      if (!seen) {
        seen = true;
        rx = x;
        ry = y;
        document.body.classList.add("cursor-live");
      }
      if (dot) dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }, { passive: true });

    subscribe(() => {
      rx = lerp(rx, x, 0.16);
      ry = lerp(ry, y, 0.16);
      if (ring) ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    }, 0);

    document.addEventListener("pointerover", (e) => {
      const hot = e.target.closest("a, button, .deck-card, .sk-group, .tl-entry, .stat");
      ring?.classList.toggle("is-hot", Boolean(hot));
    });
  }

  /* magnetic buttons */
  $$(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      if (!FINE) return;
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width / 2) * 0.16;
      const dy = (e.clientY - rect.top - rect.height / 2) * 0.2;
      el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
    });
    el.addEventListener("pointerleave", () => {
      el.style.transform = "";
    });
  });

  /* chat */
  const chatPanel = $("#chatPanel");
  const chatHint = $("#chatHint");
  const chatLog = $("#chatMessages");
  const chatSuggs = $("#chatSuggs");
  const chatForm = $("#chatForm");
  const chatInput = $("#chatInput");
  let chatOpen = false;

  const time = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function addMessage(role, text) {
    if (!chatLog) return;
    const msg = document.createElement("div");
    msg.className = `msg ${role}`;
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = text;
    const stamp = document.createElement("div");
    stamp.className = "msg-time";
    stamp.textContent = time();
    msg.append(bubble, stamp);
    chatLog.appendChild(msg);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function typing() {
    const el = document.createElement("div");
    el.className = "typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    chatLog?.appendChild(el);
    if (chatLog) chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }

  function respond(text) {
    const q = text.toLowerCase();
    if (/sentinel|orbit|blast.radius|knowledge graph/.test(q))
      return "Sentinel — an Orbit-powered MR blast-radius agent built for the GitLab Transcend Hackathon. One /sentinel command in the MR sidebar triggers it to traverse GitLab Orbit's knowledge graph across 8 node types and post a structured impact brief to the MR in under a minute. <a href='https://gitlab.com/dwijjoshi14/sentinel-orbit-agent' target='_blank' rel='noopener'>gitlab ↗</a>";
    if (/clearshift|clinical|handoff|health/.test(q))
      return "ClearShift — full-stack shift handoff tool for clinical care teams. Structured form captures what happened, open tasks and urgency flags; one tap generates an AI summary for tired incoming staff. Next.js, Supabase, Claude API, shipped live on Vercel during Mind the Product World Product Day. <a href='https://github.com/dwijjoshi14/ClearShift' target='_blank' rel='noopener'>github →</a>";
    if (/rtos|freertos|semaphore|queue|mutex/.test(q))
      return "RTOS Task Scheduler — three FreeRTOS tasks in C. SensorTask feeds a typed queue every 500ms, ControlTask fires a binary semaphore on a critical temperature, DisplayTask renders live output. Runs on Linux via POSIX simulation; ports to STM32 with three HAL swaps. <a href='https://github.com/dwijjoshi14/rtos-task-scheduler' target='_blank' rel='noopener'>github →</a>";
    if (/imu|robotic arm|mpu|gyro|servo/.test(q))
      return "IMU robotic arm — a complementary filter fusing MPU-6050 accelerometer and gyroscope data over I2C for drift-free angle estimation on STM32F103, three FreeRTOS tasks, tested in POSIX sim before hardware flash. In progress.";
    if (/heat|fan|tmp36|neopixel|thermal/.test(q))
      return "Heat Management System — Arduino Uno, TMP36 ADC sense, PMOS-driven PWM fan, 16×2 LCD and an 80-LED NeoPixel strip, for MTE301. The interesting bug was inverted PWM logic from the PMOS high-side driver, caught in Tinkercad before hardware.";
    if (/circuit|ohm|kirchhoff|kvl|kcl/.test(q))
      return "DC Circuit Analyzer — C++17 tool applying Ohm's and Kirchhoff's laws to series and parallel circuits, with automatic KVL/KCL verification. Built so he could stop doing it by hand in physics lab.";
    if (/mcu|webmaster|course union/.test(q))
      return "Dwij is sole webmaster for the Mechatronics Course Union at TMU — built tmutron.ca from scratch in vanilla HTML/CSS/JS with a custom HUD aesthetic, cut hosting from $240/yr to $20/yr on GitHub Pages.";
    if (/project|built|github|repo/.test(q))
      return "Seven projects: ClearShift (clinical handoff, live on Vercel), Sentinel (GitLab Orbit agent), RTOS Task Scheduler, IMU Robotic Arm (in progress), Heat Management System, DC Circuit Analyzer, Smart Parking Assistant. <a href='https://github.com/dwijjoshi14' target='_blank' rel='noopener'>github.com/dwijjoshi14</a>";
    if (/skill|language|tech|cpp|embedded/.test(q))
      return "C and C++ mainly. Embedded: STM32, Arduino, FreeRTOS, PWM, ADC, UART, I2C, SPI, GPIO, PlatformIO. AI: GitLab Orbit, Duo Agent Platform, prompt engineering, Claude API. Web: Next.js, Supabase, TypeScript, Vercel. Tools: Git, GitLab CI/CD, Linux, KiCad, MATLAB.";
    if (/experience|work|job|safss|rosalie|leacock|can crops/.test(q))
      return "Webmaster at MCU/TMU (Apr 2025–present); web designer at Can Crops (May–Jul 2026); intake worker at SAFSS (May–Jul 2026); administrative assistant at Rosalie Hall — rebuilt data systems, cut report time from 3hr to 45min; senior program assistant at Leacock Foundation; league ambassador at JAM Sports.";
    if (/coop|intern|hire|available|recruit/.test(q))
      return "Looking for co-op or internship in embedded systems / mechatronics starting January 2027, based in Toronto. dwijjoshi14@gmail.com · <a href='https://linkedin.com/in/dwij-joshi-14-tron' target='_blank' rel='noopener'>linkedin ↗</a>";
    if (/education|school|tmu|degree/.test(q))
      return "BEng Mechatronics Engineering at Toronto Metropolitan University, graduating April 2029, transferred from Computer Engineering. Ontario Scholar.";
    if (/contact|email|reach|linkedin|resume/.test(q))
      return "dwijjoshi14@gmail.com · <a href='https://linkedin.com/in/dwij-joshi-14-tron' target='_blank' rel='noopener'>linkedin ↗</a> · <a href='https://github.com/dwijjoshi14' target='_blank' rel='noopener'>github ↗</a> · resume in the header.";
    if (/who|about|introduce|background/.test(q))
      return "Dwij is a mechatronics engineering student at TMU, graduating 2029, transferred from computer engineering. Builds embedded firmware in C++, works with FreeRTOS, sensor integration and real-time control — and also does web and AI agents. 4+ years of work experience, Ontario Scholar.";
    if (/hello|hi|hey/.test(q)) return "hey — what do you want to know about dwij?";
    return "not sure i have that. try projects, skills, experience or co-op availability — or email him at dwijjoshi14@gmail.com.";
  }

  function send(text) {
    const value = (text || chatInput?.value || "").trim();
    if (!value) return;
    if (chatInput) chatInput.value = "";
    if (chatSuggs) chatSuggs.style.display = "none";
    addMessage("user", value);
    const dots = typing();
    setTimeout(() => {
      dots.remove();
      addMessage("bot", respond(value));
    }, 620 + Math.random() * 420);
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    chatPanel?.classList.toggle("is-open", chatOpen);
    chatPanel?.setAttribute("aria-hidden", String(!chatOpen));
    chatHint?.classList.remove("is-visible");
    if (chatOpen && chatLog && !chatLog.children.length) {
      setTimeout(
        () =>
          addMessage(
            "bot",
            "hey — I'm an AI that knows dwij's background pretty well. what do you want to know?"
          ),
        380
      );
    }
  }

  $("#chatBubble")?.addEventListener("click", toggleChat);
  $("#chatClose")?.addEventListener("click", toggleChat);
  chatHint?.addEventListener("click", toggleChat);
  chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    send();
  });
  $$(".chat-suggs button").forEach((b) =>
    b.addEventListener("click", () => send(b.textContent || ""))
  );
  setTimeout(() => chatHint?.classList.add("is-visible"), 5200);
  // the nudge is a one-off: it must not sit on the timeline or the plates forever
  setTimeout(() => chatHint?.classList.remove("is-visible"), 14200);

  /* lightning reflex */
  const gameModal = $("#gameModal");
  const arena = $("#gameArena");
  const arenaMsg = $("#arenaMsg");
  const scoreEl = $("#gameScore");
  const timerEl = $("#gameTimer");
  const highEl = $("#gameHigh");
  const startBtn = $("#gameStart");
  let score = 0;
  let high = 0;
  let gameRunning = false;
  let countdown = null;
  let targetTimeout = null;

  function spawnTarget() {
    if (!arena) return;
    arena.querySelector(".game-target")?.remove();
    const pad = 34;
    const x = pad + Math.random() * Math.max(1, arena.offsetWidth - pad * 2);
    const y = pad + Math.random() * Math.max(1, arena.offsetHeight - pad * 2);
    const target = document.createElement("button");
    target.type = "button";
    target.className = "game-target";
    target.style.left = `${x}px`;
    target.style.top = `${y}px`;
    target.textContent = "⚡";
    target.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!gameRunning) return;
      score += 1;
      if (scoreEl) scoreEl.textContent = String(score);
      target.remove();
      clearTimeout(targetTimeout);
      targetTimeout = setTimeout(spawnTarget, 80 + Math.random() * 150);
    });
    arena.appendChild(target);
    targetTimeout = setTimeout(() => {
      target.remove();
      if (gameRunning) setTimeout(spawnTarget, 150 + Math.random() * 250);
    }, 1400);
  }

  function stopGame() {
    gameRunning = false;
    clearInterval(countdown);
    clearTimeout(targetTimeout);
    arena?.querySelector(".game-target")?.remove();
  }

  function startGame() {
    if (!arena) return;
    score = 0;
    if (scoreEl) scoreEl.textContent = "0";
    gameRunning = true;
    if (arenaMsg) arenaMsg.style.display = "none";
    if (startBtn) startBtn.textContent = "restart";
    let left = 10;
    if (timerEl) timerEl.textContent = String(left);
    clearInterval(countdown);
    clearTimeout(targetTimeout);
    arena.querySelector(".game-target")?.remove();
    spawnTarget();
    countdown = setInterval(() => {
      left -= 1;
      if (timerEl) timerEl.textContent = String(left);
      if (left > 0) return;
      clearInterval(countdown);
      stopGame();
      if (score > high) {
        high = score;
        if (highEl) highEl.textContent = String(high);
      }
      if (arenaMsg) {
        arenaMsg.style.display = "flex";
        arenaMsg.innerHTML = `<div class="big">${score}</div><div class="small">${
          score > 0 && score >= high ? "new best" : "bolts caught"
        }</div><div class="small dim">best: ${high}</div>`;
      }
    }, 1000);
  }

  function openGame() {
    gameModal?.classList.add("is-open");
    gameModal?.setAttribute("aria-hidden", "false");
    lenis?.stop();
  }
  function closeGame() {
    gameModal?.classList.remove("is-open");
    gameModal?.setAttribute("aria-hidden", "true");
    stopGame();
    lenis?.start();
  }

  $("#playBtn")?.addEventListener("click", openGame);
  $("#gameClose")?.addEventListener("click", closeGame);
  $("#gameCloseBtn")?.addEventListener("click", closeGame);
  startBtn?.addEventListener("click", startGame);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameModal?.classList.contains("is-open")) closeGame();
  });

  /* field last, so the hero has its layout */
  initField();

  /* keep measurement honest after images settle */
  window.addEventListener("load", measureDeck);
}

/* ── boot ──────────────────────────────────────────────────────── */
init();
bootVeil();
