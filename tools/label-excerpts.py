#!/usr/bin/env python3
"""For the walkthrough tutorials: labels the remaining unlabelled fences. Shell -> Terminal; JS inside an explanatory section -> Excerpt
(it says plainly that the real file and the place of each part are in the walkthrough). usage: python3 tools/label-excerpts.py pages…"""
import re, sys, pathlib
DIR = pathlib.Path(__file__).resolve().parent.parent / 'docs/manual-src'
EXT = r'(?:js|json|md|glsl|py|html|mjs|css|rs|toml)'
LABEL = re.compile(r'^\s*(\*\*(File|In the file|Terminal|Example|Excerpt|Console output|Output|Result)\b|In a terminal)|`[\w./@-]+\.' + EXT + r'`|^#+ .*[\w/-]+\.' + EXT + r'\b|<span class="f">', re.I)
total = 0
for name in sys.argv[1:]:
    page = DIR / name; lines = page.read_text().split('\n'); out = []; inf = False
    for i, l in enumerate(lines):
        m = re.match(r'^```(\w*)', l)
        if m and not inf:
            inf = True; lang = m.group(1)
            if lang in ('js', 'javascript', 'sh', 'bash', 'glsl'):
                j = len(out) - 1
                while j >= 0 and out[j].strip() == '': j -= 1
                above = ' '.join(out[max(0, j - 1):j + 1])
                if not (LABEL.search(out[j]) or LABEL.search(above)):
                    if lang in ('sh', 'bash'): lab = '**Terminal** (in the project folder, or the folder named in the text above):'
                    else: lab = '**Excerpt** (from the finished project, shown to explain the idea; the file walkthrough further down gives the real file and where each part goes):'
                    if out and out[-1].strip(): out.append('')
                    out.append(lab); total += 1
        elif m and inf: inf = False
        out.append(l)
    page.write_text('\n'.join(out))
print('labels added', total)
