//! Pure text-editing helpers for the code editor (char-index based, as egui cursors are). Unit-tested.

#[derive(Debug, PartialEq, Clone)]
pub struct Edit {
    pub text: String,
    /// (anchor, head) char indices
    pub sel: (usize, usize),
}

pub fn byte(s: &str, ci: usize) -> usize {
    s.char_indices().nth(ci).map_or(s.len(), |x| x.0)
}

fn nchars(s: &str) -> usize {
    s.chars().count()
}

/// Char ranges (start, end-exclusive-without-newline) of every line.
pub fn line_ranges(s: &str) -> Vec<(usize, usize)> {
    let mut v = vec![];
    let mut start = 0;
    let mut i = 0;
    for c in s.chars() {
        if c == '\n' {
            v.push((start, i));
            start = i + 1;
        }
        i += 1;
    }
    v.push((start, i));
    v
}

pub fn line_of(s: &str, ci: usize) -> usize {
    s.chars().take(ci).filter(|&c| c == '\n').count()
}

fn leading_ws(line: &str) -> &str {
    let n = line.len() - line.trim_start_matches([' ', '\t']).len();
    &line[..n]
}

pub fn lines_covering(s: &str, a: usize, b: usize) -> (usize, usize) {
    let (lo, hi) = (a.min(b), a.max(b));
    let l0 = line_of(s, lo);
    let mut l1 = line_of(s, hi);
    // a selection ending at the very start of a line does not include that line
    if hi > lo && l1 > l0 && line_ranges(s).get(l1).is_some_and(|r| r.0 == hi) {
        l1 -= 1;
    }
    (l0, l1)
}

/// Enter pressed at `cursor`: keep indentation, add a level after an opening bracket, split `{|}` onto three lines.
pub fn newline(s: &str, cursor: usize, tab: usize) -> Edit {
    let i = byte(s, cursor);
    let line_start = s[..i].rfind('\n').map_or(0, |p| p + 1);
    let before = &s[line_start..i];
    let indent = leading_ws(before).to_string();
    let unit = " ".repeat(tab);
    let opener = before
        .trim_end()
        .chars()
        .last()
        .is_some_and(|c| "{([".contains(c));
    let closer_next = s[i..].chars().next().is_some_and(|c| "})]".contains(c));
    let mut ins = format!("\n{indent}");
    let mut pos = cursor + 1 + nchars(&indent);
    if opener {
        ins.push_str(&unit);
        pos += tab;
        if closer_next {
            ins.push_str(&format!("\n{indent}"));
        }
    }
    let mut t = String::with_capacity(s.len() + ins.len());
    t.push_str(&s[..i]);
    t.push_str(&ins);
    t.push_str(&s[i..]);
    Edit {
        text: t,
        sel: (pos, pos),
    }
}

/// Indent (or dedent) all lines covered by the selection.
#[allow(clippy::needless_range_loop)]
pub fn indent_lines(s: &str, a: usize, b: usize, tab: usize, dedent: bool) -> Edit {
    let (l0, l1) = lines_covering(s, a, b);
    let unit = " ".repeat(tab);
    let mut lines: Vec<String> = s.split('\n').map(String::from).collect();
    let (mut da, mut db) = (0isize, 0isize);
    let (ra, rb) = (line_of(s, a), line_of(s, b));
    for l in l0..=l1.min(lines.len() - 1) {
        let delta: isize = if dedent {
            let ws = leading_ws(&lines[l]).to_string();
            let remove = if ws.starts_with('\t') {
                1
            } else {
                ws.chars().take(tab).take_while(|&c| c == ' ').count()
            };
            lines[l] = lines[l][remove..].to_string();
            -(remove as isize)
        } else {
            lines[l] = format!("{unit}{}", lines[l]);
            tab as isize
        };
        if l == ra {
            da = delta;
        }
        if l == rb {
            db = delta;
        }
    }
    let na = (a as isize + da).max(0) as usize;
    let nb = (b as isize + db).max(0) as usize;
    Edit {
        text: lines.join("\n"),
        sel: (na, nb),
    }
}

