import { GenesisRenderer } from './renderer.js';

const PHI = 1.618033988749895;
const PHI_INV = PHI - 1;

const SPEEDS = [1.0, Math.pow(PHI_INV, 0.5), PHI_INV, Math.pow(PHI_INV, 1.5), PHI_INV * PHI_INV];

// ── Genesis vantage presets ────────────────────────────────────────────────
// Each preset jumps the simulation to a specific τ and moves the camera to the
// best position to observe that algebraic event.
const GENESIS_PRESETS = [
  {
    id: 'spark',
    name: 'The Nilpotent Spark  τ=0',
    category: 'Core Evolution',
    hotkey: '1',
    tau: 0.05,
    camera: { theta: 0.3, phi: Math.PI / 3.5, distance: 5, fov: 80 },
    desc: 'N²=0 — the one-time crossing. A kernel vector enters the spinorial space. Non-repeatable, volume-preserving, exactly reversible. Everything follows from this single event.'
  },
  {
    id: 'prebreak',
    name: 'Pre-Break Symmetry  τ≈2.2',
    category: 'Core Evolution',
    hotkey: '2',
    tau: 2.2,
    camera: { theta: Math.PI / 2.4, phi: Math.PI / 2.2, distance: 12, fov: 66 },
    desc: 'Before boost cancellation completes: spacetime bivectors (e14,e24,e34) are still active. The field retains near-SO(4) character.'
  },
  {
    id: 'grades',
    name: 'Grade Wavefronts  τ=5',
    category: 'Core Evolution',
    hotkey: '3',
    tau: 5.0,
    camera: { theta: 0.4, phi: Math.PI / 3, distance: 20, fov: 55 },
    desc: 'Five grade shells expanding at c·φ⁻ᵏ/² — Grace eigenvalue speeds. Red (scalar, c) leads; purple (pseudoscalar, 0.382c) trails. The separation IS the algebra.'
  },
  {
    id: 'bifurcation',
    name: 'SO(4) → SO(3)  τ=2.6',
    category: 'Core Evolution',
    hotkey: '4',
    tau: 3.2,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.1, distance: 11, fov: 68 },
    desc: 'Boost cancellation T8: c_k=g_k+g₃ and w_k=g_k−g₃ have opposite timelike signs. Their Lorentz boost bivectors cancel. Spatial SO(3) rotations survive. 3D space locks in.'
  },
  {
    id: 'postbreak',
    name: 'Post-Break Lock-In  τ≈4.0',
    category: 'Core Evolution',
    hotkey: '5',
    tau: 4.0,
    camera: { theta: Math.PI / 2.8, phi: Math.PI / 2.4, distance: 10, fov: 72 },
    desc: 'After cancellation: spatial bivectors dominate and toroidal coherence stabilizes. This is the 3D rotation regime.'
  },
  {
    id: 'shell2',
    name: 'Shell n=2  τ≈5',
    category: 'Magic Shells',
    hotkey: '6',
    tau: 5.5,
    camera: { theta: 0.5, phi: Math.PI / 2.5, distance: 7, fov: 70 },
    desc: 'First L·S shell closure (T15). The angular momentum generator L_k mixes trivector eigenspaces. The innermost stable configuration: 2 particles. The first magic number.'
  },
  {
    id: 'shell8',
    name: 'Shell n=8  τ≈7',
    category: 'Magic Shells',
    hotkey: '7',
    tau: 7.0,
    camera: { theta: 0.45, phi: Math.PI / 2.7, distance: 8, fov: 68 },
    desc: 'Second shell closure. Standing wave ring corresponding to magic number 8.'
  },
  {
    id: 'shell20',
    name: 'Shell n=20  τ≈9',
    category: 'Magic Shells',
    hotkey: '8',
    tau: 9.0,
    camera: { theta: 0.4, phi: Math.PI / 2.8, distance: 10, fov: 64 },
    desc: 'Third closure at 20 — the first broad stable shell.'
  },
  {
    id: 'shell28',
    name: 'Shell n=28  τ≈11',
    category: 'Magic Shells',
    hotkey: '9',
    tau: 11.0,
    camera: { theta: 0.35, phi: Math.PI / 2.9, distance: 12, fov: 60 },
    desc: 'Fourth closure at 28 — compact high-coherence shell.'
  },
  {
    id: 'shell50',
    name: 'Shell n=50  τ≈13',
    category: 'Magic Shells',
    hotkey: '!',
    tau: 13.0,
    camera: { theta: 0.33, phi: Math.PI / 3.0, distance: 15, fov: 58 },
    desc: 'Fifth closure at 50 — extended ring with robust L·S stability.'
  },
  {
    id: 'shell82',
    name: 'Shell n=82  τ≈15',
    category: 'Magic Shells',
    hotkey: '@',
    tau: 15.0,
    camera: { theta: 0.32, phi: Math.PI / 3.1, distance: 19, fov: 55 },
    desc: 'Sixth closure at 82 — high-radius stable shell.'
  },
  {
    id: 'shell126',
    name: 'Shell n=126  τ≈18',
    category: 'Magic Shells',
    hotkey: '#',
    tau: 18.0,
    camera: { theta: 0.31, phi: Math.PI / 3.2, distance: 24, fov: 52 },
    desc: 'Seventh closure at 126 — outermost classic magic-number shell.'
  },
  {
    id: 'boson',
    name: 'Boson Pairing  τ≈8',
    category: 'Composites',
    hotkey: '$',
    tau: 8.0,
    camera: { theta: 0.4, phi: Math.PI / 3.2, distance: 8, fov: 72 },
    desc: 'T17: (P⊗P)²=+4(P⊗P). Where grade 0 (scalar) and grade 2 (bivector) both activate, their tensor product is bosonic: (−1)×(−1)=+1. Gold regions are composite bosons.'
  },
  {
    id: 'bivector',
    name: 'Bivector Dominance  τ≈10',
    category: 'Composites',
    hotkey: '%',
    tau: 10.0,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.25, distance: 9, fov: 74 },
    desc: 'Best view of rotation-plane interference (grade 2). The toroidal knot is most visible from this edge-on orientation.'
  },
  {
    id: 'trivector',
    name: 'Trivector Dominance  τ≈12',
    category: 'Composites',
    hotkey: '^',
    tau: 12.0,
    camera: { theta: 0.95, phi: Math.PI / 2.9, distance: 8, fov: 78 },
    desc: 'Best view of volume-form emergence (grade 3) and L·S-induced mixing.'
  },
  {
    id: 'cascade',
    name: 'Magic Number Cascade  τ≈15',
    category: 'Overview',
    hotkey: '&',
    tau: 15.0,
    camera: { theta: 0.3, phi: Math.PI / 3.8, distance: 26, fov: 52 },
    desc: 'All 7 nuclear shell closures {2,8,20,28,50,82,126} visible simultaneously. Each ring is a stable L·S quantized configuration. These are the exact nuclear magic numbers.'
  },
  {
    id: 'torus',
    name: 'Toroidal Steady State  τ≈40',
    category: 'Overview',
    hotkey: '*',
    tau: 40.0,
    camera: { theta: 0.3, phi: Math.PI / 3.5, distance: 22, fov: 58 },
    desc: 'The emergent geometry. No torus was imposed — it arose from three incompatible bivector decompositions [R_i,R_j]≠0 (T18, quantum non-commutativity from null geometry).'
  },
  {
    id: 'witness',
    name: 'Grace Core  τ≈20',
    category: 'Overview',
    hotkey: '(',
    tau: 20.0,
    camera: { theta: 0.2, phi: Math.PI / 3.5, distance: 4, fov: 90 },
    desc: 'The coherent core: scalar + φ⁻¹·pseudoscalar. The Grace operator projects here — the only grades that survive indefinitely. This is what zeros of ζ(s) must converge to: σ=½.'
  },
  {
    id: 'late',
    name: 'Late-Time Stable Universe  τ≈60',
    category: 'Overview',
    hotkey: ')',
    tau: 60.0,
    camera: { theta: 0.35, phi: Math.PI / 3.4, distance: 28, fov: 50 },
    desc: 'Long-run attractor regime: shell structure persists, boost modes suppressed, Grace core stabilized.'
  }
];

