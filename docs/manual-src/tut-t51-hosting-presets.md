---
title: T51 Ship it with a hosting preset
section: Tutorials
order: 51
summary: Export a web build with one flag and get the deploy files for itch.io, GitHub Pages, Netlify, Vercel or Docker.
---
**Result:** a build folder that is ready to upload or deploy. Allow 15 minutes. **Start from:** any project that already exports (`nord build my-game`).

::: dummies
A web build is a folder of files. Each host wants slightly different extra files next to it (cache rules, a deploy script, a container recipe). A **hosting preset** writes those for you.
:::

## 1. Pick the place
| Preset | You get | Then |
|---|---|---|
| `itch` | `ITCH.md` and the `.zip` | upload the zip as an *HTML* project, or `butler push` |
| `github-pages` | `.nojekyll`, `404.html`, `.github/workflows/pages.yml` | commit the folder as a repository and push to `main` |
| `netlify` | `netlify.toml`, `_headers` | drag the folder onto netlify.com/drop |
| `vercel` | `vercel.json` | `vercel --prod` inside the folder |
| `docker` | `Dockerfile`, `nginx.conf` | `docker build -t game . && docker run -p 8080:80 game` |

## 2. Build
```
nord build my-game --host netlify -o site
```
In the editor: **Project ▸ Export…**, choose **Hosting preset**, press **Export**. The report lists the extra files as a note.

## 3. Try the Docker one locally
```
nord build my-game --host docker -o site
cd site && docker build -t game . && docker run -p 8080:80 game
```
Open http://localhost:8080.

**Check yourself:** the build folder contains the preset's files (listed in the export report), and the game still starts from the folder. Combine presets with `--pwa` for an installable offline app, and `--minify --optimize` for a smaller build. An unknown name stops with the list of valid ones. Reference: [Export](export.html), `docs/HOSTING.md`. **Next:** [T52 Find the slow part](tut-t52-profiler.html).
