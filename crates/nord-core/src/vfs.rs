//! Virtual file system (M11-02). Everything that touches project files goes through the free functions here, which mirror
//! `std::fs` (so call sites just `use nord_core::vfs as fs`). The active backend is a [`Vfs`]: [`NativeFs`] (plain
//! `std::fs`, the default on desktop — behaviour is unchanged), [`MemFs`] (default in the browser; the web shell persists it
//! to OPFS/IndexedDB) or a remote one (server mode). Swap it with [`set_backend`].
use std::collections::BTreeMap;
use std::ffi::OsString;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use web_time::SystemTime;

/// File facts, like `std::fs::Metadata`.
#[derive(Clone, Debug)]
pub struct Meta {
    len: u64,
    dir: bool,
    modified: Option<SystemTime>,
}

impl Meta {
    pub fn new(len: u64, dir: bool, modified: Option<SystemTime>) -> Self {
        Self { len, dir, modified }
    }
    pub fn len(&self) -> u64 {
        self.len
    }
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }
    pub fn is_dir(&self) -> bool {
        self.dir
    }
    pub fn is_file(&self) -> bool {
        !self.dir
    }
    pub fn modified(&self) -> io::Result<SystemTime> {
        self.modified
            .ok_or_else(|| io::Error::new(io::ErrorKind::Unsupported, "no modification time"))
    }
}

/// Directory entry, like `std::fs::DirEntry`.
#[derive(Clone, Debug)]
pub struct DirEntry {
    path: PathBuf,
    meta: Meta,
}

impl DirEntry {
    pub fn new(path: PathBuf, meta: Meta) -> Self {
        Self { path, meta }
    }
    pub fn path(&self) -> PathBuf {
        self.path.clone()
    }
    pub fn file_name(&self) -> OsString {
        self.path
            .file_name()
            .map(OsString::from)
            .unwrap_or_default()
    }
    pub fn file_type(&self) -> io::Result<Meta> {
        Ok(self.meta.clone())
    }
    pub fn metadata(&self) -> io::Result<Meta> {
        Ok(self.meta.clone())
    }
}

pub type ReadDir = std::vec::IntoIter<io::Result<DirEntry>>;

/// A storage backend. `write` must be atomic where the medium allows (temp + rename natively).
pub trait Vfs: Send + Sync {
    fn read(&self, p: &Path) -> io::Result<Vec<u8>>;
    fn write(&self, p: &Path, data: &[u8]) -> io::Result<()>;
    fn create_dir_all(&self, p: &Path) -> io::Result<()>;
    fn remove_file(&self, p: &Path) -> io::Result<()>;
    fn remove_dir_all(&self, p: &Path) -> io::Result<()>;
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
    fn stat(&self, p: &Path) -> io::Result<Meta>;
    fn list(&self, p: &Path) -> io::Result<Vec<DirEntry>>;
    /// Crash-safe write; backends without atomic rename just `write`.
    fn write_atomic(&self, p: &Path, data: &[u8]) -> io::Result<()> {
        self.write(p, data)
    }
    fn canonicalize(&self, p: &Path) -> io::Result<PathBuf> {
        Ok(p.to_path_buf())
    }
    fn copy(&self, from: &Path, to: &Path) -> io::Result<u64> {
        let d = self.read(from)?;
        self.write(to, &d)?;
        Ok(d.len() as u64)
    }
}

/// The real disk (desktop).
#[cfg(not(target_arch = "wasm32"))]
pub struct NativeFs;

#[cfg(not(target_arch = "wasm32"))]
fn meta_of(m: &std::fs::Metadata) -> Meta {
    Meta::new(m.len(), m.is_dir(), m.modified().ok().map(SystemTime::from))
}

