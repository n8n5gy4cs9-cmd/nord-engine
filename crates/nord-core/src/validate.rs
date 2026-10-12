//! Project/scene validation: structure, unique ids, referenced files exist.
use crate::{io, Entity, Project, Scene};
use serde_json::Value;
use std::collections::HashSet;
use std::path::Path;

#[derive(Debug, Clone, PartialEq)]
pub struct Issue {
    pub file: String,
    pub msg: String,
}

fn push(v: &mut Vec<Issue>, file: &str, msg: impl Into<String>) {
    v.push(Issue { file: file.into(), msg: msg.into() });
}

/// Collect string values that look like project-relative asset/script paths.
fn refs(v: &Value, out: &mut Vec<String>) {
    match v {
        Value::String(s) if (s.starts_with("assets/") || s.starts_with("scripts/") || s.starts_with("prefabs/")) => {
            out.push(s.clone())
        }
        Value::Array(a) => a.iter().for_each(|x| refs(x, out)),
        Value::Object(o) => o.values().for_each(|x| refs(x, out)),
        _ => {}
    }
}

pub fn validate_scene(root: &Path, file: &str, s: &Scene) -> Vec<Issue> {
    let mut v = vec![];
    if s.format != crate::FORMAT {
        push(&mut v, file, format!("unsupported scene format {}", s.format));
    }
    let mut ids = HashSet::new();
    let mut check = |e: &Entity| {
        if e.id.is_empty() || !ids.insert(e.id.clone()) {
            push(&mut v, file, format!("entity '{}' has empty or duplicate id '{}'", e.name, e.id));
        }
        let mut r = vec![];
        for c in &e.components {
            refs(&Value::Object(c.fields.clone()), &mut r);
        }
        for sc in &e.scripts {
            r.push(sc.path.clone());
            refs(&Value::Object(sc.attributes.clone()), &mut r);
        }
        if let Some(p) = &e.prefab {
            r.push(p.path.clone());
        }
        for path in r {
            if !root.join(&path).exists() {
                push(&mut v, file, format!("entity '{}' references missing file '{path}'", e.name));
            }
        }
    };
    for e in &s.entities {
        e.walk(&mut check);
    }
    v
}

/// Validate project file, start scene and every `scenes/*.scene.json`.
pub fn validate_project(root: &Path) -> Vec<Issue> {
    let mut v = vec![];
    let p: Project = match io::load_project(root) {
        Ok(p) => p,
        Err(e) => {
            push(&mut v, io::PROJECT_FILE, e.to_string());
            return v;
        }
    };
    if p.name.trim().is_empty() {
        push(&mut v, io::PROJECT_FILE, "name is empty");
    }
    if p.id.is_empty() || !p.id.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_') {
        push(&mut v, io::PROJECT_FILE, format!("id '{}' must be reverse-DNS style ([A-Za-z0-9._-])", p.id));
    }
    if !root.join(&p.start_scene).exists() {
        push(&mut v, io::PROJECT_FILE, format!("startScene '{}' does not exist", p.start_scene));
    }
    if let Ok(rd) = std::fs::read_dir(root.join("scenes")) {
        let mut files: Vec<_> = rd.flatten().map(|e| e.path()).filter(|p| p.to_string_lossy().ends_with(".scene.json")).collect();
        files.sort();
        for f in files {
            let rel = format!("scenes/{}", f.file_name().unwrap().to_string_lossy());
            match io::load_json::<Scene>(&f) {
                Ok(s) => v.extend(validate_scene(root, &rel, &s)),
                Err(e) => push(&mut v, &rel, e.to_string()),
            }
        }
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{scene::Component, ProjectType};

    #[test]
    fn detects_missing_refs_and_dup_ids() {
        let d = std::env::temp_dir().join(format!("nord-val-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        io::save_project(&d, &Project::new("T", "com.x.t", ProjectType::TwoD)).unwrap();
        let mut s = Scene::new("main");
        let mut a = Entity::new("A");
        a.components.push(Component { kind: "sprite".into(), fields: serde_json::from_str(r#"{"texture":"assets/nope.png"}"#).unwrap() });
        let mut b = Entity::new("B");
        b.id = a.id.clone();
        s.entities = vec![a, b];
        io::save_json(&d.join("scenes/main.scene.json"), &s).unwrap();
        let issues = validate_project(&d);
        assert!(issues.iter().any(|i| i.msg.contains("missing file 'assets/nope.png'")));
        assert!(issues.iter().any(|i| i.msg.contains("duplicate id")));
        assert_eq!(issues.len(), 2);
    }
}
