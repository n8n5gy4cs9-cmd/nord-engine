//! Pure scene-tree operations used by the hierarchy, viewport and undo system (unit-tested).
use nord_core::scene::{new_id, Entity};

pub fn find<'a>(list: &'a [Entity], id: &str) -> Option<&'a Entity> {
    for e in list {
        if e.id == id {
            return Some(e);
        }
        if let Some(f) = find(&e.children, id) {
            return Some(f);
        }
    }
    None
}

pub fn find_mut<'a>(list: &'a mut [Entity], id: &str) -> Option<&'a mut Entity> {
    for e in list {
        if e.id == id {
            return Some(e);
        }
        if let Some(f) = find_mut(&mut e.children, id) {
            return Some(f);
        }
    }
    None
}

/// Id of the parent of `id` (`None` = root level or not found).
pub fn parent_of(list: &[Entity], id: &str) -> Option<String> {
    for e in list {
        if e.children.iter().any(|c| c.id == id) {
            return Some(e.id.clone());
        }
        if let Some(p) = parent_of(&e.children, id) {
            return Some(p);
        }
    }
    None
}

pub fn remove(list: &mut Vec<Entity>, id: &str) -> Option<Entity> {
    if let Some(i) = list.iter().position(|e| e.id == id) {
        return Some(list.remove(i));
    }
    list.iter_mut().find_map(|e| remove(&mut e.children, id))
}

pub fn is_descendant(root: &Entity, id: &str) -> bool {
    find(&root.children, id).is_some()
}

/// Insert `e` as a child of `parent` (or at root) at `index` (clamped). Returns false if parent missing.
pub fn insert(list: &mut Vec<Entity>, parent: Option<&str>, index: usize, e: Entity) -> bool {
    match parent {
        None => {
            let i = index.min(list.len());
            list.insert(i, e);
            true
        }
        Some(p) => match find_mut(list, p) {
            Some(p) => {
                let i = index.min(p.children.len());
                p.children.insert(i, e);
                true
            }
            None => false,
        },
    }
}

/// Move `id` under `new_parent` (None = root) at `index`. Refuses to move into itself / a descendant.
pub fn reparent(list: &mut Vec<Entity>, id: &str, new_parent: Option<&str>, index: usize) -> bool {
    if let Some(np) = new_parent {
        if np == id || find(list, id).is_some_and(|e| is_descendant(e, np)) {
            return false;
        }
    }
    // removal shifts later siblings up by one when moving down within the same list
    let old_parent = parent_of(list, id);
    let old_idx = match &old_parent {
        None => list.iter().position(|e| e.id == id),
        Some(p) => find(list, p).and_then(|p| p.children.iter().position(|e| e.id == id)),
    };
    let Some(e) = remove(list, id) else {
        return false;
    };
    let index = match old_idx {
        Some(o) if old_parent.as_deref() == new_parent && o < index && index != usize::MAX => {
            index - 1
        }
        _ => index,
    };
    insert(list, new_parent, index, e)
}

/// Deep copy with fresh ids; returns the clone.
pub fn clone_fresh(e: &Entity) -> Entity {
    let mut c = e.clone();
    fn renew(e: &mut Entity) {
        e.id = new_id();
        e.children.iter_mut().for_each(renew);
    }
    renew(&mut c);
    c
}

/// Duplicate `id` right after the original; returns the new id.
pub fn duplicate(list: &mut Vec<Entity>, id: &str) -> Option<String> {
    let mut c = clone_fresh(find(list, id)?);
    c.name = format!("{} copy", c.name);
    let nid = c.id.clone();
    let parent = parent_of(list, id);
    let siblings = match &parent {
        None => &*list,
        Some(p) => &find(list, p)?.children,
    };
    let idx = siblings.iter().position(|e| e.id == id)? + 1;
    insert(list, parent.as_deref(), idx, c).then_some(nid)
}

/// Flatten for search/quick-open: (depth, entity).
pub fn flatten(list: &[Entity]) -> Vec<(usize, &Entity)> {
    fn go<'a>(l: &'a [Entity], d: usize, out: &mut Vec<(usize, &'a Entity)>) {
        for e in l {
            out.push((d, e));
            go(&e.children, d + 1, out);
        }
    }
    let mut v = vec![];
    go(list, 0, &mut v);
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree() -> Vec<Entity> {
        let mut a = Entity::new("a");
        let mut b = Entity::new("b");
        b.children.push(Entity::new("b1"));
        a.children.push(b);
        vec![a, Entity::new("c")]
    }

    #[test]
    fn reparent_rules() {
        let mut t = tree();
        let a = t[0].id.clone();
        let b = t[0].children[0].id.clone();
        let c = t[1].id.clone();
        assert!(!reparent(&mut t, &a, Some(&b), 0), "into descendant");
        assert!(!reparent(&mut t, &a, Some(&a), 0), "into self");
        assert!(reparent(&mut t, &b, Some(&c), 0));
        assert_eq!(parent_of(&t, &b), Some(c));
        assert!(reparent(&mut t, &b, None, 0));
        assert_eq!(t[0].id, b);
    }

    #[test]
    fn duplicate_gives_fresh_ids() {
        let mut t = tree();
        let a = t[0].id.clone();
        let n = duplicate(&mut t, &a).unwrap();
        assert_eq!(t[1].id, n);
        assert_eq!(t[1].name, "a copy");
        let mut ids = vec![];
        for e in flatten(&t) {
            ids.push(e.1.id.clone());
        }
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 7);
    }

    #[test]
    fn remove_nested() {
        let mut t = tree();
        let b1 = t[0].children[0].children[0].id.clone();
        assert!(remove(&mut t, &b1).is_some());
        assert!(find(&t, &b1).is_none());
    }
}
