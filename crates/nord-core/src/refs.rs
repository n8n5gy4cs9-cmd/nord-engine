//! Project tools (M10-25): find all references, project-wide replace, safe rename of assets and objects.
//! Works on the same text sources as version history (`history::source_files`). Every mutating function has a `dry_run` mode that only
//! reports what it would change.
use crate::vfs::PathExt;
use crate::{history, io, Error, Result};
use serde_json::Value;
use crate::vfs as fs;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hit {
    pub file: String,
    pub line: usize,
    pub text: String,
}

fn is_ident(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}

/// Byte offsets of `needle` in `hay`; with `whole_word` the match must not touch identifier characters.
fn find_all(hay: &str, needle: &str, whole_word: bool) -> Vec<usize> {
    if needle.is_empty() {
        return vec![];
    }
    let mut out = vec![];
    let mut from = 0;
    while let Some(i) = hay[from..].find(needle) {
        let at = from + i;
        let end = at + needle.len();
        let ok = !whole_word
            || (!hay[..at].chars().next_back().is_some_and(is_ident) && !hay[end..].chars().next().is_some_and(is_ident));
        if ok {
            out.push(at);
        }
        from = end;
    }
    out
}

/// Every line containing `needle` in the project's text sources.
pub fn find(root: &Path, needle: &str, whole_word: bool) -> Vec<Hit> {
    let mut hits = vec![];
    for f in history::source_files(root) {
        let Ok(text) = fs::read_to_string(root.join(&f)) else { continue };
        for (i, l) in text.lines().enumerate() {
            if !find_all(l, needle, whole_word).is_empty() {
                hits.push(Hit { file: f.clone(), line: i + 1, text: l.trim().chars().take(200).collect() });
            }
        }
    }
    hits
}

/// Replace text everywhere. Returns (file, replacements) for files that change.
pub fn replace_all(root: &Path, find: &str, with: &str, whole_word: bool, dry_run: bool) -> Result<Vec<(String, usize)>> {
    let mut out = vec![];
    for f in history::source_files(root) {
        let Ok(text) = fs::read_to_string(root.join(&f)) else { continue };
        let at = find_all(&text, find, whole_word);
        if at.is_empty() {
            continue;
        }
        if !dry_run {
            let mut s = String::with_capacity(text.len());
            let mut last = 0;
            for i in &at {
                s.push_str(&text[last..*i]);
                s.push_str(with);
                last = i + find.len();
            }
            s.push_str(&text[last..]);
            io::write_atomic(&root.join(&f), s.as_bytes())?;
        }
        out.push((f, at.len()));
    }
    Ok(out)
}

fn safe_rel(p: &str) -> bool {
    !p.is_empty() && !p.starts_with('/') && !p.contains("..") && !p.contains('\\')
}

/// Move an asset (and its `.meta.json`) and rewrite every quoted reference to it ("path", 'path', `path`).
/// Returns the files whose text changes (the moved file itself is not listed).
pub fn rename_asset(root: &Path, from: &str, to: &str, dry_run: bool) -> Result<Vec<String>> {
    if !safe_rel(from) || !safe_rel(to) {
        return Err(Error::Msg("paths must be relative and stay inside the project".into()));
    }
    if !root.join(from).v_is_file() {
        return Err(Error::Msg(format!("{from} does not exist")));
    }
    if root.join(to).v_exists() {
        return Err(Error::Msg(format!("{to} already exists")));
    }
    let mut changed = vec![];
    for f in history::source_files(root) {
        let Ok(text) = fs::read_to_string(root.join(&f)) else { continue };
        let mut new = text.clone();
        for q in ['"', '\'', '`'] {
            new = new.replace(&format!("{q}{from}{q}"), &format!("{q}{to}{q}"));
        }
        if new != text {
            if !dry_run {
                io::write_atomic(&root.join(&f), new.as_bytes())?;
            }
            changed.push(f);
        }
    }
    if !dry_run {
        for (a, b) in [(from.to_string(), to.to_string()), (format!("{from}.meta.json"), format!("{to}.meta.json"))] {
            if root.join(&a).v_is_file() {
                if let Some(p) = root.join(&b).parent() {
                    fs::create_dir_all(p).map_err(|e| io::io_err(p, e))?;
                }
                fs::rename(root.join(&a), root.join(&b)).map_err(|e| io::io_err(&root.join(&a), e))?;
            }
        }
    }
    Ok(changed)
}

