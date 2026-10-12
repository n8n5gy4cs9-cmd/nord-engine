// Fresnel rim light — Adds a coloured rim that strengthens at grazing angles.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; uniform mat4 world; attribute vec3 position; attribute vec3 normal; varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(mat3(world)*normal); vP = (world*vec4(position,1.)).xyz; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform vec3 cameraPosition; uniform vec3 baseColor; uniform vec3 rimColor; uniform float power; varying vec3 vN; varying vec3 vP;
void main(){ float f = pow(1.-max(dot(normalize(vN),normalize(cameraPosition-vP)),0.), power); gl_FragColor = vec4(baseColor + rimColor*f, 1.); }
