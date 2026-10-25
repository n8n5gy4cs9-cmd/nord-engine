// World-space text for Babylon (Unity's TextMesh): the `text` component in a 3D scene is a plane in the world, not a screen label.
// Shared by the game runtime and the editor Scene view. The text is drawn into a DynamicTexture; one world unit = 64 text pixels
// (the same pixels-per-unit as sprites), so `size: 64` is about one unit tall. Scale the entity to make it bigger.
export const TEXT_PPU = 64;
const SS = 2; // texture pixels per text pixel: keeps the glyphs sharp when you stand close

/** Create the text plane for the `text` component data `d`. Returns `{ mesh, update(d), dispose() }`; `mesh` is parented by the caller. */
export function createTextMesh(B, scene, name, d) {
  const plane = B.MeshBuilder.CreatePlane(name, { size: 1 }, scene);
  const mat = new B.StandardMaterial(`${name}.mat`, scene);
  mat.disableLighting = true; // text is its own light, like an emissive screen
  mat.specularColor = new B.Color3(0, 0, 0);
  plane.material = mat;
  let tex = null, w = 0, h = 0, shown = '', lastFont = '';
  const measure = document.createElement('canvas').getContext('2d');

  const update = (data) => {
    d = data;
    const size = d.size ?? 16, px = size * SS, lines = String(d.text ?? '').split('\n');
    const font = `${d.bold ? 'bold ' : ''}${px}px ${d.font ?? 'Inter, system-ui, sans-serif'}`;
    measure.font = font;
    if (font !== lastFont) { lastFont = font; w = 0; } // a new font or size starts a fresh texture
    const pad = Math.ceil(px * 0.3), lh = Math.ceil(px * 1.25);
    const nw = Math.max(8, Math.ceil(Math.max(...lines.map((l) => measure.measureText(l).width)) + pad * 2));
    const nh = Math.ceil(lh * lines.length + pad * 2);
    const key = JSON.stringify([d.text, font, d.color, d.align, d.stroke, d.strokeThickness]);
    if (key === shown) return;
    shown = key;
    if (!tex || nw > w || nh !== h) { // grow only: a ticking clock must not jump in size when a "1" is narrower than an "8"
      w = Math.max(w, nw); h = nh;
      tex?.dispose();
      tex = new B.DynamicTexture(`${name}.tex`, { width: w, height: h }, scene, true);
      tex.hasAlpha = true;
      mat.diffuseTexture = tex; mat.emissiveTexture = tex; mat.opacityTexture = tex;
      mat.diffuseColor = new B.Color3(0, 0, 0); mat.emissiveColor = new B.Color3(1, 1, 1);
      plane.scaling.set(w / SS / TEXT_PPU, h / SS / TEXT_PPU, 1);
    }
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, w, h);
    ctx.font = font; ctx.textBaseline = 'middle';
    const align = d.align ?? 'center', x = align === 'left' ? pad : align === 'right' ? w - pad : w / 2;
    ctx.textAlign = align; ctx.fillStyle = d.color ?? '#ffffff';
    ctx.lineJoin = 'round';
    lines.forEach((l, i) => {
      const y = pad + lh * (i + 0.5);
      if (d.stroke && d.strokeThickness) { ctx.lineWidth = d.strokeThickness * SS; ctx.strokeStyle = d.stroke; ctx.strokeText(l, x, y); }
      ctx.fillText(l, x, y);
    });
    tex.update(true);
  };
  update(d);
  return { mesh: plane, update, dispose() { tex?.dispose(); mat.dispose(); plane.dispose(); } };
}
