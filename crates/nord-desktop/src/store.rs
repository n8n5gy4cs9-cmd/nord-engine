//! Persistent app storage: JSON key-value store (settings, small state; atomic writes), versioned migrations, optional SQLite
//! (`sqlite` feature) for structured data. Lives in the app's own data dir, so it needs no permission.
use crate::{DesktopError, Result};
use serde_json::{Map, Value};
use std::{path::PathBuf, sync::Mutex};

/// One schema migration step.
pub type Step<'a> = &'a dyn Fn(&mut Map<String, Value>);

pub struct Store {
    path: PathBuf,
    data: Mutex<Map<String, Value>>,
}

const VERSION_KEY: &str = "__version";

impl Store {
    pub fn open(path: PathBuf) -> Result<Self> {
        let data = match std::fs::read_to_string(&path) {
            Ok(t) => match serde_json::from_str::<Value>(&t) {
                Ok(Value::Object(m)) => m,
                _ => {
                    // corrupt file: keep it for inspection, start fresh
                    let _ = std::fs::rename(&path, path.with_extension("json.corrupt"));
                    Map::new()
                }
            },
            Err(_) => Map::new(),
        };
        if let Some(d) = path.parent() {
            std::fs::create_dir_all(d)?;
        }
        Ok(Self {
            path,
            data: Mutex::new(data),
        })
    }
    fn lock(&self) -> std::sync::MutexGuard<'_, Map<String, Value>> {
        self.data.lock().unwrap_or_else(|e| e.into_inner())
    }
    fn flush(&self, m: &Map<String, Value>) -> Result<()> {
        let tmp = self.path.with_extension("json.tmp");
        std::fs::write(
            &tmp,
            serde_json::to_vec_pretty(m).map_err(|e| DesktopError::new("io", e.to_string()))?,
        )?;
        std::fs::rename(&tmp, &self.path)?;
        Ok(())
    }
    pub fn get(&self, key: &str) -> Option<Value> {
        self.lock().get(key).cloned()
    }
    pub fn set(&self, key: &str, v: Value) -> Result<()> {
        if key.is_empty() || key.starts_with("__") {
            return Err(DesktopError::invalid(
                "key must be non-empty and not start with '__'",
            ));
        }
        self.set_raw(key, v)
    }
    /// Internal keys (`__…`) for the backend itself (recent files, window geometry, …).
    pub fn set_raw(&self, key: &str, v: Value) -> Result<()> {
        let mut m = self.lock();
        m.insert(key.into(), v);
        self.flush(&m)
    }
    pub fn remove(&self, key: &str) -> Result<()> {
        let mut m = self.lock();
        m.remove(key);
        self.flush(&m)
    }
    pub fn keys(&self) -> Vec<String> {
        let mut v: Vec<String> = self
            .lock()
            .keys()
            .filter(|k| !k.starts_with("__"))
            .cloned()
            .collect();
        v.sort();
        v
    }
    pub fn clear(&self) -> Result<()> {
        let mut m = self.lock();
        m.retain(|k, _| k.starts_with("__"));
        self.flush(&m)
    }
    pub fn version(&self) -> u32 {
        self.lock()
            .get(VERSION_KEY)
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32
    }
    /// Run `steps[version..]` in order (step i upgrades version i → i+1), saving after each.
    pub fn migrate(&self, steps: &[Step]) -> Result<u32> {
        let mut m = self.lock();
        let mut v = m.get(VERSION_KEY).and_then(Value::as_u64).unwrap_or(0) as usize;
        while v < steps.len() {
            steps[v](&mut m);
            v += 1;
            m.insert(VERSION_KEY.into(), Value::from(v as u64));
            self.flush(&m)?;
        }
        Ok(v as u32)
    }
}

#[cfg(feature = "sqlite")]
pub mod sql {
    //! Structured storage: `exec` for statements, `query` returns rows as JSON objects. Parameters are positional JSON values.
    use crate::{DesktopError, Result};
    use rusqlite::{types::ValueRef, Connection};
    use serde_json::{Map, Value};
    use std::{path::Path, sync::Mutex};

