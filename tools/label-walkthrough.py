#!/usr/bin/env python3
"""Labels the code fences of the 'Walk through every project file' tutorials (T38-T43): the page builds each file in order, one
'#### N.M — title' step per chunk under a '### N. file' heading, so the label is exact: file + step + 'below the code of the previous step'."""
import re, sys, pathlib
DIR = pathlib.Path(__file__).resolve().parent.parent / 'docs/manual-src'
EXT = r'(?:js|json|md|glsl|py|html|mjs|css|rs|toml)'
LABEL = re.compile(r'^\s*(\*\*(File|In the file|Terminal|Example|Console output|Output|Result)\b|In a terminal)|`[\w./@-]+\.' + EXT + r'`|^#+ .*[\w/-]+\.' + EXT + r'\b|<span class="f">', re.I)
total = 0
for name in sys.argv[1:]:
    page = DIR / name; lines = page.read_text().split('\n'); out = []; inf = False; file = None; step = None; first = {}
    for l in lines:
        h = re.match(r'^### \d+\. (\S+)', l)
        if h: file = h.group(1); step = None
        s = re.match(r'^#### (\d+\.\d+) — (.+?)(?: \{#.*)?$', l)
        if s: step = (s.group(1), s.group(2))
        m = re.match(r'^```(\w*)', l)
        if m and not inf:
            inf = True
            if m.group(1) in ('js', 'javascript', 'json', 'bash', 'sh', 'glsl') and file and step:
                j = len(out) - 1
                while j >= 0 and out[j].strip() == '': j -= 1
                above = ' '.join(out[max(0, j - 1):j + 1])
                if not (LABEL.search(out[j]) or LABEL.search(above)):
                    n = first.get(file, 0); first[file] = n + 1
                    where = 'the beginning of the file' if step[1] and step[0].endswith('.1') and n == 0 else 'the next part of this file; it goes **below** the code of the previous step'
                    lab = f'**File: `{file}`** (step {step[0]}, {step[1][0].lower() + step[1][1:]}: {where})'
                    if out and out[-1].strip(): out.append('')
                    out.append(lab); total += 1
        elif m and inf: inf = False
        out.append(l)
    page.write_text('\n'.join(out))
print('labels added', total)
