// Octahedral lattice ray marching with animated repetition
// Credit: FabriceNeyret2 + Shane
// Convertido de ISF a fragment shader WebGL 1 (GLSL ES 1.00)

precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_grosor;

#define PI 3.14159265359

// === PARÁMETROS (antes INPUTS ISF) ===
float timeSpeed = 1.0;          // min 0.0 - max 3.0
float initialStep = 0.5;        // min 0.05 - max 2.0
float minDistance = 0.001;    // min 0.00001 - max 0.001
float maxSteps = 100.0;         // min 30.0 - max 200.0
float gridSize = 2.0;           // min 0.5 - max 5.0
float octahedronRadius = u_grosor;  // min 0.005 - max 0.2
float latticeThickness = 0.05;  // min 0.01 - max 0.3
float cameraSpeed = 1.0;        // min 0.0 - max 3.0
float brightness = 23.0 + (u_grosor * 100.);        // min 1.0 - max 100.0
vec4 monoColor = vec4(0.4 + u_grosor * 8., 1. - u_grosor * 9., 0.5, 1.0);      // Mono: color de las formas (blanco = gris original)
float blackLevel = 0.1;         // min 0.0 - max 1.0 (Mono: intensidad por debajo de la cual el fondo es negro)
float colorMode = 0.0;          // min 0.0 - max 2.0 (0 = Mono, 1 = Depth, 2 = Shapes)
vec4 color1 = vec4(0.2, 0.8, 1.0, 1.0);          // Depth: color cercano
vec4 color2 = vec4(1.0, 0.3, 0.6, 1.0);          // Depth: color lejano
vec4 octahedronColor = vec4(1.0, 0.4, 0.1, 1.0); // Shapes: color de los octaedros
vec4 latticeColor = vec4(0.2, 0.7, 1.0, 1.0);    // Shapes: color de la red
float colorSoftness = 0.02;     // min 0.0001 - max 0.5 (suavidad de la transición entre colores)
float gamma = 0.7;              // min 0.3 - max 2.5
float vignetteIntensity = 0.0;  // min 0.0 - max 1.0

// === SDF LATTICE OCTAÉDRICA ===
// Combina dos distancias:
// 1. Distancia al octaedro repetido en la grid
// 2. Distancia a la "red" entre octaedros
float octahedralLattice(vec3 p, out float latticeDist, out float octDist) {
    // Repetición espacial: celdas de tamaño gridSize centradas en 0
    p = mod(p, gridSize) - gridSize * 0.5;

    // abs() refleja para crear simetría
    p = abs(p);

    // Distancia al octaedro
    float l = (p.x + p.y + p.z) / 3.0;
    float octahedronDist = length(p - l) - octahedronRadius;

    // Distancia a la red
    latticeDist = l - latticeThickness;
    octDist = octahedronDist;

    // Unión de los dos SDFs
    return min(octahedronDist, latticeDist);
}

void main() {
    float time = u_time * timeSpeed;

    // === COORDENADAS ===
    vec2 R = u_resolution;
    vec2 uv = (gl_FragCoord.xy - 0.5 * R) / R.y;

    // === INICIALIZACIÓN ===
    vec4 o = vec4(0.0);     // Acumulador de color y contador
    float g = initialStep;  // Distancia acumulada (avanza el rayo)
    float d = g;            // Distancia al SDF
    float l = 0.0;          // Distancia lattice (temporal)
    float od = 0.0;         // Distancia octaedro (temporal)

    // === RAY MARCHING ===
    // WebGL 1 exige límite constante en el for: 200 = máximo de maxSteps
    int maxStepsInt = int(maxSteps);

    for (int i = 0; i < 200; i++) {
        if (i >= maxStepsInt || d <= minDistance) break;

        // Posición del rayo
        vec3 P = g * vec3(uv, 2.0) / 4.0;
        P.y -= 1.0;
        P.z += time * cameraSpeed;

        // SDF
        d = octahedralLattice(P, l, od);

        // Acumular color
        if (colorMode > 1.5) {
            // Modo Shapes: color según qué forma está más cerca en este paso
            // m = 0 -> octaedro, m = 1 -> lattice
            float m = smoothstep(-colorSoftness, colorSoftness, od - l);
            o.rgb += mix(octahedronColor.rgb, latticeColor.rgb, m);
        } else if (colorMode > 0.5) {
            float depthFactor = clamp(g * 0.1, 0.0, 1.0);
            vec3 depthColor = mix(color1.rgb, color2.rgb, depthFactor);
            o.rgb += depthColor;
        } else {
            o.rgb += vec3(1.0);
        }

        o.x += 1.0; // Contador de pasos

        // Avanzar
        g += d;
    }

    // === TONEMAPPING ===
    float steps = max(o.x, 1.0);
    vec3 col;

    if (colorMode > 0.5) {
        col = o.rgb / steps * brightness * 0.05;
    } else {
        // Intensidad original (gris) -> se recorta el fondo y se tiñe con monoColor
        float v = brightness / steps;
        v = max(v - blackLevel, 0.0) / max(1.0 - blackLevel, 0.0001);
        col = monoColor.rgb * v;
    }

    // === POST-PROCESADO ===
    if (vignetteIntensity > 0.0) {
        float vig = 1.0 - length(uv) * vignetteIntensity;
        col *= vig;
    }

    col = pow(max(col, 0.0), vec3(gamma));

    gl_FragColor = vec4(col, 1.0);
}