    pub struct Db(Mutex<Connection>);
    fn err(e: rusqlite::Error) -> DesktopError {
        DesktopError::new("io", e.to_string())
    }
    fn bind(p: &[Value]) -> Vec<rusqlite::types::Value> {
        p.iter()
            .map(|v| match v {
                Value::Null => rusqlite::types::Value::Null,
                Value::Bool(b) => rusqlite::types::Value::Integer(*b as i64),
                Value::Number(n) => n
                    .as_i64()
                    .map(rusqlite::types::Value::Integer)
                    .unwrap_or_else(|| rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))),
                Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                other => rusqlite::types::Value::Text(other.to_string()),
            })
            .collect()
    }
    impl Db {
        pub fn open(path: &Path) -> Result<Self> {
            Ok(Self(Mutex::new(Connection::open(path).map_err(err)?)))
        }
        pub fn memory() -> Result<Self> {
            Ok(Self(Mutex::new(Connection::open_in_memory().map_err(err)?)))
        }
        pub fn exec(&self, sql: &str, params: &[Value]) -> Result<usize> {
            self.0
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .execute(sql, rusqlite::params_from_iter(bind(params)))
                .map_err(err)
        }
        pub fn query(&self, sql: &str, params: &[Value]) -> Result<Vec<Value>> {
            let c = self.0.lock().unwrap_or_else(|e| e.into_inner());
            let mut st = c.prepare(sql).map_err(err)?;
            let cols: Vec<String> = st.column_names().iter().map(|s| s.to_string()).collect();
            let mut rows = st
                .query(rusqlite::params_from_iter(bind(params)))
                .map_err(err)?;
            let mut out = vec![];
            while let Some(r) = rows.next().map_err(err)? {
                let mut o = Map::new();
                for (i, c) in cols.iter().enumerate() {
                    o.insert(
                        c.clone(),
                        match r.get_ref(i).map_err(err)? {
                            ValueRef::Null => Value::Null,
                            ValueRef::Integer(n) => n.into(),
                            ValueRef::Real(f) => f.into(),
                            ValueRef::Text(t) => String::from_utf8_lossy(t).into_owned().into(),
                            ValueRef::Blob(b) => format!("<{} bytes>", b.len()).into(),
                        },
                    );
                }
                out.push(Value::Object(o));
            }
            Ok(out)
        }
        /// `PRAGMA user_version` based migrations: `steps[i]` upgrades i → i+1.
        pub fn migrate(&self, steps: &[&str]) -> Result<usize> {
            let c = self.0.lock().unwrap_or_else(|e| e.into_inner());
            let mut v: usize = c
                .query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
                .map_err(err)? as usize;
            while v < steps.len() {
                c.execute_batch(&format!(
                    "BEGIN; {}; PRAGMA user_version = {}; COMMIT;",
                    steps[v],
                    v + 1
                ))
                .map_err(err)?;
                v += 1;
            }
            Ok(v)
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        use serde_json::json;
        #[test]
        fn exec_query_migrate() {
            let db = Db::memory().unwrap();
            assert_eq!(
                db.migrate(&[
                    "CREATE TABLE n(id INTEGER PRIMARY KEY, t TEXT)",
                    "ALTER TABLE n ADD COLUMN pinned INTEGER DEFAULT 0"
                ])
                .unwrap(),
                2
            );
            assert_eq!(db.migrate(&["x", "y"]).unwrap(), 2, "idempotent");
            db.exec(
                "INSERT INTO n(t) VALUES (?1), (?2)",
                &[json!("a"), json!("b")],
            )
            .unwrap();
            assert_eq!(
                db.query("SELECT t, pinned FROM n WHERE t = ?1", &[json!("b")])
                    .unwrap(),
                vec![json!({"t":"b","pinned":0})]
            );
            assert!(db.exec("NOPE", &[]).is_err());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn persists_and_protects_internal_keys() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        let s = Store::open(p.clone()).unwrap();
        s.set("theme", json!("dark")).unwrap();
        s.set("n", json!({"a":[1,2]})).unwrap();
        assert!(s.set("__version", json!(9)).is_err());
        let s2 = Store::open(p).unwrap();
        assert_eq!(s2.get("theme"), Some(json!("dark")));
        assert_eq!(s2.keys(), ["n", "theme"]);
        s2.remove("n").unwrap();
        s2.clear().unwrap();
        assert!(s2.keys().is_empty());
    }
    #[test]
    fn corrupt_file_is_kept_aside() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("s.json");
        std::fs::write(&p, "{ not json").unwrap();
        let s = Store::open(p.clone()).unwrap();
        assert!(s.keys().is_empty() && d.path().join("s.json.corrupt").exists());
    }
    #[test]
    fn migrations_run_once_in_order() {
        let d = tempfile::tempdir().unwrap();
        let s = Store::open(d.path().join("s.json")).unwrap();
        s.set("name", json!("x")).unwrap();
        let steps: [Step; 2] = [
            &|m| {
                m.insert("title".into(), m["name"].clone());
            },
            &|m| {
                m.remove("name");
            },
        ];
        assert_eq!(s.migrate(&steps).unwrap(), 2);
        assert_eq!((s.get("title"), s.get("name")), (Some(json!("x")), None));
        assert_eq!(s.migrate(&steps).unwrap(), 2);
        assert_eq!(s.version(), 2);
    }
}
