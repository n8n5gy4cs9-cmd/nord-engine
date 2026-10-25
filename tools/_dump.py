import re,sys,pathlib
sys.path.insert(0,'tools')
DIR=pathlib.Path('docs/manual-src')
LABEL=re.compile(r'^\s*(\*\*(File|In the file|Terminal|Example|Console output|Output|Result)\b|In a terminal)|`[\w./@-]+\.(?:js|json|md|glsl|py|html|mjs|css|rs|toml)`|^#+ .*[\w/-]+\.(?:js|json|md|glsl|py|html|mjs|css|rs|toml)\b|<span class="f">',re.I)
for name in sys.argv[1:]:
    lines=(DIR/name).read_text().split('\n'); inf=False; n=0
    print('=====',name)
    for i,l in enumerate(lines):
        m=re.match(r'^```(\w*)',l)
        if m and not inf:
            inf=True; lang=m.group(1)
            if lang in('js','javascript','json','bash','sh','glsl'):
                j=i-1
                while j>=0 and lines[j].strip()=='': j-=1
                above=' '.join(lines[max(0,j-1):j+1])
                if not LABEL.search(lines[j]) and not LABEL.search(above):
                    n+=1
                    # nearest heading
                    h=next((lines[k] for k in range(i,-1,-1) if lines[k].startswith('#')),'')
                    print(f'[{n}] L{i+1} ({lang}) H: {h[:60]} | ABOVE: {lines[j][:110]} | CODE: {lines[i+1][:90]}')
        elif m and inf: inf=False
