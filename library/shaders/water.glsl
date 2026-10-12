// Water (animated) — Scrolling distortion + highlight bands for a top-down or side water plane.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; attribute vec3 position; attribute vec2 uv; varying vec2 vUV;
void main(){ vUV = uv; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform float time; uniform vec3 shallow; uniform vec3 deep; varying vec2 vUV;
void main(){ vec2 p = vUV*12.; float w = sin(p.x+time)+sin(p.y*1.3-time*1.2)+sin((p.x+p.y)*.7+time*.6); float h = smoothstep(1.6,2.2,w); vec3 c = mix(deep, shallow, .5+.5*w/3.) + h*.25; gl_FragColor = vec4(c, .85); }
