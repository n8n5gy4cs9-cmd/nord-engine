#!/usr/bin/env python3
"""Generate docs/manual-src/tutorials.md (the Tutorials landing page) from the tut-*.md front matter.

Edit META / PATHS below when you add a tutorial, then run:
    python3 tools/make-tutorials-index.py && node tools/build-manual.mjs
"""
import html, re, pathlib

SRC = pathlib.Path(__file__).resolve().parent.parent / "docs" / "manual-src"

B, I, A = "Beginner", "Intermediate", "Advanced"
# id -> (level, [tags])   tags: 2d 3d rust nocode code creator app export fullgame
META = {
 1: (B, ["2d"]), 2: (B, ["2d"]), 3: (B, ["code"]), 4: (B, ["2d"]), 5: (I, ["2d", "code"]),
 6: (B, ["2d"]), 7: (I, ["2d"]), 8: (I, ["2d", "code"]), 9: (B, ["code"]), 10: (I, ["3d"]),
 11: (I, ["3d", "code"]), 12: (I, ["code"]), 13: (I, ["code"]), 14: (B, ["export"]), 15: (I, ["export"]),
 16: (A, ["rust"]), 17: (A, ["rust", "app"]), 18: (I, ["code"]), 19: (A, ["app", "fullgame"]), 20: (A, ["fullgame", "code"]),
 21: (I, ["fullgame"]), 22: (A, ["3d", "code"]), 23: (I, ["2d"]), 24: (B, ["nocode", "2d"]), 25: (B, ["nocode", "2d"]),
 26: (B, ["nocode", "app"]), 27: (B, ["creator", "3d"]), 28: (I, ["creator", "2d"]), 29: (I, ["creator", "2d"]), 30: (I, ["creator", "2d"]),
 31: (B, ["2d", "fullgame"]), 32: (I, ["3d", "fullgame"]), 33: (I, ["2d", "code", "fullgame"]), 34: (I, ["3d", "code", "fullgame"]),
 35: (A, ["3d", "code"]), 36: (A, ["code", "fullgame"]), 37: (A, ["rust", "fullgame"]), 38: (A, ["code", "fullgame"]),
 39: (A, ["3d", "code", "fullgame"]), 40: (A, ["code", "fullgame"]), 41: (A, ["code", "fullgame"]), 42: (A, ["app", "3d", "fullgame"]),
 43: (A, ["app", "3d", "fullgame"]), 44: (I, ["code", "nocode"]), 45: (I, ["code", "nocode", "2d"]), 46: (I, ["nocode", "2d", "fullgame"]),
 47: (B, ["3d", "code"]), 48: (A, ["3d", "2d", "code", "nocode", "fullgame"]),
 49: (B, ["3d", "creator"]), 50: (I, ["2d", "3d", "nocode"]), 51: (B, ["export"]), 52: (I, ["code"]), 53: (A, ["code", "2d"]), 54: (I, ["3d", "creator"]),
}
TAGNAMES = {"2d": "2D", "3d": "3D", "rust": "Rust", "nocode": "No code", "code": "Coding", "creator": "Level creator",
            "app": "App", "export": "Export", "fullgame": "Complete project"}
FILTERS = ["2d", "3d", "nocode", "creator", "code", "rust", "app", "export", "fullgame"]

PATHS = [
 ("01", "Your first afternoon", "Never used Nord? Start here. Four short lessons, one working result each.", [1, 2, 3, 4]),
 ("02", "Make games without code", "Event sheets and behaviors: rules you can read like sentences.", [24, 25, 26]),
 ("03", "Build levels visually", "Paint maps and place objects with the 2D Level Creator and FPS Creator.", [28, 29, 30, 27]),
 ("04", "Finish a whole game by editing", "Take a working template to a complete game: tune, extend, export.", [31, 32]),
 ("05", "Learn to code a game", "From your first script to full JavaScript games with lives, records and menus.", [3, 12, 13, 33, 34]),
 ("06", "Advanced projects", "Shaders, servers, Rust and complete apps, with every file explained.", [35, 36, 37, 38, 39, 40, 41, 42, 43]),
 ("07", "Ship it", "Put your game on a website or in a Mac app.", [14, 15]),
 ("08", "The Unity-style editor", "Layouts, prefabs, materials, UI scaler, graphs and event sheets, then a finished showcase to take apart.", [47, 48]),
 ("09", "New tools: model, animate, ship, profile, play together", "The 3D Modeler, the Animator, hosting presets, the deep profiler and multiplayer tools, one short lesson each.", [49, 50, 51, 52, 53, 54]),
]


def front(path):
    t = path.read_text()
    m = re.match(r"---\n(.*?)\n---", t, re.S)
    d = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        d[k.strip()] = v.strip()
    body = t[m.end():]
    img = re.search(r"assets/screenshots/[A-Za-z0-9_.-]+\.png", body)
    return d, img.group(0) if img else None


