// Wind sway (foliage) — Vertex shader bends geometry more with height; pair with any fragment colour/texture.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; attribute vec3 position; attribute vec2 uv; uniform float time; uniform float strength; varying vec2 vUV;
void main(){ vUV = uv; vec3 p = position; p.x += sin(time*2.+position.x*3.+position.z*2.)*strength*position.y; p.z += cos(time*1.7+position.z*3.)*strength*.5*position.y; gl_Position = worldViewProjection*vec4(p,1.); }
// ---- fragment ----
precision highp float; uniform sampler2D tex; varying vec2 vUV;
void main(){ vec4 c = texture2D(tex,vUV); if(c.a<.5) discard; gl_FragColor = c; }
