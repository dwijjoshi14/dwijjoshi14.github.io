/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   OSCILLOSCOPE HERO CANVAS
   Draws a realistic-ish PWM + analog signal on the hero bg
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initScope() {
  const canvas = document.getElementById('scope-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Draw the oscilloscope grid
  function drawGrid() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,200,150,0.06)';
    ctx.lineWidth = 0.5;
    const cols = 12, rows = 8;
    for (let i = 0; i <= cols; i++) {
      const x = (W / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let i = 0; i <= rows; i++) {
      const y = (H / rows) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Center crosshair
    ctx.strokeStyle = 'rgba(0,200,150,0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Waveform state
  let phase = 0;
  const PWM_PERIOD = 0.18;    // in canvas-width fraction
  const PWM_DUTY   = 0.5;
  const BASE_Y     = 0.55;    // vertical center as fraction of height
  const AMP        = 0.15;    // amplitude as fraction of height
  const JITTER     = 0.5;     // pixel jitter for CRT realism

  function drawWaveforms(t) {
    const W = canvas.width, H = canvas.height;

    // Channel 1: PWM signal (right half of screen)
    {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,200,150,0.7)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(0,200,150,0.4)';

      const startX = W * 0.25;
      const endX   = W * 0.90;
      const baseY  = H * BASE_Y;
      const high   = baseY - H * AMP;
      const low    = baseY + H * AMP;
      const period = W * PWM_PERIOD;
      const duty   = period * PWM_DUTY;

      let x = startX;
      let high_state = true;
      let segStart = startX;

      ctx.moveTo(x, high_state ? high : low);

      while (x < endX) {
        const segEnd = high_state ? segStart + duty : segStart + (period - duty);
        const clampedEnd = Math.min(segEnd, endX);

        // Horizontal line
        const jY = (Math.random() - 0.5) * JITTER;
        ctx.lineTo(clampedEnd, (high_state ? high : low) + jY);

        if (clampedEnd < endX) {
          // Vertical transition (fast edge)
          ctx.lineTo(clampedEnd, high_state ? low : high);
          high_state = !high_state;
          segStart = clampedEnd;
        }
        x = clampedEnd;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Channel 2: Analog/sine overlay (muted, like an IMU trace)
    {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(229,48,58,0.35)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 4;
      ctx.shadowColor = 'rgba(229,48,58,0.2)';

      const startX = W * 0.25;
      const endX   = W * 0.90;
      const baseY  = H * 0.45;
      const amp    = H * 0.07;
      const freq   = 3.5;

      ctx.moveTo(startX, baseY);
      for (let x = startX; x <= endX; x += 2) {
        const progress = (x - startX) / (endX - startX);
        const y = baseY + Math.sin((progress * Math.PI * 2 * freq) + phase) * amp
                        + Math.sin((progress * Math.PI * 2 * freq * 2.3) + phase * 0.7) * amp * 0.25;
        ctx.lineTo(x, y + (Math.random() - 0.5) * 0.4);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Trigger marker
    {
      const trigX = W * 0.25;
      const trigY = H * BASE_Y;
      ctx.fillStyle = 'rgba(229,48,58,0.7)';
      ctx.beginPath();
      ctx.moveTo(trigX - 8, trigY - 4);
      ctx.lineTo(trigX,     trigY);
      ctx.lineTo(trigX - 8, trigY + 4);
      ctx.fill();
    }
  }

  let animFrame;
  function animate(t) {
    phase += 0.008;
    drawGrid();
    drawWaveforms(t);
    animFrame = requestAnimationFrame(animate);
  }
  animate(0);
})();


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MINI SIGNAL WAVEFORMS (project cards)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function drawSignalWave(canvas, type) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,200,150,0.75)';
  ctx.lineWidth = 1.2;

  if (type === 'pwm') {
    // Simple PWM square wave
    const segs = [{x:0,h:true},{x:0.3,h:false},{x:0.6,h:true},{x:0.9,h:false}];
    const lo = H * 0.72, hi = H * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, hi);
    for (let i = 0; i < segs.length; i++) {
      const x1 = segs[i].x * W;
      const x2 = (segs[i+1] ? segs[i+1].x : 1.0) * W;
      const y  = segs[i].h ? hi : lo;
      ctx.lineTo(x1, y);
      ctx.lineTo(x2, y);
      if (segs[i+1]) ctx.lineTo(x2, segs[i+1].h ? hi : lo);
    }
    ctx.stroke();
  } else if (type === 'i2c') {
    // I2C-ish signal (start bit, data bits, stop bit)
    const lo = H * 0.72, hi = H * 0.18, mid = (lo + hi) / 2;
    const bits = [1,0,1,1,0,1,0,1];
    ctx.beginPath();
    ctx.moveTo(0, hi);
    ctx.lineTo(8, hi); ctx.lineTo(8, lo); // START condition
    bits.forEach((b, i) => {
      const x = 8 + i * 9;
      const y = b ? hi : lo;
      ctx.lineTo(x, y); ctx.lineTo(x + 8, y);
    });
    ctx.lineTo(8 + bits.length * 9, lo);
    ctx.lineTo(8 + bits.length * 9 + 5, lo);
    ctx.lineTo(8 + bits.length * 9 + 5, hi); // STOP
    ctx.lineTo(W, hi);
    ctx.stroke();
    // Clock line
    ctx.strokeStyle = 'rgba(229,48,58,0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const clkY = H * 0.5;
    ctx.moveTo(0, clkY);
    for (let i = 0; i < 10; i++) {
      const x = i * 8;
      ctx.lineTo(x, clkY);
      ctx.lineTo(x + 4, clkY - 6);
      ctx.lineTo(x + 4, clkY);
    }
    ctx.stroke();
  }
}

document.querySelectorAll('.signal-wave').forEach(c => {
  drawSignalWave(c, c.dataset.type);
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SMOOTH SCROLL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
let scrollCurrent = 0, scrollTarget = 0;

window.addEventListener('wheel', e => {
  e.preventDefault();
  scrollTarget = Math.max(0, Math.min(
    scrollTarget + e.deltaY * 0.8,
    document.body.scrollHeight - window.innerHeight
  ));
}, { passive: false });

let touchStartY = 0;
window.addEventListener('touchstart', e => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', e => {
  const delta = touchStartY - e.touches[0].clientY;
  scrollTarget = Math.max(0, Math.min(
    scrollTarget + delta * 1.5,
    document.body.scrollHeight - window.innerHeight
  ));
  touchStartY = e.touches[0].clientY;
}, { passive: true });

(function scrollLoop() {
  scrollCurrent += (scrollTarget - scrollCurrent) * 0.09;
  window.scrollTo(0, scrollCurrent);
  requestAnimationFrame(scrollLoop);
})();


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROGRESS BAR + NAV SCROLL STATE
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const progressBar = document.getElementById('progress-bar');
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const total = document.body.scrollHeight - window.innerHeight;
  progressBar.style.width = (scrolled / total * 100) + '%';
  nav.classList.toggle('scrolled', scrolled > 40);
  updateSectionDots();
  updateReveals();
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION DOTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const SECTION_IDS = ['hero', 'about', 'projects', 'skills', 'experience', 'contact'];
const sdots = document.querySelectorAll('.sdot');

function updateSectionDots() {
  let active = 'hero';
  SECTION_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && window.scrollY >= el.offsetTop - 200) active = id;
  });
  sdots.forEach((d, i) => {
    d.classList.toggle('active', d.dataset.target === active);
  });
}

