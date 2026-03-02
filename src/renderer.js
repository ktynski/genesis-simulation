import { vertexSource, fragmentSource } from './shaders.js';
import { OrbitCamera } from './camera.js';

export class GenesisRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.program = null;
    this.uniforms = null;
    this.camera = new OrbitCamera();
    this.time = 0;
    this.isRunning = false;
    this.speed = 0.25; // Slowed down so the evolution is clearly visible
    this.maxDist = 120.0;

    this._onTimeUpdate = null;
    this._onGradeUpdate = null;
  }

  async initialize() {
    this.gl = this.canvas.getContext('webgl2', {
      alpha: false, depth: false, antialias: false,
      powerPreference: 'high-performance'
    });
    if (!this.gl) throw new Error('WebGL2 not supported');

    const gl = this.gl;
    this.program = this._compile(gl);
    this.uniforms = {
      uCamPos:   gl.getUniformLocation(this.program, 'uCamPos'),
      uTime:     gl.getUniformLocation(this.program, 'uTime'),
      uMaxDist:  gl.getUniformLocation(this.program, 'uMaxDist'),
      uInvView:  gl.getUniformLocation(this.program, 'uInvView'),
      uInvProj:  gl.getUniformLocation(this.program, 'uInvProj'),
    };
    const aPos = gl.getAttribLocation(this.program, 'aPosition');

    const verts = new Float32Array([-1,-1, 1,-1, 1,1, -1,-1, 1,1, -1,1]);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    this.aPos = aPos;

    this.camera.attachControls(this.canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _compile(gl) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertexSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('Vertex: ' + gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('Fragment: ' + gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Link: ' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.camera.setAspect(rect.width / rect.height);
  }

  render() {
    const gl = this.gl;
    gl.clearColor(0.008, 0.016, 0.032, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3fv(this.uniforms.uCamPos, this.camera.position);
    gl.uniform1f(this.uniforms.uTime, this.time);
    gl.uniform1f(this.uniforms.uMaxDist, this.maxDist);
    gl.uniformMatrix4fv(this.uniforms.uInvView, false, this.camera.inverseViewMatrix);
    gl.uniformMatrix4fv(this.uniforms.uInvProj, false, this.camera.inverseProjectionMatrix);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  evolve(dt) {
    this.time += dt * this.speed;
    if (this.time < 0) this.time = 0;

    this.camera.updateAnimation();

    if (this._onTimeUpdate) this._onTimeUpdate(this.time);
    this.render();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    const loop = () => {
      if (!this.isRunning) return;
      this.evolve(0.016);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.isRunning = false;
  }

  reset() {
    this.time = 0;
    if (this._onTimeUpdate) this._onTimeUpdate(this.time);
    this.render();
  }

  setTime(t) {
    this.time = Math.max(0, t);
    if (this._onTimeUpdate) this._onTimeUpdate(this.time);
    this.render();
  }

  onTimeUpdate(fn) { this._onTimeUpdate = fn; }

  dispose() {
    this.stop();
    const gl = this.gl;
    if (gl) {
      gl.deleteProgram(this.program);
      gl.deleteBuffer(this.quadBuf);
    }
  }
}
