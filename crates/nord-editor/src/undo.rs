//! Undo/redo. Every mutation of the scene goes through `UndoStack::apply`, which snapshots the entity tree before/after
//! (scenes are small JSON trees, so snapshot commands are simpler and safer than hand-written inverse ops).
//! Consecutive edits with the same `key` within `COALESCE` merge into one step (dragging a slider = one undo).
use nord_core::scene::Entity;
use std::time::{Duration, Instant};

const COALESCE: Duration = Duration::from_millis(800);
const MAX: usize = 200;

pub struct Command {
    pub label: String,
    key: Option<String>,
    at: Instant,
    before: Vec<Entity>,
    after: Vec<Entity>,
}

#[derive(Default)]
pub struct UndoStack {
    undo: Vec<Command>,
    redo: Vec<Command>,
}

impl UndoStack {
    /// Run `f` on `entities`; if it changed anything, record a command. Returns whether the scene changed.
    pub fn apply(
        &mut self,
        entities: &mut Vec<Entity>,
        label: &str,
        key: Option<&str>,
        f: impl FnOnce(&mut Vec<Entity>),
    ) -> bool {
        let before = entities.clone();
        f(entities);
        if *entities == before {
            return false;
        }
        self.redo.clear();
        let now = Instant::now();
        if let (Some(k), Some(last)) = (key, self.undo.last_mut()) {
            if last.key.as_deref() == Some(k) && now.duration_since(last.at) < COALESCE {
                last.after = entities.clone();
                last.at = now;
                return true;
            }
        }
        self.undo.push(Command {
            label: label.into(),
            key: key.map(Into::into),
            at: now,
            before,
            after: entities.clone(),
        });
        if self.undo.len() > MAX {
            self.undo.remove(0);
        }
        true
    }

    pub fn undo(&mut self, entities: &mut Vec<Entity>) -> Option<String> {
        let c = self.undo.pop()?;
        *entities = c.before.clone();
        let l = c.label.clone();
        self.redo.push(c);
        Some(l)
    }

    pub fn redo(&mut self, entities: &mut Vec<Entity>) -> Option<String> {
        let c = self.redo.pop()?;
        *entities = c.after.clone();
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
        let mut e = vec![Entity::new("a")];
        assert!(!s.apply(&mut e, "noop", None, |_| {}));
        s.apply(&mut e, "move", Some("x"), |l| l[0].transform.pos[0] = 1.0);
        s.apply(&mut e, "move", Some("x"), |l| l[0].transform.pos[0] = 2.0);
        assert_eq!(s.undo.len(), 1, "coalesced");
        s.apply(&mut e, "rename", None, |l| l[0].name = "b".into());
        assert_eq!(s.undo(&mut e).as_deref(), Some("rename"));
        assert_eq!(e[0].name, "a");
        assert_eq!(s.undo(&mut e).as_deref(), Some("move"));
        assert_eq!(e[0].transform.pos[0], 0.0);
        assert!(s.redo(&mut e).is_some());
        assert_eq!(e[0].transform.pos[0], 2.0);
        s.apply(&mut e, "del", None, |l| l.clear());
        assert!(!s.can_redo());
    }
}