#[allow(clippy::needless_range_loop)]
pub fn toggle_comment(s: &str, a: usize, b: usize, prefix: &str) -> Edit {
    let (l0, l1) = lines_covering(s, a, b);
    let mut lines: Vec<String> = s.split('\n').map(String::from).collect();
    let all = (l0..=l1)
        .filter(|&l| !lines[l].trim().is_empty())
        .all(|l| lines[l].trim_start().starts_with(prefix));
    let mut delta_first = 0isize;
    let mut delta_total = 0isize;
    for l in l0..=l1 {
        if lines[l].trim().is_empty() {
            continue;
        }
        let ws = leading_ws(&lines[l]).len();
        let d: isize = if all {
            let rest = &lines[l][ws + prefix.len()..];
            let sp = usize::from(rest.starts_with(' '));
            lines[l] = format!("{}{}", &lines[l][..ws], &rest[sp..]);
            -((prefix.len() + sp) as isize)
        } else {
            lines[l] = format!("{}{prefix} {}", &lines[l][..ws], &lines[l][ws..]);
            (prefix.len() + 1) as isize
        };
        if l == l0 {
            delta_first = d;
        }
        delta_total += d;
    }
    let (lo, hi) = (a.min(b), a.max(b));
    let nlo = (lo as isize + delta_first).max(0) as usize;
    let nhi = (hi as isize + delta_total).max(nlo as isize) as usize;
    let sel = if a <= b { (nlo, nhi) } else { (nhi, nlo) };
    Edit {
        text: lines.join("\n"),
        sel,
    }
}

fn closing(c: char) -> Option<char> {
    Some(match c {
        '(' => ')',
        '[' => ']',
        '{' => '}',
        '"' => '"',
        '\'' => '\'',
        '`' => '`',
        _ => return None,
    })
}

/// Result of typing `ch` at `cursor` (no selection): auto-close pairs / skip over an existing closer.
pub fn typed(s: &str, cursor: usize, ch: char) -> Option<Edit> {
    let i = byte(s, cursor);
    let next = s[i..].chars().next();
    if ")]}\"'`".contains(ch) && next == Some(ch) {
        return Some(Edit {
            text: s.to_string(),
            sel: (cursor + 1, cursor + 1),
        });
    }
    let close = closing(ch)?;
    let prev = s[..i].chars().last();
    if matches!(ch, '"' | '\'' | '`') && prev.is_some_and(|p| p.is_alphanumeric() || p == '\\') {
        return None;
    }
    if next.is_some_and(|n| !n.is_whitespace() && !")]},;".contains(n)) {
        return None;
    }
    let mut t = String::with_capacity(s.len() + 2);
    t.push_str(&s[..i]);
    t.push(ch);
    t.push(close);
    t.push_str(&s[i..]);
    Some(Edit {
        text: t,
        sel: (cursor + 1, cursor + 1),
    })
}

/// Backspace between an empty pair `(|)` removes both.
pub fn backspace_pair(s: &str, cursor: usize) -> Option<Edit> {
    if cursor == 0 {
        return None;
    }
    let i = byte(s, cursor);
    let prev = s[..i].chars().last()?;
    let next = s[i..].chars().next()?;
    (closing(prev) == Some(next)).then(|| {
        let mut t = s[..i - prev.len_utf8()].to_string();
        t.push_str(&s[i + next.len_utf8()..]);
        Edit {
            text: t,
            sel: (cursor - 1, cursor - 1),
        }
    })
}

/// Char indices of the bracket at/next to the cursor and its partner.
pub fn matching_bracket(s: &str, cursor: usize) -> Option<(usize, usize)> {
    let chars: Vec<char> = s.chars().collect();
    let pick = |i: usize| chars.get(i).copied().filter(|c| "()[]{}".contains(*c));
    let at = if cursor < chars.len() && pick(cursor).is_some() {
        cursor
    } else if cursor > 0 && pick(cursor - 1).is_some() {
        cursor - 1
    } else {
        return None;
    };
    let c = chars[at];
    let (open, close, fwd) = match c {
        '(' => ('(', ')', true),
        '[' => ('[', ']', true),
        '{' => ('{', '}', true),
        ')' => ('(', ')', false),
        ']' => ('[', ']', false),
        _ => ('{', '}', false),
    };
    let mut depth = 0i32;
    if fwd {
        for (j, &x) in chars.iter().enumerate().skip(at) {
            if x == open {
                depth += 1;
            } else if x == close {
                depth -= 1;
                if depth == 0 {
                    return Some((at, j));
                }
            }
        }
    } else {
        for j in (0..=at).rev() {
            let x = chars[j];
            if x == close {
                depth += 1;
            } else if x == open {
                depth -= 1;
                if depth == 0 {
                    return Some((j, at));
                }
            }
        }
    }
    None
}