let renderer = null;

async function init() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  try {
    renderer = new GenesisRenderer(canvas);
    await renderer.initialize();
    wireUI();
    renderer.start();
  } catch (err) {
    console.error('Genesis init failed:', err);
    document.body.innerHTML = `<pre style="color:#ff4444;padding:20px;font-family:monospace;">${err.message}\n\n${err.stack || ''}</pre>`;
  }
}

function wireUI() {
  // ── Vantage preset dropdown ────────────────────────────────────────────
  const presetSelect = document.getElementById('preset-select');
  const presetDesc   = document.getElementById('preset-desc');
  let resumeTimer = null;

  const applyPreset = (p) => {
    if (!p) return;

    if (resumeTimer) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }

    // Pause, jump to time, animate camera
    const wasRunning = renderer.isRunning;
    renderer.stop();
    renderer.setTime(p.tau);
    renderer.camera.goToPreset(p.camera, 900);

    // Show description
    if (presetDesc) presetDesc.textContent = p.desc;
    if (presetSelect) presetSelect.value = p.id;

    // Resume after camera settles
    if (wasRunning) {
      resumeTimer = setTimeout(() => {
        renderer.start();
        resumeTimer = null;
      }, 950);
    }
  };

  if (presetSelect) {
    const byCategory = new Map();
    for (const p of GENESIS_PRESETS) {
      if (!byCategory.has(p.category)) byCategory.set(p.category, []);
      byCategory.get(p.category).push(p);
    }
    for (const [cat, presets] of byCategory.entries()) {
      const group = document.createElement('optgroup');
      group.label = cat;
      for (const p of presets) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.hotkey ? `[${p.hotkey}] ${p.name}` : p.name;
        group.appendChild(opt);
      }
      presetSelect.appendChild(group);
    }

    presetSelect.addEventListener('change', () => {
      const p = GENESIS_PRESETS.find(x => x.id === presetSelect.value);
      applyPreset(p);
    });
  }

  // ── Time / playback controls ───────────────────────────────────────────
  const timeSlider = document.getElementById('time-slider');
  const timeValue  = document.getElementById('time-value');
  const btnPlay    = document.getElementById('btn-playpause');
  const btnReset   = document.getElementById('btn-reset');
  const btnSlower  = document.getElementById('btn-slower');
  const btnFaster  = document.getElementById('btn-faster');
  const speedLabel = document.getElementById('val-speed');
  const coherence  = document.getElementById('val-coherence');
  const gradeBar   = document.getElementById('grade-bar');
  const wfEls      = [0,1,2,3,4].map(i => document.getElementById('wf-' + i));

  let scrubbing = false;

  renderer.onTimeUpdate(t => {
    if (!scrubbing && timeSlider) {
      timeSlider.value = t;
      timeSlider.max = Math.max(100, t + 20);
    }
    if (timeValue) timeValue.textContent = t.toFixed(3);

    // Update wavefront radii
    for (let k = 0; k < 5; k++) {
      const wfR = SPEEDS[k] * t;
      if (wfEls[k]) wfEls[k].textContent = wfR.toFixed(2);
    }

    // Approximate grade weights at camera distance for the bar
    const camR = Math.sqrt(
      renderer.camera.position[0] ** 2 +
      renderer.camera.position[1] ** 2 +
      renderer.camera.position[2] ** 2
    );
    const viewR = camR * 0.3;
    const graces = [1.0, PHI_INV, PHI_INV**2, PHI_INV**3, PHI_INV**4];
    let weights = [];
    let totalW = 0;
    for (let k = 0; k < 5; k++) {
      const wfR = SPEEDS[k] * t;
      const behind = wfR - viewR;
      const width = Math.max(0.4, wfR * 0.25);
      let a = smoothstepJS(-width * 0.3, width, behind) * graces[k];
      a /= (1.0 + viewR * 0.15);
      weights.push(Math.max(a, 0));
      totalW += Math.max(a, 0);
    }

    if (gradeBar && totalW > 0.001) {
      const bars = gradeBar.children;
      for (let k = 0; k < 5; k++) {
        bars[k].style.flex = (weights[k] / totalW).toFixed(4);
      }
    }

    if (coherence) {
      const coh = totalW > 0 ? (weights[0] + PHI_INV * weights[4]) / totalW : 0;
      coherence.textContent = coh.toFixed(3);
    }
  });

  if (timeSlider) {
    timeSlider.addEventListener('mousedown', () => { scrubbing = true; });
    timeSlider.addEventListener('touchstart', () => { scrubbing = true; });
    timeSlider.addEventListener('input', () => {
      renderer.setTime(parseFloat(timeSlider.value));
    });
    timeSlider.addEventListener('mouseup', () => { scrubbing = false; });
    timeSlider.addEventListener('touchend', () => { scrubbing = false; });
  }

  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (renderer.isRunning) {
        renderer.stop();
        btnPlay.textContent = 'Paused';
        btnPlay.classList.remove('active');
      } else {
        renderer.start();
        btnPlay.textContent = 'Playing';
        btnPlay.classList.add('active');
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      renderer.reset();
      if (!renderer.isRunning) renderer.render();
    });
  }

  if (btnSlower) {
    btnSlower.addEventListener('click', () => {
      renderer.speed = Math.max(0.1, renderer.speed * 0.7);
      if (speedLabel) speedLabel.textContent = renderer.speed.toFixed(1) + '\u00d7';
    });
  }

  if (btnFaster) {
    btnFaster.addEventListener('click', () => {
      renderer.speed = Math.min(10, renderer.speed * 1.4);
      if (speedLabel) speedLabel.textContent = renderer.speed.toFixed(1) + '\u00d7';
    });
  }

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === ' ') {
      e.preventDefault();
      btnPlay?.click();
    }
    if (e.key === 'r' || e.key === 'R') {
      btnReset?.click();
    }
    const preset = GENESIS_PRESETS.find(p => p.hotkey === e.key);
    if (preset) {
      if (preset) applyPreset(preset);
    }
  });
}

function smoothstepJS(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
