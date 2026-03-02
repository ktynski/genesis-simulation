const PHI = 1.618033988749895;

export class OrbitCamera {
  constructor() {
    this.theta = 0.3;
    this.phi = Math.PI / 3.5;
    this.distance = 25; // start further out so we can see the whole genesis
    this.target = [0, 0, 0];
    this.fov = 60;
    this.aspectRatio = 16 / 9;
    this.near = 0.1;
    this.far = 200;

    this.position = [0, 0, 18];
    this.up = [0, 1, 0];

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.viewMatrix = new Float32Array(16);
    this.projectionMatrix = new Float32Array(16);
    this.inverseViewMatrix = new Float32Array(16);
    this.inverseProjectionMatrix = new Float32Array(16);

    this.updatePosition();
  }

  updatePosition() {
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    const st = Math.sin(this.theta), ct = Math.cos(this.theta);

    this.position = [
      this.target[0] + this.distance * sp * ct,
      this.target[1] + this.distance * cp,
      this.target[2] + this.distance * sp * st
    ];

    this._computeView();
    this._computeProjection();
  }

  _computeView() {
    const [px, py, pz] = this.position;
    const [tx, ty, tz] = this.target;
    const [ux, uy, uz] = this.up;

    let fx = tx - px, fy = ty - py, fz = tz - pz;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx /= fl; fy /= fl; fz /= fl;

    let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
    const rl = Math.sqrt(rx * rx + ry * ry + rz * rz);
    rx /= rl; ry /= rl; rz /= rl;

    const upx = ry * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - ry * fx;

    const m = this.viewMatrix;
    m[0] = rx;  m[1] = upx; m[2] = -fx; m[3] = 0;
    m[4] = ry;  m[5] = upy; m[6] = -fy; m[7] = 0;
    m[8] = rz;  m[9] = upz; m[10] = -fz; m[11] = 0;
    m[12] = -(rx * px + ry * py + rz * pz);
    m[13] = -(upx * px + upy * py + upz * pz);
    m[14] = fx * px + fy * py + fz * pz;
    m[15] = 1;

    invert4(m, this.inverseViewMatrix);
  }

  _computeProjection() {
    const f = 1 / Math.tan((this.fov * Math.PI / 180) / 2);
    const nf = 1 / (this.near - this.far);
    const p = this.projectionMatrix;

    p[0] = f / this.aspectRatio; p[1] = 0; p[2] = 0; p[3] = 0;
    p[4] = 0; p[5] = f; p[6] = 0; p[7] = 0;
    p[8] = 0; p[9] = 0; p[10] = (this.far + this.near) * nf; p[11] = -1;
    p[12] = 0; p[13] = 0; p[14] = 2 * this.far * this.near * nf; p[15] = 0;

    invert4(p, this.inverseProjectionMatrix);
  }

  rotate(dTheta, dPhi) {
    this.theta += dTheta;
    this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi + dPhi));
    this.updatePosition();
  }

  zoom(delta) {
    this.distance = Math.max(2, Math.min(120, this.distance + delta));
    this.updatePosition();
  }

  setAspect(a) {
    this.aspectRatio = a;
    this._computeProjection();
  }

  goToPreset({ theta, phi, distance, fov }, duration = 1000) {
    this._from = { theta: this.theta, phi: this.phi, distance: this.distance, fov: this.fov };
    // Shortest-path on theta
    let dTheta = ((theta - this.theta) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this._to = { theta: this.theta + dTheta, phi, distance, fov };
    this._animStart = performance.now();
    this._animDuration = duration;
    this._isAnimating = true;
  }

  updateAnimation() {
    if (!this._isAnimating) return false;
    const raw = Math.min(1, (performance.now() - this._animStart) / this._animDuration);
    // Cubic ease-in-out
    const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    this.theta    = this._from.theta    + (this._to.theta    - this._from.theta)    * t;
    this.phi      = this._from.phi      + (this._to.phi      - this._from.phi)      * t;
    this.distance = this._from.distance + (this._to.distance - this._from.distance) * t;
    this.fov      = this._from.fov      + (this._to.fov      - this._from.fov)      * t;
    this._computeProjection();
    this.updatePosition();
    if (raw >= 1) this._isAnimating = false;
    return true;
  }

  attachControls(canvas) {
    canvas.addEventListener('mousedown', e => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('mousemove', e => {
      if (!this.isDragging) return;
      this.rotate(-(e.clientX - this.lastX) * 0.008, (e.clientY - this.lastY) * 0.008);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('mouseup', () => { this.isDragging = false; });
    canvas.addEventListener('mouseleave', () => { this.isDragging = false; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom(e.deltaY * 0.02);
    }, { passive: false });

    let lastDist = 0;
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastDist = Math.sqrt(dx * dx + dy * dy);
      }
    });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        this.rotate(-(e.touches[0].clientX - this.lastX) * 0.008,
                     (e.touches[0].clientY - this.lastY) * 0.008);
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.sqrt(dx * dx + dy * dy);
        this.zoom((lastDist - d) * 0.03);
        lastDist = d;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.isDragging = false; });
  }
}

function invert4(m, out) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) {
    for (let i = 0; i < 16; i++) out[i] = i % 5 === 0 ? 1 : 0;
    return;
  }
  det = 1 / det;

  out[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1]  = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2]  = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3]  = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4]  = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6]  = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7]  = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8]  = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9]  = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
}
