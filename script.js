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
  let fastSpinTimer = null;
  const FAST_SPIN_THRESHOLD = 6.5; // deg per frame ≈ 1 rev / sec

  function getR() {
    if (!stage) return 280;
    const v = parseFloat(getComputedStyle(stage).getPropertyValue('--r'));
    return isFinite(v) ? v : 280;
  }

  // ── shared parallax + tilt state, used by both wheel rotation and cursor parallax
  let parX = 0, parY = 0;       // SVG/center translate offset
  let tiltX = 0, tiltY = 0;     // wheel tilt (deg) — rotateX, rotateY

  const svgEl = document.querySelector('.flywheel-svg');
  const centerEl = document.querySelector('.hub-center');

  function render() {
    if (!stage) return;
    if (isMobileLayout()) {
      cards.forEach((c) => { c.style.transform = ''; });
      if (userWheel) userWheel.style.transform = '';
      if (svgEl) svgEl.style.transform = '';
      if (centerEl) centerEl.style.transform = '';
      return;
    }
    const r = getR();
    const tilt = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    cards.forEach((card, i) => {
      const a = (baseAngles[i] + theta) * Math.PI / 180;
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      card.style.transform =
        `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px)) ${tilt}`;
    });
    if (svgEl) {
      svgEl.style.transform =
        `translate(calc(-50% + ${parX.toFixed(2)}px), calc(-50% + ${parY.toFixed(2)}px)) ${tilt}`;
    }
    if (centerEl) {
      centerEl.style.transform =
        `translate(${(parX * 0.4).toFixed(2)}px, ${(parY * 0.4).toFixed(2)}px) ${tilt}`;
    }
    if (userWheel) userWheel.style.transform = `rotate(${theta}deg)`;
  }

  // legacy alias (still called from drag/inertia handlers)
  const applyWheel = render;

  // initial paint after layout settles
  requestAnimationFrame(render);
  window.addEventListener('resize', render);

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

  // ── CURSOR PARALLAX + WHEEL TILT (skipped while dragging) ──
  if (stage && !reducedMotion) {
    let raf = null;
    let targetParX = 0, targetParY = 0;
    let targetTiltX = 0, targetTiltY = 0;
    const PAR_MAX = 8;     // SVG/center translate range
    const TILT_MAX = 11;   // wheel tilt in degrees

    const onMove = (e) => {
      if (isMobileLayout() || dragging) return;
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // -1..1 normalized cursor offset from center
      const ndx = Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2)));
      const ndy = Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2)));
      targetParX = ndx * PAR_MAX;
      targetParY = ndy * PAR_MAX;
      // tilt: cursor right -> wheel rotates around Y (right side moves away);
      //       cursor down -> wheel tilts forward toward viewer (negate)
      targetTiltY = ndx * TILT_MAX;
      targetTiltX = -ndy * TILT_MAX;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      parX  += (targetParX  - parX)  * 0.08;
      parY  += (targetParY  - parY)  * 0.08;
      tiltX += (targetTiltX - tiltX) * 0.08;
      tiltY += (targetTiltY - tiltY) * 0.08;
      render();
      const settled =
        Math.abs(targetParX  - parX)  < 0.05 &&
        Math.abs(targetParY  - parY)  < 0.05 &&
        Math.abs(targetTiltX - tiltX) < 0.05 &&
        Math.abs(targetTiltY - tiltY) < 0.05;
      raf = settled ? null : requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    // when the cursor leaves the window, ease the tilt back to neutral
    document.addEventListener('mouseleave', () => {
      targetParX = 0; targetParY = 0;
      targetTiltX = 0; targetTiltY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  // ── 3D card tilt on hover (skipped while dragging) ──
  if (hasHover && !reducedMotion) {
    cards.forEach((card) => {
      const inner = card.querySelector('.category-inner');
      if (!inner) return;
      let raf = null;
      let targetX = 0, targetY = 0, curX = 0, curY = 0;
      const max = 18;

      const apply = () => {
        curX += (targetX - curX) * 0.15;
        curY += (targetY - curY) * 0.15;
        inner.style.transform = `rotateX(${curY.toFixed(2)}deg) rotateY(${curX.toFixed(2)}deg) translateZ(16px)`;
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
