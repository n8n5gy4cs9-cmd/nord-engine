---
title: T14 Export to web & host it
section: Tutorials
order: 14
summary: Build a static folder, test it, upload it.
---
1. `nord check my-game` — validates the project.
2. `nord build my-game --minify --optimize --zip` (or **Project → Export…**).
3. Test locally: `cd my-game/dist && python3 -m http.server 8000`, open http://localhost:8000.
4. Offline proof: `nord check-offline my-game/dist` must pass (the build already runs it).
5. Upload: itch.io (zip, *played in the browser*), GitHub Pages (`dist/` to `gh-pages`), Netlify/Cloudflare Pages (drag the folder).
6. For a file you can double-click: `nord build my-game --single-file`.

Details: [Export & hosting](export.html). **Next:** [T15 Mac app](tut-t15-mac-app.html).