#[cfg(not(target_arch = "wasm32"))]
impl Vfs for NativeFs {
    fn read(&self, p: &Path) -> io::Result<Vec<u8>> {
        std::fs::read(p)
    }
    fn write(&self, p: &Path, data: &[u8]) -> io::Result<()> {
        std::fs::write(p, data)
    }
    fn create_dir_all(&self, p: &Path) -> io::Result<()> {
        std::fs::create_dir_all(p)
    }
    fn remove_file(&self, p: &Path) -> io::Result<()> {
        std::fs::remove_file(p)
    }
    fn remove_dir_all(&self, p: &Path) -> io::Result<()> {
        std::fs::remove_dir_all(p)
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        std::fs::rename(from, to)
    }
    fn stat(&self, p: &Path) -> io::Result<Meta> {
        std::fs::metadata(p).map(|m| meta_of(&m))
    }
    fn list(&self, p: &Path) -> io::Result<Vec<DirEntry>> {
        let mut v = vec![];
        for e in std::fs::read_dir(p)? {
            let e = e?;
            let m = e.metadata().or_else(|_| std::fs::metadata(e.path()))?;
            v.push(DirEntry::new(e.path(), meta_of(&m)));
        }
        Ok(v)
    }
    fn write_atomic(&self, path: &Path, data: &[u8]) -> io::Result<()> {
        use std::io::Write;
        let mut tmp = path.as_os_str().to_owned();
        tmp.push(".nordtmp");
        let tmp = PathBuf::from(tmp);
        let res = (|| {
            let mut f = std::fs::File::create(&tmp)?;
            f.write_all(data)?;
            f.sync_all()?;
            std::fs::rename(&tmp, path)
        })();
        if res.is_err() {
            let _ = std::fs::remove_file(&tmp);
        }
        res
    }
    fn canonicalize(&self, p: &Path) -> io::Result<PathBuf> {
        std::fs::canonicalize(p)
    }
    fn copy(&self, from: &Path, to: &Path) -> io::Result<u64> {
        std::fs::copy(from, to)
    }
}

enum Node {
    File(Vec<u8>, SystemTime),
    Dir,
}

/// In-memory tree (browser default, tests). `dirty` counts changes so a shell can persist it lazily.
#[derive(Default)]
pub struct MemFs {
    nodes: Mutex<BTreeMap<String, Node>>,
    dirty: std::sync::atomic::AtomicU64,
}

fn key(p: &Path) -> String {
    let mut parts: Vec<String> = vec![];
    for c in p.to_string_lossy().split(['/', '\\']) {
        match c {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            c => parts.push(c.to_string()),
        }
    }
    format!("/{}", parts.join("/"))
}

fn not_found() -> io::Error {
    io::Error::new(io::ErrorKind::NotFound, "not found")
}

impl MemFs {
    pub fn new() -> Self {
        Self::default()
    }
    /// Number of mutations so far (cheap "has anything changed" check).
    pub fn revision(&self) -> u64 {
        self.dirty.load(std::sync::atomic::Ordering::Relaxed)
    }
    fn touch(&self) {
        self.dirty
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    }
    /// Every file as (path, bytes) — for zip export / persistence.
    pub fn files(&self) -> Vec<(String, Vec<u8>)> {
        let n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        n.iter()
            .filter_map(|(k, v)| match v {
                Node::File(d, _) => Some((k.clone(), d.clone())),
                Node::Dir => None,
            })
            .collect()
    }
    fn mkdirs(n: &mut BTreeMap<String, Node>, k: &str) -> io::Result<()> {
        let mut cur = String::new();
        for part in k.split('/').filter(|s| !s.is_empty()) {
            cur.push('/');
            cur.push_str(part);
            match n.get(&cur) {
                Some(Node::File(..)) => {
                    return Err(io::Error::new(
                        io::ErrorKind::AlreadyExists,
                        "a file is in the way",
                    ))
                }
                Some(Node::Dir) => {}
                None => {
                    n.insert(cur.clone(), Node::Dir);
                }
            }
        }
        Ok(())
    }
}

