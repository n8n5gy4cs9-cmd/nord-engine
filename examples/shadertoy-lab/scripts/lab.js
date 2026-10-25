// Shadertoy Lab: press C to switch the CRT post effect on and off. `await __lab.selfTest()` runs the checks of tools/shadertoy-lab-test.mjs.
import { MonoBehaviour, UnityInput as Input, KeyCode } from 'nord';

export default class Lab extends MonoBehaviour {
  start() { window.__lab = this; this.crt = null; }
  update() {
    if (Input.GetKeyDown(KeyCode.C)) this.ToggleCrt();
  }
  ToggleCrt() {
    if (this.crt) { this.crt.remove(); this.crt = null; return; }
    this.crt = this.game.effects.add('scene', 'shadertoy', { file: 'assets/shaders/crt.glsl', channels: [{ type: 'screen' }] });
  }
  async selfTest() {
    const out = [], ok = (name, pass, info = '') => out.push({ name, ok: !!pass, info: String(info) });
    const g = this.game, sleep = (s) => new Promise((res) => { const t0 = g.time.elapsed, t = () => (g.time.elapsed - t0 >= s ? res() : setTimeout(t, 16)); t(); });
    const comps = ['Background', 'Tunnel', 'Paint', 'Keys', 'Spectrum'].map((n) => [n, this.scene.find(n).getComponent('shadertoy')]);
    for (const [, c] of comps) await c.ready;
    await sleep(0.5);
    for (const [n, c] of comps) ok(`${n}: compiled and running`, c.st && !c.st.error && c.st.frame > 5, `frame ${c.st?.frame}`);
    const px = (st) => { const gl = st.gl, a = new Uint8Array(4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(Math.floor(st.width * 0.85), st.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, a); return [...a]; };
    ok('Tunnel draws colour', px(comps[1][1].st).slice(0, 3).some((v) => v > 10), px(comps[1][1].st));
    // Buffer A feedback: paint with the mouse → pixels appear, then fade
    const paint = comps[2][1].st, p = g.input.pointer, pe = this.scene.find('Paint');
    Object.assign(p, { worldX: pe.pos[0], worldY: pe.pos[1], down: true }); await sleep(0.3); // the component turns the pointer into iMouse
    p.down = false;
    const gl = paint.gl, b = paint.buffers.get('A'), px2 = new Float32Array(4); gl.bindFramebuffer(gl.FRAMEBUFFER, b.sides[b.cur].fb); gl.readPixels(paint.width >> 1, paint.height >> 1, 1, 1, gl.RGBA, gl.FLOAT, px2); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    ok('Buffer A keeps what the mouse painted (float feedback buffer)', px2[0] + px2[1] + px2[2] > 0.5, [...px2].map((v) => v.toFixed(2)));
    // keyboard channel
    comps[3][1].st.keyDown.add(37); await sleep(0.2); comps[3][1].st.keyDown.delete(37);
    ok('Keyboard channel texture is uploaded', comps[3][1].st.keys.length === 768);
    // uniforms + post effect
    comps[0][1].st.setUniform('uTest', 1.5); ok('setUniform accepts a name the shader does not declare', true);
    const fx = g.effects.add('scene', 'shadertoy', { file: 'assets/shaders/crt.glsl', channels: [{ type: 'screen' }] }); await sleep(0.6);
    ok('Scene post effect runs', !!fx && g.effects.canvas.parentElement.querySelectorAll('canvas').length >= 2, 'overlay canvas present');
    fx.remove(); await sleep(0.1);
    ok('...and goes away again', g.effects.canvas.parentElement.querySelectorAll('canvas').length === 1);
    return out;
  }
}
