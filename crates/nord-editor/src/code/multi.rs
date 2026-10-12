//! Multi-cursor core: pure, char-index based, unit-tested. The primary selection still lives in `egui::TextEdit`;
//! `Doc.extra` holds the secondary ones. While extras exist, `process_keys` routes editing keys through here.

use super::edit::{byte, line_ranges};

#[derive(Debug, PartialEq, Clone, Copy)]
pub struct Sel {
    pub anchor: usize,
    pub head: usize,
}

impl Sel {
    pub fn caret(p: usize) -> Self {
        Sel { anchor: p, head: p }
    }
    pub fn lo(&self) -> usize {
        self.anchor.min(self.head)
    }
    pub fn hi(&self) -> usize {
        self.anchor.max(self.head)
    }
    pub fn is_empty(&self) -> bool {
        self.anchor == self.head
    }
}

/// All selections plus which one is the primary (the one TextEdit shows).
#[derive(Debug, PartialEq, Clone)]
pub struct Multi {
    pub sels: Vec<Sel>,
    pub primary: usize,
}

impl Multi {
    pub fn new(primary: Sel, extra: &[Sel]) -> Self {
        let mut sels = vec![primary];
        sels.extend_from_slice(extra);
        let mut m = Multi { sels, primary: 0 };
        m.normalize();
        m
    }

    /// Split back into (primary, extras).
    pub fn split(&self) -> (Sel, Vec<Sel>) {
        let p = self.sels[self.primary];
        let ex = self
            .sels
            .iter()
            .enumerate()
            .filter(|(i, _)| *i != self.primary)
            .map(|(_, s)| *s)
            .collect();
        (p, ex)
    }

    /// Sort by position and merge touching/overlapping selections (primary survives a merge).
    pub fn normalize(&mut self) {
        let mut v: Vec<(Sel, bool)> = self
            .sels
            .iter()
            .enumerate()
            .map(|(i, s)| (*s, i == self.primary))
            .collect();
        v.sort_by_key(|(s, _)| (s.lo(), s.hi()));
        let mut out: Vec<(Sel, bool)> = vec![];
        for (s, p) in v {
            if let Some((last, lp)) = out.last_mut() {
                let overlap = s.lo() < last.hi()
                    || (s.lo() == last.hi() && (s.is_empty() || last.is_empty()));
                if overlap {
                    let (lo, hi) = (last.lo().min(s.lo()), last.hi().max(s.hi()));
                    let keep_dir = if p { s } else { *last };
                    *last = if keep_dir.anchor <= keep_dir.head {
                        Sel {
                            anchor: lo,
                            head: hi,
                        }
                    } else {
                        Sel {
                            anchor: hi,
                            head: lo,
                        }
                    };
                    *lp |= p;
                    continue;
                }
            }
            out.push((s, p));
        }
        self.primary = out.iter().position(|(_, p)| *p).unwrap_or(0);
        self.sels = out.into_iter().map(|(s, _)| s).collect();
    }
}

/// Replace every selection `i` by `f(i, sel) -> (lo, hi, insert)` (a range that may extend the selection, e.g.
/// backspace) and leave a caret after each insertion. Ranges are clamped so they never overlap the previous one.
pub fn edit_each(
    text: &str,
    m: &Multi,
    mut f: impl FnMut(usize, &Sel) -> (usize, usize, String),
) -> (String, Multi) {
    let mut out = String::with_capacity(text.len() + 16);
    let mut carets = Vec::with_capacity(m.sels.len());
    let mut done = 0usize; // chars of `text` already copied
    let mut out_chars = 0usize;
    let nchars = text.chars().count();
    for (i, s) in m.sels.iter().enumerate() {
        let (lo, hi, ins) = f(i, s);
        let lo = lo.max(done).min(nchars);
        let hi = hi.max(lo).min(nchars);
        let chunk = &text[byte(text, done)..byte(text, lo)];
        out.push_str(chunk);
        out_chars += lo - done;
        out.push_str(&ins);
        out_chars += ins.chars().count();
        carets.push(Sel::caret(out_chars));
        done = hi;
    }
    out.push_str(&text[byte(text, done)..]);
    (
        out,
        Multi {
            sels: carets,
            primary: m.primary,
        },
    )
}

pub fn insert(text: &str, m: &Multi, s: &str) -> (String, Multi) {
    edit_each(text, m, |_, sel| (sel.lo(), sel.hi(), s.to_string()))
}

pub fn backspace(text: &str, m: &Multi) -> (String, Multi) {
    edit_each(text, m, |_, sel| {
        if sel.is_empty() {
            (sel.lo().saturating_sub(1), sel.lo(), String::new())
        } else {
            (sel.lo(), sel.hi(), String::new())
        }
    })
}