impl Vfs for MemFs {
    fn read(&self, p: &Path) -> io::Result<Vec<u8>> {
        match self
            .nodes
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .get(&key(p))
        {
            Some(Node::File(d, _)) => Ok(d.clone()),
            Some(Node::Dir) => Err(io::Error::other("is a directory")),
            None => Err(not_found()),
        }
    }
    fn write(&self, p: &Path, data: &[u8]) -> io::Result<()> {
        let k = key(p);
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(parent) = k.rsplit_once('/').map(|x| x.0) {
            // like std::fs::write, the parent must exist
            if !parent.is_empty() && !matches!(n.get(parent), Some(Node::Dir)) {
                return Err(not_found());
            }
        }
        if matches!(n.get(&k), Some(Node::Dir)) {
            return Err(io::Error::other("is a directory"));
        }
        n.insert(k, Node::File(data.to_vec(), SystemTime::now()));
        drop(n);
        self.touch();
        Ok(())
    }
    fn create_dir_all(&self, p: &Path) -> io::Result<()> {
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        Self::mkdirs(&mut n, &key(p))?;
        drop(n);
        self.touch();
        Ok(())
    }
    fn remove_file(&self, p: &Path) -> io::Result<()> {
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        match n.get(&key(p)) {
            Some(Node::File(..)) => {
                n.remove(&key(p));
                drop(n);
                self.touch();
                Ok(())
            }
            Some(Node::Dir) => Err(io::Error::other("is a directory")),
            None => Err(not_found()),
        }
    }
    fn remove_dir_all(&self, p: &Path) -> io::Result<()> {
        let k = key(p);
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if !matches!(n.get(&k), Some(Node::Dir)) {
            return Err(not_found());
        }
        let pre = format!("{k}/");
        n.retain(|x, _| x != &k && !x.starts_with(&pre));
        drop(n);
        self.touch();
        Ok(())
    }
    fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
        let (a, b) = (key(from), key(to));
        let mut n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if !n.contains_key(&a) {
            return Err(not_found());
        }
        if let Some(parent) = b.rsplit_once('/').map(|x| x.0) {
            if !parent.is_empty() && !matches!(n.get(parent), Some(Node::Dir)) {
                return Err(not_found());
            }
        }
        let pre = format!("{a}/");
        let moved: Vec<String> = n
            .keys()
            .filter(|k| **k == a || k.starts_with(&pre))
            .cloned()
            .collect();
        for k in moved {
            if let Some(v) = n.remove(&k) {
                n.insert(format!("{b}{}", &k[a.len()..]), v);
            }
        }
        drop(n);
        self.touch();
        Ok(())
    }
    fn stat(&self, p: &Path) -> io::Result<Meta> {
        let k = key(p);
        if k == "/" {
            return Ok(Meta::new(0, true, None));
        }
        match self.nodes.lock().unwrap_or_else(|e| e.into_inner()).get(&k) {
            Some(Node::File(d, t)) => Ok(Meta::new(d.len() as u64, false, Some(*t))),
            Some(Node::Dir) => Ok(Meta::new(0, true, None)),
            None => Err(not_found()),
        }
    }
    fn list(&self, p: &Path) -> io::Result<Vec<DirEntry>> {
        let k = key(p);
        let n = self.nodes.lock().unwrap_or_else(|e| e.into_inner());
        if k != "/" && !matches!(n.get(&k), Some(Node::Dir)) {
            return Err(not_found());
        }
        let pre = if k == "/" {
            "/".to_string()
        } else {
            format!("{k}/")
        };
        Ok(n.range(pre.clone()..)
            .take_while(|(x, _)| x.starts_with(&pre))
            .filter(|(x, _)| !x[pre.len()..].contains('/'))
            .map(|(x, v)| {
                let m = match v {
                    Node::File(d, t) => Meta::new(d.len() as u64, false, Some(*t)),
                    Node::Dir => Meta::new(0, true, None),
                };
                DirEntry::new(PathBuf::from(x), m)
            })
            .collect())
    }
}

fn slot() -> &'static RwLock<Arc<dyn Vfs>> {
    static S: OnceLock<RwLock<Arc<dyn Vfs>>> = OnceLock::new();
    S.get_or_init(|| {
        #[cfg(target_arch = "wasm32")]
        let b: Arc<dyn Vfs> = Arc::new(MemFs::new());
        #[cfg(not(target_arch = "wasm32"))]
        let b: Arc<dyn Vfs> = Arc::new(NativeFs);
        RwLock::new(b)
    })
}

/// The active backend.
pub fn backend() -> Arc<dyn Vfs> {
    slot().read().unwrap_or_else(|e| e.into_inner()).clone()
}

