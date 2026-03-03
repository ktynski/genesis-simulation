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
uniform int uSystemMode;
uniform float uParticleDist;


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

  if (t <= 0.0) {
    res.dist = 100.0;
    return res;
  }

  int num_p = (uSystemMode == 1) ? 2 : 1;
  float c0 = 0.0, c1 = 0.0, c2 = 0.0, c3 = 0.0, c4 = 0.0;
  float origin_repulsion = 0.0;
  float min_r = 10000.0;

  for (int i = 0; i < 2; i++) {
    if (i >= num_p) break;
    
    vec3 center = vec3(0.0);
    float pSign = 1.0;
    if (uSystemMode == 1) {
      center = vec3((float(i) - 0.5) * uParticleDist, 0.0, 0.0);
      pSign = (i == 0) ? 1.0 : -1.0;
    }
    
    vec3 local_p = p - center;
    float r = length(local_p);
    min_r = min(min_r, r);
    
    float a0 = gradeActivation(r, t, SPEED_0, GRACE_0);
    float a1 = gradeActivation(r, t, SPEED_1, GRACE_1);
    float a2 = gradeActivation(r, t, SPEED_2, GRACE_2);
    float a3 = gradeActivation(r, t, SPEED_3, GRACE_3);
    float a4 = gradeActivation(r, t, SPEED_4, GRACE_4);

    float earlyBoost = max(1.0, 12.0 * exp(-t * 0.25));
    a0 *= earlyBoost; a1 *= earlyBoost; a2 *= earlyBoost; a3 *= earlyBoost; a4 *= earlyBoost;

    float s0 = scalarPattern(local_p, t);
    float s1 = vectorPattern(local_p, t);
    float s2 = bivectorPattern(local_p, t);
    float s3 = trivectorPattern(local_p, t);
    float s4 = pseudoscalarPattern(local_p, t);

    c0 += a0 * s0 * pSign;
    c1 += a1 * s1 * pSign;
    c2 += a2 * s2 * pSign;
    c3 += a3 * s3 * pSign;
    c4 += a4 * s4 * pSign;
    
    origin_repulsion += exp(-r*r * 2.0) * max(0.0, 1.0 - t * 0.2);
  }

  res.gradeWeights[0] = abs(c0);
  res.gradeWeights[1] = abs(c1);
  res.gradeWeights[2] = abs(c2);
  res.gradeWeights[3] = abs(c3);
  res.gradeWeights[4] = abs(c4);

  float field = c0 + c1 + c2 + c3 + c4;

  float coupling_01 = c0 * c1 * 0.4;
  float coupling_11 = c1 * c1 * 0.3;
  float coupling_12 = c1 * c2 * 0.35;
  float coupling_02 = c0 * c2 * 0.25;
  float coupling_23 = c2 * c3 * 0.2;
  field += (coupling_01 + coupling_11 + coupling_12 + coupling_02 + coupling_23);

  float tripotent_mod = 1.0 + 0.15 * cos(t * PI / PHI);
  tripotent_mod = mix(1.0, tripotent_mod, 1.0 / (1.0 + min_r * 0.1));
  field *= tripotent_mod;

  field += (abs(c0) + PHI_INV * abs(c4)) * PHI_INV * 0.08;
  res.totalEnergy = abs(c0) + abs(c1) + abs(c2) + abs(c3) + abs(c4);

  if (res.totalEnergy < 0.001 && origin_repulsion < 0.001) {
     float active_edge = SPEED_0 * t + max(0.8, SPEED_0 * t * 0.4) * 0.5;
     res.dist = max(0.2, min_r - active_edge);
     return res;
  }

  float sdf = abs(field);
  float base_thickness = origin_repulsion * 0.8 + min(0.3, t * 0.05) / (1.0 + min_r * 0.1);
  float energy_factor = smoothstep(0.001, 0.02, res.totalEnergy + origin_repulsion);
  sdf -= base_thickness * energy_factor;
  sdf *= 0.4;

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
  const vec3 COL_0 = vec3(1.0, 0.15, 0.08);   // Scalar: warm coral
  const vec3 COL_1 = vec3(1.0, 0.65, 0.05);   // Vector: bright amber
  const vec3 COL_2 = vec3(0.05, 0.90, 0.30);  // Bivector: emerald green
  const vec3 COL_3 = vec3(0.10, 0.45, 1.00);  // Trivector: sapphire blue
  const vec3 COL_4 = vec3(0.65, 0.05, 0.95);  // Pseudoscalar: violet

  float maxW = max(max(max(max(gw[0], gw[1]), gw[2]), gw[3]), gw[4]) + 0.0001;
  float p = 2.5;
  float w0 = pow(gw[0]/maxW, p);
  float w1 = pow(gw[1]/maxW, p);
  float w2 = pow(gw[2]/maxW, p);
  float w3 = pow(gw[3]/maxW, p);
  float w4 = pow(gw[4]/maxW, p);

  float total = w0 + w1 + w2 + w3 + w4 + 0.0001;
  vec3 col = (w0 * COL_0 + w1 * COL_1 + w2 * COL_2 + w3 * COL_3 + w4 * COL_4) / total;
  col = pow(col, vec3(0.92));
  return col;
}

