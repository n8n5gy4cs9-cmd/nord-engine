//! Path jail: every client-supplied name or path goes through here before it touches the disk.
use std::path::{Component, Path, PathBuf};

/// A project or user name: letters, digits, space, `.`, `_`, `-`; 1..=64 chars; no leading dot.
pub fn valid_name(n: &str) -> bool {
    !n.is_empty()
        && n.len() <= 64
        && !n.starts_with('.')
        && n.chars()
            .all(|c| c.is_ascii_alphanumeric() || " ._-".contains(c))
}

/// Join a project-relative path (forward slashes) to `base`. Rejects absolute paths, `..`, backslashes, NUL, empty components and
/// hidden server-side folders; refuses to traverse a symlink that already exists. `None` = refuse.
pub fn safe_join(base: &Path, rel: &str) -> Option<PathBuf> {
    if rel.is_empty() || rel.len() > 400 || rel.contains(['\\', '\0']) {
        return None;
    }
    let mut p = base.to_path_buf();
    for part in rel.split('/') {
        if part.is_empty() || part == "." || part == ".." || part == ".nord-cache" || part == ".git"
        {
            return None;
        }
        if !matches!(
            Path::new(part).components().next(),
            Some(Component::Normal(_))
        ) {
            return None;
        }
        p.push(part);
        if std::fs::symlink_metadata(&p).is_ok_and(|m| m.file_type().is_symlink()) {
            return None;
        }
    }
    Some(p)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names() {
        assert!(valid_name("My Game-2.0"));
        for bad in ["", ".hidden", "a/b", "a\\b", "..", &"x".repeat(65), "tab\t"] {
            assert!(!valid_name(bad), "{bad:?}");
        }
    }

    #[test]
    fn traversal_is_refused() {
        let base = Path::new("/srv/ws/u/p");
        assert!(safe_join(base, "scenes/main.scene.json").is_some());
        for bad in [
            "",
            "/etc/passwd",
            "../x",
            "a/../../x",
            "a//b",
            "a\\..\\b",
            "a/./b",
            ".git/config",
            ".nord-cache/lock",
            "a\0b",
            "C:/x",
        ] {
            // "C:/x" is a normal relative name on unix and stays inside the base; everything else must be refused
            if bad == "C:/x" {
                assert!(safe_join(base, bad).is_some_and(|p| p.starts_with(base)));
            } else {
                assert!(safe_join(base, bad).is_none(), "{bad:?}");
            }
        }
    }

    #[test]
    fn symlinks_are_not_followed() {
        let d = std::env::temp_dir().join(format!("nord-jail-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink("/etc", d.join("link")).unwrap();
            assert!(safe_join(&d, "link/passwd").is_none());
        }
        let _ = std::fs::remove_dir_all(&d);
    }
}
