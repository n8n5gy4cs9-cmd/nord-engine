#!/usr/bin/env python3
"""Mirror docs/UI_SCENES.md and docs/GRAPH.md into the manual sources (front matter added). Run before node tools/build-manual.mjs."""
import re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
def mirror(src, dst, title, order, summary):
    s = (R / 'docs' / src).read_text()
    s = re.sub(r'^# .*\n', '', s, count=1).lstrip('\n')
    s = s.replace('## Styles (skins): one rule set for every node', '## Styles (skins): one rule set for every node {#styles}')
    fm = f'---\ntitle: {title}\nsection: Guides\norder: {order}\nsummary: {summary}\n---\n\n'
    (R / 'docs/manual-src' / dst).write_text(fm + s)
mirror('UI_SCENES.md', 'ui-scenes.md', 'UI scenes reference', 3, 'The .ui.json format, text, images and 9-slice, skins, and the script API.')
mirror('GRAPH.md', 'graph-reference.md', 'Node graph reference', 4, 'Pins, events, flow, the full node list, the runner and the component.')
print('mirrored')
