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

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    // Aspect correction so smoke doesn't stretch
    float ratio = u_resolution.x / u_resolution.y;
    uv.x *= ratio;

    vec2 p = uv * 3.0; // Scale of "waves"
    float t = u_time * 0.05; // Slow, meditative speed

    // Layered warping for smoke-like motion
    for(int n = 1; n < 5; n++) {
        float i = float(n);
        p.x += 0.7 / i * sin(i * p.y + t + i * 1.5);
        p.y += 0.7 / i * cos(i * p.x + t + i * 2.5);
    }

    // Zinc-950-ish base (slightly lifted so it's visible on pure black)
    vec3 color = vec3(0.06, 0.06, 0.075);

    // Softer highlights (avoid negative brightness)
    float brightness = 0.5 + 0.5 * sin(p.x + p.y);
    brightness = smoothstep(0.25, 0.85, brightness);
    // Smoke highlights (still subtle, but readable)
    color += vec3(0.18, 0.18, 0.20) * (0.55 * brightness);

    // Gentle vignette: keeps edges darker, center a bit clearer
    vec2 centered = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    float r = length(centered);
    float vignette = smoothstep(1.25, 0.15, r);
    color += vec3(0.12, 0.12, 0.14) * (0.05 * vignette);
    color *= mix(0.92, 1.0, vignette);

    gl_FragColor = vec4(color, 1.0);
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

export function BackgroundFluid({
  opacity = 0.42,
}: {
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastLogRef = useRef<number>(0);
  const [mounted, setMounted] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDebugEnabled(new URLSearchParams(window.location.search).get("shaderDebug") === "1");
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasEl: HTMLCanvasElement = canvas;

    const gl = canvasEl.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) return;
    const glCtx: WebGLRenderingContext = gl;

    const program = createShaderProgram(glCtx, VERTEX_SHADER, FRAGMENT_SHADER);
    if (!program) return;

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

      // Visible proof in DevTools that the loop is alive.
      // Throttled to ~1 log/sec to avoid freezing the tab.
      if (debugEnabled && now - lastLogRef.current > 1000) {
        // eslint-disable-next-line no-console
        console.log("Shader is running");
        lastLogRef.current = now;
      }

      glCtx.useProgram(program);
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, buffer);
      glCtx.enableVertexAttribArray(positionLoc);
      glCtx.vertexAttribPointer(positionLoc, 2, glCtx.FLOAT, false, 0, 0);

      if (timeLoc) glCtx.uniform1f(timeLoc, time);
      if (resolutionLoc) glCtx.uniform2f(resolutionLoc, canvasEl.width, canvasEl.height);

      glCtx.drawArrays(glCtx.TRIANGLES, 0, 6);
      rafRef.current = requestAnimationFrame(render);
    }

    render();

    const onResize = () => setSize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      glCtx.deleteProgram(program);
      glCtx.deleteBuffer(buffer);
    };
  }, [mounted, debugEnabled]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      style={{
        zIndex: 0,
        opacity: debugEnabled ? 1 : opacity,
      }}
      aria-hidden
    />
  );
}

