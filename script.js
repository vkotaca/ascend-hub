(function () {
  // current year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileLayout = () => window.matchMedia('(max-width: 760px)').matches;
  const hasHover = window.matchMedia('(hover: hover)').matches;

  // ── WebGL AURORA ──
  (function setupAurora() {
    if (reducedMotion) return;
    const canvas = document.querySelector('.aurora-canvas');
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const VS = `
      attribute vec2 a_position;
      void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
    `;
    const FS = `
      precision mediump float;
      uniform float u_time;
      uniform vec2  u_resolution;

      // Ashima Arts simplex noise (compact GLSL implementation)
      vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
      vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
      float snoise(vec2 v){
        const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
        vec2 i=floor(v+dot(v,C.yy));
        vec2 x0=v-i+dot(i,C.xx);
        vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
        vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;
        i=mod289(i);
        vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
        vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
        m=m*m; m=m*m;
        vec3 x=2.0*fract(p*C.www)-1.0;
        vec3 h=abs(x)-0.5;
        vec3 ox=floor(x+0.5);
        vec3 a0=x-ox;
        m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
        vec3 g;
        g.x=a0.x*x0.x+h.x*x0.y;
        g.yz=a0.yz*x12.xz+h.yz*x12.yw;
        return 130.0*dot(m,g);
      }

      void main(){
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.05;

        // layered flowing noise — aurora ribbons
        float n = 0.0;
        n += 0.50 * snoise(p * 1.4 + vec2( t,        t * 0.3));
        n += 0.25 * snoise(p * 2.8 + vec2(-t * 1.2,  t * 0.8));
        n += 0.13 * snoise(p * 5.6 + vec2( t * 1.7, -t * 1.1));

        // shape into bright ribbons where noise is near zero crossings
        float bands = pow(1.0 - abs(n), 3.5);

        // radial vignette so the aurora pools toward the center
        float r = length(p);
        float vignette = smoothstep(1.4, 0.1, r);
        bands *= vignette;

        // gentle floor + ceiling
        bands = clamp(bands * 0.55, 0.0, 0.7);

        vec3 deep      = vec3(0.74, 0.12, 0.18);  // crimson
        vec3 highlight = vec3(1.00, 0.45, 0.55);  // pink
        vec3 col = mix(deep, highlight, smoothstep(0.18, 0.65, bands));

        gl_FragColor = vec4(col * bands, bands);
      }
    `;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('aurora shader:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1, -1,  1,
      -1,  1,  1, -1,  1,  1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes  = gl.getUniformLocation(prog, 'u_resolution');

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    const start = performance.now();
    let running = true;
    function frame() {
      if (!running) return;
      const elapsed = (performance.now() - start) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // pause when tab hidden (save battery)
    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });
  })();

  // ── AMBIENT DUST PARTICLES ──
  (function setupDust() {
    if (reducedMotion) return;
    const canvas = document.querySelector('.dust-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    let W = 0, H = 0;
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.scale(dpr, dpr);
    }
    resize();
    window.addEventListener('resize', () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resize();
    });

    const N = 48;
    const dust = [];
    for (let i = 0; i < N; i++) {
      dust.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * 0.10,
        vy: (Math.random() - 0.5) * 0.10 - 0.04,
        a: Math.random() * 0.5 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
      });
    }

    let running = true;
    function loop() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const now = performance.now() * 0.001;
      for (const d of dust) {
        d.x += d.vx;
        d.y += d.vy;
        // wrap around edges
        if (d.x < -10) d.x = W + 10;
        else if (d.x > W + 10) d.x = -10;
        if (d.y < -10) d.y = H + 10;
        else if (d.y > H + 10) d.y = -10;
        const flicker = 0.6 + 0.4 * Math.sin(now + d.twinkle);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(188, 30, 45, ${(d.a * flicker).toFixed(3)})`;
        ctx.shadowColor = 'rgba(188, 30, 45, 0.7)';
        ctx.shadowBlur = 6;
        ctx.fill();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(loop);
    });
  })();

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
  const lensFlareEl = document.querySelector('.lens-flare');
  let lastFlareTime = 0;
  const FLARE_COOLDOWN = 1400; // ms between flares — don't spam

  function triggerFastSpin() {
    document.body.classList.add('fast-spin');
    if (fastSpinTimer) clearTimeout(fastSpinTimer);
    fastSpinTimer = setTimeout(() => {
      document.body.classList.remove('fast-spin');
      fastSpinTimer = null;
    }, 600);

    // lens-flare burst
    const now = performance.now();
    if (lensFlareEl && (now - lastFlareTime) > FLARE_COOLDOWN && !reducedMotion) {
      lastFlareTime = now;
      lensFlareEl.classList.remove('fire');
      // force reflow so the animation restarts cleanly
      void lensFlareEl.offsetWidth;
      lensFlareEl.classList.add('fire');
    }
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
