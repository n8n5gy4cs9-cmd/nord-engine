// Toon (cel) shading — Babylon ShaderMaterial: banded diffuse lighting from a light direction uniform.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; uniform mat4 world; attribute vec3 position; attribute vec3 normal; varying vec3 vN;
void main(){ vN = normalize(mat3(world) * normal); gl_Position = worldViewProjection * vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform vec3 lightDir; uniform vec3 baseColor; uniform float bands; varying vec3 vN;
void main(){ float d = max(dot(normalize(vN), normalize(-lightDir)), 0.); d = floor(d*bands)/bands; gl_FragColor = vec4(baseColor*(0.25+0.75*d),1.); }
