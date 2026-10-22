//! Virtual Hierarchy rows: things the game shows or runs that are not scene entities (environment, managers,
//! FPS-level contents). Read-only, never saved, ids start with `v:`. docs/EDITOR_UI.md "Virtual nodes".
use nord_core::project::Project;
use nord_core::scene::{Entity, Scene};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;

#[derive(Clone)]
pub struct VNode {
    pub id: String,
    pub name: String,
    pub icon: &'static str,
    pub info: Vec<String>,
    pub children: Vec<VNode>,
}

pub fn is_virtual(id: &str) -> bool {
    id.starts_with("v:")
}

fn node(id: &str, name: &str, icon: &'static str, info: Vec<String>) -> VNode {
    VNode {
        id: id.into(),
        name: name.into(),
        icon,
        info,
        children: vec![],
    }
}

/// "Environment" and "Managers" for the open scene (settings + project services).
pub fn scene_nodes(p: &Project, s: &Scene) -> Vec<VNode> {
    let set = &s.settings;
    let mut env = vec![
        format!("Background: {}", p.display.background),
        format!(
            "Display: {} × {} ({})",
            p.display.width, p.display.height, p.display.scale
        ),
    ];
    if let Some(a) = &set.ambient {
        env.push(format!("Ambient: {a}"));
    }
    if let Some(sk) = &set.skybox {
        env.push(format!("Skybox: {sk}"));
    }
    if let Some(g) = set.gravity {
        env.push(format!("Gravity (scene): {g:?}"));
    }
    env.push("Edit: Project ▸ Settings, or the scene settings in the Inspector.".into());
    let mut mgr = vec![
        node(
            "v:mgr:physics",
            "Physics",
            "component",
            vec![
                format!("Engine: {}", p.physics.engine),
                format!("Gravity: {:?}", p.physics.gravity),
            ],
        ),
        node(
            "v:mgr:input",
            "Input",
            "crosshair",
            vec![format!("{} action(s)", p.input.actions.len())]
                .into_iter()
                .chain(p.input.actions.keys().map(|k| format!("• {k}")))
                .collect(),
        ),
        node(
            "v:mgr:ui",
            "UI / Theme",
            "layout-grid",
            p.ui.iter().map(|(k, v)| format!("{k}: {v}")).collect(),
        ),
        node(
            "v:mgr:game",
            "Game",
            "play",
            vec![
                format!("Start scene: {}", p.start_scene),
                "Game.loadScene(), Game.pause(), score/state store, audio, save".into(),
            ],
        ),
    ];
    if !p.plugins.is_empty() || !p.addons.is_empty() {
        mgr.push(node(
            "v:mgr:addons",
            "Plugins / Addons",
            "package",
            p.plugins
                .iter()
                .chain(p.addons.iter())
                .map(|x| format!("• {x}"))
                .collect(),
        ));
    }
    if set.extra.contains_key("eventSheet") {
        mgr.push(node(
            "v:mgr:events",
            "Event sheet",
            "list",
            vec![format!("{}", set.extra["eventSheet"])],
        ));
    }
    if let Some(g) = set.extra.get("graphs") {
        mgr.push(node("v:mgr:graphs", "Graphs", "list", vec![format!("{g}")]));
    }
    let mut env_node = node("v:env", "Environment", "globe", env);
    env_node.children = vec![];
    let mut m = node(
        "v:managers",
        "Managers",
        "settings",
        vec!["Services the runtime provides to every scene.".into()],
    );
    m.children = mgr;
    vec![env_node, m]
}

fn level_path(e: &Entity) -> Option<String> {
    let s = e
        .scripts
        .iter()
        .find(|s| s.path.ends_with("fpsc/level-script.js"))?;
    Some(
        s.attributes
            .get("level")
            .and_then(Value::as_str)
            .unwrap_or("levels/level1.fpsl.json")
            .to_string(),
    )
}

