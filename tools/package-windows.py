#!/usr/bin/env python3
"""Assemble the Windows portable release without expanding the HTML guide."""
import hashlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SKIP = {".nord-cache", "target", "dist", ".DS_Store", "__pycache__", ".git"}
RESOURCES = ("vendor", "runtime", "editor", "library", "examples", "templates", "assets", "crates")


def ignored(directory, names):
    return [name for name in names if name in SKIP or name.startswith("._")]


def files(folder):
    return sorted(p for p in folder.rglob("*") if p.is_file()
                  and not any(n in SKIP or n.startswith("._") for n in p.relative_to(folder).parts))


def archive(folder, destination, prefix=""):
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p in files(folder):
            z.write(p, prefix + p.relative_to(folder).as_posix())
    with zipfile.ZipFile(destination) as z:
        bad = z.testzip()
        if bad:
            raise RuntimeError(f"Corrupt archive entry: {bad}")


def main():
    binaries = Path(sys.argv[1]).resolve()
    abi = sys.argv[2]
    out = ROOT / "dist/windows/NordEngine"
    for name in ("nord-editor.exe", "nord.exe", "nord-player.exe"):
        if not (binaries / name).is_file():
            raise RuntimeError(f"Missing Windows binary: {binaries / name}")
    if not (ROOT / "docs/manual/index.html").is_file():
        raise RuntimeError("Build the manual first")
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for name in ("nord-editor.exe", "nord.exe", "nord-player.exe"):
        shutil.copy2(binaries / name, out / name)
    loaders = list(binaries.glob("build/webview2-com-sys-*/out/x64/WebView2Loader.dll"))
    if not loaders:
        raise RuntimeError("WebView2 loader missing from Cargo build output")
    shutil.copy2(max(loaders, key=lambda p: p.stat().st_mtime), out / "WebView2Loader.dll")
    # Retain all tiers, shared assets, starters and examples; never regenerate their art.
    for name in RESOURCES:
        shutil.copytree(ROOT / name, out / name, ignore=ignored)
    (out / "docs").mkdir()
    for p in (ROOT / "docs").glob("*.md"):
        shutil.copy2(p, out / "docs" / p.name)
    archive(ROOT / "docs/manual", out / "docs/manual.zip")
    for name in ("LICENSE", "THIRD_PARTY.md", "README.md", "ASSETS.md", "Cargo.toml", "Cargo.lock"):
        shutil.copy2(ROOT / name, out / name)
    (out / "tools").mkdir()
    for name in ("export-bundle.mjs", "vendor.mjs"):
        shutil.copy2(ROOT / "tools" / name, out / "tools" / name)
    # MinGW may dynamically import its support libraries: include those actually used,
    # including transitive imports, rather than relying on the build host's PATH.
    if abi == "gnu":
        pending = list(out.glob("*.exe")) + list(out.glob("*.dll"))
        seen = set()
        while pending:
            binary = pending.pop()
            listing = subprocess.check_output(["x86_64-w64-mingw32-objdump", "-p", str(binary)], text=True)
            for dll in re.findall(r"DLL Name:\s*(\S+)", listing):
                if dll.lower() in seen:
                    continue
                seen.add(dll.lower())
                if dll.lower().startswith(("libgcc_", "libstdc++", "libwinpthread", "libssp")):
                    source = Path(subprocess.check_output(
                        ["x86_64-w64-mingw32-gcc", "-print-file-name=" + dll], text=True).strip())
                    if not source.is_file():
                        raise RuntimeError(f"Cannot locate required runtime {dll}")
                    shutil.copy2(source, out / dll)
                    pending.append(out / dll)
    (out / "NordEngine.cmd").write_bytes(b'@echo off\r\nstart "" "%~dp0nord-editor.exe" %*\r\n')
    (out / "README-WINDOWS.txt").write_text(
        "Nord Engine - Crowelian 2026 + Sonnet\n\n"
        "Extract the entire release ZIP before running NordEngine.cmd or nord-editor.exe.\n"
        "Keep every resource folder beside the EXEs; launch from any working directory.\n"
        "Requires Windows 10/11 x64 and Microsoft Edge WebView2 Runtime.\n"
        "If WebView2 is unavailable, the editor offers Open in browser. The player needs WebView2.\n"
        "Examples and templates are available from the project hub, with original assets.\n"
        "The complete searchable offline guide is docs/manual.zip. The editor Docs tab\n"
        "serves it directly without extraction. To read separately, extract it and open index.html.\n"
        "CLI: nord.exe --help. Export Windows games/apps using the bundled nord-player.exe.\n"
        "Rust/WASM examples need Rust + wasm32-unknown-unknown and their build tools;\n"
        "Node is needed for TypeScript export. Ordinary JS/HTML examples need neither.\n",
        encoding="utf-8")
    # Compare every resource byte: catches missing/corrupted example assets before shipping.
    for name in RESOURCES:
        for source in files(ROOT / name):
            target = out / source.relative_to(ROOT)
            if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
                raise RuntimeError(f"Resource mismatch: {target}")
    version = re.search(r'^version = "([^"]+)"', (ROOT / "Cargo.toml").read_text(), re.M)[1]
    destination = out.parent / f"NordEngine-{version}-windows.zip"
    archive(out, destination, "NordEngine/")
    print(f"Built: {out}\nArchive: {destination}")


if __name__ == "__main__":
    main()
