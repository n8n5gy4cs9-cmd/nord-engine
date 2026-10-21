// Snap in projected space so the grid follows the screen, rather than world units.
export const vertexSource = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float uRetro;
uniform vec2 uGrid;
varying vec3 vNormal;

void main() {
  vec4 clip = worldViewProjection * vec4(position, 1.0);
  vec2 projected = clip.xy / clip.w;
  vec2 snapped = floor(projected * uGrid + 0.5) / uGrid;
  clip.xy = mix(clip.xy, snapped * clip.w, uRetro);
  gl_Position = clip;
  vNormal = normalize(mat3(world) * normal);
}
`;

// A 2×2 ordered dither offsets the sixteen-level colour quantization.
export const fragmentSource = `
precision highp float;
uniform vec3 uColor;
uniform float uRetro;
varying vec3 vNormal;

void main() {
  vec3 lightDirection = normalize(vec3(-0.4, 0.8, -0.5));
  float light = 0.45 + 0.55 * max(dot(normalize(vNormal), lightDirection), 0.0);
  vec3 color = uColor * light;
  vec2 pixel = mod(floor(gl_FragCoord.xy), 2.0);
  float dither = (pixel.x + pixel.y * 2.0) / 4.0 - 0.375;
  vec3 quantized = floor(
    clamp(color + dither / 15.0, 0.0, 1.0) * 15.0 + 0.5
  ) / 15.0;
  gl_FragColor = vec4(mix(color, quantized, uRetro), 1.0);
}
`;
