/* ── FisheyeRenderer: WebGL barrel-distortion filter ── */
// eslint-disable-next-line no-unused-vars
class FisheyeRenderer {
  constructor(videoEl, canvas) {
    this.video = videoEl;
    this.canvas = canvas;
    this.strength = 0.5;
    this.running = false;
    this._raf = null;

    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    this._init();
  }

  /* ── shader setup ── */
  _init() {
    const gl = this.gl;

    const vs = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main(){
        v_uv = a_pos * 0.5 + 0.5;
        v_uv.y = 1.0 - v_uv.y;          // flip Y for video
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    const fs = `
      precision mediump float;
      varying vec2 v_uv;
      uniform sampler2D u_tex;
      uniform float u_k;

      void main(){
        vec2 center = vec2(0.5);
        vec2 d = v_uv - center;
        float r2 = dot(d, d);

        // barrel distortion  (k > 0 ⇒ fisheye bulge)
        vec2 distorted = d * (1.0 + u_k * r2 + u_k * 0.5 * r2 * r2);
        vec2 uv = distorted + center;

        // vignette
        float vig = 1.0 - smoothstep(0.35, 0.75, sqrt(r2));

        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){
          gl_FragColor = vec4(0,0,0,1);
        } else {
          gl_FragColor = texture2D(u_tex, uv) * vec4(vec3(vig), 1.0);
        }
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;

    // full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    // texture
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    this.uK = gl.getUniformLocation(prog, 'u_k');
  }

  setStrength(v) { this.strength = v; }

  start() {
    this.running = true;
    this._render();
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  getStream(fps = 30) {
    return this.canvas.captureStream(fps);
  }

  _render() {
    if (!this.running) return;
    const gl = this.gl;
    const v = this.video;

    if (v.readyState >= v.HAVE_CURRENT_DATA) {
      if (this.canvas.width !== v.videoWidth || this.canvas.height !== v.videoHeight) {
        this.canvas.width = v.videoWidth || 640;
        this.canvas.height = v.videoHeight || 480;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      gl.uniform1f(this.uK, this.strength * 4.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    this._raf = requestAnimationFrame(() => this._render());
  }
}
