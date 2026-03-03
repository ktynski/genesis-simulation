import re

with open('src/shaders.js', 'r') as f: s = f.read()

# Make the boolean operation more explicit for the collision
# Instead of pure additive math which is resulting in simple clipping plane
old_gf = re.search(r"FieldResult genesisField\(vec3 p, float t\) \{.*?\n\}", s, re.DOTALL)
if old_gf:
    new_gf = """FieldResult genesisField(vec3 p, float t) {
  FieldResult res;
  for (int i = 0; i < 5; i++) res.gradeWeights[i] = 0.0;
  res.totalEnergy = 0.0;

  if (t <= 0.0) {
    res.dist = 100.0;
    return res;
  }

  int num_p = (uSystemMode == 1) ? 2 : 1;
  
  // We need to track the fields separately for non-linear interference
  float c0_1 = 0.0, c1_1 = 0.0, c2_1 = 0.0, c3_1 = 0.0, c4_1 = 0.0;
  float c0_2 = 0.0, c1_2 = 0.0, c2_2 = 0.0, c3_2 = 0.0, c4_2 = 0.0;
  
  float origin_repulsion = 0.0;
  float min_r = 10000.0;

  for (int i = 0; i < 2; i++) {
    if (i >= num_p) break;
    
    vec3 center = vec3(0.0);
    float pSign = 1.0;
    if (uSystemMode == 1) {
      center = vec3((float(i) - 0.5) * uParticleDist, 0.0, 0.0);
      pSign = (i == 0) ? 1.0 : -1.0; // Opposite spins
    }
    
    vec3 local_p = p - center;
    float r = length(local_p);
    min_r = min(min_r, r);
    
    float a0 = gradeActivation(r, t, SPEED_0, GRACE_0);
    float a1 = gradeActivation(r, t, SPEED_1, GRACE_1);
    float a2 = gradeActivation(r, t, SPEED_2, GRACE_2);
    float a3 = gradeActivation(r, t, SPEED_3, GRACE_3);
    float a4 = gradeActivation(r, t, SPEED_4, GRACE_4);

    float earlyBoost = max(1.0, 20.0 * exp(-t * 0.2));
    a0 *= earlyBoost; a1 *= earlyBoost; a2 *= earlyBoost; a3 *= earlyBoost; a4 *= earlyBoost;

    // Apply the spatial patterns
    float s0 = scalarPattern(local_p, t) * a0;
    float s1 = vectorPattern(local_p, t) * a1;
    float s2 = bivectorPattern(local_p, t) * a2;
    float s3 = trivectorPattern(local_p, t) * a3;
    float s4 = pseudoscalarPattern(local_p, t) * a4;

    if (i == 0) {
      c0_1 = s0 * pSign; c1_1 = s1 * pSign; c2_1 = s2 * pSign; c3_1 = s3 * pSign; c4_1 = s4 * pSign;
    } else {
      c0_2 = s0 * pSign; c1_2 = s1 * pSign; c2_2 = s2 * pSign; c3_2 = s3 * pSign; c4_2 = s4 * pSign;
    }
    
    origin_repulsion += exp(-r*r * 2.0) * max(0.0, 1.0 - t * 0.2);
  }

  // INTERFERENCE LOGIC
  // If we just add them linearly, we just get a flat boolean cut.
  // Instead we apply the geometric product logic to the combined field.
  
  float c0 = c0_1 + c0_2;
  float c1 = c1_1 + c1_2;
  float c2 = c2_1 + c2_2;
  float c3 = c3_1 + c3_2;
  float c4 = c4_1 + c4_2;
  
  // Non-linear Pauli Repulsion:
  // If the scalar fields are completely out of phase (destructive interference),
  // they create a vacuum gap (distance pushed outward)
  float pauli_gap = 0.0;
  if (uSystemMode == 1) {
     // Measure how much they are cancelling each other out vs adding
     float interference_depth = abs(c0_1) + abs(c0_2) - abs(c0_1 + c0_2);
     pauli_gap = interference_depth * 2.5; 
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
  
  // Apply the Pauli vacuum gap - pushing the surface away where fields destructively interfere
  if (uSystemMode == 1) {
     sdf += pauli_gap * energy_factor;
  }
  
  sdf *= 0.4;

  res.dist = sdf;
  return res;
}"""
    s = s.replace(old_gf.group(0), new_gf)

with open('src/shaders.js', 'w') as f: f.write(s)

