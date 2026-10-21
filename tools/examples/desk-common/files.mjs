export function deskFiles(id, names, { phaser = false, desktop = false } = {}) {
  const files = names.map((name) => ({
    from: `tools/examples/${id}/src/${name}`,
    to: name,
  }));
  files.push(
    { from: 'tools/examples/desk-common/desk.js', to: 'desk.js' },
    { from: 'runtime/core/save.js', to: 'save.js' },
    {
      from: 'tools/art/dev-desk/dev-desk-sprites.png',
      to: 'assets/dev-desk-sprites.png',
    },
    { from: 'vendor/babylonjs/babylon.js', to: 'vendor/babylonjs/babylon.js' },
    { from: 'vendor/babylonjs/license.md', to: 'vendor/babylonjs/LICENSE.md' },
    { from: 'vendor/havok/HavokPhysics_umd.js', to: 'vendor/havok/HavokPhysics_umd.js' },
    { from: 'vendor/havok/HavokPhysics.wasm', to: 'vendor/havok/HavokPhysics.wasm' },
    { from: 'vendor/havok/LICENSE', to: 'vendor/havok/LICENSE' },
    { from: 'LICENSE', to: 'LICENSE' },
  );
  if (phaser)
    files.push(
      { from: 'vendor/phaser/phaser.min.js', to: 'vendor/phaser/phaser.min.js' },
      { from: 'vendor/phaser/LICENSE.md', to: 'vendor/phaser/LICENSE.md' },
    );
  if (desktop)
    files.push({ from: 'runtime/desktop/nord-desktop.js', to: 'nord-desktop.js' });
  return files;
}
