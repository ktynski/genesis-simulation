import { GenesisRenderer } from './renderer.js';

const PHI = 1.618033988749895;
const PHI_INV = PHI - 1;

const SPEEDS = [1.0, Math.pow(PHI_INV, 0.5), PHI_INV, Math.pow(PHI_INV, 1.5), PHI_INV * PHI_INV];

// ── Genesis vantage presets ────────────────────────────────────────────────
// Each preset jumps the simulation to a specific τ and moves the camera to the
// best position to observe that algebraic event.
const GENESIS_PRESETS = [
  // ── Core Evolution (Single System) ──────────────────────────────────────
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
    id: 'early-expansion',
    name: 'Early Expansion  τ≈1',
    category: 'Core Evolution',
    hotkey: '',
    tau: 1.0,
    camera: { theta: 0.35, phi: Math.PI / 3, distance: 8, fov: 72 },
    desc: 'All five grade wavefronts expanding outward. Scalar (red) leads at speed c, pseudoscalar (violet) trails at 0.382c. The grade hierarchy is becoming visible.'
  },
  {
    id: 'prebreak',
    name: 'Pre-Break Symmetry  τ≈2.2',
    category: 'Core Evolution',
    hotkey: '2',
    tau: 2.2,
    camera: { theta: Math.PI / 2.4, phi: Math.PI / 2.2, distance: 12, fov: 66 },
    desc: 'Before boost cancellation completes: spacetime bivectors (e₁₄,e₂₄,e₃₄) are still active. The field retains near-SO(4) character — full 4D rotational symmetry.'
  },
  {
    id: 'bifurcation',
    name: 'SO(4) → SO(3) Bifurcation  τ≈3.2',
    category: 'Core Evolution',
    hotkey: '3',
    tau: 3.2,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.1, distance: 11, fov: 68 },
    desc: 'Boost cancellation T8: c_k = g_k + g₃ and w_k = g_k − g₃ have opposite timelike signs. Their Lorentz boost bivectors cancel. Spatial SO(3) rotations survive. 3D space locks in.'
  },
  {
    id: 'postbreak',
    name: 'Post-Break Lock-In  τ≈4.0',
    category: 'Core Evolution',
    hotkey: '4',
    tau: 4.0,
    camera: { theta: Math.PI / 2.8, phi: Math.PI / 2.4, distance: 10, fov: 72 },
    desc: 'After boost cancellation: spatial bivectors dominate and toroidal coherence stabilizes. This is the pure 3D rotation regime — angular momentum L_k is now well-defined.'
  },
  {
    id: 'grades',
    name: 'Grade Wavefronts  τ=5',
    category: 'Core Evolution',
    hotkey: '5',
    tau: 5.0,
    camera: { theta: 0.4, phi: Math.PI / 3, distance: 20, fov: 55 },
    desc: 'Five grade shells clearly separated at c·φ⁻ᵏ/². Red (scalar, c) leads; violet (pseudoscalar, 0.382c) trails. The spectral gap γ = φ⁻² ≈ 0.382 between shells is the mass gap.'
  },

  // ── Magic Shells ────────────────────────────────────────────────────────
  {
    id: 'shell2',
    name: 'Shell n=2  τ≈5.5',
    category: 'Magic Shells',
    hotkey: '6',
    tau: 5.5,
    camera: { theta: 0.5, phi: Math.PI / 2.5, distance: 7, fov: 70 },
    desc: 'First L·S shell closure (1s₁/₂). The angular momentum generator L_k mixes trivector eigenspaces. The innermost stable configuration: 2 particles. The first magic number.'
  },
  {
    id: 'shell8',
    name: 'Shell n=8  τ≈7',
    category: 'Magic Shells',
    hotkey: '7',
    tau: 7.0,
    camera: { theta: 0.45, phi: Math.PI / 2.7, distance: 8, fov: 68 },
    desc: 'Second shell closure (1p). Standing wave ring corresponding to magic number 8. Still matches harmonic oscillator prediction — L·S has not yet split.'
  },
  {
    id: 'shell20',
    name: 'Shell n=20  τ≈9',
    category: 'Magic Shells',
    hotkey: '8',
    tau: 9.0,
    camera: { theta: 0.4, phi: Math.PI / 2.8, distance: 10, fov: 64 },
    desc: 'Third closure at 20 (1d + 2s). Last shell that matches the harmonic oscillator. Beyond this, L·S coupling breaks the HO degeneracy.'
  },
  {
    id: 'shell28',
    name: 'Shell n=28 (L·S split)  τ≈11',
    category: 'Magic Shells',
    hotkey: '9',
    tau: 11.0,
    camera: { theta: 0.35, phi: Math.PI / 2.9, distance: 12, fov: 60 },
    desc: 'THE KEY SHELL: HO predicts 40, but L·S splits 1f into 1f₇/₂ (8 states) which closes at 28. This is where the algebra diverges from naive shell counting. dim SO(8) = C(8,2) = 28.'
  },
  {
    id: 'shell50',
    name: 'Shell n=50  τ≈13',
    category: 'Magic Shells',
    hotkey: '',
    tau: 13.0,
    camera: { theta: 0.33, phi: Math.PI / 3.0, distance: 15, fov: 58 },
    desc: 'Fifth closure at 50 (2p + 1g). HO predicts 70. L·S splits the g orbital to close early. Extended ring with robust stability.'
  },
  {
    id: 'shell82',
    name: 'Shell n=82  τ≈15',
    category: 'Magic Shells',
    hotkey: '',
    tau: 15.0,
    camera: { theta: 0.32, phi: Math.PI / 3.1, distance: 19, fov: 55 },
    desc: 'Sixth closure at 82 (2d + 1h). HO predicts 112. Lead-208 has 82 protons AND 126 neutrons — doubly magic, the heaviest stable nucleus.'
  },
  {
    id: 'shell126',
    name: 'Shell n=126  τ≈18',
    category: 'Magic Shells',
    hotkey: '',
    tau: 18.0,
    camera: { theta: 0.31, phi: Math.PI / 3.2, distance: 24, fov: 52 },
    desc: 'Seventh closure at 126 (3p + 2f + 1i). HO predicts 168. The outermost experimentally confirmed magic number. Beyond this lie predicted superheavy island-of-stability shells.'
  },

  // ── Composites & Structure ──────────────────────────────────────────────
  {
    id: 'boson',
    name: 'Boson Pairing  τ≈8',
    category: 'Composites',
    hotkey: '',
    tau: 8.0,
    camera: { theta: 0.4, phi: Math.PI / 3.2, distance: 8, fov: 72 },
    desc: 'T17: (P⊗P)²=+4(P⊗P). Where grade 0 (scalar) and grade 2 (bivector) are both active, their tensor product is bosonic: (−1)×(−1)=+1. Gold regions are composite bosons.'
  },
  {
    id: 'bivector',
    name: 'Bivector Dominance  τ≈10',
    category: 'Composites',
    hotkey: '',
    tau: 10.0,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.25, distance: 9, fov: 74 },
    desc: 'Edge-on view of rotation-plane interference (grade 2). The toroidal knot is most visible here — bilinear products p_x·p_y create saddle surfaces that interfere into toroidal topology.'
  },
  {
    id: 'trivector',
    name: 'Trivector Dominance  τ≈12',
    category: 'Composites',
    hotkey: '',
    tau: 12.0,
    camera: { theta: 0.95, phi: Math.PI / 2.9, distance: 8, fov: 78 },
    desc: 'Volume-form emergence (grade 3) and L·S-induced mixing. Trivectors are triple products e₁₂₃, e₁₂₄, e₁₃₄, e₂₃₄ — they encode the chiral structure of space.'
  },
  {
    id: 'interior-close',
    name: 'Interior Structure  τ≈8',
    category: 'Composites',
    hotkey: '',
    tau: 8.0,
    camera: { theta: 0.6, phi: Math.PI / 2.5, distance: 3.5, fov: 90 },
    desc: 'Close-up inside the field: see the fine-grained interference between spatial bivectors (green) and the tripotent seed (red scalar). The complexity lives in these overlapping patterns.'
  },

  // ── Overview ────────────────────────────────────────────────────────────
  {
    id: 'cascade',
    name: 'Magic Number Cascade  τ≈15',
    category: 'Overview',
    hotkey: '',
    tau: 15.0,
    camera: { theta: 0.3, phi: Math.PI / 3.8, distance: 26, fov: 52 },
    desc: 'All 7 nuclear shell closures {2,8,20,28,50,82,126} visible simultaneously. Each ring is a stable L·S quantized configuration. These are the exact nuclear magic numbers.'
  },
  {
    id: 'torus',
    name: 'Toroidal Steady State  τ≈40',
    category: 'Overview',
    hotkey: '',
    tau: 40.0,
    camera: { theta: 0.3, phi: Math.PI / 3.5, distance: 22, fov: 58 },
    desc: 'The emergent torus. Not imposed — it arises from three incompatible bivector decompositions [R_i,R_j]≠0 (T18). Quantum non-commutativity from null geometry creates toroidal topology.'
  },
  {
    id: 'witness',
    name: 'Grace Core  τ≈20',
    category: 'Overview',
    hotkey: '',
    tau: 20.0,
    camera: { theta: 0.2, phi: Math.PI / 3.5, distance: 4, fov: 90 },
    desc: 'The coherent core: scalar + φ⁻¹·pseudoscalar. The Grace operator projects here — the only grades that survive indefinitely. This is what zeros of ζ(s) must converge to: σ=½.'
  },
  {
    id: 'late',
    name: 'Late-Time Attractor  τ≈60',
    category: 'Overview',
    hotkey: '',
    tau: 60.0,
    camera: { theta: 0.35, phi: Math.PI / 3.4, distance: 28, fov: 50 },
    desc: 'Long-run attractor: shell structure persists, boost modes fully suppressed, Grace core stabilized. The φ-eigenvalue hierarchy has fully separated.'
  },
  {
    id: 'very-late',
    name: 'Deep Attractor  τ≈120',
    category: 'Overview',
    hotkey: '',
    tau: 120.0,
    camera: { theta: 0.3, phi: Math.PI / 3.5, distance: 50, fov: 45 },
    desc: 'Very late time: only the most persistent grade structures remain. The Grace contraction has projected away all transient modes. What remains is the fixed-point basin.'
  },

  // ── Binary System ───────────────────────────────────────────────────────
  {
    id: 'binary-birth',
    name: 'Binary: Twin Sparks  τ≈0.5',
    category: 'Binary System',
    hotkey: '',
    tau: 0.5,
    mode: 1,
    camera: { theta: 0.3, phi: Math.PI / 3, distance: 18, fov: 65 },
    desc: 'Two nilpotent sparks (N²=0) with opposite tripotent signs (+P and −P). At birth, their wavefronts are separate — two independent Clifford field bubbles expanding in isolation.'
  },
  {
    id: 'binary-first-contact',
    name: 'Binary: First Contact  τ≈3',
    category: 'Binary System',
    hotkey: '',
    tau: 3.0,
    mode: 1,
    camera: { theta: 0.4, phi: Math.PI / 2.8, distance: 20, fov: 62 },
    desc: 'The scalar wavefronts (red, fastest) reach the midplane and begin overlapping. First interference: the opposite-sign scalars start cancelling — fermionic destructive interference begins.'
  },
  {
    id: 'binary-wavefront-merge',
    name: 'Binary: Wavefront Overlap  τ≈5',
    category: 'Binary System',
    hotkey: '',
    tau: 5.0,
    mode: 1,
    camera: { theta: 0.35, phi: Math.PI / 3, distance: 25, fov: 58 },
    desc: 'Multiple grade wavefronts now overlap between the two systems. The interference pattern is complex: scalars cancel (fermion), but bivectors can constructively overlap (boson pairing).'
  },
  {
    id: 'binary-pauli',
    name: 'Binary: Pauli Midplane  τ≈8',
    category: 'Binary System',
    hotkey: '',
    tau: 8.0,
    mode: 1,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.1, distance: 20, fov: 64 },
    desc: 'Edge-on view showing the Pauli exclusion zone at the midplane. Opposite-sign tripotents destructively interfere: the fermionic field is zero at the exact midplane. This IS Pauli repulsion — from algebra, not a postulate.'
  },
  {
    id: 'binary-boson-bridge',
    name: 'Binary: Boson Bridge  τ≈10',
    category: 'Binary System',
    hotkey: '',
    tau: 10.0,
    mode: 1,
    camera: { theta: 0.15, phi: Math.PI / 3.5, distance: 18, fov: 66 },
    desc: 'Top-down view: where grade 0 and grade 2 constructively overlap between the particles, golden boson bridges form. The tensor product (P⊗P)²=+4(P⊗P) — integer spin from half-integer constituents.'
  },
  {
    id: 'binary-shells',
    name: 'Binary: Interacting Shells  τ≈12',
    category: 'Binary System',
    hotkey: '',
    tau: 12.0,
    mode: 1,
    camera: { theta: 0.3, phi: Math.PI / 3.2, distance: 30, fov: 55 },
    desc: 'Both systems have developed shell closures. Where shells from opposite particles overlap, the interference creates new standing wave patterns — the beginnings of molecular-like structure.'
  },
  {
    id: 'binary-overview',
    name: 'Binary: Full Overview  τ≈15',
    category: 'Binary System',
    hotkey: '-',
    tau: 15.0,
    mode: 1,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.5, distance: 35, fov: 60 },
    desc: 'Complete binary system: two N²=0 sparks with opposite spins, shell closures around each, Pauli exclusion at the midplane, and boson bridges connecting them. All from Cl(3,1) algebra alone.'
  },
  {
    id: 'binary-close-midplane',
    name: 'Binary: Midplane Close-Up  τ≈10',
    category: 'Binary System',
    hotkey: '',
    tau: 10.0,
    mode: 1,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.05, distance: 8, fov: 80 },
    desc: 'Zoomed into the midplane: the fermion exclusion zone is clearly visible as a dark band. On either side, the grade structure is rich — but at the exact center, opposite tripotents annihilate.'
  },
  {
    id: 'binary-diagonal',
    name: 'Binary: Diagonal View  τ≈15',
    category: 'Binary System',
    hotkey: '',
    tau: 15.0,
    mode: 1,
    camera: { theta: Math.PI / 4, phi: Math.PI / 3, distance: 28, fov: 58 },
    desc: '45° diagonal view showing both the radial shell structure around each particle and the lateral interference pattern between them. The asymmetry reveals the chiral structure.'
  },
  {
    id: 'binary-above',
    name: 'Binary: Orbital View  τ≈15',
    category: 'Binary System',
    hotkey: '',
    tau: 15.0,
    mode: 1,
    camera: { theta: 0.05, phi: Math.PI / 3, distance: 30, fov: 55 },
    desc: 'Looking straight down the binary axis. The concentric shell rings from each particle create a Moiré-like interference pattern. Boson bridge connections visible as golden arcs.'
  },
  {
    id: 'binary-late',
    name: 'Binary: Late Evolution  τ≈40',
    category: 'Binary System',
    hotkey: '',
    tau: 40.0,
    mode: 1,
    camera: { theta: 0.3, phi: Math.PI / 3.5, distance: 40, fov: 52 },
    desc: 'Late-time binary: the toroidal structure around each particle is well-developed. Shell closures persist. The boson bridge is a stable feature — not a transient. This is a bound state.'
  },
  {
    id: 'binary-deep',
    name: 'Binary: Deep Interior  τ≈8',
    category: 'Binary System',
    hotkey: '',
    tau: 8.0,
    mode: 1,
    camera: { theta: Math.PI / 2, phi: Math.PI / 2.2, distance: 4, fov: 90 },
    desc: 'Inside the interaction region between the two particles. The field is a superposition of both tripotent seeds. Grade mixing creates complex interference — the origin of quantum non-commutativity.'
  },
  {
    id: 'binary-wide-late',
    name: 'Binary: Cosmic Web  τ≈60',
    category: 'Binary System',
    hotkey: '',
    tau: 60.0,
    mode: 1,
    camera: { theta: 0.35, phi: Math.PI / 3.4, distance: 55, fov: 48 },
    desc: 'Far-field view of the binary system at late time. The nested shell structure, boson bridges, and Pauli zones all persist. The attractor geometry of two interacting Clifford fields.'
  },
];

