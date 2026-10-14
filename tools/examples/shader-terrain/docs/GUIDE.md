# Shader Terrain Lab
Open `examples/shader-terrain` in NordEditor and press Play, or run `nord serve examples/shader-terrain`. The original owner-pasted GLSL is `terrain.glsl`; the HTML-tier host supplies Shadertoy-style uniforms and calls `mainImage` using WebGL2. Export with the HTML target; all files stay local.

- The scene starts animated. Freeze terrain pauses its shader time and sound-texture snapshot; Resume terrain resumes the drive and clears the old cube.
- Click visible ground or press Drop cube. The scene freezes so the selected surface stays still while gravity moves the cube. Clicking sky gives a helpful message.
- The host runs the SAME GLSL `trinoise` in a 1×1 GPU framebuffer to sample terrain height. Five probes under the cube footprint give a conservative contact height. The cube's bottom stops there; the text shows the height and contact.
- Click picking also uses the shader's own `intersect` raymarch function. It does not substitute a flat plane for the procedural landscape.
- The cube is a projected 3D box drawn on a transparent 2D overlay. This is a simple matching-height interaction example, not a full terrain physics mesh, rigid-body solver or complete depth-occlusion system. Large footprints and steep terrain need a real mesh/collider or more detailed collision representation.
- Enable audio starts the generated local ambient loop after a player gesture; Mute audio stops it. Web Audio analyses this WAV before the speaker-volume control and feeds `iChannel0` a 512×2 texture: bottom row FFT, top row waveform. The compiled shader enables its original sound-sampling branch (camera speed 5); the file on disk stays unchanged. Terrain and sky now react to the loop. Muting clears the input on the next unfrozen frame. Freeze/drop holds the audio snapshot too, keeping the picture and cube collision consistent while the music continues; resume applies live audio again. Replace the local WAV to visualize your own music.
- WebGL2 is required. Shader compile errors are shown in the status area.

Source: `tools/examples/shader-terrain/`; regenerate with `node tools/gen_examples.mjs shader-terrain`. Original WAV regeneration: `node tools/gen_shader_audio.mjs` (overwrites that default audio). Full short tutorial: `docs/manual/nord/tutorials/tut-t22-shader-terrain.html`.

The exact provided shader text is preserved, including its title/description comments. Shader origin/author/licence were not supplied; no new ownership claim is made over it. Host and generated audio: Crowelian 2026 + Sonnet, MIT. No tests or native build were run for this work at the owner's request.