/// Children shown under an "FPS Level" host entity: settings, storeys, and every placed item grouped by type.
pub fn host_nodes(root: &Path, e: &Entity) -> Vec<VNode> {
    let Some(rel) = level_path(e) else {
        return vec![];
    };
    let Ok(txt) = nord_core::vfs::read_to_string(root.join(&rel)) else {
        return vec![node(
            &format!("v:{}:missing", e.id),
            &format!("⚠ {rel} not found"),
            "alert-triangle",
            vec![],
        )];
    };
    let Ok(lv) = serde_json::from_str::<Value>(&txt) else {
        return vec![];
    };
    let pre = format!("v:{}:", e.id);
    let st = &lv["settings"];
    let mut out = vec![node(
        &format!("{pre}settings"),
        &format!("Level: {}", lv["name"].as_str().unwrap_or("level")),
        "map",
        vec![
            format!("File: {rel}"),
            format!("Size: {} × {} cells of {} m", lv["w"], lv["d"], lv["cell"]),
            format!(
                "Sky: {}  Ground: {}",
                st["sky"].as_str().unwrap_or("day"),
                st["ground"].as_str().unwrap_or("-")
            ),
            format!("Ambient: {}  Fog: {}", st["ambient"], st["fog"]),
            "Edit it in the FPS Level tab.".into(),
        ],
    )];
    for (i, l) in lv["layers"].as_array().into_iter().flatten().enumerate() {
        let cells = l["cells"].as_object().map_or(0, |o| o.len());
        let edges = l["edges"].as_object().map_or(0, |o| o.len());
        out.push(node(
            &format!("{pre}layer{i}"),
            &format!("Storey {}: {}", i, l["name"].as_str().unwrap_or("")),
            "layers",
            vec![format!("{cells} floor cells, {edges} wall/door pieces")],
        ));
    }
    let mut groups: BTreeMap<String, Vec<VNode>> = BTreeMap::new();
    for it in lv["entities"].as_array().into_iter().flatten() {
        let ty = it["type"].as_str().unwrap_or("item");
        let id = it["id"].as_str().unwrap_or("?");
        let nm = it["name"].as_str().filter(|s| !s.is_empty()).unwrap_or(ty);
        groups.entry(ty.to_string()).or_default().push(node(
            &format!("{pre}ent:{id}"),
            nm,
            "component",
            vec![
                format!("Type: {ty}"),
                format!(
                    "Position: x {} z {} storey {}",
                    it["x"], it["z"], it["layer"]
                ),
                format!("Rotation: {}", it["rot"]),
            ],
        ));
    }
    for (ty, items) in groups {
        let mut g = node(
            &format!("{pre}grp:{ty}"),
            &format!("{ty} ×{}", items.len()),
            "folder",
            vec![],
        );
        g.children = items;
        out.push(g);
    }
    out
}

/// Parsed FPS-level rows by host entity id, refreshed when the level file changes.
pub type Cache =
    std::collections::HashMap<String, (web_time::SystemTime, std::sync::Arc<Vec<VNode>>)>;

pub fn host_cached(cache: &mut Cache, root: &Path, e: &Entity) -> std::sync::Arc<Vec<VNode>> {
    let Some(rel) = level_path(e) else {
        return Default::default();
    };
    let mt = nord_core::vfs::metadata(root.join(&rel))
        .and_then(|m| m.modified())
        .unwrap_or(web_time::SystemTime::UNIX_EPOCH);
    if let Some((t, v)) = cache.get(&e.id) {
        if *t == mt {
            return v.clone();
        }
    }
    let v = std::sync::Arc::new(host_nodes(root, e));
    cache.insert(e.id.clone(), (mt, v.clone()));
    v
}

pub fn find<'a>(nodes: &'a [VNode], id: &str) -> Option<&'a VNode> {
    for n in nodes {
        if n.id == id {
            return Some(n);
        }
        if let Some(f) = find(&n.children, id) {
            return Some(f);
        }
    }
    None
}

/// Everything virtual for the open scene (used by the Inspector to describe a selected virtual row).
pub fn all(root: Option<&Path>, p: &Project, s: &Scene) -> Vec<VNode> {
    let mut v = scene_nodes(p, s);
    if let Some(r) = root {
        for (_, e) in crate::scene_ops::flatten(&s.entities) {
            let mut h = host_nodes(r, e);
            if !h.is_empty() {
                let mut n = node(&format!("v:{}", e.id), &e.name, "folder", vec![]);
                n.children.append(&mut h);
                v.push(n);
            }
        }
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scene_has_environment_and_managers() {
        let n = scene_nodes(
            &Project::new("t", "t", nord_core::project::ProjectType::TwoD),
            &Scene::new("main"),
        );
        assert_eq!(n[0].id, "v:env");
        assert!(find(&n, "v:mgr:physics").is_some());
        assert!(is_virtual(&n[1].id));
    }

    #[test]
    fn fps_host_children() {
        let dir = std::env::temp_dir().join(format!("nord-virt-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("levels")).unwrap();
        std::fs::write(
            dir.join("levels/level1.fpsl.json"),
            r#"{"name":"T","w":4,"d":4,"cell":4,"settings":{},"layers":[{"name":"Ground","cells":{"0,0":{}},"edges":{}}],"entities":[{"id":"e1","type":"player_start","x":1,"z":2,"layer":0,"rot":0}]}"#,
        )
        .unwrap();
        let mut e = Entity::new("FPS Level");
        e.scripts.push(nord_core::scene::ScriptRef {
            path: "scripts/fpsc/level-script.js".into(),
            attributes: Default::default(),
        });
        let n = host_nodes(&dir, &e);
        assert!(n
            .iter()
            .any(|x| x.name == "player_start ×1" && x.children.len() == 1));
        let _ = std::fs::remove_dir_all(dir);
    }
}
