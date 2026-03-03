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
uniform float uTime;
uniform float uMaxDist;
uniform int uSystemMode;
uniform float uParticleDist;

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const float PHI     = 1.618033988749;
const float PHI_INV = 0.618033988749;
const float PI      = 3.141592653589793;

const float SPEED_0 = 1.0;
const float SPEED_1 = 0.78615;
const float SPEED_2 = 0.61803;
const float SPEED_3 = 0.48587;
const float SPEED_4 = 0.38197;

const float GRACE_0 = 1.0;
const float GRACE_1 = 0.61803;
const float GRACE_2 = 0.38197;
const float GRACE_3 = 0.23607;
const float GRACE_4 = 0.14590;

#define MAX_STEPS 160
#define SURF_DIST 0.001
#define NORMAL_EPS 0.003

// ═══════════════════════════════════════════════════════════════════════
// Cl(3,1) MULTIPLICATION TABLE
//
// Basis ordering (grade-sorted, lexicographic within grade):
//   [0]  1       [1] e0   [2] e1   [3] e2   [4] e3
//   [5]  e01     [6] e02  [7] e03  [8] e12  [9] e13  [10] e23
//   [11] e012   [12] e013 [13] e023 [14] e123
//   [15] e0123
//
// Metric: e0²=+1, e1²=+1, e2²=+1, e3²=-1
// ═══════════════════════════════════════════════════════════════════════

const int MUL_IDX[256] = int[](
  0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,
  1,0,5,6,7,2,3,4,11,12,13,8,9,10,15,14,
  2,5,0,8,9,1,11,12,3,4,14,6,7,15,10,13,
  3,6,8,0,10,11,1,13,2,14,4,5,15,7,9,12,
  4,7,9,10,0,12,13,1,14,2,3,15,5,6,8,11,
  5,2,1,11,12,0,8,9,6,7,15,3,4,14,13,10,
  6,3,11,1,13,8,0,10,5,15,7,2,14,4,12,9,
  7,4,12,13,1,9,10,0,15,5,6,14,2,3,11,8,
  8,11,3,2,14,6,5,15,0,10,9,1,13,12,4,7,
  9,12,4,14,2,7,15,5,10,0,8,13,1,11,3,6,
  10,13,14,4,3,15,7,6,9,8,0,12,11,1,2,5,
  11,8,6,5,15,3,2,14,1,13,12,0,10,9,7,4,
  12,9,7,15,5,4,14,2,13,1,11,10,0,8,6,3,
  13,10,15,7,6,14,4,3,12,11,1,9,8,0,5,2,
  14,15,10,9,8,13,12,11,4,3,2,7,6,5,0,1,
  15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0
);

const int MUL_SIGN[256] = int[](
   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
   1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
   1,-1, 1, 1, 1,-1,-1,-1, 1, 1, 1,-1,-1,-1, 1,-1,
   1,-1,-1, 1, 1, 1,-1,-1,-1,-1, 1, 1, 1,-1,-1, 1,
   1,-1,-1,-1,-1, 1, 1, 1, 1, 1, 1,-1,-1,-1,-1, 1,
   1,-1, 1, 1, 1,-1,-1,-1, 1, 1, 1,-1,-1,-1, 1,-1,
   1,-1,-1, 1, 1, 1,-1,-1,-1,-1, 1, 1, 1,-1,-1, 1,
   1,-1,-1,-1,-1, 1, 1, 1, 1, 1, 1,-1,-1,-1,-1, 1,
   1, 1,-1, 1, 1,-1, 1, 1,-1,-1, 1,-1,-1, 1,-1,-1,
   1, 1,-1,-1,-1,-1,-1,-1, 1, 1, 1, 1, 1, 1,-1,-1,
   1, 1, 1,-1,-1, 1,-1,-1,-1,-1, 1,-1,-1, 1, 1, 1,
   1, 1,-1, 1, 1,-1, 1, 1,-1,-1, 1,-1,-1, 1,-1,-1,
   1, 1,-1,-1,-1,-1,-1,-1, 1, 1, 1, 1, 1, 1,-1,-1,
   1, 1, 1,-1,-1, 1,-1,-1,-1,-1, 1,-1,-1, 1, 1, 1,
   1,-1, 1,-1,-1,-1, 1, 1,-1,-1, 1, 1, 1,-1, 1,-1,
   1,-1, 1,-1,-1,-1, 1, 1,-1,-1, 1, 1, 1,-1, 1,-1
);