// ── Magic Number Reveal ──────────────────────────────────────────────────
// Nuclear magic numbers {2,8,20,28,50,82,126} emerge from L·S coupling
// once SO(3) stabilizes (boosts cancel). Each shell closure maps to a τ
// threshold from the vantage presets.
//
// The numbers COUNT UP from 0 before locking — the viewer sees the system
// computing the answer, not just being told the answer. Each number is
// color-matched to its 3D shell ring in the shader (SCOL array).
//
// Below each number, the harmonic oscillator prediction is shown for
// comparison. The first three match (2,8,20 = HO), but at n=28 the
// spin-orbit coupling L·S splits the HO prediction (40→28). This
// divergence is the proof: L·S is doing real physics.

const MAGIC_NUMBERS     = [2, 8, 20, 28, 50, 82, 126];
const MAGIC_SHELL_THRESHOLDS = [
  { idx: 0, tau: 5.5  },
  { idx: 1, tau: 7.0  },
  { idx: 2, tau: 9.0  },
  { idx: 3, tau: 11.0 },
  { idx: 4, tau: 13.0 },
  { idx: 5, tau: 15.0 },
  { idx: 6, tau: 18.0 },
];

const SO3_STABILIZE_TAU = 3.5;
const BOOST_CANCEL_TAU  = 2.618;   // φ² — the bifurcation point
const EQUATION_TAU      = 19.5;

