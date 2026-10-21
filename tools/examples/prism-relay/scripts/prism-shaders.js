// Original GLSL. Position stays unchanged so rendered landings match colliders.
export const vertexSource = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}`;
export const fragmentSource = `
precision highp float;
varying vec2 vUV;
uniform float uTime;
uniform float uEnergy;
uniform float uDanger;
uniform float uIntensity;
uniform float uFrequency;
void main() {
  vec2 p = vUV * uFrequency;
  vec2 cell = abs(fract(p) - 0.5);
  float line = smoothstep(0.43, 0.49, max(cell.x, cell.y));
  float wave = 0.5 + 0.5 * sin((vUV.x + vUV.y) * 18.0 - uTime * 3.0);
  vec3 cool = mix(vec3(0.04, 0.12, 0.22), vec3(0.1, 0.9, 1.0), uEnergy);
  vec3 color = mix(cool, vec3(1.0, 0.12, 0.05), uDanger);
  color *= 0.25 + line * uIntensity + wave * 0.25;
  gl_FragColor = vec4(color, 1.0);
}`;
