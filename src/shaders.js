export const vertexSource = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec3 vRayDir;
uniform mat4 uInvView;
uniform mat4 uInvProj;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  vec4 ndc = vec4(aPosition, 1.0, 1.0);
  vec4 vp  = uInvProj * ndc;
  vp /= vp.w;
  vec4 wd  = uInvView * vec4(vp.xyz, 0.0);
  vRayDir  = normalize(wd.xyz);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const fragmentSource = `#version 300 es
precision highp float;

in vec2 vUv;
in vec3 vRayDir;
out vec4 fragColor;

uniform vec3  uCamPos;
uniform float uTime;       // evolution time τ
uniform float uMaxDist;

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS — derived from Cl(3,1) and the golden ratio
// ═══════════════════════════════════════════════════════════════════════

const float PHI     = 1.618033988749;
const float PHI_INV = 0.618033988749;
const float PI      = 3.141592653589793;

// Grade propagation speeds: c_k = φ^(-k/2)
// Derived from Grace eigenvalues λ_k = φ^(-k), wave speed = √λ_k
const float SPEED_0 = 1.0;       // scalar:       c
const float SPEED_1 = 0.78615;   // vector:       φ^(-1/2)  ≈ 0.786
const float SPEED_2 = 0.61803;   // bivector:     φ^(-1)    ≈ 0.618
const float SPEED_3 = 0.48587;   // trivector:    φ^(-3/2)  ≈ 0.486
const float SPEED_4 = 0.38197;   // pseudoscalar: φ^(-2)    ≈ 0.382

// Grace damping weights: φ^(-k)
const float GRACE_0 = 1.0;
const float GRACE_1 = 0.61803;
const float GRACE_2 = 0.38197;
const float GRACE_3 = 0.23607;
const float GRACE_4 = 0.14590;

// Tripotent seed: P = w₁w₂ = -1 + e₁₂ - e₁₃ + e₂₃
// Scalar component = -1, bivector components = (1, -1, 1)
const float SEED_SCALAR = -1.0;
const vec3  SEED_BIVEC  = vec3(1.0, -1.0, 1.0);  // e₁₂, e₁₃, e₂₃

#define MAX_STEPS 160
#define SURF_DIST 0.001
#define NORMAL_EPS 0.003

// ═══════════════════════════════════════════════════════════════════════
// GRADE ACTIVATION — continuous, no discrete phases
//
// Each grade activates behind its own wavefront. The activation is a
// smooth function of (r, t) — no step functions, no switches.
// ═══════════════════════════════════════════════════════════════════════

float gradeActivation(float r, float t, float speed, float graceWeight) {
  float wavefrontR = speed * t;

  // How far behind the wavefront are we? Positive = inside.
  float behind = wavefrontR - r;

  // Smooth activation: rises over a width proportional to the wavefront radius.
  // This avoids artifacts and makes the transition physical (diffraction).
  // Make the width larger so the activation happens more gradually and isn't so abrupt.
  float width = max(0.8, wavefrontR * 0.4);
  
  // Make the activation much stronger and more immediate when t > 0
  float activation = smoothstep(-width * 0.5, width * 0.5, behind);

  // Grace damping: higher grades are weaker
  activation *= graceWeight;

  // 3D spreading: amplitude decays as 1/r (energy as 1/r²)
  // But don't decay too fast early on so we can see it
  activation /= (1.0 + r * 0.02);

  return activation;
}

// ═══════════════════════════════════════════════════════════════════════
// SPATIAL PATTERNS — one for each Clifford grade
//
// These are NOT imposed shapes. They are the spatial dependence of each
// grade's contribution to the field. The torus EMERGES from the bivector
// (grade 2) pattern — bilinear products of position components create
// saddle surfaces that interfere into toroidal topology.
// ═══════════════════════════════════════════════════════════════════════

float scalarPattern(vec3 p, float t) {
  // Isotropic multi-frequency resonance: φ, φ², and 1 wavelengths
  float r = length(p);
  float m1 = cos(r / PHI + t * 0.15);
  float m2 = cos(r / (PHI * PHI) + t * 0.09);
  float m3 = cos(r + t * 0.12);
  // φ-weighted combination
  return PHI_INV * m1 + PHI_INV * m2 * 0.5 + PHI_INV * m3 * 0.3;
}

float vectorPattern(vec3 p, float t) {
  // Directional modes — breaks spherical symmetry
  // Three incommensurable frequencies along three axes
  float v1 = sin(p.x / PHI + t * 0.13) * cos(p.y + t * 0.08);
  float v2 = sin(p.y / PHI + t * 0.11) * cos(p.z + t * 0.07);
  float v3 = sin(p.z / PHI + t * 0.09) * cos(p.x + t * 0.06);
  // The fourth component (timelike e₄) contributes phase
  float v4 = cos((p.x + p.y + p.z) * PHI_INV + t * 0.17);
  return (v1 + v2 + v3) * 0.25 + v4 * 0.15;
}

float bivectorPattern(vec3 p, float t) {
  // Bilinear products — rotation planes: e₁₂, e₁₃, e₁₄, e₂₃, e₂₄, e₃₄
  // These are the terms that create toroidal geometry.
  // p.x*p.y → e₁₂ plane, p.y*p.z → e₂₃ plane, etc.
  float scale = 0.3;

  // Spatial bivectors (e₁₂, e₁₃, e₂₃) — generate SO(3) rotations
  // These SURVIVE the boost cancellation (T8) and define 3D space
  float b_12 = p.x * p.y * sin(length(p.xy) * scale * PHI + t * 0.07);
  float b_13 = p.x * p.z * cos(length(p.xz) * scale + t * 0.06);
  float b_23 = p.y * p.z * sin(length(p.yz) * scale * PHI_INV + t * 0.05);

  // Spacetime bivectors (e₁₄, e₂₄, e₃₄) — generate Lorentz boosts
  // c_k = g_k + g_3, w_k = g_k - g_3: their products have OPPOSITE timelike signs.
  // When both V_c and V_w products are summed, the timelike parts cancel (T8).
  // This cancellation is complete by tau = phi^2, leaving only SO(3).
  // We model this as exponential decay: boosts present early, gone after tau=phi^2.
  float boostCancellation = exp(-max(0.0, t - PHI * PHI) * 1.2);
  float r = length(p);
  float b_14 = p.x * sin(r * scale * 0.7 + t * 0.11) * 0.3 * boostCancellation;
  float b_24 = p.y * cos(r * scale * 0.7 + t * 0.10) * 0.3 * boostCancellation;
  float b_34 = p.z * sin(r * scale * 0.7 + t * 0.09) * 0.3 * boostCancellation;

  // After boost cancellation, spatial bivectors strengthen (they inherit the energy)
  float so3boost = 1.0 + 0.5 * (1.0 - boostCancellation);
  
  // Tripotent seed contributes to bivectors: e₁₂ - e₁₃ + e₂₃
  float seed_contribution = (
    SEED_BIVEC.x * b_12 +
    SEED_BIVEC.y * b_13 +
    SEED_BIVEC.z * b_23
  ) * 0.5;

  return (b_12 + b_13 + b_23) * 0.35 * so3boost + (b_14 + b_24 + b_34) * 0.15 + seed_contribution * 0.2;
}

float trivectorPattern(vec3 p, float t) {
  // Triple products — volumes: e₁₂₃, e₁₂₄, e₁₃₄, e₂₃₄
  float r = length(p);
  float t123 = p.x * p.y * p.z * cos(r * 0.2 * PHI + t * 0.04);
  float t124 = p.x * p.y * sin(r * 0.15 + t * 0.05) * 0.5;
  float t134 = p.x * p.z * cos(r * 0.15 * PHI_INV + t * 0.03) * 0.5;
  float t234 = p.y * p.z * sin(r * 0.15 * PHI + t * 0.06) * 0.5;
  return (t123 * 0.4 + t124 + t134 + t234) * 0.15;
}

float pseudoscalarPattern(vec3 p, float t) {
  // Volume element e₁₂₃₄ — chirality/orientation
  float r = length(p);
  float vol = sin(p.x * p.y * p.z * 0.3 + t * 0.03);
  float orient = cos(r * PHI_INV * 0.5 + t * 0.02);
  return vol * orient * 0.3;
}

// ═══════════════════════════════════════════════════════════════════════
// GENESIS SDF — the complete evolution from nothing
//
// One function. Evaluated at (position, time).
// The temporal structure is a CONSEQUENCE of the φ-scaled speeds.
// ═══════════════════════════════════════════════════════════════════════

struct FieldResult {
  float dist;
  float gradeWeights[5]; // for coloring
  float totalEnergy;
};

FieldResult genesisField(vec3 p, float t) {
  FieldResult res;
  for (int i = 0; i < 5; i++) res.gradeWeights[i] = 0.0;
  res.totalEnergy = 0.0;

  // Before creation: the void
  if (t <= 0.0) {
    res.dist = 100.0;
    return res;
  }

  float r = length(p);

  // Grade activations — continuous functions of (r, t)
  float a0 = gradeActivation(r, t, SPEED_0, GRACE_0);
  float a1 = gradeActivation(r, t, SPEED_1, GRACE_1);
  float a2 = gradeActivation(r, t, SPEED_2, GRACE_2);
  float a3 = gradeActivation(r, t, SPEED_3, GRACE_3);
  float a4 = gradeActivation(r, t, SPEED_4, GRACE_4);

  // Early on, we need something to render. If activations are all tiny, boost them temporarily.
  // We make it extremely strong at t=0 so the seed is visible.
  float earlyBoost = max(1.0, 20.0 * exp(-t * 0.2));
  a0 *= earlyBoost; a1 *= earlyBoost; a2 *= earlyBoost; a3 *= earlyBoost; a4 *= earlyBoost;

  // Spatial patterns
  float s0 = scalarPattern(p, t);
  float s1 = vectorPattern(p, t);
  float s2 = bivectorPattern(p, t);
  float s3 = trivectorPattern(p, t);
  float s4 = pseudoscalarPattern(p, t);

  // Weighted contributions
  float c0 = a0 * s0;
  float c1 = a1 * s1;
  float c2 = a2 * s2;
  float c3 = a3 * s3;
  float c4 = a4 * s4;

  // Store grade weights for coloring
  res.gradeWeights[0] = abs(c0);
  res.gradeWeights[1] = abs(c1);
  res.gradeWeights[2] = abs(c2);
  res.gradeWeights[3] = abs(c3);
  res.gradeWeights[4] = abs(c4);

  // Total field: superposition of all grade contributions
  float field = c0 + c1 + c2 + c3 + c4;

  // ═══════════════════════════════════════════════════════════════════
  // INTER-GRADE COUPLING — geometric product creates cross terms
  //
  // scalar × vector → vector (grade 0 × 1 → 1)
  // vector × vector → scalar + bivector (grade 1 × 1 → 0, 2)
  // bivector × vector → vector + trivector (grade 2 × 1 → 1, 3)
  //
  // These nonlinear terms are what make the evolution non-trivial.
  // Without them, you'd just get five independent expanding shells.
  // WITH them, the grades couple and create emergent structure.
  // ═══════════════════════════════════════════════════════════════════

  float coupling_01 = c0 * c1 * 0.4;              // scalar-vector → vector character
  float coupling_11 = c1 * c1 * 0.3;              // vector-vector → scalar + bivector
  float coupling_12 = c1 * c2 * 0.35;             // vector-bivector → vector + trivector
  float coupling_02 = c0 * c2 * 0.25;             // scalar-bivector → bivector
  float coupling_23 = c2 * c3 * 0.2;              // bivector-trivector → higher order

  float coupling = coupling_01 + coupling_11 + coupling_12 + coupling_02 + coupling_23;

  field += coupling;

  // ═══════════════════════════════════════════════════════════════════
  // TRIPOTENT MODULATION — P² = -P creates sign-alternating pulsation
  //
  // The tripotent cycle (P, -P, P) has period 2 in the algebra.
  // In continuous time, this becomes a cos with period 2τ₀ where
  // τ₀ = φ (the natural timescale from the golden ratio).
  //
  // This is NOT an imposed oscillation — it's the temporal expression
  // of the fact that the geometric product of the seed with itself
  // negates: P² = -P.
  // ═══════════════════════════════════════════════════════════════════

  float tripotent_tau = PHI;
  float tripotent_phase = t * PI / tripotent_tau;
  float tripotent_mod = 1.0 + 0.15 * cos(tripotent_phase);

  // The modulation also has a spatial component: stronger near the origin
  // (where the seed lives) and weaker far out (where the field is more diffuse)
  float spatial_mod = 1.0 / (1.0 + r * 0.1);
  tripotent_mod = mix(1.0, tripotent_mod, spatial_mod);

  field *= tripotent_mod;

  // ═══════════════════════════════════════════════════════════════════
  // GRACE CONTRACTION — prevents blow-up, creates coherent core
  //
  // The Grace operator projects to scalar + φ⁻¹ × pseudoscalar.
  // In the field, this manifests as a bias toward low-grade structure.
  // The contraction acts continuously, not as a discrete step.
  // ═══════════════════════════════════════════════════════════════════

  float grace_core = abs(c0) + PHI_INV * abs(c4);
  float grace_contribution = grace_core * PHI_INV * 0.08;
  field += grace_contribution;

  // ═══════════════════════════════════════════════════════════════════
  // BIREFLECTION — β∘β = identity (creates caustic double-sheet)
  //
  // The surface is the zero-set of the field.
  // Taking |field| makes the raymarcher converge to zero-crossings
  // from both sides — both positive and negative regions are "solid."
  // ═══════════════════════════════════════════════════════════════════

  // Total energy (for UI coherence metric)
  res.totalEnergy = abs(c0) + abs(c1) + abs(c2) + abs(c3) + abs(c4);

  // In the beginning, the field is near zero everywhere. We need a minimum density
  // so the early universe has a surface. We do this by subtracting a small base thickness.
  // We use the origin_repulsion so the core is solid initially, then hollows out.
  float origin_repulsion = exp(-r*r * 2.0) * max(0.0, 1.0 - t * 0.2);

  if (res.totalEnergy < 0.001 && origin_repulsion < 0.001) {
     // This is empty space (either outside the universe, or in a dead zone inside).
     // Force the SDF to be positive so the ray doesn't hit a phantom surface.
     // We return the distance to the fastest expanding wavefront.
     float active_edge = SPEED_0 * t + max(0.8, SPEED_0 * t * 0.4) * 0.5;
     res.dist = max(0.2, r - active_edge);
     return res;
  }

  float sdf = abs(field);
  
  // Make the base thickness significantly thicker so the geometry is visible from afar
  float base_thickness = origin_repulsion * 0.8 + min(0.3, t * 0.05) / (1.0 + r * 0.1);
  
  // Scale thickness by energy so we don't create surfaces where there is barely any field
  float energy_factor = smoothstep(0.001, 0.02, res.totalEnergy + origin_repulsion);
  sdf -= base_thickness * energy_factor;

  // Scale for reasonable raymarching step sizes
  sdf *= 0.4; // Slightly safer step size

  res.dist = sdf;
  return res;
}

// Simple SDF wrapper for normal estimation
float genesisSDF(vec3 p, float t) {
  return genesisField(p, t).dist;
}

// ═══════════════════════════════════════════════════════════════════════
// COLORING — grade-dominant color mixing
// ═══════════════════════════════════════════════════════════════════════

vec3 gradeColor(float gw[5]) {
  // Deep, saturated colors
  const vec3 COL_0 = vec3(1.0, 0.05, 0.05);   // Scalar: pure red
  const vec3 COL_1 = vec3(1.0, 0.60, 0.00);   // Vector: bright orange
  const vec3 COL_2 = vec3(0.0, 1.00, 0.10);   // Bivector: pure green
  const vec3 COL_3 = vec3(0.0, 0.50, 1.00);   // Trivector: deep blue
  const vec3 COL_4 = vec3(0.8, 0.00, 1.00);   // Pseudoscalar: deep purple

  // Instead of normalizing by sum which washes out the colors, 
  // we normalize by the max weight, keeping the dominant color pure.
  float maxW = max(max(max(max(gw[0], gw[1]), gw[2]), gw[3]), gw[4]) + 0.0001;
  
  // Power curve makes the dominant grade pop more
  float p = 2.0;
  float w0 = pow(gw[0]/maxW, p);
  float w1 = pow(gw[1]/maxW, p);
  float w2 = pow(gw[2]/maxW, p);
  float w3 = pow(gw[3]/maxW, p);
  float w4 = pow(gw[4]/maxW, p);

  float total = w0 + w1 + w2 + w3 + w4 + 0.0001;
  vec3 col = (w0 * COL_0 + w1 * COL_1 + w2 * COL_2 + w3 * COL_3 + w4 * COL_4) / total;

  return col; // Removed the pow(..., 0.85) which was washing out the darks
}

// ═══════════════════════════════════════════════════════════════════════
// WAVEFRONT GLOW — visible shells at the expanding wavefronts
// ═══════════════════════════════════════════════════════════════════════

vec3 wavefrontGlow(float r, float t) {
  if (t <= 0.0) return vec3(0.0);

  vec3 glow = vec3(0.0);

  float speeds[5];
  speeds[0] = SPEED_0; speeds[1] = SPEED_1; speeds[2] = SPEED_2;
  speeds[3] = SPEED_3; speeds[4] = SPEED_4;

  vec3 colors[5];
  colors[0] = vec3(1.0, 0.05, 0.05); // Red
  colors[1] = vec3(1.0, 0.6, 0.0);   // Orange
  colors[2] = vec3(0.0, 1.0, 0.1);   // Green
  colors[3] = vec3(0.0, 0.5, 1.0);   // Blue/Cyan
  colors[4] = vec3(0.8, 0.0, 1.0);   // Purple

  float graceW[5];
  graceW[0] = GRACE_0; graceW[1] = GRACE_1; graceW[2] = GRACE_2;
  graceW[3] = GRACE_3; graceW[4] = GRACE_4;

  // Enhance the glow significantly so it's visible early on
  float globalGlowBoost = min(1.5, 4.0 / (t + 0.5));

  for (int k = 0; k < 5; k++) {
    float wfR = speeds[k] * t;
    float dist_to_wf = abs(r - wfR);
    float width = max(0.3, wfR * 0.08);
    float intensity = exp(-dist_to_wf * dist_to_wf / (width * width)) * graceW[k];
    intensity /= (1.0 + r * 0.04);
    glow += colors[k] * intensity * globalGlowBoost;
  }

  return glow;
}

// ═══════════════════════════════════════════════════════════════════════
// SHELL CLOSURE GLOW — L.S coupling produces magic number shells
//
// After SO(4)→SO(3) (tau = phi^2), the L_k generators mix trivector
// eigenspaces (T15). This L.S coupling produces stable quantized shells
// at the magic numbers {2,8,20,28,50,82,126}.
//
// Each shell appears as a bright quantized ring that brightens and then
// persists as the field self-organizes. The radii scale with the cube
// root of the magic number (3D volume → radius scaling).
// ═══════════════════════════════════════════════════════════════════════

vec3 shellClosureGlow(float r, float t) {
  float tBreak = PHI * PHI; // tau at which SO(4)→SO(3) completes
  if (t <= tBreak) return vec3(0.0);
  float tSince = t - tBreak;

  // The 7 nuclear magic numbers
  const float MAGIC[7] = float[](2.0, 8.0, 20.0, 28.0, 50.0, 82.0, 126.0);

  // Colors warm to cool: inner shells are hot/young, outer are cool/mature
  const vec3 SCOL[7] = vec3[](
    vec3(1.0, 1.0, 0.6),  // 2:  warm white-gold
    vec3(1.0, 0.8, 0.2),  // 8:  amber
    vec3(0.6, 1.0, 0.3),  // 20: lime
    vec3(0.2, 1.0, 0.7),  // 28: aquamarine
    vec3(0.1, 0.6, 1.0),  // 50: sky blue
    vec3(0.4, 0.3, 1.0),  // 82: indigo
    vec3(0.8, 0.1, 0.9)   // 126: violet
  );

  vec3 glow = vec3(0.0);
  for (int i = 0; i < 7; i++) {
    // Shell radius scales as magic_n^(1/3) * SPEED_2 * tSince
    // (trivector+bivector interference creates standing wave at this radius)
    float shellR = pow(MAGIC[i] / 126.0, 0.333) * SPEED_2 * tSince * 2.5;
    float dist = abs(r - shellR);

    // Narrow Gaussian ring — the quantization
    float width = 0.12 + shellR * 0.02;
    float ring = exp(-dist * dist / (width * width));

    // Shell brightness: peaks when it forms, then stabilizes
    float formTime = float(i) * PHI * 0.8;
    float age = tSince - formTime;
    float brightness = smoothstep(0.0, 1.5, age) * (0.6 + 0.4 * exp(-max(0.0, age - 2.0) * 0.3));

    glow += SCOL[i] * ring * brightness * 0.7;
  }
  return glow;
}

// ═══════════════════════════════════════════════════════════════════════
// SEED GLOW — the nilpotent origin point
// ═══════════════════════════════════════════════════════════════════════

vec3 seedGlow(vec3 p, float t) {
  if (t <= 0.0) return vec3(0.0);
  float r = length(p);

  // Bright point at origin that fades as the field expands
  // Make it large enough to see from afar
  float seedRadius = 1.5 + t * 0.3;
  float seedIntensity = exp(-r * r / (seedRadius * seedRadius));

  // Fades over time as energy disperses, but starts very bright
  seedIntensity *= 4.0 / (1.0 + t * 0.3);

  // Tripotent pulsation at the seed
  float pulse = 0.7 + 0.3 * cos(t * PI / PHI);

  // White-gold core
  return vec3(1.0, 0.95, 0.7) * seedIntensity * pulse;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN — raymarching
// ═══════════════════════════════════════════════════════════════════════

void main() {
  vec3 ro = uCamPos;
  vec3 rd = normalize(vRayDir);

  float totalDist = 0.0;
  vec3 accumulatedGlow = vec3(0.0);

  bool hit = false;
  vec3 hitPos = vec3(0.0);
  FieldResult hitField;

  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * totalDist;
    float r = length(p);

    FieldResult fr = genesisField(p, uTime);
    float d = fr.dist;

    if (d < SURF_DIST) {
      hit = true;
      hitPos = p;
      hitField = fr;
      break;
    }

    // Step size: proportional to distance from surface, capped to avoid overshooting wavefronts
    float marchStep = max(d * 0.7, SURF_DIST * 2.0);
    marchStep = min(marchStep, 0.5);

    // Glow accumulation: NO distance scaling. Just a flat small contribution per step.
    // The natural path length through the wavefront shell provides the integration.
    accumulatedGlow += wavefrontGlow(r, uTime) * marchStep * 0.15;
    accumulatedGlow += seedGlow(p, uTime) * marchStep * 0.08;
    accumulatedGlow += shellClosureGlow(r, uTime) * marchStep * 0.3;

    totalDist += marchStep;

    if (totalDist > uMaxDist) break;
  }

  vec3 color = vec3(0.0);
  vec3 baseColor = vec3(0.0);

  if (hit) {
    vec3 n = normalize(vec3(
      genesisSDF(hitPos + vec3(NORMAL_EPS, 0.0, 0.0), uTime) -
      genesisSDF(hitPos - vec3(NORMAL_EPS, 0.0, 0.0), uTime),
      genesisSDF(hitPos + vec3(0.0, NORMAL_EPS, 0.0), uTime) -
      genesisSDF(hitPos - vec3(0.0, NORMAL_EPS, 0.0), uTime),
      genesisSDF(hitPos + vec3(0.0, 0.0, NORMAL_EPS), uTime) -
      genesisSDF(hitPos - vec3(0.0, 0.0, NORMAL_EPS), uTime)
    ));

    baseColor = gradeColor(hitField.gradeWeights);

    // ── Fermion-to-boson composite detection (T17) ──────────────────────────
    // When grade 0 (scalar, fermionic P²=-P) AND grade 2 (bivector, fermionic)
    // are both strongly active at the same point, their tensor product is bosonic:
    // (P⊗P)² = +4(P⊗P). This is the algebraic basis of spin-statistics.
    // Visually: the collision region emits warm gold — the bosonic composite.
    float f0 = hitField.gradeWeights[0];
    float f2 = hitField.gradeWeights[2];
    float bosonStrength = smoothstep(0.05, 0.25, min(f0, f2) * 4.0);
    vec3 bosonColor = vec3(1.0, 0.92, 0.55); // warm gold = bosonic composite

    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.05, dot(n, lightDir));
    float spec = pow(max(0.0, dot(reflect(-lightDir, n), normalize(uCamPos - hitPos))), 32.0) * 0.5;
    float fresnel = pow(1.0 - max(0.0, dot(n, normalize(uCamPos - hitPos))), 3.0);

    color = baseColor * diff * 2.5;
    color += vec3(1.0) * spec;
    color += baseColor * fresnel * 1.2;
    color += baseColor * 0.05; // tiny ambient

    // Apply boson composite emission on top of the lit surface
    color = mix(color, bosonColor * diff * 3.0, bosonStrength * 0.55);
  }

  // Deep space background
  vec3 bg = vec3(0.005, 0.005, 0.015);

  if (!hit) {
    color = bg + accumulatedGlow;
  } else {
    // Geometry gets its shaded color. Glow adds a subtle halo on top.
    color += accumulatedGlow * 0.2;
    color = mix(color, bg, smoothstep(uMaxDist * 0.6, uMaxDist, totalDist));
  }

  // ACES filmic tone mapping
  color = max(color, 0.0);
  color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
  color = clamp(color, 0.0, 1.0);

  // sRGB gamma
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
`;
