(function () {
  // current year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile      = window.matchMedia('(max-width: 760px)').matches;
  const hasHover      = window.matchMedia('(hover: hover)').matches;

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

  // subtle parallax: nudge the SVG wheel toward the cursor
  const stage = document.querySelector('.flywheel-stage');
  const svg = document.querySelector('.flywheel-svg');
  const center = document.querySelector('.hub-center');
  if (stage && svg && !isMobile && !reducedMotion) {
    let raf = null;
    let tx = 0, ty = 0, targetX = 0, targetY = 0;
    const max = 12;

    const onMove = (e) => {
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

  // 3D card tilt on hover
  if (hasHover && !isMobile && !reducedMotion) {
    document.querySelectorAll('.category').forEach((card) => {
      const inner = card.querySelector('.category-inner');
      if (!inner) return;
      let raf = null;
      let targetX = 0, targetY = 0;
      let curX = 0, curY = 0;
      const max = 10;

      const apply = () => {
        curX += (targetX - curX) * 0.15;
        curY += (targetY - curY) * 0.15;
        inner.style.transform =
          `rotateX(${curY.toFixed(2)}deg) rotateY(${curX.toFixed(2)}deg) translateZ(6px)`;
        if (Math.abs(targetX - curX) > 0.05 || Math.abs(targetY - curY) > 0.05) {
          raf = requestAnimationFrame(apply);
        } else {
          raf = null;
        }
      };

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        targetX =  x * max;
        targetY = -y * max;
        if (!raf) raf = requestAnimationFrame(apply);
      });

      card.addEventListener('mouseleave', () => {
        targetX = 0;
        targetY = 0;
        if (!raf) raf = requestAnimationFrame(apply);
      });
    });
  }

  // chip ripple — quick scale on click before the new tab opens
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
