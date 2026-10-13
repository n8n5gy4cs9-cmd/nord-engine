# X-KOM reviewed raster masters

Original artwork generated with the built-in ImageGen tool on 2026-10-13, directed toward 1990s X-COM grit and XCOM 2 military/alien technology. No commercial game art was copied. Credit: Crowelian 2026 + Sonnet.

`prompts.json` records every generation and background-extraction prompt. The 23 `.rgba.gz` files contain reviewed, cropped, native-size RGBA pixels, compressed with gzip; the other eight sheets are drawn by `../details.mjs`. `manifest.json` fixes all 31 output paths, dimensions, frame contracts and metadata. Animation frames retain their original order and baseline. Transparent backgrounds were requested through ImageGen; packing uses hard alpha edges, preserves the exact tactical diamond footprint, and excludes neighboring atlas sprites.

Reproduce the complete art pack offline:

```sh
node tools/pixelart.mjs xkom --preview
node tools/gen_examples.mjs xkom
```

The command needs only Node built-ins. It never calls an image API. The geoscape raster and `tools/examples/xkom/assets/geo/world.map` mission-placement mask must be updated together; the raster is no longer synthesized from map characters. Runtime audio and vendored fonts are separate from this redraw. See `examples/xkom/assets.md` for the complete inventory.