def short(s, n=150):
    s = s.strip()
    if len(s) <= n:
        return s
    return s[:n].rsplit(" ", 1)[0].rstrip(",;:—-") + "…"


tuts = {}
for p in sorted(SRC.glob("tut-t*.md")):
    n = int(re.match(r"tut-t(\d+)", p.name).group(1))
    d, img = front(p)
    title = re.sub(r"^T\d+\s+", "", d["title"])
    tuts[n] = dict(n=n, href=p.stem + ".html", title=title, summary=d.get("summary", ""), img=img)
missing = [n for n in tuts if n not in META]
assert not missing, f"add META for tutorials {missing}"


def lv_class(l):
    return {"Beginner": "lv-b", "Intermediate": "lv-i", "Advanced": "lv-a"}[l]


def card(t):
    lvl, tags = META[t["n"]]
    e = html.escape
    thumb = (f'<img src="{t["img"]}" alt="" loading="lazy">' if t["img"] else
             f'<span class="tgrad g{t["n"] % 6}">{"&#9654;"}</span>')
    chips = "".join(f'<em class="tag">{TAGNAMES[x]}</em>' for x in tags)
    search = e(f'T{t["n"]:02d} {t["title"]} {t["summary"]} {lvl} ' + " ".join(TAGNAMES[x] for x in tags)).lower()
    return (f'<a class="tcard" href="{t["href"]}" data-level="{lvl}" data-tags="{" ".join(tags)}" data-q="{search}">'
            f'<span class="tthumb">{thumb}<span class="tnum">T{t["n"]:02d}</span></span>'
            f'<span class="tbody"><span class="tmeta"><em class="lv {lv_class(lvl)}">{lvl}</em>{chips}</span>'
            f'<b>{e(t["title"])}</b><span class="tsum">{e(short(t["summary"]))}</span></span></a>')


out = ['''---
title: Learn by building
section: Tutorials
order: 0
summary: Pick a learning path or browse every tutorial by level and topic.
---
Every tutorial builds something you can run. Each one names its goal, shows the expected result and ends with a check you can see. Pick a path below, or filter all %d tutorials by level and topic.
''' % len(tuts)]

out.append('<div class="lp-grid">')
for num, name, blurb, ids in PATHS:
    first = tuts[ids[0]]
    steps = "".join(
        f'<li><a href="{tuts[i]["href"]}"><span>T{i:02d}</span>{html.escape(tuts[i]["title"])}</a></li>' for i in ids)
    out.append(f'<section class="lpath"><div class="path-step">PATH {num}</div><h3>{html.escape(name)}</h3>'
               f'<p>{html.escape(blurb)}</p><ol>{steps}</ol></section>')
out.append('</div>\n')

out.append('''::: dummies
A **tutorial** is a guided exercise with a result. The **Manual** explains a tool in depth. The **API** is a dictionary of exact names. You never need to read the dictionary from start to finish. New to programming? Read [Programming for dummy developers](developer-basics.html) before your first script lesson.
:::
''')

out.append('## All tutorials\n')
chips = ['<button class="tf on" data-f="all">All</button>'] + \
        [f'<button class="tf" data-f="{f}">{TAGNAMES[f]}</button>' for f in FILTERS]
lvls = ['<button class="tl on" data-l="all">Any level</button>'] + \
       [f'<button class="tl" data-l="{l}">{l}</button>' for l in (B, I, A)]
out.append('<div class="tfilter"><input type="search" class="tsearch" placeholder="Search tutorials…" aria-label="Search tutorials">'
           f'<div class="tchips" role="group" aria-label="Topic">{"".join(chips)}</div>'
           f'<div class="tchips" role="group" aria-label="Level">{"".join(lvls)}</div>'
           '<p class="tcount" aria-live="polite"></p></div>')
out.append('<div class="tgrid">' + "".join(card(tuts[n]) for n in sorted(tuts)) + '</div>\n')
out.append('<p class="tempty" hidden>No tutorial matches. Clear the search or choose <b>All</b>.</p>\n')

out.append('''## Related guides
* [Getting started](getting-started.html) and [How Nord works](how-nord-works.html) if you have not opened the editor yet.
* [Mobile and touch controls](mobile-controls.html): a joystick and buttons for phones and tablets.
* [Cookbook](cookbook.html) and the [cheat sheets](cheat-sheet-nordjs.html): copy-ready answers once you know the basics.
* [FPS Creator](fps-creator.html) and [2D Level Creator](level-creator-2d.html): the full guides behind the level-building tutorials.
''')
(SRC / "tutorials.md").write_text("\n".join(out))
print("wrote tutorials.md:", len(tuts), "tutorials")