// ═══════════════════════════════════════════════════════════════════════
// WAVEFRONT GLOW — visible shells at the expanding wavefronts
// ═══════════════════════════════════════════════════════════════════════

vec3 wavefrontGlow(vec3 p, float t) {
  if (t <= 0.0) return vec3(0.0);
  vec3 glow = vec3(0.0);
  int num_p = (uSystemMode == 1) ? 2 : 1;
  float speeds[5] = float[](SPEED_0, SPEED_1, SPEED_2, SPEED_3, SPEED_4);
  vec3 colors[5] = vec3[](vec3(1.0, 0.05, 0.05), vec3(1.0, 0.6, 0.0), vec3(0.0, 1.0, 0.1), vec3(0.0, 0.5, 1.0), vec3(0.8, 0.0, 1.0));
  float graceW[5] = float[](GRACE_0, GRACE_1, GRACE_2, GRACE_3, GRACE_4);
  float globalGlowBoost = min(1.5, 4.0 / (t + 0.5));

  for (int i = 0; i < 2; i++) {
    if (i >= num_p) break;
    vec3 center = (uSystemMode == 1) ? vec3((float(i) - 0.5) * uParticleDist, 0.0, 0.0) : vec3(0.0);
    float r = length(p - center);
    for (int k = 0; k < 5; k++) {
      float wfR = speeds[k] * t;
      float dist_to_wf = abs(r - wfR);
      float width = max(0.3, wfR * 0.08);
      float intensity = exp(-dist_to_wf * dist_to_wf / (width * width)) * graceW[k];
      glow += colors[k] * (intensity / (1.0 + r * 0.04)) * globalGlowBoost;
    }
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

vec3 shellClosureGlow(vec3 p, float t) {
  float tBreak = PHI * PHI;
  if (t <= tBreak) return vec3(0.0);
  float tSince = t - tBreak;
  const float MAGIC[7] = float[](2.0, 8.0, 20.0, 28.0, 50.0, 82.0, 126.0);
  const vec3 SCOL[7] = vec3[](vec3(1.0, 1.0, 0.6), vec3(1.0, 0.8, 0.2), vec3(0.6, 1.0, 0.3), vec3(0.2, 1.0, 0.7), vec3(0.1, 0.6, 1.0), vec3(0.4, 0.3, 1.0), vec3(0.8, 0.1, 0.9));
  vec3 glow = vec3(0.0);
  int num_p = (uSystemMode == 1) ? 2 : 1;

  for (int p_idx = 0; p_idx < 2; p_idx++) {
    if (p_idx >= num_p) break;
    vec3 center = (uSystemMode == 1) ? vec3((float(p_idx) - 0.5) * uParticleDist, 0.0, 0.0) : vec3(0.0);
    float r = length(p - center);
    for (int i = 0; i < 7; i++) {
      float shellR = pow(MAGIC[i] / 126.0, 0.333) * SPEED_2 * tSince * 2.5;
      float dist = abs(r - shellR);
      float width = 0.12 + shellR * 0.02;
      float ring = exp(-dist * dist / (width * width));
      float age = tSince - float(i) * PHI * 0.8;
      float brightness = smoothstep(0.0, 1.5, age) * (0.6 + 0.4 * exp(-max(0.0, age - 2.0) * 0.3));
      glow += SCOL[i] * ring * brightness * 0.7;
    }
  }
  return glow;
}

// ═══════════════════════════════════════════════════════════════════════
// SEED GLOW — the nilpotent origin point
// ═══════════════════════════════════════════════════════════════════════

vec3 seedGlow(vec3 p, float t) {
  if (t <= 0.0) return vec3(0.0);
  vec3 glow = vec3(0.0);
  int num_p = (uSystemMode == 1) ? 2 : 1;
  for (int i = 0; i < 2; i++) {
    if (i >= num_p) break;
    vec3 center = (uSystemMode == 1) ? vec3((float(i) - 0.5) * uParticleDist, 0.0, 0.0) : vec3(0.0);
    float r = length(p - center);
    float seedRadius = 1.5 + t * 0.3;
    float seedIntensity = exp(-r * r / (seedRadius * seedRadius)) * (4.0 / (1.0 + t * 0.3));
    glow += vec3(1.0, 0.95, 0.7) * seedIntensity * (0.7 + 0.3 * cos(t * PI / PHI));
  }
  return glow;
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

    accumulatedGlow += wavefrontGlow(p, uTime) * marchStep * 0.12;
    accumulatedGlow += seedGlow(p, uTime) * marchStep * 0.06;
    accumulatedGlow += shellClosureGlow(p, uTime) * marchStep * 0.22;

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

    float f0 = hitField.gradeWeights[0];
    float f2 = hitField.gradeWeights[2];
    float bosonStrength = smoothstep(0.05, 0.25, min(f0, f2) * 4.0);
    vec3 bosonColor = vec3(1.0, 0.92, 0.55);

    vec3 viewDir = normalize(uCamPos - hitPos);

    vec3 keyDir  = normalize(vec3(0.5, 0.8, 1.0));
    vec3 fillDir = normalize(vec3(-0.4, -0.3, 0.6));
    float keyDiff  = max(0.0, dot(n, keyDir));
    float fillDiff = max(0.0, dot(n, fillDir)) * 0.35;
    float diff = max(0.06, keyDiff + fillDiff);

    float spec = pow(max(0.0, dot(reflect(-keyDir, n), viewDir)), 40.0) * 0.55;
    float fresnel = pow(1.0 - max(0.0, dot(n, viewDir)), 3.5);

    float ao = clamp(hitField.dist * 8.0 + 0.7, 0.3, 1.0);

    color = baseColor * diff * 2.2 * ao;
    color += vec3(0.95, 0.97, 1.0) * spec;
    color += baseColor * fresnel * 1.0;
    color += baseColor * 0.06;

    color = mix(color, bosonColor * diff * 2.8, bosonStrength * 0.55);
  }

  // Deep space background
  vec3 bg = vec3(0.005, 0.005, 0.015);

  float glowLuma = dot(accumulatedGlow, vec3(0.2126, 0.7152, 0.0722));
  vec3 glowClamped = accumulatedGlow / (1.0 + glowLuma * 0.5);

  if (!hit) {
    color = bg + glowClamped;
  } else {
    color += glowClamped * 0.15;
    color = mix(color, bg, smoothstep(uMaxDist * 0.6, uMaxDist, totalDist));
  }

  color = max(color, 0.0);
  color = (color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14);
  color = clamp(color, 0.0, 1.0);
  color = pow(color, vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
`;
