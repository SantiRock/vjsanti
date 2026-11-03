import { useEffect, useRef } from "react";

import vertexSource from "../shaders/vertex.glsl?raw";
import fragmentSource from "../shaders/fragment.glsl?raw";

// Rango del uniform grosor
const GROSOR_MIN = 0.01;
const GROSOR_MAX = 0.07;

// Ajustes de la respuesta al volumen
const BASS_MIN_HZ = 300; // inicio de la banda de bajos
const BASS_MAX_HZ =  800; // fin de la banda de bajos
const BASS_FLOOR = 0.35; // 0-1, nivel por debajo del cual se ignora (sube si hay ruido de fondo)
const BASS_GAIN = 2.5; // sensibilidad: sube si el grosor casi no se mueve
const ATTACK = 0.5; // 0-1, qué tan rápido sube (más alto = más rápido)
const RELEASE = 0.08; // 0-1, qué tan rápido baja (más bajo = más suave)

export function Canvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    let onMove;

    if (!gl) {
      console.error("WebGL no soportado");
      return;
    }

    //-------------------------
    // Buffers
    //-------------------------

    const vertices = [-1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0];

    const indices = [3, 2, 1, 3, 1, 0];

    const vertexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW,
    );

    //-------------------------
    // Vertex Shader
    //-------------------------

    const vertShader = gl.createShader(gl.VERTEX_SHADER);

    gl.shaderSource(vertShader, vertexSource);

    gl.compileShader(vertShader);

    if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(vertShader));

      return;
    }

    //-------------------------
    // Fragment Shader
    //-------------------------

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(fragShader, fragmentSource);

    gl.compileShader(fragShader);

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(fragShader));

      return;
    }

    //-------------------------
    // Program
    //-------------------------

    const program = gl.createProgram();

    gl.attachShader(program, vertShader);

    gl.attachShader(program, fragShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));

      return;
    }

    gl.useProgram(program);

    //-------------------------
    // Attributes
    //-------------------------

    const position = gl.getAttribLocation(program, "a_position");

    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(position);

    //-------------------------
    // Uniforms
    //-------------------------

    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");

    // Si el shader todavía no declara "grosor", esto devuelve null
    // y gl.uniform1f(null, ...) simplemente no hace nada (no da error)
    const uGrosor = gl.getUniformLocation(program, "u_grosor");
    gl.uniform1f(uGrosor, GROSOR_MIN);

    //-------------------------
    // Web Audio API (volumen del micrófono -> grosor)
    //-------------------------

    let audioCtx = null;
    let mediaStream = null;
    let analyser = null;
    let audioData = null;
    let bassStart = 0; // primer bin de la banda de bajos
    let bassEnd = 1; // último bin (exclusivo) de la banda de bajos
    let level = 0; // volumen suavizado, 0-1
    let disposed = false; // evita fugas si el componente se desmonta mientras se pide el permiso

    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Desactivados para que el volumen medido sea el real
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        mediaStream = stream;

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const source = audioCtx.createMediaStreamSource(stream);

        analyser = audioCtx.createAnalyser();
        // fftSize alto = más resolución en frecuencias graves
        // (con 2048 y 48 kHz cada bin ocupa ~23 Hz)
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        audioData = new Uint8Array(analyser.frequencyBinCount);

        // Convertir Hz a índices de bin
        const hzPerBin = audioCtx.sampleRate / analyser.fftSize;
        bassStart = Math.max(1, Math.floor(BASS_MIN_HZ / hzPerBin));
        bassEnd = Math.max(bassStart + 1, Math.ceil(BASS_MAX_HZ / hzPerBin));

        // No se conecta a audioCtx.destination para evitar feedback
        source.connect(analyser);
      } catch (err) {
        console.error("No se pudo acceder al micrófono:", err);
      }
    }

    // Algunos navegadores dejan el AudioContext en "suspended" hasta
    // que hay un gesto del usuario
    function resumeAudio() {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    }

    window.addEventListener("click", resumeAudio);
    window.addEventListener("keydown", resumeAudio);

    initAudio();

    // Devuelve el valor de grosor (0.5 - 0.7) según el volumen actual
    function getGrosor() {
      let target = 0;

      if (analyser) {
        analyser.getByteFrequencyData(audioData);

        // Promedio de energía en la banda de bajos (0-255 -> 0-1)
        let sum = 0;
        for (let i = bassStart; i < bassEnd; i++) {
          sum += audioData[i];
        }
        const bass = sum / (bassEnd - bassStart) / 255;

        // Se descarta el piso de ruido y se aplica la sensibilidad
        const gated = Math.max(bass - BASS_FLOOR, 0) / (1 - BASS_FLOOR);

        target = Math.min(gated * BASS_GAIN, 1);
      }

      // Suavizado: sube rápido, baja lento
      const k = target > level ? ATTACK : RELEASE;
      level += (target - level) * k;

      return GROSOR_MIN + level * (GROSOR_MAX - GROSOR_MIN);
    }

    //-------------------------
    // Resize
    //-------------------------

    function resize() {
      canvas.width = window.innerWidth;

      canvas.height = window.innerHeight;

      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.uniform2f(uResolution, canvas.width, canvas.height);
    }

    window.addEventListener("resize", resize);

    resize();

    //-------------------------
    // Animation
    //-------------------------

    const start = performance.now();

    let animationId;

    function render() {
      const t = (performance.now() - start) * 0.001;

      gl.uniform1f(uTime, t);

      gl.uniform1f(uGrosor, getGrosor());

      gl.clearColor(0, 0, 0, 1);

      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      animationId = requestAnimationFrame(render);
    }

    render();

    //-------------------------
    // Cleanup
    //-------------------------

    return () => {
      disposed = true;

      cancelAnimationFrame(animationId);

      window.removeEventListener("resize", resize);

      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }

      if (audioCtx) {
        audioCtx.close();
      }

      gl.deleteProgram(program);

      gl.deleteShader(vertShader);

      gl.deleteShader(fragShader);

      gl.deleteBuffer(vertexBuffer);

      gl.deleteBuffer(indexBuffer);
    };
  }, []);

  return <canvas ref={canvasRef} className="canvas" />;
}
