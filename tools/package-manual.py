#!/usr/bin/env python3
"""Package the rebuilt offline manual without macOS metadata or stale pages."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
source = root / 'docs/manual'
with ZipFile(root / 'docs/manual.zip', 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(source.rglob('*')):
        if not file.is_file() or file.name == '.DS_Store':
            continue
        info = ZipInfo('manual/' + file.relative_to(source).as_posix(), (2026, 10, 25, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, file.read_bytes())
print('docs/manual.zip:', (root / 'docs/manual.zip').stat().st_size, 'bytes')
