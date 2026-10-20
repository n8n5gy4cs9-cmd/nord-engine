//! Browser storage and file transfer (M11-06): the project tree lives in a `MemFs`, mirrored to IndexedDB; zips come in and go out
//! through the browser's file picker / download. Compiled for wasm32 only (see `platform` for the cross-platform seam).
use crate::platform::WebEvent;
use js_sys::{Array, Uint8Array};
use nord_core::vfs::{self, MemFs};
use std::collections::HashMap;
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_time::Instant;

#[wasm_bindgen(module = "/web/store.js")]
extern "C" {
    #[wasm_bindgen(catch)]
    async fn load_all() -> Result<JsValue, JsValue>;
    fn put(path: &str, bytes: &[u8]);
    fn del(path: &str);
    #[wasm_bindgen(catch)]
    async fn pick_files(accept: &str, multiple: bool) -> Result<JsValue, JsValue>;
    fn download(name: &str, bytes: &[u8]);
}

/// Where new and imported projects live in the browser tree.
pub const PROJECTS_DIR: &str = "/projects";

static MEM: OnceLock<Arc<MemFs>> = OnceLock::new();
static EVENTS: Mutex<Vec<WebEvent>> = Mutex::new(Vec::new());
static SAVED: Mutex<Option<HashMap<String, u64>>> = Mutex::new(None);
static LAST_FLUSH: Mutex<Option<Instant>> = Mutex::new(None);

fn entries(v: JsValue) -> Vec<(String, Vec<u8>)> {
    Array::from(&v)
        .iter()
        .filter_map(|e| {
            let pair = Array::from(&e);
            Some((pair.get(0).as_string()?, pair.get(1).dyn_into::<Uint8Array>().ok()?.to_vec()))
        })
        .collect()
}

/// Install the browser tree as the VFS backend and restore what the last session saved. Call once before the editor starts.
pub async fn init() {
    let mem = Arc::new(MemFs::new());
    let mut saved = HashMap::new();
    if let Ok(v) = load_all().await {
        for (path, data) in entries(v) {
            mem.import(&path, data);
        }
    }
    for (p, r) in mem.stamps() {
        saved.insert(p, r);
    }
    let _ = vfs::create_dir_all(PROJECTS_DIR); // default backend is still a MemFs here; harmless
    vfs::set_backend(mem.clone());
    let _ = vfs::create_dir_all(PROJECTS_DIR);
    let _ = MEM.set(mem);
    *SAVED.lock().unwrap_or_else(|e| e.into_inner()) = Some(saved);
}

/// Write changed files to IndexedDB (at most every 1.5 s; call every frame).
pub fn flush() {
    let now = Instant::now();
    {
        let mut l = LAST_FLUSH.lock().unwrap_or_else(|e| e.into_inner());
        if l.is_some_and(|t| now.duration_since(t).as_millis() < 1500) {
            return;
        }
        *l = Some(now);
    }
    let (Some(mem), mut g) = (MEM.get(), SAVED.lock().unwrap_or_else(|e| e.into_inner())) else {
        return;
    };
    let Some(saved) = g.as_mut() else { return };
    let current = mem.stamps();
    let mut seen = std::collections::HashSet::new();
    for (p, r) in current {
        seen.insert(p.clone());
        if saved.get(&p) != Some(&r) {
            if let Ok(d) = vfs::read(&p) {
                put(&p, &d);
                saved.insert(p, r);
            }
        }
    }
    saved.retain(|p, _| {
        let keep = seen.contains(p);
        if !keep {
            del(p);
        }
        keep
    });
}

pub fn poll_events() -> Vec<WebEvent> {
    std::mem::take(&mut *EVENTS.lock().unwrap_or_else(|e| e.into_inner()))
}

fn emit(e: WebEvent) {
    EVENTS.lock().unwrap_or_else(|e| e.into_inner()).push(e);
}

