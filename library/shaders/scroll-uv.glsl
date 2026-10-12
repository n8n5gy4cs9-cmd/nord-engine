// Scrolling UV — Scrolls a texture by (speed.x, speed.y) per second — conveyors, waterfalls, energy beams.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; attribute vec3 position; attribute vec2 uv; varying vec2 vUV;
void main(){ vUV = uv; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform sampler2D tex; uniform float time; uniform vec2 speed; varying vec2 vUV;
void main(){ gl_FragColor = texture2D(tex, fract(vUV + speed*time)); }
