#!/usr/bin/env node
// Helper for `nord build`: bundle / minify JS with the vendored esbuild-wasm (offline, no native binary).
//   node tools/export-bundle.mjs <spec.json>
//   spec = { mode: "bundle", entry, out, minify, alias: {name: path} }          -> one classic-script IIFE
//        | { mode: "minify", files: [path, ...] }                               -> in-place per-file minify (ES modules kept)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.self ??= globalThis; // esbuild's browser build expects a worker-ish global
const esbuild = createRequire(import.meta.url)(path.join(root, 'vendor/esbuild-wasm/browser.js'));
await esbuild.initialize({ wasmModule: new WebAssembly.Module(fs.readFileSync(path.join(root, 'vendor/esbuild-wasm/esbuild.wasm'))), worker: false });

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
try {
  if (spec.mode === 'bundle') {
    // the wasm build has no file system access: resolve/load through a plugin
    const fsPlugin = {
      name: 'fs',
      setup(b) {
        b.onResolve({ filter: /.*/ }, (a) => {
          if (a.kind === 'entry-point') return { path: path.resolve(a.path), namespace: 'fs' };
          if (spec.alias?.[a.path]) return { path: spec.alias[a.path], namespace: 'fs' };
          if (a.path.startsWith('.') || path.isAbsolute(a.path)) return { path: path.resolve(a.resolveDir, a.path), namespace: 'fs' };
          return { errors: [{ text: `cannot resolve '${a.path}' (only relative, absolute and 'nord' imports are bundled)` }] };
        });
        b.onLoad({ filter: /.*/, namespace: 'fs' }, (a) => ({ contents: fs.readFileSync(a.path, 'utf8'), loader: 'js', resolveDir: path.dirname(a.path) }));
      },
    };
    const r = await esbuild.build({
      entryPoints: [spec.entry], bundle: true, format: 'iife', minify: !!spec.minify, write: false, plugins: [fsPlugin],
      logLevel: 'warning', legalComments: 'none', target: 'es2022', charset: 'utf8',
    });
    fs.writeFileSync(spec.out, r.outputFiles[0].contents);
  } else if (spec.mode === 'minify') {
    for (const f of spec.files) {
      const r = await esbuild.transform(fs.readFileSync(f, 'utf8'), { minify: true, format: 'esm', target: 'es2022', legalComments: 'none', charset: 'utf8' });
      fs.writeFileSync(f, r.code);
    }
  } else throw new Error(`unknown mode ${spec.mode}`);
} catch (e) { console.error(e.message ?? e); process.exit(1); }
process.exit(0);