/// Pick a `.zip` project and unpack it into `/projects/<name>`; emits `OpenProject` when done.
pub fn import_zip() {
    wasm_bindgen_futures::spawn_local(async {
        let Ok(v) = pick_files(".zip", false).await else { return };
        let Some((name, data)) = entries(v).into_iter().next() else { return };
        match unzip_project(&name, &data) {
            Ok(dir) => emit(WebEvent::OpenProject(dir)),
            Err(e) => emit(WebEvent::Error(format!("Could not open {name}: {e}"))),
        }
    });
}

/// Pick asset files and stage them in `/imports`; emits `ImportFiles`.
pub fn import_files() {
    wasm_bindgen_futures::spawn_local(async {
        let Ok(v) = pick_files("*/*", true).await else { return };
        let _ = vfs::create_dir_all("/imports");
        let mut out = vec![];
        for (name, data) in entries(v) {
            let p = PathBuf::from("/imports").join(&name);
            if vfs::write(&p, &data).is_ok() {
                out.push(p);
            }
        }
        if !out.is_empty() {
            emit(WebEvent::ImportFiles(out));
        }
    });
}

fn unzip_project(zip_name: &str, data: &[u8]) -> Result<PathBuf, String> {
    let mut z = zip::ZipArchive::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    // a zip made by "Download project" has a single top folder; strip it so nord.project.json lands at the root
    let names: Vec<String> = (0..z.len()).filter_map(|i| z.by_index(i).ok().map(|f| f.name().to_string())).collect();
    let top = names.first().and_then(|n| n.split('/').next()).unwrap_or("").to_string();
    let strip = !top.is_empty()
        && names.iter().all(|n| n.starts_with(&format!("{top}/")));
    let stem = zip_name.trim_end_matches(".zip");
    let base = if strip { top.as_str() } else { stem };
    let safe: String = base.chars().map(|c| if c.is_alphanumeric() || " -_.".contains(c) { c } else { '_' }).collect();
    let mut dir = Path::new(PROJECTS_DIR).join(&safe);
    let mut n = 2;
    while vfs::metadata(&dir).is_ok() {
        dir = Path::new(PROJECTS_DIR).join(format!("{safe} {n}"));
        n += 1;
    }
    for i in 0..z.len() {
        let mut f = z.by_index(i).map_err(|e| e.to_string())?;
        if f.is_dir() {
            continue;
        }
        let rel = f.name().to_string();
        let rel = if strip { rel[top.len() + 1..].to_string() } else { rel };
        // zip-slip guard: no absolute or parent components
        if rel.split('/').any(|c| c == ".." || c.is_empty() && rel.starts_with('/')) {
            continue;
        }
        let mut buf = vec![];
        f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        let target = dir.join(&rel);
        if let Some(parent) = target.parent() {
            vfs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        vfs::write(&target, &buf).map_err(|e| e.to_string())?;
    }
    if !vfs::metadata(dir.join("nord.project.json")).is_ok_and(|m| m.is_file()) {
        let _ = vfs::remove_dir_all(&dir);
        return Err("no nord.project.json in the zip".into());
    }
    Ok(dir)
}

/// Zip the project folder and hand it to the browser as a download.
pub fn download_project(root: &Path) -> Result<(), String> {
    let mem = MEM.get().ok_or("browser storage not ready")?;
    let prefix = format!("{}/", root.to_string_lossy().trim_end_matches('/'));
    let name = root.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "project".into());
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default();
    for (p, data) in mem.files() {
        let Some(rel) = p.strip_prefix(&prefix) else { continue };
        if rel.starts_with(".nord-cache/") {
            continue;
        }
        w.start_file(format!("{name}/{rel}"), opts).map_err(|e| e.to_string())?;
        w.write_all(&data).map_err(|e| e.to_string())?;
    }
    let bytes = w.finish().map_err(|e| e.to_string())?.into_inner();
    download(&format!("{name}.zip"), &bytes);
    Ok(())
}