sdots.forEach(d => {
  d.addEventListener('click', () => {
    const target = document.getElementById(d.dataset.target);
    if (target) scrollTarget = target.offsetTop - 56;
  });
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ANCHOR LINKS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    if (id === 'hero') {
      scrollTarget = 0;
    } else {
      const el = document.getElementById(id);
      if (el) scrollTarget = el.offsetTop - 56;
    }
    document.getElementById('fs-nav')?.classList.remove('open');
  });
});

// Logo click
document.querySelector('.nav-logo')?.addEventListener('click', e => {
  e.preventDefault(); scrollTarget = 0;
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FULLSCREEN NAV
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const fsNav  = document.getElementById('fs-nav');
const burger = document.getElementById('hamburger');
const fsClose = document.getElementById('fsClose');

burger?.addEventListener('click',  () => fsNav.classList.add('open'));
fsClose?.addEventListener('click', () => fsNav.classList.remove('open'));
document.querySelectorAll('[data-nav]').forEach(a => {
  a.addEventListener('click', () => fsNav.classList.remove('open'));
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCROLL REVEAL (IntersectionObserver)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

function updateReveals() {}  // kept for compat; observer handles it

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TIMELINE TOGGLES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
// Already handled by onclick="this.parentElement.classList.toggle('open')" in HTML
// But also add keyboard support
document.querySelectorAll('.tl-head').forEach(head => {
  head.setAttribute('tabindex', '0');
  head.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      head.parentElement.classList.toggle('open');
    }
  });
});


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TERMINAL TYPEWRITER (contact section)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initTerminal() {
  const body = document.getElementById('terminalBody');
  if (!body) return;

  const lines = body.querySelectorAll('.term-line, .term-output');
  lines.forEach(l => { l.style.opacity = '0'; });

  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();

    let delay = 0;
    lines.forEach(line => {
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transition = 'opacity 0.15s';
      }, delay);
      delay += line.classList.contains('term-line') ? 350 : 200;
    });
  }, { threshold: 0.4 });

  observer.observe(body);
})();