/// Rewrite identifier-bounded `old` that is followed by `.` or `(` (object property / call in an expression).
fn rename_in_expr(s: &str, old: &str, new: &str) -> String {
    let mut out = String::new();
    let mut last = 0;
    for at in find_all(s, old, true) {
        let after = s[at + old.len()..].chars().next();
        if matches!(after, Some('.') | Some('(')) {
            out.push_str(&s[last..at]);
            out.push_str(new);
            last = at + old.len();
        }
    }
    out.push_str(&s[last..]);
    out
}

fn rename_in_sheet(v: &mut Value, old: &str, new: &str, key: Option<&str>) -> bool {
    match v {
        Value::String(s) => {
            let exact = s == old && matches!(key, Some("object" | "type" | "target"));
            let n = if exact { new.to_string() } else { rename_in_expr(s, old, new) };
            let ch = n != *s;
            *s = n;
            ch
        }
        Value::Array(a) => a.iter_mut().fold(false, |c, x| rename_in_sheet(x, old, new, key) | c),
        Value::Object(m) => {
            let mut c = false;
            for (k, x) in m.iter_mut() {
                if k == "title" || k == "text" {
                    continue;
                }
                c |= rename_in_sheet(x, old, new, Some(k));
            }
            c
        }
        _ => false,
    }
}

fn rename_entities(list: &mut [Value], old: &str, new: &str) -> bool {
    let mut c = false;
    for e in list {
        if e["name"] == old {
            e["name"] = Value::String(new.into());
            c = true;
        }
        if let Some(ch) = e["children"].as_array_mut() {
            c |= rename_entities(ch, old, new);
        }
    }
    c
}

