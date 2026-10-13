# Shader example files
- `terrain.glsl`: exact user-provided shader, “another synthwave sunset thing”; retained unchanged. Source author/licence unspecified.
- `assets/audio/ambience.wav`: original generated 16-second quiet loop, mono 22,050 Hz PCM. Reuse under MIT; regenerate explicitly with `tools/gen_shader_audio.mjs`.
- `app.js`: WebGL2 wrapper, GPU picking/height probes, audio-to-iChannel0 FFT/waveform texture, five-point cube collision demo and code-drawn cube overlay.
- `style.css`: code-drawn app controls; no image sprites needed for this demonstration.

Copies in `examples/shader-terrain/` are runnable/exportable. Edit permanent source under `tools/examples/shader-terrain/`. Font is the system UI font; no online resources.
