//! Rebindable editor shortcuts (Unity defaults). `Settings::keymap` stores only the chords the user changed
//! (`"tool.move": "Y"`); everything else comes from [`DEFS`]. A chord is `[Cmd+][Shift+][Alt+]Key`, `Cmd` = Ctrl on Windows/Linux.
use crate::state::{Action, Tool};
use egui::{Key, Modifiers};
use std::collections::BTreeMap;

pub struct Def {
    pub id: &'static str,
    pub label: &'static str,
    pub default: &'static str,
    /// fires while a text field has focus (global commands such as Save)
    pub while_typing: bool,
    /// uses the browser-safe navigation modifier in the web build (Alt instead of Cmd)
    pub nav: bool,
}

const fn d(
    id: &'static str,
    label: &'static str,
    default: &'static str,
    while_typing: bool,
    nav: bool,
) -> Def {
    Def {
        id,
        label,
        default,
        while_typing,
        nav,
    }
}

pub const DEFS: &[Def] = &[
    d("tool.hand", "Hand tool", "Q", false, false),
    d("tool.move", "Move tool", "W", false, false),
    d("tool.rotate", "Rotate tool", "E", false, false),
    d("tool.scale", "Scale tool", "R", false, false),
    d("tool.rect", "Rect tool", "T", false, false),
    d("focus", "Frame selected", "F", false, false),
    d("focus_all", "Frame all", "Shift+F", false, false),
    d("duplicate", "Duplicate", "Cmd+D", false, false),
    d("copy", "Copy", "Cmd+C", false, false),
    d("paste", "Paste", "Cmd+V", false, false),
    d("undo", "Undo", "Cmd+Z", false, false),
    d("redo", "Redo", "Cmd+Shift+Z", false, false),
    d("delete", "Delete selected", "Delete", false, false),
    d(
        "delete2",
        "Delete selected (alternative)",
        "Backspace",
        false,
        false,
    ),
    d("play", "Play / stop", "F5", true, false),
    d("play_scene", "Run this scene", "F6", true, false),
    d("save", "Save all", "Cmd+S", true, false),
    d("quick_open", "Quick open file", "Cmd+P", true, true),
    d("palette", "Command palette", "Cmd+K", true, true),
    d(
        "build_settings",
        "Build settings",
        "Cmd+Shift+B",
        true,
        false,
    ),
    d("settings", "Settings", "Cmd+Comma", true, false),
    d("tab.scene", "Show Scene", "Cmd+1", true, true),
    d("tab.game", "Show Game", "Cmd+2", true, true),
    d("tab.code", "Show Code", "Cmd+3", true, true),
    d("tab.assets", "Show Assets", "Cmd+4", true, true),
];

/// A chord as modifiers + key.
pub type Chord = (Modifiers, Key);

fn key_from(name: &str) -> Option<Key> {
    let n = name.trim();
    if n.is_empty() {
        return None;
    }
    let mut c = n.chars();
    let first = c.next()?;
    let norm = if c.next().is_none() {
        first.to_ascii_uppercase().to_string()
    } else {
        // the page sends DOM names lower-cased ("f5", "escape", "arrowup")
        let mut cs = n.chars();
        cs.next().map_or(String::new(), |f| f.to_ascii_uppercase().to_string() + cs.as_str())
    };
    Key::from_name(&norm)
}

/// Parse `Cmd+Shift+Z`; `None` for anything that is not a real chord.
pub fn parse(chord: &str) -> Option<Chord> {
    let mut m = Modifiers::NONE;
    let parts: Vec<&str> = chord.split('+').map(str::trim).collect();
    let (key, mods) = parts.split_last()?;
    for p in mods {
        match p.to_ascii_lowercase().as_str() {
            "cmd" | "ctrl" | "command" => m.command = true,
            "shift" => m.shift = true,
            "alt" | "opt" | "option" => m.alt = true,
            _ => return None,
        }
    }
    // "Cmd++" style is not supported; the comma key is spelled Comma
    Some((m, key_from(key)?))
}

/// The chord text for `id` (user override when valid, else the default).
pub fn chord_text<'a>(map: &'a BTreeMap<String, String>, def: &'a Def) -> &'a str {
    match map.get(def.id) {
        Some(c) if parse(c).is_some() => c,
        _ => def.default,
    }
}

/// Modifiers + key for `def`, with the web navigation modifier applied.
pub fn resolve(map: &BTreeMap<String, String>, def: &Def) -> Option<Chord> {
    let (mut m, k) = parse(chord_text(map, def))?;
    if def.nav && m.command {
        m = crate::platform::nav_modifiers()
            | Modifiers {
                command: false,
                ..m
            };
    }
    Some((m, k))
}

/// Human-readable chord, e.g. `Cmd+Shift+Z`.
pub fn label(map: &BTreeMap<String, String>, id: &str) -> String {
    DEFS.iter()
        .find(|d| d.id == id)
        .map_or(String::new(), |d| chord_text(map, d).to_string())
}

