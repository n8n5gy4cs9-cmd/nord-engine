// Hologram — Fresnel rim + moving scanlines with additive-looking alpha.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; uniform mat4 world; attribute vec3 position; attribute vec3 normal; varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(mat3(world)*normal); vP = (world*vec4(position,1.)).xyz; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform vec3 cameraPosition; uniform float time; uniform vec3 tint; varying vec3 vN; varying vec3 vP;
void main(){ float f = pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vP))),2.); float s = .5+.5*sin(vP.y*40.-time*4.); gl_FragColor = vec4(tint*(f+.25*s), .35+.5*f); }