// Grade of each basis element
const int GRADE[16] = int[](0, 1,1,1,1, 2,2,2,2,2,2, 3,3,3,3, 4);

// ═══════════════════════════════════════════════════════════════════════
// CLIFFORD GEOMETRIC PRODUCT — exact 16-component multiplication
// ═══════════════════════════════════════════════════════════════════════

void cliffordMul(float a[16], float b[16], out float c[16]) {
  for (int k = 0; k < 16; k++) c[k] = 0.0;
  for (int i = 0; i < 16; i++) {
    float ai = a[i];
    if (ai == 0.0) continue;
    for (int j = 0; j < 16; j++) {
      float bj = b[j];
      if (bj == 0.0) continue;
      int idx = i * 16 + j;
      c[MUL_IDX[idx]] += float(MUL_SIGN[idx]) * ai * bj;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// GRADE ACTIVATION — unchanged from original
// ═══════════════════════════════════════════════════════════════════════

float gradeActivation(float r, float t, float speed, float graceWeight) {
  float wavefrontR = speed * t;
  float behind = wavefrontR - r;
  float width = max(0.8, wavefrontR * 0.4);
  float activation = smoothstep(-width * 0.5, width * 0.5, behind);
  activation *= graceWeight;
  activation /= (1.0 + r * 0.02);
  return activation;
}

// ═══════════════════════════════════════════════════════════════════════
// 16-COMPONENT MULTIVECTOR FIELD
//
// Each basis element gets its own spatial pattern derived from the
// original grade-level patterns but split into individual components.
//
// Tripotent seed: P = w1*w2 = -1 + e12 - e13 + e23
//   => component [0] = -1, [8] = +1, [9] = -1, [10] = +1
// ═══════════════════════════════════════════════════════════════════════

void computeMultivector(vec3 p, float t, out float mv[16]) {
  float r = length(p);

  float a0 = gradeActivation(r, t, SPEED_0, GRACE_0);
  float a1 = gradeActivation(r, t, SPEED_1, GRACE_1);
  float a2 = gradeActivation(r, t, SPEED_2, GRACE_2);
  float a3 = gradeActivation(r, t, SPEED_3, GRACE_3);
  float a4 = gradeActivation(r, t, SPEED_4, GRACE_4);

  float earlyBoost = max(1.0, 20.0 * exp(-t * 0.2));
  a0 *= earlyBoost; a1 *= earlyBoost; a2 *= earlyBoost;
  a3 *= earlyBoost; a4 *= earlyBoost;

  // [0] Scalar — reduced amplitude so other grades can compete visually
  float m1 = cos(r / PHI + t * 0.15);
  float m2 = cos(r / (PHI * PHI) + t * 0.09);
  float m3 = cos(r + t * 0.12);
  mv[0] = a0 * (PHI_INV * m1 + PHI_INV * m2 * 0.3 + PHI_INV * m3 * 0.15) * 0.6;

  // [1-4] Vectors — stronger directional modes with less cancellation
  mv[1] = a1 * (sin(p.x / PHI + t * 0.13) * 0.5 + cos(p.y * 0.7 + t * 0.08) * 0.25);
  mv[2] = a1 * (sin(p.y / PHI + t * 0.11) * 0.5 + cos(p.z * 0.7 + t * 0.07) * 0.25);
  mv[3] = a1 * (sin(p.z / PHI + t * 0.09) * 0.5 + cos(p.x * 0.7 + t * 0.06) * 0.25);
  mv[4] = a1 * cos((p.x + p.y + p.z) * PHI_INV + t * 0.17) * 0.3;

  // [5-10] Bivectors — mixed angular + radial patterns so they're nonzero everywhere
  float scale = 0.3;
  float boostCancel = exp(-max(0.0, t - PHI * PHI) * 1.2);
  float so3boost = 1.0 + 0.6 * (1.0 - boostCancel);

  // Spacetime bivectors: decay after boost cancellation
  mv[5] = a2 * (p.x * sin(r * scale * 0.7 + t * 0.11) + cos(p.y * 0.5 + t * 0.14) * 0.3) * 0.2 * boostCancel;
  mv[6] = a2 * (p.y * cos(r * scale * 0.7 + t * 0.10) + sin(p.z * 0.5 + t * 0.12) * 0.3) * 0.2 * boostCancel;
  mv[7] = a2 * (p.z * sin(r * scale * 0.7 + t * 0.09) + cos(p.x * 0.5 + t * 0.13) * 0.3) * 0.2 * boostCancel;

  // Spatial bivectors: survive, with angular pattern + isotropic floor
  float ang12 = atan(p.y, p.x + 0.001);
  float ang13 = atan(p.z, p.x + 0.001);
  float ang23 = atan(p.z, p.y + 0.001);

  mv[8]  = a2 * (sin(ang12 * 2.0 + r * scale * PHI + t * 0.07) * 0.5
              + sin(r * 0.4 + t * 0.05) * 0.2) * so3boost;
  mv[9]  = a2 * (cos(ang13 * 2.0 + r * scale + t * 0.06) * 0.5
              + cos(r * 0.35 + t * 0.04) * 0.2) * so3boost;
  mv[10] = a2 * (sin(ang23 * 2.0 + r * scale * PHI_INV + t * 0.05) * 0.5
              + sin(r * 0.45 + t * 0.06) * 0.2) * so3boost;

  // Tripotent seed: P = -1 + e12 - e13 + e23
  float seedWeight = 0.25 / (1.0 + r * 0.12);
  mv[0]  += a0 * (-1.0) * seedWeight;
  mv[8]  += a2 * ( 1.0) * seedWeight;
  mv[9]  += a2 * (-1.0) * seedWeight;
  mv[10] += a2 * ( 1.0) * seedWeight;

  // [11-14] Trivectors — angular patterns so they're visible off-axis
  float phi_ang = atan(p.y, p.x + 0.001);
  float theta_ang = acos(clamp(p.z / max(r, 0.01), -1.0, 1.0));

  mv[11] = a3 * sin(phi_ang * 3.0 + r * 0.2 * PHI + t * 0.04) * 0.2;
  mv[12] = a3 * cos(theta_ang * 2.0 + r * 0.18 + t * 0.05) * 0.18;
  mv[13] = a3 * sin(phi_ang * 2.0 + theta_ang + r * 0.15 * PHI_INV + t * 0.03) * 0.18;
  mv[14] = a3 * cos(phi_ang + theta_ang * 3.0 + r * 0.15 * PHI + t * 0.06) * 0.15;

  // [15] Pseudoscalar — isotropic chirality
  mv[15] = a4 * sin(r * PHI_INV * 0.5 + t * 0.03) * cos(phi_ang * 0.5 + t * 0.02) * 0.4;
}

// ═══════════════════════════════════════════════════════════════════════
// EXTRACT GRADE WEIGHTS from a 16-component multivector
// ═══════════════════════════════════════════════════════════════════════

void gradeWeightsFromMV(float mv[16], out float gw[5]) {
  gw[0] = abs(mv[0]);
  gw[1] = abs(mv[1]) + abs(mv[2]) + abs(mv[3]) + abs(mv[4]);
  gw[2] = abs(mv[5]) + abs(mv[6]) + abs(mv[7]) + abs(mv[8]) + abs(mv[9]) + abs(mv[10]);
  gw[3] = abs(mv[11]) + abs(mv[12]) + abs(mv[13]) + abs(mv[14]);
  gw[4] = abs(mv[15]);
}

float mvNorm(float mv[16]) {
  float s = 0.0;
  for (int i = 0; i < 16; i++) s += mv[i] * mv[i];
  return sqrt(s);
}

// ═══════════════════════════════════════════════════════════════════════
// GENESIS SDF — full 16-component Clifford field
// ═══════════════════════════════════════════════════════════════════════

struct FieldResult {
  float dist;
  float gradeWeights[5];
  float totalEnergy;
  float scalarProduct;
};

FieldResult genesisField(vec3 p, float t) {
  FieldResult res;
  for (int i = 0; i < 5; i++) res.gradeWeights[i] = 0.0;
  res.totalEnergy = 0.0;
  res.scalarProduct = 0.0;

  if (t <= 0.0) {
    res.dist = 100.0;
    return res;
  }

  float min_r = 10000.0;
  float origin_repulsion = 0.0;

  // Compute multivector for system A (always present)
  vec3 centerA = vec3(0.0);
  if (uSystemMode == 1) centerA = vec3(-0.5 * uParticleDist, 0.0, 0.0);
  vec3 localA = p - centerA;
  float rA = length(localA);
  min_r = min(min_r, rA);
  origin_repulsion += exp(-rA*rA * 2.0) * max(0.0, 1.0 - t * 0.2);

  float mvA[16];
  computeMultivector(localA, t, mvA);

  float total[16];

  if (uSystemMode == 1) {
    // Binary mode: compute system B and take geometric product
    vec3 centerB = vec3(0.5 * uParticleDist, 0.0, 0.0);
    vec3 localB = p - centerB;
    float rB = length(localB);
    min_r = min(min_r, rB);
    origin_repulsion += exp(-rB*rB * 2.0) * max(0.0, 1.0 - t * 0.2);

    float mvB[16];
    computeMultivector(localB, t, mvB);

    // Flip the sign of mvB (opposite tripotent / opposite spin)
    for (int i = 0; i < 16; i++) mvB[i] = -mvB[i];

    // Psi_total = Psi_A + Psi_B + beta * (Psi_A * Psi_B)
    // The geometric product creates new grade components that neither
    // field had individually (e.g. vector * vector => scalar + bivector).
    float product[16];
    cliffordMul(mvA, mvB, product);

    float beta = 0.5;
    for (int i = 0; i < 16; i++) {
      total[i] = mvA[i] + mvB[i] + beta * product[i];
    }

    // The scalar part of the geometric product reveals boson/fermion character
    res.scalarProduct = product[0];
  } else {
    // Single mode: just the one system
    for (int i = 0; i < 16; i++) total[i] = mvA[i];
  }

  // Extract grade weights for coloring
  gradeWeightsFromMV(total, res.gradeWeights);

  // Total field: grade-weighted signed density
  // Each grade contributes its signed sum (preserving interference patterns)
  // but weighted by Grace coefficients so the grade hierarchy is visible.
  float g0_field = total[0];
  float g1_field = total[1] + total[2] + total[3] + total[4];
  float g2_field = total[5] + total[6] + total[7] + total[8] + total[9] + total[10];
  float g3_field = total[11] + total[12] + total[13] + total[14];
  float g4_field = total[15];

  float field = g0_field + g1_field * 1.2 + g2_field * 1.5 + g3_field * 1.8 + g4_field * 1.0;

  // Tripotent modulation: P^2 = -P creates sign-alternating pulsation
  float tripotent_mod = 1.0 + 0.15 * cos(t * PI / PHI);
  tripotent_mod = mix(1.0, tripotent_mod, 1.0 / (1.0 + min_r * 0.1));
  field *= tripotent_mod;

  // Grace contraction: bias toward scalar + pseudoscalar
  float grace_core = abs(total[0]) + PHI_INV * abs(total[15]);
  field += grace_core * PHI_INV * 0.08;

  // Total energy
  res.totalEnergy = 0.0;
  for (int i = 0; i < 5; i++) res.totalEnergy += res.gradeWeights[i];

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

float genesisSDF(vec3 p, float t) {
  return genesisField(p, t).dist;
}

// ═══════════════════════════════════════════════════════════════════════
// COLORING — grade-dominant color mixing (unchanged)
// ═══════════════════════════════════════════════════════════════════════

vec3 gradeColor(float gw[5]) {
  const vec3 COL_0 = vec3(1.0, 0.05, 0.05);
  const vec3 COL_1 = vec3(1.0, 0.60, 0.00);
  const vec3 COL_2 = vec3(0.0, 1.00, 0.10);
  const vec3 COL_3 = vec3(0.0, 0.50, 1.00);
  const vec3 COL_4 = vec3(0.8, 0.00, 1.00);

  float maxW = max(max(max(max(gw[0], gw[1]), gw[2]), gw[3]), gw[4]) + 0.0001;
  float pw = 2.0;
  float w0 = pow(gw[0]/maxW, pw);
  float w1 = pow(gw[1]/maxW, pw);
  float w2 = pow(gw[2]/maxW, pw);
  float w3 = pow(gw[3]/maxW, pw);
  float w4 = pow(gw[4]/maxW, pw);
  float tot = w0 + w1 + w2 + w3 + w4 + 0.0001;
  return (w0 * COL_0 + w1 * COL_1 + w2 * COL_2 + w3 * COL_3 + w4 * COL_4) / tot;
}

// ═══════════════════════════════════════════════════════════════════════
// WAVEFRONT GLOW
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
// SHELL CLOSURE GLOW — magic number shells
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
// SEED GLOW — nilpotent origin point
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

    FieldResult fr = genesisField(p, uTime);
    float d = fr.dist;

    if (d < SURF_DIST) {
      hit = true;
      hitPos = p;
      hitField = fr;
      break;
    }

    float marchStep = max(d * 0.7, SURF_DIST * 2.0);
    marchStep = min(marchStep, 0.5);

    accumulatedGlow += wavefrontGlow(p, uTime) * marchStep * 0.15;
    accumulatedGlow += seedGlow(p, uTime) * marchStep * 0.08;
    accumulatedGlow += shellClosureGlow(p, uTime) * marchStep * 0.3;

    totalDist += marchStep;
    if (totalDist > uMaxDist) break;
  }

  vec3 color = vec3(0.0);

  if (hit) {
    vec3 n = normalize(vec3(
      genesisSDF(hitPos + vec3(NORMAL_EPS, 0.0, 0.0), uTime) -
      genesisSDF(hitPos - vec3(NORMAL_EPS, 0.0, 0.0), uTime),
      genesisSDF(hitPos + vec3(0.0, NORMAL_EPS, 0.0), uTime) -
      genesisSDF(hitPos - vec3(0.0, NORMAL_EPS, 0.0), uTime),
      genesisSDF(hitPos + vec3(0.0, 0.0, NORMAL_EPS), uTime) -
      genesisSDF(hitPos - vec3(0.0, 0.0, NORMAL_EPS), uTime)
    ));

    vec3 baseColor = gradeColor(hitField.gradeWeights);

    // Boson detection: in binary mode, the scalar part of the geometric
    // product reveals fermion-boson character. Positive scalar = bosonic
    // composite (T17: (-1)x(-1) = +1). Negative = fermionic repulsion.
    float bosonStrength = 0.0;
    if (uSystemMode == 1) {
      bosonStrength = smoothstep(0.0, 0.15, hitField.scalarProduct);
    } else {
      float f0 = hitField.gradeWeights[0];
      float f2 = hitField.gradeWeights[2];
      bosonStrength = smoothstep(0.05, 0.25, min(f0, f2) * 4.0);
    }
    vec3 bosonColor = vec3(1.0, 0.92, 0.55);

    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float diff = max(0.05, dot(n, lightDir));
    float spec = pow(max(0.0, dot(reflect(-lightDir, n), normalize(uCamPos - hitPos))), 32.0) * 0.5;
    float fresnel = pow(1.0 - max(0.0, dot(n, normalize(uCamPos - hitPos))), 3.0);

    color = baseColor * diff * 2.5;
    color += vec3(1.0) * spec;
    color += baseColor * fresnel * 1.2;
    color += baseColor * 0.05;
    color = mix(color, bosonColor * diff * 3.0, bosonStrength * 0.55);
  }

  vec3 bg = vec3(0.005, 0.005, 0.015);

  if (!hit) {
    color = bg + accumulatedGlow;
  } else {
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
