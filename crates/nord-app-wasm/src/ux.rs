//! Small real-app helpers for egui apps (M9-14): snapshot undo/redo. Dark-mode follow, IME and high-DPI are eframe defaults
//! (`egui::Context::set_theme(ThemePreference::System)` — the default — follows the OS; text input uses winit's IME).

/// Snapshot-based undo stack: `push(state)` after every change, `undo()` / `redo()` return the state to show.
#[derive(Debug, Clone)]
pub struct UndoStack<T: Clone> {
    past: Vec<T>,
    future: Vec<T>,
    limit: usize,
}
impl<T: Clone> UndoStack<T> {
    pub fn new(initial: T, limit: usize) -> Self {
        Self { past: vec![initial], future: vec![], limit: limit.max(2) }
    }
    pub fn push(&mut self, s: T) {
        self.past.push(s);
        self.future.clear();
        if self.past.len() > self.limit {
            self.past.remove(0);
        }
    }
    pub fn undo(&mut self) -> Option<T> {
        (self.past.len() > 1).then(|| {
            let cur = self.past.pop().unwrap();
            self.future.push(cur);
            self.past.last().unwrap().clone()
        })
    }
    pub fn redo(&mut self) -> Option<T> {
        self.future.pop().map(|s| {
            self.past.push(s.clone());
            s
        })
    }
    pub fn can_undo(&self) -> bool { self.past.len() > 1 }
    pub fn can_redo(&self) -> bool { !self.future.is_empty() }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn undo_redo_and_limit() {
        let mut u = UndoStack::new("a".to_string(), 3);
        u.push("b".into());
        u.push("c".into());
        assert_eq!(u.undo().as_deref(), Some("b"));
        assert_eq!(u.redo().as_deref(), Some("c"));
        u.undo();
        u.push("x".into());
        assert!(!u.can_redo());
        u.push("y".into());
        u.push("z".into());
        assert_eq!(u.past.len(), 3, "limit");
        assert_eq!(u.undo().as_deref(), Some("y"));
        assert_eq!(u.undo().as_deref(), Some("x"));
        assert_eq!(u.undo(), None);
    }
}
