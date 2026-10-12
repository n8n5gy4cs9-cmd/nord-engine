// CRT post effect — Fullscreen fragment shader (Phaser PostFX / Babylon PostProcess): barrel distortion, scanlines, RGB shift.
// Sections are split by the marker lines below; load with fetch() and pass to BABYLON.ShaderMaterial / Phaser PostFXPipeline.
// ---- vertex ----
attribute vec2 position; varying vec2 vUV; void main(){ vUV = position*.5+.5; gl_Position = vec4(position,0.,1.); }
// ---- fragment ----
precision highp float; uniform sampler2D textureSampler; uniform float time; varying vec2 vUV;
void main(){ vec2 c = vUV*2.-1.; c *= 1.+dot(c,c)*.08; vec2 uv = c*.5+.5; if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.){ gl_FragColor=vec4(0.,0.,0.,1.); return; }
 float r = texture2D(textureSampler, uv+vec2(.0015,0.)).r, g = texture2D(textureSampler, uv).g, b = texture2D(textureSampler, uv-vec2(.0015,0.)).b;
 float s = .85+.15*sin(uv.y*700.+time*8.); gl_FragColor = vec4(vec3(r,g,b)*s, 1.); }
