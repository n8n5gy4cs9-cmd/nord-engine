// Outline (inverted hull) — Render a slightly inflated back-face copy of the mesh with this material for a solid outline.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; attribute vec3 position; attribute vec3 normal; uniform float width;
void main(){ gl_Position = worldViewProjection*vec4(position + normal*width, 1.); }
// ---- fragment ----
precision highp float; uniform vec3 lineColor;
void main(){ gl_FragColor = vec4(lineColor,1.); }