/// Identifier prefix before the cursor: (start char index, prefix).
pub fn word_before(s: &str, cursor: usize) -> (usize, String) {
    let chars: Vec<char> = s.chars().collect();
    let mut st = cursor.min(chars.len());
    while st > 0
        && (chars[st - 1].is_alphanumeric()
            || chars[st - 1] == '_'
            || chars[st - 1] == '$'
            || chars[st - 1] == '.')
    {
        st -= 1;
    }
    (st, chars[st..cursor.min(chars.len())].iter().collect())
}

/// Re-indent brace-structured code by bracket depth (JS/TS/Rust/CSS/GLSL/WGSL/JSON "format"). Ignores brackets in
/// strings and `//` comments; blank lines stay empty, trailing whitespace is trimmed.
pub fn reindent(s: &str, tab: usize) -> String {
    let mut depth: i32 = 0;
    let mut out = vec![];
    let mut in_block = false;
    for line in s.split('\n') {
        let t = line.trim();
        if t.is_empty() {
            out.push(String::new());
            continue;
        }
        let lead_close = t.chars().take_while(|c| "})]".contains(*c)).count() as i32;
        let d = (depth - if in_block { 0 } else { lead_close }).max(0);
        let pad = if in_block && !t.starts_with("*/") {
            " "
        } else {
            ""
        };
        out.push(format!("{}{pad}{t}", " ".repeat(d as usize * tab)));
        let (mut q, mut esc) = (None::<char>, false);
        let cs: Vec<char> = t.chars().collect();
        let mut i = 0;
        while i < cs.len() {
            let c = cs[i];
            if in_block {
                if c == '*' && cs.get(i + 1) == Some(&'/') {
                    in_block = false;
                    i += 1;
                }
            } else if let Some(qq) = q {
                if esc {
                    esc = false;
                } else if c == '\\' {
                    esc = true;
                } else if c == qq {
                    q = None;
                }
            } else if c == '/' && cs.get(i + 1) == Some(&'/') {
                break;
            } else if c == '/' && cs.get(i + 1) == Some(&'*') {
                in_block = true;
                i += 1;
            } else if matches!(c, '"' | '\'' | '`') {
                q = Some(c);
            } else if "{([".contains(c) {
                depth += 1;
            } else if "})]".contains(c) {
                depth = (depth - 1).max(0);
            }
            i += 1;
        }
    }
    out.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn newline_keeps_and_adds_indent() {
        let e = newline("  if (x) {", 10, 2);
        assert_eq!(e.text, "  if (x) {\n    ");
        assert_eq!(e.sel.0, 15);
        let e = newline("{}", 1, 2);
        assert_eq!(e.text, "{\n  \n}");
        assert_eq!(e.sel.0, 4);
    }

    #[test]
    fn indent_dedent() {
        let e = indent_lines("a\nb\nc", 0, 3, 2, false);
        assert_eq!(e.text, "  a\n  b\nc");
        let d = indent_lines(&e.text, 0, 7, 2, true);
        assert_eq!(d.text, "a\nb\nc");
    }

    #[test]
    fn comment_toggle_roundtrip() {
        let on = toggle_comment("a\n  b", 0, 5, "//");
        assert_eq!(on.text, "// a\n  // b");
        let off = toggle_comment(&on.text, on.sel.0, on.sel.1, "//");
        assert_eq!(off.text, "a\n  b");
    }

    #[test]
    fn pairs() {
        assert_eq!(typed("f", 1, '(').unwrap().text, "f()");
        assert_eq!(typed("f()", 2, ')').unwrap().sel, (3, 3));
        assert!(typed("don", 3, '\'').is_none(), "apostrophe after word");
        assert!(typed("x", 0, '(').is_none(), "no autoclose before text");
        assert_eq!(backspace_pair("f()", 2).unwrap().text, "f");
    }

    #[test]
    fn brackets() {
        let s = "a(b[c]{d})";
        assert_eq!(matching_bracket(s, 1), Some((1, 9)));
        assert_eq!(matching_bracket(s, 10), Some((1, 9)));
        assert_eq!(matching_bracket(s, 0), None);
    }

    #[test]
    fn format_braces() {
        let src = "function f() {\nif (a) {\nx('}');\n}\n}\n";
        assert_eq!(
            reindent(src, 2),
            "function f() {\n  if (a) {\n    x('}');\n  }\n}\n"
        );
    }

    #[test]
    fn unicode_safe() {
        let e = newline("é\n  ü{", 6, 2);
        assert!(e.text.contains("ü{\n"));
        assert_eq!(word_before("héllo.wor", 9).1, "héllo.wor");
    }
}
