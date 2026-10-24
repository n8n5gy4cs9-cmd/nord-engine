//! Per-project asset organisation: folder colours and icons, colour tags and descriptions for any asset, view options.
//! Stored in `<project>/.nord/asset-meta.json` (commit it to share it with the team).
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
};

#[derive(Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(default)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Default, PartialEq)]
#[serde(default)]
pub struct Item {
    /// folder colour overlay `#rrggbb`
    pub color: Option<String>,
    /// Lucide icon name from `ICON_CHOICES`, or `img:<project path>` for a user texture
    pub icon: Option<String>,
    pub tags: Vec<String>,
    /// description shown as tooltip
    pub note: String,
}

impl Item {
    fn is_empty(&self) -> bool {
        self.color.is_none() && self.icon.is_none() && self.tags.is_empty() && self.note.is_empty()
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct AssetMeta {
    pub tags: Vec<Tag>,
    pub items: BTreeMap<String, Item>,
    /// alternate row shading in the folder tree
    pub zebra: bool,
    /// vertical indent guide lines in the folder tree
    pub guides: bool,
    /// folders without their own icon show the icon of their dominant content
    pub auto_icons: bool,
    #[serde(skip)]
    loaded_for: Option<PathBuf>,
}

impl Default for AssetMeta {
    fn default() -> Self {
        Self {
            tags: vec![],
            items: BTreeMap::new(),
            zebra: true,
            guides: true,
            auto_icons: true,
            loaded_for: None,
        }
    }
}

/// Folder colour palette (name, hex).
pub const COLORS: &[(&str, &str)] = &[
    ("Red", "#e5534b"),
    ("Orange", "#f0883e"),
    ("Yellow", "#e3b341"),
    ("Green", "#56b36a"),
    ("Teal", "#3fb8af"),
    ("Blue", "#4c9aff"),
    ("Purple", "#a78bfa"),
    ("Pink", "#f472b6"),
    ("Brown", "#a1775a"),
    ("Grey", "#8b949e"),
    ("White", "#e6edf3"),
    ("Black", "#4b5563"),
];

/// Icons offered for folders (all embedded Lucide icons, see `icons.rs`).
pub const ICON_CHOICES: &[&str] = &[
    "folder",
    "image",
    "music",
    "box",
    "boxes",
    "map",
    "film",
    "package",
    "file-code",
    "type",
    "lightbulb",
    "sparkles",
    "zap",
    "star",
    "users",
    "bug",
    "camera",
    "book-open",
    "settings",
    "layers",
    "globe",
    "home",
    "library",
    "terminal",
    "hammer",
    "brush",
    "crosshair",
    "workflow",
];

impl AssetMeta {
    fn path(root: &Path) -> PathBuf {
        root.join(".nord").join("asset-meta.json")
    }
    /// (Re)load when the project changed.
    pub fn ensure(&mut self, root: &Path) {
        if self.loaded_for.as_deref() == Some(root) {
            return;
        }
        let mut m: AssetMeta = nord_core::io::load_json(&Self::path(root)).unwrap_or_default();
        m.loaded_for = Some(root.to_path_buf());
        *self = m;
    }
    pub fn save(&mut self, root: &Path) {
        self.items.retain(|_, i| !i.is_empty());
        let _ = nord_core::vfs::create_dir_all(root.join(".nord"));
        let _ = nord_core::io::save_json(&Self::path(root), self);
    }
    pub fn item(&self, rel: &str) -> Option<&Item> {
        self.items.get(rel)
    }
    pub fn item_mut(&mut self, rel: &str) -> &mut Item {
        self.items.entry(rel.to_string()).or_default()
    }
    pub fn tag(&self, id: &str) -> Option<&Tag> {
        self.tags.iter().find(|t| t.id == id)
    }
    pub fn add_tag(&mut self, name: &str, color: &str) -> String {
        let mut id: String = name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect();
        while self.tags.iter().any(|t| t.id == id) {
            id.push('2');
        }
        self.tags.push(Tag {
            id: id.clone(),
            name: name.into(),
            color: color.into(),
        });
        id
    }
    pub fn toggle_tag(&mut self, rel: &str, id: &str) {
        let t = &mut self.item_mut(rel).tags;
        if let Some(i) = t.iter().position(|x| x == id) {
            t.remove(i);
        } else {
            t.push(id.into());
        }
    }
    /// Keep metadata when a file or folder is renamed or moved (also for everything inside a folder).
    pub fn rekey(&mut self, from: &str, to: &str) {
        let moved: Vec<String> = self
            .items
            .keys()
            .filter(|k| *k == from || k.starts_with(&format!("{from}/")))
            .cloned()
            .collect();
        for k in moved {
            if let Some(v) = self.items.remove(&k) {
                self.items.insert(format!("{to}{}", &k[from.len()..]), v);
            }
        }
    }
    pub fn remove(&mut self, rel: &str) {
        self.items
            .retain(|k, _| k != rel && !k.starts_with(&format!("{rel}/")));
    }
    /// Tooltip text: description and tag names.
    pub fn tooltip(&self, rel: &str) -> String {
        let Some(i) = self.item(rel) else {
            return String::new();
        };
        let tags: Vec<&str> = i
            .tags
            .iter()
            .filter_map(|t| self.tag(t))
            .map(|t| t.name.as_str())
            .collect();
        let mut s = String::new();
        if !i.note.is_empty() {
            s += &i.note;
        }
        if !tags.is_empty() {
            if !s.is_empty() {
                s += "\n";
            }
            s += &format!("Tags: {}", tags.join(", "));
        }
        s
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rekey_moves_folder_contents_and_empty_items_are_dropped() {
        let mut m = AssetMeta::default();
        m.item_mut("a").color = Some("#fff000".into());
        m.item_mut("a/b").note = "n".into();
        m.item_mut("ab").note = "other".into();
        m.rekey("a", "c");
        assert!(
            m.item("c").is_some()
                && m.item("c/b").is_some()
                && m.item("ab").is_some()
                && m.item("a").is_none()
        );
        m.item_mut("zzz");
        let dir = std::env::temp_dir().join(format!("nordmeta-{}", std::process::id()));
        m.save(&dir);
        assert!(m.item("zzz").is_none());
        let mut back = AssetMeta::default();
        back.ensure(&dir);
        assert_eq!(back.item("c/b").unwrap().note, "n");
        let _ = std::fs::remove_dir_all(dir);
    }
    #[test]
    fn tags_toggle() {
        let mut m = AssetMeta::default();
        let id = m.add_tag("Needs art", "#e5534b");
        m.toggle_tag("x.png", &id);
        assert_eq!(m.item("x.png").unwrap().tags, vec![id.clone()]);
        assert!(m.tooltip("x.png").contains("Needs art"));
        m.toggle_tag("x.png", &id);
        assert!(m.item("x.png").unwrap().tags.is_empty());
    }
}
