(function () {
  // current year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileLayout = () => window.matchMedia('(max-width: 760px)').matches;
  const hasHover = window.matchMedia('(hover: hover)').matches;

  // generate decorative ticks around the outer ring
  const ticksGroup = document.querySelector('.flywheel-svg .ticks');
  if (ticksGroup) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const innerR = 432;
    const outerR = 448;
    const COUNT = 60;
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const isMajor = i % 5 === 0;
      const r1 = isMajor ? innerR - 6 : innerR;
      const r2 = outerR;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', (cos * r1).toFixed(2));
      line.setAttribute('y1', (sin * r1).toFixed(2));
      line.setAttribute('x2', (cos * r2).toFixed(2));
      line.setAttribute('y2', (sin * r2).toFixed(2));
      line.style.strokeWidth = isMajor ? '1.6' : '1';
      line.style.opacity = '0';
      // ticks come in during the cinematic reveal: 2.0s base + ripple
      line.style.animationDelay = (2.0 + (i / COUNT) * 0.8).toFixed(2) + 's';
      ticksGroup.appendChild(line);
    }
  }

  const stage = document.querySelector('.flywheel-stage');
  const userWheel = document.querySelector('.flywheel-svg .user-wheel');
  const cards = Array.from(document.querySelectorAll('.category'));
  const spinHint = document.querySelector('.spin-hint');
  const baseAngles = cards.map((c) => parseFloat(c.dataset.baseAngle) || 0);

  // ── ROTATION STATE ──
  let theta = -45;        // degrees — start cards at the corners (NE/SE/SW/NW)
  let velocity = 0;       // degrees per frame
  let dragging = false;
  let inertiaRaf = null;
  let lastPointerAngle = 0;
  let dragMoved = 0;      // accumulated drag distance to know "real" drag
  let lastTickTheta = -45; // track 90° crossings for whoosh sound
  let fastSpinTimer = null;
  const FAST_SPIN_THRESHOLD = 6.5; // deg per frame ≈ 1 rev / sec
  const TICK_INTERVAL = 90;        // degrees between whoosh sounds (one per card slot)

  function getR() {
    if (!stage) return 280;
    const v = parseFloat(getComputedStyle(stage).getPropertyValue('--r'));
    return isFinite(v) ? v : 280;
  }

  function applyWheel() {
    if (!stage) return;
    if (isMobileLayout()) {
      // clear any inline transforms left over from desktop layout
      cards.forEach((c) => { c.style.transform = ''; });
      if (userWheel) userWheel.style.transform = '';
      return;
    }
    const r = getR();
    cards.forEach((card, i) => {
      const a = (baseAngles[i] + theta) * Math.PI / 180;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      card.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px))`;
    });
    if (userWheel) userWheel.style.transform = `rotate(${theta}deg)`;
  }

  // initial paint after layout settles
  requestAnimationFrame(applyWheel);
  window.addEventListener('resize', applyWheel);

  // ── AUDIO: subtle whoosh on each 90° card-pass ──
  let audioCtx = null;
  let audioMuted = (function () {
    try { return localStorage.getItem('hub-audio-muted') === '1'; } catch (_) { return false; }
  })();
  // default: muted on first visit (don't surprise people with sound)
  // user opts in via the speaker icon
  if (!audioMuted && (function () { try { return localStorage.getItem('hub-audio-muted') === null; } catch (_) { return true; } })()) {
    audioMuted = true;
  }

  const audioToggle = document.querySelector('.audio-toggle');
  function syncAudioToggle() {
    if (!audioToggle) return;
    audioToggle.classList.toggle('muted', audioMuted);
    audioToggle.setAttribute('aria-pressed', audioMuted ? 'false' : 'true');
    audioToggle.title = audioMuted ? 'Sound off — click to enable' : 'Sound on — click to mute';
  }
  syncAudioToggle();

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playWhoosh(intensity = 1) {
    if (audioMuted || !audioCtx || reducedMotion) return;
    const now = audioCtx.currentTime;
    const duration = 0.18;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + duration);
    filter.Q.value = 0.6;
    const gain = audioCtx.createGain();
    const peak = Math.min(0.18, 0.06 + 0.02 * intensity);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  if (audioToggle) {
    audioToggle.addEventListener('click', () => {
      audioMuted = !audioMuted;
      try { localStorage.setItem('hub-audio-muted', audioMuted ? '1' : '0'); } catch (_) {}
      syncAudioToggle();
      if (!audioMuted) {
        ensureAudio();
        // confirm with a single soft whoosh so user hears it works
        setTimeout(() => playWhoosh(1.5), 30);
      }
    });
  }

  // ── FAST-SPIN EASTER EGG ──
  function triggerFastSpin() {
    document.body.classList.add('fast-spin');
    if (fastSpinTimer) clearTimeout(fastSpinTimer);
    fastSpinTimer = setTimeout(() => {
      document.body.classList.remove('fast-spin');
      fastSpinTimer = null;
    }, 600);
  }

  function checkRotationEffects() {
    // whoosh on 90° crossings
    while (Math.abs(theta - lastTickTheta) >= TICK_INTERVAL) {
      const dir = theta > lastTickTheta ? 1 : -1;
      lastTickTheta += dir * TICK_INTERVAL;
      const intensity = Math.min(3, Math.abs(velocity) / 2);
      playWhoosh(intensity);
    }
    // hot-spin glow when above threshold
    if (Math.abs(velocity) >= FAST_SPIN_THRESHOLD) {
      triggerFastSpin();
    }
  }

  // ── DRAG / INERTIA ──
  function pointerAngle(e) {
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  }

  function inertiaLoop() {
    if (dragging) { inertiaRaf = null; return; }
    if (Math.abs(velocity) > 0.05) {
      theta += velocity;
      velocity *= 0.95;
      applyWheel();
      checkRotationEffects();
      inertiaRaf = requestAnimationFrame(inertiaLoop);
    } else {
      inertiaRaf = null;
    }
  }

  function isDragSurface(target) {
    // chips/links should still receive clicks normally
    return !target.closest('a');
  }

  if (stage) {
    stage.addEventListener('pointerdown', (e) => {
      if (isMobileLayout()) return;
      if (!isDragSurface(e.target)) return;
      dragging = true;
      dragMoved = 0;
      velocity = 0;
      lastPointerAngle = pointerAngle(e);
      lastTickTheta = theta; // reset tick reference so first whoosh fires after a full slot
      ensureAudio();         // first-gesture audio init (browser policy)
      stage.classList.add('dragging');
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    stage.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const a = pointerAngle(e);
      let delta = a - lastPointerAngle;
      if (delta > 180) delta -= 360;
      else if (delta < -180) delta += 360;
      theta += delta;
      velocity = delta * 0.6;
      dragMoved += Math.abs(delta);
      if (dragMoved > 3 && spinHint && !spinHint.classList.contains('dismissed')) {
        spinHint.classList.add('dismissed');
      }
      lastPointerAngle = a;
      applyWheel();
      checkRotationEffects();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('dragging');
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
      if (Math.abs(velocity) > 0.05 && !inertiaRaf) {
        inertiaRaf = requestAnimationFrame(inertiaLoop);
      }
    }
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
  }

  // ── SUBTLE PARALLAX (skipped while dragging) ──
  const svg = document.querySelector('.flywheel-svg');
  const center = document.querySelector('.hub-center');
  if (stage && svg && !reducedMotion) {
    let raf = null;
    let tx = 0, ty = 0, targetX = 0, targetY = 0;
    const max = 10;

    const onMove = (e) => {
      if (isMobileLayout() || dragging) return;
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      targetX = dx * max;
      targetY = dy * max;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      tx += (targetX - tx) * 0.08;
      ty += (targetY - ty) * 0.08;
      svg.style.transform = `translate(calc(-50% + ${tx.toFixed(2)}px), calc(-50% + ${ty.toFixed(2)}px))`;
      if (center) {
        center.style.transform = `translate(${(tx * 0.4).toFixed(2)}px, ${(ty * 0.4).toFixed(2)}px)`;
      }
      if (Math.abs(targetX - tx) > 0.05 || Math.abs(targetY - ty) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
  }

  // ── 3D card tilt on hover (skipped while dragging) ──
  if (hasHover && !reducedMotion) {
    cards.forEach((card) => {
      const inner = card.querySelector('.category-inner');
      if (!inner) return;
      let raf = null;
      let targetX = 0, targetY = 0, curX = 0, curY = 0;
      const max = 10;

      const apply = () => {
        curX += (targetX - curX) * 0.15;
        curY += (targetY - curY) * 0.15;
        inner.style.transform = `rotateX(${curY.toFixed(2)}deg) rotateY(${curX.toFixed(2)}deg) translateZ(6px)`;
        if (Math.abs(targetX - curX) > 0.05 || Math.abs(targetY - curY) > 0.05) {
          raf = requestAnimationFrame(apply);
        } else {
          raf = null;
        }
      };

      card.addEventListener('mousemove', (e) => {
        if (dragging || isMobileLayout()) return;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        targetX =  x * max;
        targetY = -y * max;
        if (!raf) raf = requestAnimationFrame(apply);
      });

      card.addEventListener('mouseleave', () => {
        targetX = 0; targetY = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      });
    });
  }

  // chip ripple
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.animate(
        [
          { transform: 'translateY(-2px) scale(1)' },
          { transform: 'translateY(-2px) scale(1.06)' },
          { transform: 'translateY(-2px) scale(1)' },
        ],
        { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    });
  });
})();
