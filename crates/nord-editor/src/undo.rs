//! Undo/redo. Every mutation of the scene goes through `UndoStack::apply`, which snapshots the entity tree and the scene settings
//! (layers, event sheet link…) before/after (scenes are small JSON trees, so snapshot commands are simpler and safer than hand-written
//! inverse ops). Consecutive edits with the same `key` within `COALESCE` merge into one step (dragging a slider = one undo).
use nord_core::scene::{Entity, SceneSettings};
use nord_core::Scene;
use std::time::Duration;
use web_time::Instant;

const COALESCE: Duration = Duration::from_millis(800);
const MAX: usize = 200;

#[derive(Clone, PartialEq)]
struct Snap {
    entities: Vec<Entity>,
    settings: SceneSettings,
}

impl Snap {
    fn of(s: &Scene) -> Self {
        Self {
            entities: s.entities.clone(),
            settings: s.settings.clone(),
        }
    }
    fn restore(&self, s: &mut Scene) {
        s.entities = self.entities.clone();
        s.settings = self.settings.clone();
    }
}

pub struct Command {
    pub label: String,
    key: Option<String>,
    at: Instant,
    before: Snap,
    after: Snap,
}

#[derive(Default)]
pub struct UndoStack {
    undo: Vec<Command>,
    redo: Vec<Command>,
}

impl UndoStack {
    /// Run `f` on the scene; if it changed anything, record a command. Returns whether the scene changed.
    pub fn apply(
        &mut self,
        scene: &mut Scene,
        label: &str,
        key: Option<&str>,
        f: impl FnOnce(&mut Scene),
    ) -> bool {
        let before = Snap::of(scene);
        f(scene);
        let after = Snap::of(scene);
        if after == before {
            return false;
        }
        self.redo.clear();
        let now = Instant::now();
        if let (Some(k), Some(last)) = (key, self.undo.last_mut()) {
            if last.key.as_deref() == Some(k) && now.duration_since(last.at) < COALESCE {
                last.after = after;
                last.at = now;
                return true;
            }
        }
        self.undo.push(Command {
            label: label.into(),
            key: key.map(Into::into),
            at: now,
            before,
            after,
        });
        if self.undo.len() > MAX {
            self.undo.remove(0);
        }
        true
    }

    pub fn undo(&mut self, scene: &mut Scene) -> Option<String> {
        let c = self.undo.pop()?;
        c.before.restore(scene);
        let l = c.label.clone();
        self.redo.push(c);
        Some(l)
    }

    pub fn redo(&mut self, scene: &mut Scene) -> Option<String> {
        let c = self.redo.pop()?;
        c.after.restore(scene);
        let l = c.label.clone();
        self.undo.push(c);
        Some(l)
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
    pub fn next_undo_label(&self) -> Option<&str> {
        self.undo.last().map(|c| c.label.as_str())
    }
    pub fn clear(&mut self) {
        self.undo.clear();
        self.redo.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn undo_redo_and_coalesce() {
        let mut s = UndoStack::default();
        let mut sc = Scene::new("t");
        sc.entities = vec![Entity::new("a")];
        assert!(!s.apply(&mut sc, "noop", None, |_| {}));
        s.apply(&mut sc, "move", Some("x"), |s| {
            s.entities[0].transform.pos[0] = 1.0
        });
        s.apply(&mut sc, "move", Some("x"), |s| {
            s.entities[0].transform.pos[0] = 2.0
        });
        assert_eq!(s.undo.len(), 1, "coalesced");
        s.apply(&mut sc, "rename", None, |s| s.entities[0].name = "b".into());
        assert_eq!(s.undo(&mut sc).as_deref(), Some("rename"));
        assert_eq!(sc.entities[0].name, "a");
        assert_eq!(s.undo(&mut sc).as_deref(), Some("move"));
        assert_eq!(sc.entities[0].transform.pos[0], 0.0);
        assert!(s.redo(&mut sc).is_some());
        assert_eq!(sc.entities[0].transform.pos[0], 2.0);
        s.apply(&mut sc, "del", None, |s| s.entities.clear());
        assert!(!s.can_redo());
    }

    #[test]
    fn scene_settings_are_part_of_undo() {
        let mut s = UndoStack::default();
        let mut sc = Scene::new("t");
        s.apply(&mut sc, "layer", None, |s| {
            s.settings.extra.insert(
                "layers".into(),
                serde_json::json!({"0": {"name": "Ground"}}),
            );
        });
        assert!(sc.settings.extra.contains_key("layers"));
        s.undo(&mut sc);
        assert!(!sc.settings.extra.contains_key("layers"));
        s.redo(&mut sc);
        assert_eq!(sc.settings.extra["layers"]["0"]["name"], "Ground");
    }
}