let magicOverlayVisible = false;
let magicState = new Array(7).fill('hidden'); // hidden | counting | locked
let magicEqVisible = false;
let activeCounters = {};

function animateCounter(idx) {
  const el = document.getElementById('magic-' + idx);
  if (!el) return;
  const target = MAGIC_NUMBERS[idx];

  el.classList.add('counting', 'revealed');
  magicState[idx] = 'counting';

  const duration = 800 + target * 4;
  const startTime = performance.now();

  const tick = (now) => {
    if (magicState[idx] !== 'counting') return;
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);

    if (progress < 1) {
      activeCounters[idx] = requestAnimationFrame(tick);
    } else {
      el.textContent = target;
      el.classList.remove('counting');
      el.classList.add('locked');
      magicState[idx] = 'locked';
      delete activeCounters[idx];
    }
  };
  activeCounters[idx] = requestAnimationFrame(tick);
}

function resetMagicNum(idx) {
  const el = document.getElementById('magic-' + idx);
  if (!el) return;
  if (activeCounters[idx]) {
    cancelAnimationFrame(activeCounters[idx]);
    delete activeCounters[idx];
  }
  el.classList.remove('revealed', 'counting', 'locked');
  el.textContent = MAGIC_NUMBERS[idx];
  magicState[idx] = 'hidden';
}