pub fn delete(text: &str, m: &Multi) -> (String, Multi) {
    edit_each(text, m, |_, sel| {
        if sel.is_empty() {
            (sel.lo(), sel.lo() + 1, String::new())
        } else {
            (sel.lo(), sel.hi(), String::new())
        }
    })
}

/// Enter at every cursor: newline + the indentation of that cursor's line (+1 level after an opening bracket).
pub fn newline(text: &str, m: &Multi, tab: usize) -> (String, Multi) {
    edit_each(text, m, |_, sel| {
        let i = byte(text, sel.lo());
        let ls = text[..i].rfind('\n').map_or(0, |p| p + 1);
        let before = &text[ls..i];
        let indent: String = before
            .chars()
            .take_while(|c| *c == ' ' || *c == '\t')
            .collect();
        let opener = before
            .trim_end()
            .chars()
            .last()
            .is_some_and(|c| "{([".contains(c));
        let extra = if opener {
            " ".repeat(tab)
        } else {
            String::new()
        };
        (sel.lo(), sel.hi(), format!("\n{indent}{extra}"))
    })
}

/// Tab at every cursor: insert spaces up to the next tab stop.
pub fn tab(text: &str, m: &Multi, tab: usize) -> (String, Multi) {
    let ranges = line_ranges(text);
    edit_each(text, m, |_, sel| {
        let l = super::edit::line_of(text, sel.lo());
        let col = sel.lo() - ranges[l].0;
        (sel.lo(), sel.hi(), " ".repeat(tab - col % tab))
    })
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Dir {
    Left,
    Right,
    Up,
    Down,
    Home,
    End,
}

/// Move every selection; `extend` keeps the anchor (Shift). Vertical moves keep the column.
pub fn move_all(text: &str, m: &mut Multi, dir: Dir, extend: bool) {
    let ranges = line_ranges(text);
    let n = text.chars().count();
    let line_of = |p: usize| ranges.iter().rposition(|r| r.0 <= p).unwrap_or(0);
    for s in &mut m.sels {
        let head = s.head;
        let l = line_of(head);
        let col = head - ranges[l].0;
        let nh = match dir {
            Dir::Left if !extend && !s.is_empty() => s.lo(),
            Dir::Right if !extend && !s.is_empty() => s.hi(),
            Dir::Left => head.saturating_sub(1),
            Dir::Right => (head + 1).min(n),
            Dir::Up if l == 0 => 0,
            Dir::Up => ranges[l - 1].0 + col.min(ranges[l - 1].1 - ranges[l - 1].0),
            Dir::Down if l + 1 >= ranges.len() => ranges[l].1,
            Dir::Down => ranges[l + 1].0 + col.min(ranges[l + 1].1 - ranges[l + 1].0),
            Dir::Home => {
                // smart home: first non-blank, then column 0
                let line: String = text
                    .chars()
                    .skip(ranges[l].0)
                    .take(ranges[l].1 - ranges[l].0)
                    .collect();
                let ind = line.chars().take_while(|c| *c == ' ' || *c == '\t').count();
                if col == ind {
                    ranges[l].0
                } else {
                    ranges[l].0 + ind
                }
            }
            Dir::End => ranges[l].1,
        };
        s.head = nh;
        if !extend {
            s.anchor = nh;
        }
    }
    m.normalize();
}

/// Ctrl/Cmd+D: select the word under the primary cursor, or add the next occurrence of the selected text.
/// Returns false when nothing was found.
pub fn add_next_occurrence(text: &str, m: &mut Multi) -> bool {
    let chars: Vec<char> = text.chars().collect();
    let p = m.sels[m.primary];
    if p.is_empty() {
        let word = |c: char| c.is_alphanumeric() || c == '_' || c == '$';
        let (mut a, mut b) = (p.head, p.head);
        while a > 0 && word(chars[a - 1]) {
            a -= 1;
        }
        while b < chars.len() && word(chars[b]) {
            b += 1;
        }
        if a == b {
            return false;
        }
        m.sels[m.primary] = Sel { anchor: a, head: b };
        return true;
    }
    let needle: Vec<char> = chars[p.lo()..p.hi()].to_vec();
    let last_hi = m.sels.iter().map(|s| s.hi()).max().unwrap_or(0);
    let find = |from: usize, to: usize| {
        (from..to.saturating_sub(needle.len() - 1))
            .find(|&i| chars[i..i + needle.len()] == needle[..])
    };
    let hit = find(last_hi, chars.len()).or_else(|| find(0, chars.len()));
    let Some(i) = hit else { return false };
    if m.sels
        .iter()
        .any(|s| s.lo() == i && s.hi() == i + needle.len())
    {
        return false;
    }
    m.sels.push(Sel {
        anchor: i,
        head: i + needle.len(),
    });
    m.primary = m.sels.len() - 1; // newest becomes primary so the view follows it
    m.normalize();
    true
}

/// Ctrl+Alt+Up/Down: add a caret one line above/below every selection's head (same column, clamped).
pub fn add_vertical(text: &str, m: &mut Multi, up: bool) {
    let ranges = line_ranges(text);
    let line_of = |p: usize| ranges.iter().rposition(|r| r.0 <= p).unwrap_or(0);
    let mut add = vec![];
    for s in &m.sels {
        let l = line_of(s.head);
        let col = s.head - ranges[l].0;
        let tl = if up {
            l.checked_sub(1)
        } else {
            (l + 1 < ranges.len()).then_some(l + 1)
        };
        if let Some(t) = tl {
            add.push(Sel::caret(ranges[t].0 + col.min(ranges[t].1 - ranges[t].0)));
        }
    }
    if !add.is_empty() {
        let keep = m.sels[m.primary];
        m.sels.extend(add);
        m.normalize();
        // primary = the originally primary selection unless it was merged
        m.primary = m
            .sels
            .iter()
            .position(|s| s.lo() <= keep.lo() && s.hi() >= keep.hi())
            .unwrap_or(0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn carets(ps: &[usize]) -> Multi {
        Multi::new(
            Sel::caret(ps[0]),
            &ps[1..].iter().map(|p| Sel::caret(*p)).collect::<Vec<_>>(),
        )
    }

    #[test]
    fn type_at_all_cursors() {
        let (t, m) = insert("a\nb\nc", &carets(&[1, 3, 5]), "X");
        assert_eq!(t, "aX\nbX\ncX");
        assert_eq!(
            m.sels.iter().map(|s| s.head).collect::<Vec<_>>(),
            vec![2, 5, 8]
        );
    }

    #[test]
    fn replace_selections() {
        let m = Multi::new(Sel { anchor: 0, head: 1 }, &[Sel { anchor: 2, head: 3 }]);
        assert_eq!(insert("a-b-", &m, "ZZ").0, "ZZ-ZZ-");
    }

    #[test]
    fn backspace_and_delete() {
        assert_eq!(backspace("abc\ndef", &carets(&[2, 6])).0, "ac\ndf");
        assert_eq!(delete("abc\ndef", &carets(&[0, 4])).0, "bc\nef");
        // adjacent carets must not delete the same char twice
        assert_eq!(backspace("abcd", &carets(&[2, 3])).0, "ad");
    }

    #[test]
    fn newline_indents_each() {
        let (t, _) = newline("  a\n    b", &carets(&[3, 9]), 2);
        assert_eq!(t, "  a\n  \n    b\n    ");
    }

    #[test]
    fn vertical_add_and_move() {
        let mut m = carets(&[2]);
        add_vertical("abc\nde\nfghi", &mut m, false);
        assert_eq!(
            m.sels.iter().map(|s| s.head).collect::<Vec<_>>(),
            vec![2, 6]
        );
        move_all("abc\nde\nfghi", &mut m, Dir::Down, false);
        assert_eq!(
            m.sels.iter().map(|s| s.head).collect::<Vec<_>>(),
            vec![6, 9]
        );
        move_all("abc\nde\nfghi", &mut m, Dir::End, false);
        assert_eq!(
            m.sels.iter().map(|s| s.head).collect::<Vec<_>>(),
            vec![6, 11]
        );
    }

    #[test]
    fn next_occurrence() {
        let t = "foo bar foo baz foo";
        let mut m = carets(&[1]);
        assert!(add_next_occurrence(t, &mut m)); // selects word
        assert_eq!(m.sels, vec![Sel { anchor: 0, head: 3 }]);
        assert!(add_next_occurrence(t, &mut m));
        assert!(add_next_occurrence(t, &mut m));
        assert_eq!(m.sels.len(), 3);
        assert!(
            !add_next_occurrence(t, &mut m),
            "wrapped to an already selected one"
        );
        let (t2, _) = insert(t, &m, "x");
        assert_eq!(t2, "x bar x baz x");
    }

    #[test]
    fn merge_overlap() {
        let m = Multi::new(
            Sel { anchor: 0, head: 4 },
            &[Sel { anchor: 2, head: 6 }, Sel::caret(9)],
        );
        assert_eq!(m.sels.len(), 2);
        assert_eq!(m.sels[0], Sel { anchor: 0, head: 6 });
    }

    #[test]
    fn unicode() {
        let (t, _) = insert("é\nü", &carets(&[1, 3]), "!");
        assert_eq!(t, "é!\nü!");
    }
}
