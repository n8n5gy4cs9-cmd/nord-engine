//! Small hand-written tokenizer-based highlighter (JS/TS/Rust/HTML/CSS/JSON/MD/GLSL/WGSL/TOML) colored from the shared
//! themes.json `code` palette (syntect was dropped: no TOML/TS/GLSL/WGSL grammars out of the box, and we want one
//! palette for web + native; see docs/DECISIONS.md ADR-021).
use crate::theme::{hex, CodeColors};
use egui::{text::LayoutJob, Color32, FontId, TextFormat};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Hash)]
pub enum Lang {
    Js,
    Ts,
    Rust,
    Html,
    Css,
    Json,
    Md,
    Glsl,
    Wgsl,
    Toml,
    Plain,
}

impl Lang {
    pub fn from_path(p: &str) -> Lang {
        match p
            .rsplit('.')
            .next()
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str()
        {
            "js" | "mjs" | "cjs" | "jsx" => Lang::Js,
            "ts" | "tsx" => Lang::Ts,
            "rs" => Lang::Rust,
            "html" | "htm" => Lang::Html,
            "css" => Lang::Css,
            "json" | "tmj" => Lang::Json,
            "md" | "markdown" => Lang::Md,
            "glsl" | "vert" | "frag" | "fs" | "vs" => Lang::Glsl,
            "wgsl" => Lang::Wgsl,
            "toml" => Lang::Toml,
            _ => Lang::Plain,
        }
    }