/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AI CHAT — Anthropic API powered
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function initChat() {
  const fab    = document.getElementById('chatFab');
  const panel  = document.getElementById('chatPanel');
  const close  = document.getElementById('chatClose');
  const msgs   = document.getElementById('chatMsgs');
  const input  = document.getElementById('chatInput');
  const send   = document.getElementById('chatSend');
  const suggs  = document.getElementById('chatSuggs');

  let chatOpen = false;
  let chatHistory = [];
  let initialized = false;

  const SYSTEM_PROMPT = `You are an AI assistant embedded in Dwij Joshi's personal portfolio website. You know everything about Dwij and represent him accurately and confidently.

ABOUT DWIJ:
- Mechatronics Engineering student at Toronto Metropolitan University (TMU), transferred from Computer Engineering, graduating April 2029
- Targeting January 2027 embedded systems co-op
- Based in Scarborough, ON
- Email: dwijjoshi14@gmail.com | LinkedIn: linkedin.com/in/dwij-joshi-14-tron | GitHub: github.com/dwijjoshi14

TECHNICAL SKILLS:
- Primary: C and C++, embedded firmware, STM32F103, FreeRTOS (queues, semaphores, mutexes), I2C, SPI, UART, PWM, ADC, GPIO
- Platforms: Arduino, PlatformIO, Linux, POSIX simulation, KiCad, Tinkercad, MATLAB, Make
- Also: Python, Java, JavaScript/TypeScript, SQL, YAML
- Web: Next.js, Supabase, Vercel, Node.js
- AI/Agents: GitLab Orbit, Duo Agent Platform, Claude API, Prompt Engineering
- Testing: unit testing, black-box/white-box, POSIX simulation before hardware, V&V

PROJECTS:
1. IMU Robotic Arm (in progress) — complementary filter fusing MPU-6050 accel+gyro over I2C, drift-free angle estimation on STM32F103. Three-task FreeRTOS (IMU read, angle compute, servo PWM). POSIX sim layer for testing before hardware flash. Hardware parts arriving (ordered from AliExpress).
2. ClearShift (hackathon, Mind the Product World Product Day, Jun 2026) — full-stack clinical shift-handoff tool. Next.js, Supabase, Claude API, TypeScript, Vercel. Shipped live in competition window. Live: project-ak4dq-pu47a3emu-dwij-joshi-s-projects.vercel.app
3. Sentinel (hackathon, GitLab Transcend, Jun 2026) — Orbit-powered MR blast-radius agent. /sentinel command traverses 8 knowledge graph node types, posts structured impact brief to MR in <60s. Python, YAML, GitLab CI/CD.
4. RTOS Task Scheduler — three-task FreeRTOS in C. SensorTask queues data every 500ms, ControlTask fires semaphore on critical temp, DisplayTask renders output. POSIX simulation on Linux.
5. Heat Management System (MTE301 group project, Fall 2025) — Arduino Uno, TMP36 ADC, PMOS-driven PWM fan, 16x2 LCD, 80-LED NeoPixel. Key debug: inverted PWM logic from PMOS high-side driver.
6. DC Circuit Analyzer — C++17, Ohm's Law + KVL/KCL on series/parallel circuits with auto-verification.
7. Smart Parking Assistant (HS capstone) — 95% accuracy 5-100cm, sub-50ms loop.
8. MCU Website — sole dev, mcutmu.ca, vanilla HTML/CSS/JS, cut cost 92% via GitHub Pages.

EXPERIENCE:
- Webmaster/Full-Stack Dev, MCU at TMU (Apr 2025–present)
- Web Designer, Can Crops Inc. (May–Jul 2026)
- Intake Worker, SAFSS (May–Jul 2026)
- Administrative Assistant, Rosalie Hall Mental Health Institution (Jul 2024–Aug 2025) — rebuilt Excel workflow cutting 3hr process to 45min
- Senior Program Assistant, Leacock Foundation (Feb 2023–Oct 2025) — Certificate of Recognition, spotted 15% attendance drop, recovered in 6 weeks
- League Ambassador, JAM Sports (Sept–Dec 2022)

PERSONA NOTES:
- Keep answers concise and conversational. Don't be corporate or stiff.
- Use technical precision when discussing embedded work — recruiters reading this know their stuff.
- Be honest about what's in progress. The IMU arm hardware hasn't arrived yet.
- If asked about salary/pay, say Dwij is open to discussing and to reach out directly.
- Always end responses about co-op/hiring with the email: dwijjoshi14@gmail.com

Keep responses SHORT (2-4 sentences max for simple questions, a short paragraph for complex ones). Be direct, a bit casual, technically accurate.`;

  function toggleChat() {
    chatOpen = !chatOpen;
    panel.classList.toggle('open', chatOpen);
    panel.setAttribute('aria-hidden', String(!chatOpen));
    if (chatOpen && !initialized) {
      initialized = true;
      setTimeout(() => addBot("hey — I'm an AI that knows dwij's work pretty well. what do you want to know?"), 350);
    }
    if (chatOpen) input.focus();
  }

  fab.addEventListener('click', toggleChat);
  close.addEventListener('click', toggleChat);

  suggs.querySelectorAll('.chat-sugg').forEach(s => {
    s.addEventListener('click', () => sendMsg(s.textContent));
  });

  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addBot(text) {
    const m = document.createElement('div');
    m.className = 'msg bot';
    m.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${getTime()}</div>`;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addUser(text) {
    const m = document.createElement('div');
    m.className = 'msg user';
    m.innerHTML = `<div class="msg-bubble">${text}</div><div class="msg-time">${getTime()}</div>`;
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
    return m;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'typing-indicator';
    t.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    msgs.appendChild(t);
    msgs.scrollTop = msgs.scrollHeight;
    return t;
  }

  // Fallback responses if API fails
  function getFallback(msg) {
    const m = msg.toLowerCase();
    if (m.match(/who|about|background/)) return "dwij is a mechatronics eng. student at TMU, graduating 2029. embedded C++ is his main thing — STM32, FreeRTOS, sensor integration. also builds web apps and AI agents. looking for jan 2027 co-op.";
    if (m.match(/imu|robotic|arm|mpu|gyro|accel/)) return "the IMU arm is the main project right now — complementary filter fusing MPU-6050 data over I2C on STM32F103. three FreeRTOS tasks, POSIX sim layer for testing before hardware. parts are still in transit.";
    if (m.match(/rtos|freertos|scheduler/)) return "the RTOS scheduler is a three-task FreeRTOS system in C — sensor queue every 500ms, binary semaphore for critical alerts, mutex for shared output. runs on Linux via POSIX sim.";
    if (m.match(/clearshift|hackathon/)) return "ClearShift — clinical handoff tool built at Mind the Product World Product Day 2026. Next.js + Supabase + Claude API, shipped live on Vercel during the competition.";
    if (m.match(/sentinel|gitlab|orbit/)) return "Sentinel — built for GitLab Transcend 2026. Orbit agent that traverses the knowledge graph and posts a blast-radius impact brief to any MR in under 60 seconds.";
    if (m.match(/skill|embed|stm|freertos|uart|spi|i2c/)) return "core embedded stack: C/C++, STM32, FreeRTOS (queues, semaphores, mutexes), I2C, SPI, UART, PWM, ADC. uses PlatformIO, Linux, POSIX simulation, KiCad.";
    if (m.match(/coop|intern|hire|job|available/)) return "yes — looking for embedded systems or mechatronics co-op starting january 2027. reach out at dwijjoshi14@gmail.com.";
    if (m.match(/contact|email|reach/)) return "dwijjoshi14@gmail.com // linkedin.com/in/dwij-joshi-14-tron";
    return "not sure about that — try asking about his embedded projects, skills, or co-op availability. or just email dwijjoshi14@gmail.com.";
  }

  async function callAPI(userMessage) {
    chatHistory.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: chatHistory
        })
      });

      if (!response.ok) throw new Error('API error');

      const data = await response.json();
      const assistantMsg = data.content?.[0]?.text || '';

      chatHistory.push({ role: 'assistant', content: assistantMsg });
      return assistantMsg;
    } catch (err) {
      // If API fails (no key in browser context), fall back gracefully
      const fallback = getFallback(userMessage);
      chatHistory.push({ role: 'assistant', content: fallback });
      return fallback;
    }
  }

  async function sendMsg(text) {
    const userText = (text || input.value).trim();
    if (!userText) return;
    input.value = '';
    suggs.style.display = 'none';

    addUser(userText);
    const typing = showTyping();

    const reply = await callAPI(userText);
    typing.remove();
    addBot(reply);
  }

  send.addEventListener('click', () => sendMsg());
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
})();
