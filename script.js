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
      line.style.animationDelay = (1.1 + (i / COUNT) * 0.8).toFixed(2) + 's';
      ticksGroup.appendChild(line);
    }
  }

  const stage = document.querySelector('.flywheel-stage');
  const userWheel = document.querySelector('.flywheel-svg .user-wheel');
  const cards = Array.from(document.querySelectorAll('.category'));
  const spinHint = document.querySelector('.spin-hint');
  const baseAngles = cards.map((c) => parseFloat(c.dataset.baseAngle) || 0);

  // ── ROTATION STATE ──
  let theta = 0;          // degrees
  let velocity = 0;       // degrees per frame
  let dragging = false;
  let inertiaRaf = null;
  let lastPointerAngle = 0;
  let dragMoved = 0;      // accumulated drag distance to know "real" drag

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
      inertiaRaf = requestAnimationFrame(inertiaLoop);
    } else {
      inertiaRaf = null;
    }
  }

  function isDragSurface(target) {
    // chips/links should still receive clicks normally
    return !target.closest('a');
  }

  function dismissHint() {
    if (spinHint && !spinHint.classList.contains('dismissed')) {
      spinHint.classList.add('dismissed');
    }
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
      if (dragMoved > 3) dismissHint();
      lastPointerAngle = a;
      applyWheel();
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