    pub fn line_comment(self) -> Option<&'static str> {
        match self {
            Lang::Js | Lang::Ts | Lang::Rust | Lang::Glsl | Lang::Wgsl => Some("//"),
            Lang::Toml => Some("#"),
            _ => None,
        }
    }

    fn keywords(self) -> &'static [&'static str] {
        match self {
            Lang::Js | Lang::Ts => &[
                "async",
                "await",
                "break",
                "case",
                "catch",
                "class",
                "const",
                "continue",
                "default",
                "delete",
                "do",
                "else",
                "export",
                "extends",
                "finally",
                "for",
                "from",
                "function",
                "if",
                "import",
                "in",
                "instanceof",
                "let",
                "new",
                "of",
                "return",
                "static",
                "super",
                "switch",
                "this",
                "throw",
                "try",
                "typeof",
                "var",
                "void",
                "while",
                "yield",
                "true",
                "false",
                "null",
                "undefined",
                "interface",
                "type",
                "enum",
                "implements",
                "public",
                "private",
                "readonly",
                "as",
            ],
            Lang::Rust => &[
                "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
                "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match",
                "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
                "super", "trait", "true", "type", "unsafe", "use", "where", "while",
            ],
            Lang::Glsl => &[
                "attribute",
                "break",
                "const",
                "continue",
                "discard",
                "do",
                "else",
                "for",
                "if",
                "in",
                "inout",
                "out",
                "precision",
                "return",
                "struct",
                "uniform",
                "varying",
                "void",
                "while",
                "highp",
                "mediump",
                "lowp",
                "layout",
                "true",
                "false",
                "float",
                "int",
                "bool",
                "vec2",
                "vec3",
                "vec4",
                "mat3",
                "mat4",
                "sampler2D",
                "uint",
            ],
            Lang::Wgsl => &[
                "fn",
                "let",
                "var",
                "const",
                "struct",
                "return",
                "if",
                "else",
                "for",
                "while",
                "loop",
                "break",
                "continue",
                "switch",
                "case",
                "default",
                "true",
                "false",
                "override",
                "alias",
                "f32",
                "i32",
                "u32",
                "bool",
                "vec2",
                "vec3",
                "vec4",
                "mat3x3",
                "mat4x4",
                "texture_2d",
                "sampler",
                "array",
            ],
            Lang::Json | Lang::Toml => &["true", "false", "null"],
            Lang::Css => &["important", "inherit", "initial", "none", "auto", "solid"],
            _ => &[],
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tok {
    Plain,
    Keyword,
    Str,
    Num,
    Comment,
    Func,
    Type,
    Op,
    Punct,
}

/// Split `src` into (token, byte range) covering all of it. Pure; unit-tested.
pub fn tokenize(src: &str, lang: Lang) -> Vec<(Tok, std::ops::Range<usize>)> {
    let mut out: Vec<(Tok, std::ops::Range<usize>)> = vec![];
    let b: Vec<(usize, char)> = src.char_indices().collect();
    let n = b.len();
    let at = |i: usize| b.get(i).map(|x| x.1);
    let byte = |i: usize| b.get(i).map_or(src.len(), |x| x.0);
    let push = |t: Tok, s: usize, e: usize, out: &mut Vec<(Tok, std::ops::Range<usize>)>| {
        if e > s {
            out.push((t, byte(s)..byte(e)));
        }
    };
    let lc = lang.line_comment();
    let kws = lang.keywords();
    let mut i = 0;
    let mut line_start = true;
    while i < n {
        let c = b[i].1;
        // markdown: line-level rules
        if lang == Lang::Md && line_start {
            let mut j = i;
            while j < n && b[j].1 != '\n' {
                j += 1;
            }
            let line = &src[byte(i)..byte(j)];
            let t = line.trim_start();
            if t.starts_with('#') {
                push(Tok::Keyword, i, j, &mut out);
                i = j;
                continue;
            }
            if t.starts_with("```") {
                push(Tok::Comment, i, j, &mut out);
                i = j;
                continue;
            }
            if t.starts_with("- ") || t.starts_with("* ") || t.starts_with("> ") {
                let off = line.len() - t.len() + 1;
                let k = i + line[..off].chars().count();
                push(Tok::Op, i, k, &mut out);
                i = k;
            }
            line_start = false;
            if i >= j {
                continue;
            }
        }
        line_start = c == '\n';
        if lang == Lang::Md {
            if c == '`' {
                let mut j = i + 1;
                while j < n && b[j].1 != '`' && b[j].1 != '\n' {
                    j += 1;
                }
                let e = (j + 1).min(n);
                push(Tok::Str, i, e, &mut out);
                i = e;
                continue;
            }
            push(Tok::Plain, i, i + 1, &mut out);
            i += 1;
            continue;
        }
        // comments
        let starts = |s: &str, i: usize| src[byte(i)..].starts_with(s);
        if let Some(p) = lc {
            if starts(p, i) {
                let mut j = i;
                while j < n && b[j].1 != '\n' {
                    j += 1;
                }
                push(Tok::Comment, i, j, &mut out);
                i = j;
                continue;
            }
        }
        if matches!(
            lang,
            Lang::Js | Lang::Ts | Lang::Rust | Lang::Css | Lang::Glsl | Lang::Wgsl
        ) && starts("/*", i)
        {
            let mut j = i + 2;
            while j < n && !starts("*/", j) {
                j += 1;
            }
            let e = (j + 2).min(n);
            push(Tok::Comment, i, e, &mut out);
            i = e;
            continue;
        }
        if lang == Lang::Html && starts("<!--", i) {
            let mut j = i + 4;
            while j < n && !starts("-->", j) {
                j += 1;
            }
            let e = (j + 3).min(n);
            push(Tok::Comment, i, e, &mut out);
            i = e;
            continue;
        }
        if lang == Lang::Html && c == '<' {
            let mut j = i + 1;
            while j < n && b[j].1 != '>' && b[j].1 != '"' && b[j].1 != '\'' && b[j].1 != '\n' {
                j += 1;
            }
            push(Tok::Keyword, i, j, &mut out);
            i = j;
            if at(i) == Some('>') {
                push(Tok::Keyword, i, i + 1, &mut out);
                i += 1;
            }
            continue;
        }
        // strings
        if c == '"' || c == '\'' || (c == '`' && matches!(lang, Lang::Js | Lang::Ts)) {
            // rust lifetimes / chars: 'a without closing quote on same token
            if lang == Lang::Rust && c == '\'' {
                let close = (i + 2 < n && b[i + 2].1 == '\'')
                    || (i + 3 < n && b[i + 1].1 == '\\' && b[i + 3].1 == '\'');
                if !close {
                    push(Tok::Type, i, i + 1, &mut out);
                    i += 1;
                    continue;
                }
            }
            let mut j = i + 1;
            while j < n && b[j].1 != c && (b[j].1 != '\n' || c == '`') {
                if b[j].1 == '\\' {
                    j += 1;
                }
                j += 1;
            }
            let e = (j + 1).min(n);
            push(Tok::Str, i, e, &mut out);
            i = e;
            continue;
        }
        if c.is_ascii_digit()
            || (c == '#'
                && matches!(lang, Lang::Css)
                && at(i + 1).is_some_and(|x| x.is_ascii_hexdigit()))
        {
            let mut j = i + 1;
            while j < n && (b[j].1.is_ascii_alphanumeric() || b[j].1 == '.' || b[j].1 == '_') {
                j += 1;
            }
            push(Tok::Num, i, j, &mut out);
            i = j;
            continue;
        }
        if c.is_alphabetic() || c == '_' || c == '$' || (c == '@' && lang == Lang::Css) {
            let mut j = i + 1;
            while j < n
                && (b[j].1.is_alphanumeric()
                    || b[j].1 == '_'
                    || b[j].1 == '$'
                    || (b[j].1 == '-' && lang == Lang::Css))
            {
                j += 1;
            }
            let w = &src[byte(i)..byte(j)];
            let t = if kws.contains(&w) || (c == '@' && lang == Lang::Css) {
                Tok::Keyword
            } else if at(j) == Some('(') || (lang == Lang::Rust && at(j) == Some('!')) {
                Tok::Func
            } else if w.chars().next().is_some_and(|f| f.is_uppercase()) && lang != Lang::Json {
                Tok::Type
            } else {
                Tok::Plain
            };
            push(t, i, j, &mut out);
            i = j;
            continue;
        }
        let t = if "+-*/%=<>!&|^~?:".contains(c) {
            Tok::Op
        } else if "(){}[];,.".contains(c) {
            Tok::Punct
        } else {
            Tok::Plain
        };
        push(t, i, i + 1, &mut out);
        i += 1;
    }
    // JSON keys: strings followed by ':' use the function color
    if matches!(lang, Lang::Json) {
        for k in 0..out.len() {
            if out[k].0 == Tok::Str {
                let rest = src[out[k].1.end..].trim_start();
                if rest.starts_with(':') {
                    out[k].0 = Tok::Func;
                }
            }
        }
    }
    out
}

pub struct Palette {
    pub fg: Color32,
    pub kw: Color32,
    pub st: Color32,
    pub num: Color32,
    pub com: Color32,
    pub func: Color32,
    pub ty: Color32,
    pub op: Color32,
    pub punct: Color32,
}

impl Palette {
    pub fn new(c: &CodeColors) -> Self {
        Self {
            fg: hex(&c.variable),
            kw: hex(&c.keyword),
            st: hex(&c.string),
            num: hex(&c.number),
            com: hex(&c.comment),
            func: hex(&c.function),
            ty: hex(&c.ty),
            op: hex(&c.operator),
            punct: hex(&c.punctuation),
        }
    }
    fn color(&self, t: Tok) -> Color32 {
        match t {
            Tok::Plain => self.fg,
            Tok::Keyword => self.kw,
            Tok::Str => self.st,
            Tok::Num => self.num,
            Tok::Comment => self.com,
            Tok::Func => self.func,
            Tok::Type => self.ty,
            Tok::Op => self.op,
            Tok::Punct => self.punct,
        }
    }
}

pub fn layout_job(src: &str, lang: Lang, pal: &Palette, font: FontId) -> LayoutJob {
    let mut job = LayoutJob::default();
    job.wrap.max_width = f32::INFINITY;
    for (t, r) in tokenize(src, lang) {
        job.append(&src[r], 0.0, TextFormat::simple(font.clone(), pal.color(t)));
    }
    job
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(s: &str, l: Lang) -> Vec<(Tok, &str)> {
        tokenize(s, l)
            .into_iter()
            .map(|(t, r)| (t, &s[r]))
            .collect()
    }

    #[test]
    fn covers_all_input_and_classifies_js() {
        let s = "const x = 'a'; // hi\nfoo(1.5) /* c */";
        let t = tokenize(s, Lang::Js);
        let joined: String = t.iter().map(|(_, r)| &s[r.clone()]).collect();
        assert_eq!(joined, s);
        let k = kinds(s, Lang::Js);
        assert!(k.contains(&(Tok::Keyword, "const")));
        assert!(k.contains(&(Tok::Str, "'a'")));
        assert!(k.contains(&(Tok::Comment, "// hi")));
        assert!(k.contains(&(Tok::Func, "foo")));
        assert!(k.contains(&(Tok::Num, "1.5")));
        assert!(k.contains(&(Tok::Comment, "/* c */")));
    }

    #[test]
    fn every_language_roundtrips_unicode() {
        let s = "héllo = \"wörld\" // ü\n# x\n<a href='y'>t</a>\nfn main() { let a = 'c'; 'l: loop {} }";
        for l in [
            Lang::Js,
            Lang::Ts,
            Lang::Rust,
            Lang::Html,
            Lang::Css,
            Lang::Json,
            Lang::Md,
            Lang::Glsl,
            Lang::Wgsl,
            Lang::Toml,
            Lang::Plain,
        ] {
            let joined: String = tokenize(s, l).iter().map(|(_, r)| &s[r.clone()]).collect();
            assert_eq!(joined, s, "{l:?}");
        }
    }

    #[test]
    fn json_keys_and_toml_comments() {
        let k = kinds("{\"a\": 1}", Lang::Json);
        assert!(k.contains(&(Tok::Func, "\"a\"")));
        assert!(kinds("# c\nx = 1", Lang::Toml).contains(&(Tok::Comment, "# c")));
        assert!(kinds("# T", Lang::Md).contains(&(Tok::Keyword, "# T")));
    }
}
