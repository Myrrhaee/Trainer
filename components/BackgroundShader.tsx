"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_debug;
  varying vec2 v_uv;

  // Smooth noise via hash + smoothstep
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 q = p;
    for (int i = 0; i < 4; i++) {
      v += a * smoothNoise(q);
      q = q * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = v_uv * 2.0 - 1.0;
    float aspect = u_resolution.x / u_resolution.y;
    uv.x *= aspect;

    // Hard debug: instantly visible colorful output
    if (u_debug > 1.5) {
      vec2 p = v_uv;
      vec3 c = 0.55 + 0.45 * cos(u_time * 2.0 + vec3(0.0, 2.0, 4.0) + p.xyx * 6.0);
      gl_FragColor = vec4(c, 1.0);
      return;
    }

    // Very slow, meditative time
    float speed = mix(0.04, 0.24, u_debug);
    float t = u_time * speed;
    vec2 q = uv * 1.8 + vec2(t * 0.15, t * 0.1);
    float n = fbm(q);
    float n2 = fbm(q * 1.3 + vec2(t * -0.08, t * 0.12) + 10.0);
    float n3 = fbm(q * 0.7 + vec2(t * 0.05, t * -0.06) + 20.0);

    // Combine layers for soft dark fluid
    float f = n * 0.5 + n2 * 0.3 + n3 * 0.2;
    // Push contrast a bit so it reads on pure black
    float edge0 = mix(0.22, 0.12, u_debug);
    float edge1 = mix(0.64, 0.56, u_debug);
    f = smoothstep(edge0, edge1, f);
    f = pow(f, mix(0.92, 0.65, u_debug));

    // Zinc palette: very dark base, subtle warm gray wisps
    vec3 dark = vec3(0.035, 0.035, 0.04);   // deeper zinc-950
    vec3 mid  = vec3(0.10, 0.10, 0.11);     // zinc-900
    vec3 light = vec3(0.14, 0.14, 0.155);   // zinc-800 highlight

    float midAmt = mix(0.92, 1.12, u_debug);
    float lightAmt = mix(0.28, 0.55, u_debug);
    vec3 col = mix(dark, mid, clamp(f * midAmt, 0.0, 1.0));
    col = mix(col, light, clamp(f * f * lightAmt, 0.0, 1.0));

    // Subtle vignette so the center is a bit clearer
    float r = length(uv / vec2(aspect, 1.0));
    float vignette = smoothstep(1.25, 0.25, r); // 1 in center, 0 on edges
    float glow = mix(0.035, 0.09, u_debug);
    float vignetteEdge = mix(0.22, 0.34, u_debug);
    col += light * glow * vignette;
    col = mix(col, dark, vignetteEdge * (1.0 - vignette));

    gl_FragColor = vec4(col, 1.0);
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createShaderProgram(
  gl: WebGLRenderingContext,
  vertSource: string,
  fragSource: string
): WebGLProgram | null {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export function BackgroundShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const [debugStatus, setDebugStatus] = useState<string | null>(null);

  const debugEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("shaderDebug") === "1";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;

    const gl = canvasEl.getContext("webgl", { alpha: false, antialias: true });
    if (!gl) {
      if (debugEnabled) setDebugStatus("WebGL FAIL (no context)");
      return;
    }
    const glCtx: WebGLRenderingContext = gl;

    const program = createShaderProgram(glCtx, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) {
      if (debugEnabled) setDebugStatus("WebGL FAIL (program)");
      return;
    }

    // Full-screen quad (clip space -1..1)
    const buffer = glCtx.createBuffer();
    glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buffer);
    glCtx.bufferData(
      glCtx.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      glCtx.STATIC_DRAW
    );

    const positionLoc = glCtx.getAttribLocation(program, "a_position");
    const timeLoc = glCtx.getUniformLocation(program, "u_time");
    const resolutionLoc = glCtx.getUniformLocation(program, "u_resolution");
    const debugLoc = glCtx.getUniformLocation(program, "u_debug");
    if (debugEnabled) {
      const renderer = String(glCtx.getParameter(glCtx.RENDERER) ?? "");
      setDebugStatus(`WebGL OK (${renderer || "renderer"})`);
    }

    function setSize() {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvasEl.width === w && canvasEl.height === h) return;
      canvasEl.width = w;
      canvasEl.height = h;
      canvasEl.style.width = "100%";
      canvasEl.style.height = "100%";
      glCtx.viewport(0, 0, w, h);
    }

    setSize();
    startTimeRef.current = performance.now();

    function render() {
      const now = performance.now();
      const time = (now - startTimeRef.current) / 1000;

      glCtx.useProgram(program);
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buffer);
      glCtx.enableVertexAttribArray(positionLoc);
      glCtx.vertexAttribPointer(positionLoc, 2, glCtx.FLOAT, false, 0, 0);

      glCtx.uniform1f(timeLoc, time);
      glCtx.uniform2f(resolutionLoc, canvasEl.width, canvasEl.height);
      const debug = debugEnabled
        ? time < 1.5
          ? 2
          : Math.max(0, 1 - (time - 1.5) / 10)
        : 0;
      glCtx.uniform1f(debugLoc, debug);

      glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    }

    render();

    const onResize = () => {
      setSize();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      glCtx.deleteProgram(program);
      glCtx.deleteBuffer(buffer);
    };
  }, []);

  return (
    <>
      {debugEnabled && (
        <div className="fixed left-3 top-3 z-[9999] rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1 text-xs text-zinc-200 backdrop-blur">
          {debugStatus ?? "WebGL…"}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 block h-full w-full"
        style={{ width: "100%", height: "100%" }}
        aria-hidden
      />
    </>
  );
}