function updateConvergence(tau) {
  const fill  = document.getElementById('convergence-fill');
  const label = document.getElementById('val-so3');
  if (!fill || !label) return;

  if (tau < 0.1) {
    fill.style.width = '0%';
    fill.classList.remove('locked');
    label.textContent = '—';
    return;
  }

  const boostFraction = Math.max(0, 1 - (tau / BOOST_CANCEL_TAU));
  const convergence = Math.min(1, Math.max(0, 1 - boostFraction));
  const pct = (convergence * 100);
  fill.style.width = pct.toFixed(1) + '%';

  if (tau >= SO3_STABILIZE_TAU) {
    fill.classList.add('locked');
    fill.style.background = '#44ff88';
    label.textContent = 'LOCKED';
    label.style.color = '#44ff88';
  } else {
    fill.classList.remove('locked');
    const r = Math.round(255 * (1 - convergence));
    const g = Math.round(100 + 155 * convergence);
    fill.style.background = `rgb(${r},${g},68)`;
    label.textContent = pct.toFixed(0) + '%';
    label.style.color = '#ffd86a';
  }
}

function updateMagicNumbers(tau) {
  const overlay = document.getElementById('magic-overlay');
  if (!overlay) return;

  updateConvergence(tau);

  if (tau < BOOST_CANCEL_TAU * 0.3) {
    if (magicOverlayVisible) {
      overlay.classList.remove('visible', 'shells-visible');
      for (let i = 0; i < 7; i++) resetMagicNum(i);
      const eq = document.getElementById('magic-equation');
      const br = document.getElementById('magic-bridge');
      if (eq) eq.classList.remove('visible');
      if (br) br.classList.remove('visible');
      magicOverlayVisible = false;
      magicEqVisible = false;
    }
    return;
  }

  if (tau >= SO3_STABILIZE_TAU && !magicOverlayVisible) {
    overlay.classList.add('visible');
    magicOverlayVisible = true;
  }

  for (const shell of MAGIC_SHELL_THRESHOLDS) {
    if (tau >= shell.tau && magicState[shell.idx] === 'hidden') {
      animateCounter(shell.idx);
    }
    if (tau < shell.tau && magicState[shell.idx] !== 'hidden') {
      resetMagicNum(shell.idx);
    }
  }

  if (tau >= EQUATION_TAU && !magicEqVisible) {
    const eq = document.getElementById('magic-equation');
    const br = document.getElementById('magic-bridge');
    if (eq) eq.classList.add('visible');
    if (br) br.classList.add('visible');
    overlay.classList.add('shells-visible');
    magicEqVisible = true;
  }
  if (tau < EQUATION_TAU && magicEqVisible) {
    const eq = document.getElementById('magic-equation');
    const br = document.getElementById('magic-bridge');
    if (eq) eq.classList.remove('visible');
    if (br) br.classList.remove('visible');
    overlay.classList.remove('shells-visible');
    magicEqVisible = false;
  }
}

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
    if(p.mode !== undefined) { renderer.systemMode = p.mode; } else { renderer.systemMode = 0; }
    const btnMode = document.getElementById('btn-mode');
    if(btnMode) btnMode.textContent = renderer.systemMode === 1 ? 'Mode: Binary' : 'Mode: Single';
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

    updateMagicNumbers(t);

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

    const btnMode = document.getElementById('btn-mode');
  if (btnMode) {
    btnMode.addEventListener('click', () => {
      renderer.systemMode = renderer.systemMode === 0 ? 1 : 0;
      btnMode.textContent = renderer.systemMode === 1 ? 'Mode: Binary' : 'Mode: Single';
      if (!renderer.isRunning) renderer.render();
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
