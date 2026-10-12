// Triplanar terrain — Projects a tileable texture on three axes, blended by normal; no UVs needed.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; uniform mat4 world; attribute vec3 position; attribute vec3 normal; varying vec3 vN; varying vec3 vP;
void main(){ vN = normalize(mat3(world)*normal); vP = (world*vec4(position,1.)).xyz; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform sampler2D tex; uniform float scale; varying vec3 vN; varying vec3 vP;
void main(){ vec3 w = pow(abs(normalize(vN)), vec3(4.)); w /= (w.x+w.y+w.z); vec3 c = texture2D(tex,vP.yz*scale).rgb*w.x + texture2D(tex,vP.xz*scale).rgb*w.y + texture2D(tex,vP.xy*scale).rgb*w.z; gl_FragColor = vec4(c,1.); }
