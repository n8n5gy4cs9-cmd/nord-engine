#!/usr/bin/env python3
"""Applies hand-written labels (tools/doc-labels/<page>.txt, one label per line, in the order of the fences that `node tools/lint-docs-style.mjs`
flags) above those code fences. A label line of '-' skips that fence. usage: python3 tools/apply-doc-labels.py [pages…]"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / 'docs/manual-src'; LAB = ROOT / 'tools/doc-labels'
EXT = r'(?:js|json|md|glsl|py|html|mjs|css|rs|toml)'
LABEL = re.compile(r'^\s*(\*\*(File|In the file|Terminal|Example|Console output|Output|Result)\b|In a terminal)|`[\w./@-]+\.' + EXT + r'`|^#+ .*[\w/-]+\.' + EXT + r'\b|<span class="f">', re.I)
names = sys.argv[1:] or [p.stem for p in sorted(LAB.glob('*.txt'))]
for name in names:
    lf = LAB / f'{name}.txt'
    if not lf.exists(): continue
    labels = [l.rstrip('\n') for l in lf.read_text().split('\n') if l.strip() != '']
    page = DIR / f'{name}.md'; lines = page.read_text().split('\n'); out = []; inf = False; k = 0; flagged = []
    for i, l in enumerate(lines):
        m = re.match(r'^```(\w*)', l)
        if m and not inf:
            inf = True
            if m.group(1) in ('js', 'javascript', 'json', 'bash', 'sh', 'glsl'):
                j = len(out) - 1
                while j >= 0 and out[j].strip() == '': j -= 1
                above = ' '.join(out[max(0, j - 1):j + 1])
                if not (LABEL.search(out[j]) or LABEL.search(above)): flagged.append(len(out))
        elif m and inf: inf = False
        out.append(l)
    if len(flagged) != len(labels):
        print(f'SKIP {name}: {len(flagged)} fences need a label but the file has {len(labels)}'); continue
    for pos, label in sorted(zip(flagged, labels), reverse=True):
        if label.strip() == '-': continue
        ins = [label]
        if pos > 0 and out[pos - 1].strip(): ins = ['', label]
        out[pos:pos] = ins
    page.write_text('\n'.join(out)); print(f'ok {name}: {len(labels)}')