/// Install another backend (browser storage, remote server). Call once at start-up.
pub fn set_backend(b: Arc<dyn Vfs>) {
    *slot().write().unwrap_or_else(|e| e.into_inner()) = b;
}

pub fn read(p: impl AsRef<Path>) -> io::Result<Vec<u8>> {
    backend().read(p.as_ref())
}
pub fn read_to_string(p: impl AsRef<Path>) -> io::Result<String> {
    String::from_utf8(read(p)?).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}
pub fn write(p: impl AsRef<Path>, data: impl AsRef<[u8]>) -> io::Result<()> {
    backend().write(p.as_ref(), data.as_ref())
}
pub fn create_dir_all(p: impl AsRef<Path>) -> io::Result<()> {
    backend().create_dir_all(p.as_ref())
}
pub fn remove_file(p: impl AsRef<Path>) -> io::Result<()> {
    backend().remove_file(p.as_ref())
}
pub fn remove_dir_all(p: impl AsRef<Path>) -> io::Result<()> {
    backend().remove_dir_all(p.as_ref())
}
pub fn rename(a: impl AsRef<Path>, b: impl AsRef<Path>) -> io::Result<()> {
    backend().rename(a.as_ref(), b.as_ref())
}
pub fn copy(a: impl AsRef<Path>, b: impl AsRef<Path>) -> io::Result<u64> {
    backend().copy(a.as_ref(), b.as_ref())
}
pub fn metadata(p: impl AsRef<Path>) -> io::Result<Meta> {
    backend().stat(p.as_ref())
}
pub fn canonicalize(p: impl AsRef<Path>) -> io::Result<PathBuf> {
    backend().canonicalize(p.as_ref())
}
pub fn read_dir(p: impl AsRef<Path>) -> io::Result<ReadDir> {
    Ok(backend()
        .list(p.as_ref())?
        .into_iter()
        .map(Ok)
        .collect::<Vec<_>>()
        .into_iter())
}
pub fn exists(p: impl AsRef<Path>) -> bool {
    backend().stat(p.as_ref()).is_ok()
}
pub fn is_dir(p: impl AsRef<Path>) -> bool {
    backend().stat(p.as_ref()).is_ok_and(|m| m.is_dir())
}
pub fn is_file(p: impl AsRef<Path>) -> bool {
    backend().stat(p.as_ref()).is_ok_and(|m| m.is_file())
}

/// `Path::exists/is_dir/is_file` through the active backend (the std ones always hit the real disk).
pub trait PathExt {
    fn v_exists(&self) -> bool;
    fn v_is_dir(&self) -> bool;
    fn v_is_file(&self) -> bool;
}

impl<T: AsRef<Path> + ?Sized> PathExt for T {
    fn v_exists(&self) -> bool {
        exists(self.as_ref())
    }
    fn v_is_dir(&self) -> bool {
        is_dir(self.as_ref())
    }
    fn v_is_file(&self) -> bool {
        is_file(self.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memfs_behaves_like_a_disk() {
        let m = MemFs::new();
        assert!(
            m.write(Path::new("/p/a.txt"), b"x").is_err(),
            "parent must exist"
        );
        m.create_dir_all(Path::new("/p/sub")).unwrap();
        m.write(Path::new("/p/a.txt"), b"hello").unwrap();
        m.write(Path::new("/p/sub/b.txt"), b"b").unwrap();
        assert_eq!(m.read(Path::new("/p/a.txt")).unwrap(), b"hello");
        let names: Vec<_> = m
            .list(Path::new("/p"))
            .unwrap()
            .iter()
            .map(|e| e.file_name())
            .collect();
        assert_eq!(names.len(), 2);
        m.rename(Path::new("/p/sub"), Path::new("/p/moved"))
            .unwrap();
        assert!(m.stat(Path::new("/p/moved/b.txt")).unwrap().is_file());
        assert!(m.stat(Path::new("/p/sub")).is_err());
        m.remove_dir_all(Path::new("/p/moved")).unwrap();
        assert!(m.stat(Path::new("/p/moved/b.txt")).is_err());
        assert_eq!(m.files().len(), 1);
    }
}