/// Chord text for a pressed key (used by the rebinding capture).
pub fn format_chord(m: Modifiers, key: Key) -> String {
    let mut s = String::new();
    if m.command {
        s += "Cmd+";
    }
    if m.shift {
        s += "Shift+";
    }
    if m.alt {
        s += "Alt+";
    }
    s + key.name()
}

/// Ids whose effective chord equals `id`'s (conflicts shown in Settings).
pub fn conflicts(map: &BTreeMap<String, String>, id: &str) -> Vec<&'static str> {
    let Some(me) = DEFS.iter().find(|d| d.id == id) else {
        return vec![];
    };
    let mine = parse(chord_text(map, me));
    DEFS.iter()
        .filter(|o| o.id != id && parse(chord_text(map, o)) == mine)
        .map(|o| o.label)
        .collect()
}

/// What the shortcut does.
pub fn action(id: &str) -> Option<Action> {
    Some(match id {
        "tool.hand" => Action::SetTool(Tool::Hand),
        "tool.move" => Action::SetTool(Tool::Move),
        "tool.rotate" => Action::SetTool(Tool::Rotate),
        "tool.scale" => Action::SetTool(Tool::Scale),
        "tool.rect" => Action::SetTool(Tool::Rect),
        "focus" => Action::Focus,
        "focus_all" => Action::FocusAll,
        "duplicate" => Action::Duplicate,
        "copy" => Action::Copy,
        "paste" => Action::Paste,
        "undo" => Action::Undo,
        "redo" => Action::Redo,
        "delete" | "delete2" => Action::Delete,
        "play_scene" => Action::PlayScene,
        "save" => Action::SaveAll,
        "quick_open" => Action::QuickOpen,
        "palette" => Action::Palette,
        "build_settings" => Action::BuildSettings,
        "settings" => Action::Settings,
        "tab.scene" => Action::ShowTab(crate::app::Tab::Scene),
        "tab.game" => Action::ShowTab(crate::app::Tab::Game),
        "tab.code" => Action::ShowTab(crate::app::Tab::Code),
        "tab.assets" => Action::ShowTab(crate::app::Tab::Assets),
        _ => return None, // "play" toggles, decided by the caller
    })
}

/// Defs in the order they must be tested: more modifiers first, so Shift+F wins over F.
pub fn ordered(map: &BTreeMap<String, String>) -> Vec<&'static Def> {
    let mut v: Vec<&Def> = DEFS.iter().collect();
    let n = |d: &Def| {
        parse(chord_text(map, d)).map_or(0, |(m, _)| {
            usize::from(m.command) + usize::from(m.shift) + usize::from(m.alt)
        })
    };
    v.sort_by_key(|d| std::cmp::Reverse(n(d)));
    v
}

/// The def a key press from the Scene view page (`{key, cmd, shift, alt}`) triggers, if any.
pub fn from_page_key(
    map: &BTreeMap<String, String>,
    key: &str,
    cmd: bool,
    shift: bool,
    alt: bool,
) -> Option<&'static str> {
    let k = key_from(match key {
        "delete" => "Delete",
        "backspace" => "Backspace",
        o => o,
    })?;
    ordered(map).into_iter().find_map(|d| {
        let (m, dk) = parse(chord_text(map, d))?;
        (dk == k && m.command == cmd && m.shift == shift && m.alt == alt).then_some(d.id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_parse_and_do_not_clash() {
        let map = BTreeMap::new();
        for d in DEFS {
            assert!(parse(d.default).is_some(), "{} {}", d.id, d.default);
            let c = conflicts(&map, d.id);
            assert!(c.is_empty(), "{} clashes with {c:?}", d.id);
        }
    }

    #[test]
    fn override_wins_and_bad_override_falls_back() {
        let mut map = BTreeMap::new();
        map.insert("tool.move".to_string(), "Y".to_string());
        map.insert("tool.hand".to_string(), "nonsense++".to_string());
        assert_eq!(label(&map, "tool.move"), "Y");
        assert_eq!(label(&map, "tool.hand"), "Q");
        assert_eq!(
            from_page_key(&map, "y", false, false, false),
            Some("tool.move")
        );
        assert_eq!(
            from_page_key(&map, "w", false, false, false),
            None,
            "old key is free after rebinding"
        );
        assert_eq!(
            from_page_key(&map, "f", false, true, false),
            Some("focus_all")
        );
        assert_eq!(
            from_page_key(&map, "delete", false, false, false),
            Some("delete")
        );
    }

    #[test]
    fn chord_round_trip() {
        let (m, k) = parse("Cmd+Shift+Z").unwrap();
        assert_eq!(format_chord(m, k), "Cmd+Shift+Z");
        assert!(conflicts(
            &BTreeMap::from([("tool.move".into(), "E".into())]),
            "tool.move"
        )
        .contains(&"Rotate tool"));
    }
}
