// Dissolve — Alpha-clips by a noise threshold with a glowing edge. Animate uniform "amount" 0→1.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
uniform mat4 worldViewProjection; attribute vec3 position; attribute vec2 uv; varying vec2 vUV;
void main(){ vUV = uv; gl_Position = worldViewProjection*vec4(position,1.); }
// ---- fragment ----
precision highp float; uniform sampler2D tex; uniform float amount; uniform vec3 edgeColor; varying vec2 vUV;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
void main(){ float k = n(vUV*8.); if(k < amount) discard; vec4 c = texture2D(tex,vUV); float e = smoothstep(amount, amount+.08, k); gl_FragColor = vec4(mix(edgeColor, c.rgb, e), c.a); }
