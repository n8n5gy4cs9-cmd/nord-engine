//! Declarative window/menu/tray/shortcut specs. The core can't open windows (that's the shell: tao/wry in `nord-player`, eframe viewports
//! for Rust apps), so the bridge validates them against the permissions and queues [`HostCommand`]s the shell drains and applies.
use crate::{DesktopError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct WindowOpts {
    pub id: String,
    pub title: String,
    pub url: String,
    pub width: f64,
    pub height: f64,
    pub frameless: bool,
    pub transparent: bool,
    pub always_on_top: bool,
    pub fullscreen: bool,
    pub resizable: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct MenuItem {
    pub id: String,
    pub label: String,
    /// `Cmd+S`, `Ctrl+Shift+N` … (`Cmd` = Ctrl on Windows/Linux)
    pub accelerator: Option<String>,
    pub separator: bool,
    pub checked: Option<bool>,
    pub enabled: Option<bool>,
    /// predefined role: copy, paste, quit, … (shell maps these to native items)
    pub role: Option<String>,
    pub items: Vec<MenuItem>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "cmd", rename_all = "camelCase")]
pub enum HostCommand {
    OpenWindow(WindowOpts),
    CloseWindow {
        id: String,
    },
    SetMenu {
        items: Vec<MenuItem>,
    },
    ContextMenu {
        items: Vec<MenuItem>,
        x: Option<f64>,
        y: Option<f64>,
    },
    SetTray {
        icon: Option<String>,
        tooltip: String,
        items: Vec<MenuItem>,
    },
    RemoveTray,
    RegisterShortcut {
        id: String,
        accelerator: String,
    },
    UnregisterShortcut {
        id: String,
    },
    SetTitle {
        title: String,
    },
    SetFullscreen {
        on: bool,
    },
    SetAlwaysOnTop {
        on: bool,
    },
    Badge {
        text: Option<String>,
    },
    Progress {
        value: Option<f32>,
    },
    Autostart {
        enable: bool,
    },
    QuitGuard {
        enable: bool,
    },
    Quit,
}

pub fn parse<T: for<'de> Deserialize<'de>>(v: &Value, what: &str) -> Result<T> {
    serde_json::from_value(v.clone()).map_err(|e| DesktopError::invalid(format!("{what}: {e}")))
}

const MODS: [&str; 6] = ["cmd", "ctrl", "alt", "shift", "super", "cmdorctrl"];
/// `Mod+Mod+Key`; key = single char, F1–F24, or a named key. Returns the normalised form.
pub fn check_accelerator(a: &str) -> Result<String> {
    let parts: Vec<&str> = a.split('+').map(str::trim).collect();
    let (key, mods) = parts
        .split_last()
        .ok_or_else(|| DesktopError::invalid("empty accelerator"))?;
    if key.is_empty()
        || mods
            .iter()
            .any(|m| !MODS.contains(&m.to_ascii_lowercase().as_str()))
    {
        return Err(DesktopError::invalid(format!("bad accelerator '{a}'")));
    }
    let named = [
        "space",
        "enter",
        "tab",
        "escape",
        "backspace",
        "delete",
        "up",
        "down",
        "left",
        "right",
        "home",
        "end",
        "pageup",
        "pagedown",
    ];
    let ok = key.chars().count() == 1
        || named.contains(&key.to_ascii_lowercase().as_str())
        || (key.len() <= 3
            && key.starts_with(['F', 'f'])
            && key[1..].parse::<u8>().is_ok_and(|n| (1..=24).contains(&n)));
    if !ok {
        return Err(DesktopError::invalid(format!(
            "bad key in accelerator '{a}'"
        )));
    }
    Ok(a.to_string())
}

pub fn check_menu(items: &[MenuItem], depth: usize) -> Result<()> {
    if depth > 4 {
        return Err(DesktopError::invalid("menu nested too deep"));
    }
    for i in items {
        if !i.separator && i.role.is_none() && i.items.is_empty() && i.id.is_empty() {
            return Err(DesktopError::invalid(
                "menu item needs an id (or role/separator/items)",
            ));
        }
        if let Some(a) = &i.accelerator {
            check_accelerator(a)?;
        }
        check_menu(&i.items, depth + 1)?;
    }
    Ok(())
}

/// Window geometry persisted in the store under `__window.<id>` is applied by the shell; this clamps nonsense (off-screen, tiny) values.
pub fn clamp_geometry(x: f64, y: f64, w: f64, h: f64, screen: (f64, f64)) -> (f64, f64, f64, f64) {
    let (w, h) = (w.clamp(200.0, screen.0), h.clamp(120.0, screen.1));
    (
        x.clamp(-w + 80.0, screen.0 - 80.0),
        y.clamp(0.0, screen.1 - 60.0),
        w,
        h,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accelerators() {
        for ok in ["Cmd+S", "ctrl+shift+N", "F5", "Alt+Space", "CmdOrCtrl+,"] {
            assert!(check_accelerator(ok).is_ok(), "{ok}")
        }
        for bad in ["", "Cmd+", "Hyper+S", "Cmd+Foo", "F99"] {
            assert!(check_accelerator(bad).is_err(), "{bad}")
        }
    }
    #[test]
    fn menus_validate() {
        let m: Vec<MenuItem> = parse(&serde_json::json!([{"label":"File","items":[{"id":"new","label":"New","accelerator":"Cmd+N"},{"separator":true},{"role":"quit"}]}]), "menu").unwrap();
        assert!(check_menu(&m, 0).is_ok());
        assert!(check_menu(
            &parse::<Vec<MenuItem>>(&serde_json::json!([{"label":"x"}]), "m").unwrap(),
            0
        )
        .is_err());
    }
    #[test]
    fn geometry_is_kept_on_screen() {
        assert_eq!(
            clamp_geometry(5000.0, -50.0, 10.0, 10.0, (1920.0, 1080.0)),
            (1840.0, 0.0, 200.0, 120.0)
        );
    }
}