/// Rename an object (entity name) across scenes, prefabs and event sheets: entity `name`s, sheet `object`s, `Old.X` / `Old(…)`
/// inside expressions, scene families and timeline targets. Tags and script code are NOT touched (use `replace_all`).
pub fn rename_object(root: &Path, old: &str, new: &str, dry_run: bool) -> Result<Vec<String>> {
    if old.is_empty() || new.is_empty() || !new.chars().all(|c| is_ident(c) || c == ' ' || c == '-') {
        return Err(Error::Msg("new name must be letters, digits, '_' , '-' or spaces".into()));
    }
    let mut changed = vec![];
    for f in history::source_files(root) {
        let is_scene = f.ends_with(".scene.json");
        let is_prefab = f.ends_with(".prefab.json");
        let is_sheet = f.ends_with(".events.json");
        if !(is_scene || is_prefab || is_sheet) {
            continue;
        }
        let Ok(mut v) = io::load_json::<Value>(&root.join(&f)) else { continue };
        let mut c = false;
        if is_scene {
            if let Some(a) = v["entities"].as_array_mut() {
                c |= rename_entities(a, old, new);
            }
            if let Some(m) = v["settings"]["timelines"].as_object_mut() {
                for t in m.values_mut() {
                    c |= rename_in_sheet(&mut t["tracks"], old, new, None);
                }
            }
            if let Some(fam) = v["settings"]["families"].as_object_mut() {
                for l in fam.values_mut() {
                    c |= rename_in_sheet(l, old, new, Some("target"));
                }
            }
        } else if is_prefab {
            if v["root"]["name"] == old {
                v["root"]["name"] = Value::String(new.into());
                c = true;
            }
            if let Some(ch) = v["root"]["children"].as_array_mut() {
                c |= rename_entities(ch, old, new);
            }
        } else {
            c |= rename_in_sheet(&mut v["events"], old, new, None);
        }
        if c {
            if !dry_run {
                io::save_json(&root.join(&f), &v)?;
            }
            changed.push(f);
        }
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn proj(n: &str) -> std::path::PathBuf {
        let d = std::env::temp_dir().join(format!("nord-refs-{n}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(d.join("scenes")).unwrap();
        fs::create_dir_all(d.join("events")).unwrap();
        fs::create_dir_all(d.join("assets")).unwrap();
        d
    }

    #[test]
    fn find_and_replace_whole_words() {
        let d = proj("find");
        fs::write(d.join("a.js"), "let hero = 1;\nlet heroine = 2;\n").unwrap();
        assert_eq!(find(&d, "hero", true).len(), 1);
        assert_eq!(find(&d, "hero", false).len(), 2);
        let dry = replace_all(&d, "hero", "knight", true, true).unwrap();
        assert_eq!(dry, vec![("a.js".to_string(), 1)]);
        assert!(fs::read_to_string(d.join("a.js")).unwrap().contains("hero"));
        replace_all(&d, "hero", "knight", true, false).unwrap();
        assert_eq!(fs::read_to_string(d.join("a.js")).unwrap(), "let knight = 1;\nlet heroine = 2;\n");
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn rename_asset_rewrites_quoted_references_and_moves_meta() {
        let d = proj("asset");
        fs::write(d.join("assets/hero.png"), [1u8]).unwrap();
        fs::write(d.join("assets/hero.png.meta.json"), "{}").unwrap();
        fs::write(d.join("scenes/m.scene.json"), r#"{"t":"assets/hero.png","u":"assets/hero.png.bak"}"#).unwrap();
        fs::write(d.join("s.js"), "load('assets/hero.png')").unwrap();
        assert_eq!(rename_asset(&d, "assets/hero.png", "assets/knight.png", true).unwrap().len(), 2);
        assert!(d.join("assets/hero.png").v_exists(), "dry run moves nothing");
        rename_asset(&d, "assets/hero.png", "assets/knight.png", false).unwrap();
        assert!(d.join("assets/knight.png").v_exists() && d.join("assets/knight.png.meta.json").v_exists() && !d.join("assets/hero.png").v_exists());
        assert_eq!(fs::read_to_string(d.join("scenes/m.scene.json")).unwrap(), r#"{"t":"assets/knight.png","u":"assets/hero.png.bak"}"#);
        assert!(rename_asset(&d, "assets/knight.png", "../x.png", false).is_err());
        assert!(rename_asset(&d, "assets/nope.png", "assets/y.png", false).is_err());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn rename_object_in_scenes_and_sheets() {
        let d = proj("obj");
        io::save_json(&d.join("scenes/m.scene.json"), &json!({"format":1,"name":"m","settings":{"families":{"Foes":["Slime"]}},"entities":[{"id":"a","name":"Slime","children":[{"id":"b","name":"Slime"}]},{"id":"c","name":"Slimey"}]})).unwrap();
        io::save_json(&d.join("events/m.events.json"), &json!({"events":[{"type":"event","conditions":[{"object":"Slime","id":"compare-x","params":{"value":"Slime.X + 1"}}],"actions":[{"object":"System","id":"for-each","params":{"object":"Slime"}},{"object":"System","id":"set-var","params":{"variable":"n","value":"Slimey.X + Slime(0).Y"}}]},{"type":"comment","text":"Slime rules"}]})).unwrap();
        assert_eq!(rename_object(&d, "Slime", "Goo", true).unwrap().len(), 2);
        rename_object(&d, "Slime", "Goo", false).unwrap();
        let s: Value = io::load_json(&d.join("scenes/m.scene.json")).unwrap();
        assert_eq!(s["entities"][0]["name"], "Goo");
        assert_eq!(s["entities"][0]["children"][0]["name"], "Goo");
        assert_eq!(s["entities"][1]["name"], "Slimey");
        assert_eq!(s["settings"]["families"]["Foes"][0], "Goo");
        let e: Value = io::load_json(&d.join("events/m.events.json")).unwrap();
        assert_eq!(e["events"][0]["conditions"][0]["object"], "Goo");
        assert_eq!(e["events"][0]["conditions"][0]["params"]["value"], "Goo.X + 1");
        assert_eq!(e["events"][0]["actions"][0]["params"]["object"], "Goo");
        assert_eq!(e["events"][0]["actions"][1]["params"]["value"], "Slimey.X + Goo(0).Y");
        assert_eq!(e["events"][1]["text"], "Slime rules", "comments are left alone");
        assert!(rename_object(&d, "Goo", "bad;name", false).is_err());
        let _ = fs::remove_dir_all(&d);
    }
}
