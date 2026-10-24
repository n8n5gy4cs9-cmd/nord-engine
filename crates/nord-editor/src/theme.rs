//! Skins + themes from the shared `assets/themes/themes.json` (same file the web runtime UI uses), applied to egui.
use egui::{Color32, FontData, FontDefinitions, FontFamily, FontId, TextStyle};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

const THEMES_JSON: &str = include_str!("../../../assets/themes/themes.json");

#[derive(Deserialize, Clone)]
pub struct Skin {
    pub id: String,
    pub name: String,
    pub ui: String,
    pub code: String,
    pub ligatures: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct UiColors {
    pub bg: String,
    pub panel: String,
    pub panel2: String,
    pub border: String,
    pub fg: String,
    #[serde(rename = "fgDim")]
    pub fg_dim: String,
    pub accent: String,
    pub good: String,
    pub warn: String,
    pub bad: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct CodeColors {
    pub bg: String,
    pub fg: String,
    pub selection: String,
    #[serde(rename = "lineHighlight")]
    pub line_highlight: String,
    pub cursor: String,
    pub gutter: String,
    pub keyword: String,
    pub string: String,
    pub number: String,
    pub comment: String,
    pub function: String,
    pub variable: String,
    #[serde(rename = "type")]
    pub ty: String,
    pub operator: String,
    pub punctuation: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub dark: bool,
    pub ui: UiColors,
    pub code: CodeColors,
}

#[derive(Deserialize, Clone)]
struct FontEntry {
    dir: String,
}

#[derive(Deserialize, Clone)]
struct Catalog {
    skins: Vec<Skin>,
    fonts: BTreeMap<String, FontEntry>,
    themes: Vec<Theme>,
}

#[derive(Clone)]
pub struct Themes {
    cat: Catalog,
}

pub fn hex(s: &str) -> Color32 {
    let s = s.trim_start_matches('#');
    let p = |i: usize| u8::from_str_radix(s.get(i..i + 2).unwrap_or("00"), 16).unwrap_or(0);
    Color32::from_rgb(p(0), p(2), p(4))
}

macro_rules! font_files {
    ($($dir:literal),*) => {
        fn font_bytes(dir: &str, bold: bool) -> Option<&'static [u8]> {
            match (dir, bold) {
                $(
                    ($dir, false) => Some(include_bytes!(concat!("../../../assets/fonts/skins/", $dir, "-regular.ttf"))),
                    ($dir, true) => Some(include_bytes!(concat!("../../../assets/fonts/skins/", $dir, "-bold.ttf"))),
                )*
                ("dm-mono", false) => Some(dm_mono()),
                _ => None,
            }
        }
    };
}
font_files!(
    "inter",
    "plus-jakarta-sans",
    "ibm-plex-sans",
    "jetbrains-mono",
    "fira-code",
    "ibm-plex-mono",
    "roboto",
    "source-sans-3",
    "dm-sans",
    "manrope",
    "open-sans",
    "roboto-mono",
    "source-code-pro",
    "red-hat-mono"
);
// dm-mono has no bold cut (only used as a code font), so it is listed separately
fn dm_mono() -> &'static [u8] {
    include_bytes!("../../../assets/fonts/skins/dm-mono-regular.ttf")
}

/// Editor-only font pairs (UI font + code font). All are OFL, vendored by `tools/vendor.mjs`, converted by `tools/woff2_to_ttf.py`.
fn add_editor_skins(cat: &mut Catalog) {
    for (name, dir) in [
        ("Roboto", "roboto"),
        ("Source Sans 3", "source-sans-3"),
        ("DM Sans", "dm-sans"),
        ("Manrope", "manrope"),
        ("Open Sans", "open-sans"),
        ("Roboto Mono", "roboto-mono"),
        ("Source Code Pro", "source-code-pro"),
        ("DM Mono", "dm-mono"),
        ("Red Hat Mono", "red-hat-mono"),
    ] {
        cat.fonts.insert(name.into(), FontEntry { dir: dir.into() });
    }
    for (id, name, ui, code, lig) in [
        ("material", "Material", "Roboto", "Roboto Mono", false),
        (
            "adobe",
            "Adobe Studio",
            "Source Sans 3",
            "Source Code Pro",
            false,
        ),
        ("geometric", "Geometric", "DM Sans", "DM Mono", false),
        ("soft", "Soft", "Manrope", "JetBrains Mono", true),
        (
            "humanist",
            "Humanist",
            "Open Sans",
            "Source Code Pro",
            false,
        ),
        ("classic", "Classic", "Roboto", "Source Code Pro", false),
        ("studio", "Studio", "Source Sans 3", "Red Hat Mono", false),
        ("clean", "Clean", "DM Sans", "Roboto Mono", false),
        ("compact", "Compact Dev", "Open Sans", "Fira Code", true),
        ("workstation", "Workstation", "Inter", "Red Hat Mono", false),
    ] {
        cat.skins.push(Skin {
            id: id.into(),
            name: name.into(),
            ui: ui.into(),
            code: code.into(),
            ligatures: lig,
        });
    }
}

fn hex_of(c: Color32) -> String {
    format!("#{:02x}{:02x}{:02x}", c.r(), c.g(), c.b())
}

/// Build a theme from the 10 UI colours + 6 syntax colours; everything else (selection, gutter, cursor…) is derived.
#[allow(clippy::too_many_arguments)]
pub fn make_theme(
    base: &Theme,
    id: &str,
    name: &str,
    dark: bool,
    ui: [&str; 10],
    code: [&str; 6],
) -> Theme {
    let mut t = base.clone();
    t.id = id.into();
    t.name = name.into();
    t.dark = dark;
    t.ui = UiColors {
        bg: ui[0].into(),
        panel: ui[1].into(),
        panel2: ui[2].into(),
        border: ui[3].into(),
        fg: ui[4].into(),
        fg_dim: ui[5].into(),
        accent: ui[6].into(),
        good: ui[7].into(),
        warn: ui[8].into(),
        bad: ui[9].into(),
    };
    let (bg, panel, fg, dim, accent) = (hex(ui[0]), hex(ui[1]), hex(ui[4]), hex(ui[5]), hex(ui[6]));
    t.code.bg = ui[0].into();
    t.code.fg = ui[4].into();
    t.code.gutter = ui[5].into();
    t.code.line_highlight = hex_of(bg.lerp_to_gamma(panel, 0.7));
    t.code.selection = hex_of(bg.lerp_to_gamma(accent, 0.3));
    t.code.cursor = ui[6].into();
    t.code.variable = hex_of(fg);
    t.code.operator = hex_of(dim.lerp_to_gamma(fg, 0.5));
    t.code.punctuation = hex_of(dim.lerp_to_gamma(fg, 0.4));
    t.code.keyword = code[0].into();
    t.code.string = code[1].into();
    t.code.number = code[2].into();
    t.code.comment = code[3].into();
    t.code.function = code[4].into();
    t.code.ty = code[5].into();
    t
}

fn add_editor_themes(cat: &mut Catalog) {
    let dark = cat
        .themes
        .iter()
        .find(|t| t.dark)
        .cloned()
        .unwrap_or_else(|| cat.themes[0].clone());
    let light = cat
        .themes
        .iter()
        .find(|t| !t.dark)
        .cloned()
        .unwrap_or_else(|| dark.clone());
    // ui: bg panel panel2 border fg dim accent good warn bad · code: keyword string number comment function type
    let d: [(&str, &str, [&str; 10], [&str; 6]); 8] = [
        (
            "midnight",
            "Midnight",
            [
                "#0e1117", "#151a23", "#1d2430", "#2a3342", "#e6edf3", "#8b98a9", "#4c9aff",
                "#56d364", "#e3b341", "#ff7b72",
            ],
            [
                "#ff7b72", "#a5d6ff", "#79c0ff", "#6e7f93", "#d2a8ff", "#ffa657",
            ],
        ),
        (
            "obsidian",
            "Obsidian",
            [
                "#0b0b0d", "#131316", "#1b1b20", "#2a2a31", "#ececf1", "#8e8e99", "#a78bfa",
                "#6ee7b7", "#fcd34d", "#fca5a5",
            ],
            [
                "#c4b5fd", "#86efac", "#fdba74", "#6b6b78", "#93c5fd", "#f9a8d4",
            ],
        ),
        (
            "carbon",
            "Carbon",
            [
                "#141414", "#1c1c1c", "#262626", "#333333", "#f0f0f0", "#9a9a9a", "#2dd4bf",
                "#4ade80", "#facc15", "#f87171",
            ],
            [
                "#2dd4bf", "#fde68a", "#fb923c", "#6b6b6b", "#7dd3fc", "#c4b5fd",
            ],
        ),
        (
            "deep-ocean",
            "Deep Ocean",
            [
                "#0a1a24", "#0f2432", "#16303f", "#1f4154", "#dbeaf2", "#7fa2b5", "#38bdf8",
                "#34d399", "#fbbf24", "#fb7185",
            ],
            [
                "#38bdf8", "#a7f3d0", "#fdba74", "#5f8499", "#fde68a", "#c4b5fd",
            ],
        ),
        (
            "forest",
            "Forest Night",
            [
                "#0f1712", "#15201a", "#1d2b23", "#29392f", "#e1ece4", "#86a08f", "#4ade80",
                "#86efac", "#fcd34d", "#fca5a5",
            ],
            [
                "#86efac", "#fde68a", "#fdba74", "#628070", "#7dd3fc", "#d9f99d",
            ],
        ),
        (
            "ember",
            "Ember",
            [
                "#17110e", "#201814", "#2b201a", "#3b2c24", "#f1e6df", "#a38b7d", "#fb923c",
                "#a3e635", "#fbbf24", "#f87171",
            ],
            [
                "#fb923c", "#fde68a", "#f9a8d4", "#7d695d", "#fcd34d", "#fda4af",
            ],
        ),
        (
            "rose-night",
            "Rose Night",
            [
                "#171117", "#21171f", "#2c202a", "#3d2c3a", "#f3e6ef", "#a688a0", "#f472b6",
                "#86efac", "#fcd34d", "#fb7185",
            ],
            [
                "#f472b6", "#fbcfe8", "#fdba74", "#80647a", "#c4b5fd", "#a5b4fc",
            ],
        ),
        (
            "slate-gold",
            "Slate Gold",
            [
                "#1a1d21", "#22262b", "#2c3137", "#3a4047", "#e5e9ee", "#94a0ac", "#eab308",
                "#4ade80", "#fbbf24", "#f87171",
            ],
            [
                "#eab308", "#bef264", "#fb923c", "#6f7a86", "#7dd3fc", "#c4b5fd",
            ],
        ),
    ];
    for (id, name, ui, code) in d {
        cat.themes.push(make_theme(&dark, id, name, true, ui, code));
    }
    let l: [(&str, &str, [&str; 10], [&str; 6]); 2] = [
        (
            "paper",
            "Paper",
            [
                "#f6f5f1", "#fbfaf7", "#ecebe6", "#d6d4cc", "#26241f", "#77746b", "#2563eb",
                "#15803d", "#b45309", "#b91c1c",
            ],
            [
                "#a21caf", "#15803d", "#c2410c", "#9a9588", "#1d4ed8", "#0e7490",
            ],
        ),
        (
            "daylight",
            "Daylight",
            [
                "#eef1f5", "#f8fafc", "#e6eaf0", "#cfd6df", "#1c2430", "#66758a", "#0284c7",
                "#16a34a", "#d97706", "#dc2626",
            ],
            [
                "#7c3aed", "#059669", "#ea580c", "#94a3b8", "#0369a1", "#be185d",
            ],
        ),
    ];
    for (id, name, ui, code) in l {
        cat.themes
            .push(make_theme(&light, id, name, false, ui, code));
    }
}

const CUSTOM_PREFIX: &str = "custom-";
fn custom_path() -> std::path::PathBuf {
    nord_core::io::config_dir().join("themes.custom.json")
}
fn load_custom() -> Vec<Theme> {
    let v: Vec<Theme> = nord_core::io::load_json(&custom_path()).unwrap_or_default();
    v.into_iter()
        .filter(|t| t.id.starts_with(CUSTOM_PREFIX) && t.id != DRAFT_ID)
        .collect()
}
/// The live-preview copy of the theme being edited; never written to disk.
pub const DRAFT_ID: &str = "custom-draft";

impl Themes {
    pub fn is_custom(&self, id: &str) -> bool {
        id.starts_with(CUSTOM_PREFIX)
    }
    /// Replace the live-preview theme (shown while the theme editor is open).
    pub fn set_draft(&mut self, mut t: Theme) {
        t.id = DRAFT_ID.into();
        self.cat.themes.retain(|x| x.id != DRAFT_ID);
        self.cat.themes.push(t);
    }
    /// Save the draft as a new custom theme (built-in themes are never touched). Returns the new id.
    pub fn save_custom(&mut self, mut t: Theme) -> String {
        let slug: String = t
            .name
            .to_lowercase()
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect();
        let slug = slug.trim_matches('-');
        let mut id = format!(
            "{CUSTOM_PREFIX}{}",
            if slug.is_empty() { "theme" } else { slug }
        );
        let mut n = 2;
        while self.cat.themes.iter().any(|x| x.id == id) {
            id = format!("{CUSTOM_PREFIX}{slug}-{n}");
            n += 1;
        }
        t.id = id.clone();
        self.cat.themes.retain(|x| x.id != DRAFT_ID);
        self.cat.themes.push(t);
        self.write_custom();
        id
    }
    pub fn clear_draft(&mut self) {
        self.cat.themes.retain(|x| x.id != DRAFT_ID);
    }
    pub fn remove_custom(&mut self, id: &str) {
        if self.is_custom(id) {
            self.cat.themes.retain(|x| x.id != id);
            self.write_custom();
        }
    }
    fn write_custom(&self) {
        let list: Vec<&Theme> = self
            .cat
            .themes
            .iter()
            .filter(|t| t.id.starts_with(CUSTOM_PREFIX) && t.id != DRAFT_ID)
            .collect();
        let _ = nord_core::io::save_json(&custom_path(), &list);
    }
}

impl Themes {
    pub fn load() -> Self {
        let mut cat: Catalog = serde_json::from_str(THEMES_JSON).expect("themes.json");
        // Editor-only palette: exported games retain their existing shared themes.
        let mut graphite = cat.themes[0].clone();
        graphite.id = "graphite".into();
        graphite.name = "Graphite".into();
        graphite.ui = UiColors {
            bg: "#191919".into(),
            panel: "#232323".into(),
            panel2: "#2d2d2d".into(),
            border: "#3d3d3d".into(),
            fg: "#ededed".into(),
            fg_dim: "#a5a5a5".into(),
            accent: "#80b8ee".into(),
            good: "#8fc9a3".into(),
            warn: "#e8bd78".into(),
            bad: "#ef9292".into(),
        };
        graphite.code.bg = "#191919".into();
        graphite.code.fg = "#dedede".into();
        graphite.code.gutter = "#858585".into();
        graphite.code.line_highlight = "#252525".into();
        graphite.code.selection = "#35495d".into();
        cat.themes.insert(0, graphite.clone());
        // PlayCanvas-style editor palette: blue-grey panels, thin dividers, orange accent.
        let mut pc = graphite;
        pc.id = "playcanvas".into();
        pc.name = "PlayCanvas".into();
        pc.ui = UiColors {
            bg: "#1b2325".into(),
            panel: "#20292b".into(),
            panel2: "#293538".into(),
            border: "#151c1e".into(),
            fg: "#e3e8ea".into(),
            fg_dim: "#8a9a9e".into(),
            accent: "#ff6600".into(),
            good: "#5ec47a".into(),
            warn: "#ffc04a".into(),
            bad: "#ff5a5a".into(),
        };
        pc.code.bg = "#1b2325".into();
        pc.code.fg = "#dfe5e7".into();
        pc.code.gutter = "#6c7b7f".into();
        pc.code.line_highlight = "#222c2e".into();
        pc.code.selection = "#3a4a4e".into();
        cat.themes.insert(0, pc);
        add_editor_skins(&mut cat);
        add_editor_themes(&mut cat);
        let mut me = Self { cat };
        me.cat.themes.extend(load_custom());
        me
    }
    pub fn skins(&self) -> &[Skin] {
        &self.cat.skins
    }
    pub fn themes(&self) -> &[Theme] {
        &self.cat.themes
    }
    pub fn skin(&self, id: &str) -> &Skin {
        self.cat
            .skins
            .iter()
            .find(|s| s.id == id)
            .unwrap_or(&self.cat.skins[0])
    }
    pub fn theme(&self, id: &str) -> &Theme {
        self.cat
            .themes
            .iter()
            .find(|t| t.id == id)
            .unwrap_or(&self.cat.themes[0])
    }

    fn fonts(&self, skin: &Skin) -> FontDefinitions {
        let mut f = FontDefinitions::default();
        let mut add = |name: &str, family: &FontFamily, bytes: &'static [u8]| {
            f.font_data
                .insert(name.to_string(), Arc::new(FontData::from_static(bytes)));
            f.families
                .entry(family.clone())
                .or_default()
                .insert(0, name.to_string());
        };
        let dir = |face: &str| self.cat.fonts.get(face).map(|e| e.dir.as_str());
        if let Some(b) = dir(&skin.code).and_then(|d| font_bytes(d, false)) {
            add("code", &FontFamily::Monospace, b);
        }
        if let Some(b) = dir(&skin.ui).and_then(|d| font_bytes(d, true)) {
            add("ui-bold", &FontFamily::Name("bold".into()), b);
        }
        if let Some(b) = dir(&skin.ui).and_then(|d| font_bytes(d, false)) {
            add("ui", &FontFamily::Proportional, b);
        }
        // symbols the UI fonts lack (▸ → ● ▾ …) come from egui's bundled Hack, in every UI family — the bold family used to have no fallback at all
        for fam in [FontFamily::Proportional, FontFamily::Name("bold".into())] {
            let list = f.families.entry(fam).or_default();
            if !list.iter().any(|n| n == "ui") {
                list.push("ui".into());
            }
            for fallback in [
                "Ubuntu-Light",
                "NotoEmoji-Regular",
                "emoji-icon-font",
                "Hack",
            ] {
                if !list.iter().any(|n| n == fallback) {
                    list.push(fallback.into());
                }
            }
        }
        f
    }

    /// Apply skin (fonts) + theme (colors) to the egui context. Cheap enough to call live from Settings.
    pub fn apply(&self, ctx: &egui::Context, skin: &str, theme: &str) {
        let skin = self.skin(skin);
        let th = self.theme(theme);
        ctx.set_fonts(self.fonts(skin));
        let u = &th.ui;
        let mut v = if th.dark {
            egui::Visuals::dark()
        } else {
            egui::Visuals::light()
        };
        let (bg, panel, panel2, border, fg, dim, accent) = (
            hex(&u.bg),
            hex(&u.panel),
            hex(&u.panel2),
            hex(&u.border),
            hex(&u.fg),
            hex(&u.fg_dim),
            hex(&u.accent),
        );
        v.panel_fill = panel;
        v.window_fill = panel;
        v.extreme_bg_color = bg;
        v.faint_bg_color = panel2;
        v.code_bg_color = bg;
        v.override_text_color = Some(fg);
        v.hyperlink_color = accent;
        v.warn_fg_color = hex(&u.warn);
        v.error_fg_color = hex(&u.bad);
        v.window_stroke = egui::Stroke::new(1.0_f32, border);
        v.window_corner_radius = egui::CornerRadius::same(8);
        v.window_shadow = egui::Shadow {
            offset: [0, 6],
            blur: 18,
            spread: 0,
            color: Color32::from_black_alpha(90),
        };
        v.popup_shadow = v.window_shadow;
        v.slider_trailing_fill = true;
        v.indent_has_left_vline = false;
        v.menu_corner_radius = egui::CornerRadius::same(6);
        v.selection.bg_fill = bg.lerp_to_gamma(accent, 0.28);
        v.selection.stroke = egui::Stroke::new(1.0_f32, fg);
        let rounding = egui::CornerRadius::same(if theme == "playcanvas" { 3 } else { 4 });
        for (w, fill) in [
            (&mut v.widgets.noninteractive, panel),
            (&mut v.widgets.inactive, panel2),
            (&mut v.widgets.hovered, border),
            (&mut v.widgets.active, bg.lerp_to_gamma(accent, 0.3)),
            (&mut v.widgets.open, panel2),
        ] {
            w.bg_fill = fill;
            w.weak_bg_fill = fill;
            w.corner_radius = rounding;
            w.bg_stroke = egui::Stroke::new(1.0_f32, border);
            w.fg_stroke = egui::Stroke::new(1.0_f32, fg);
        }
        v.widgets.noninteractive.fg_stroke = egui::Stroke::new(1.0_f32, dim);
        v.widgets.inactive.bg_stroke = egui::Stroke::new(1.0_f32, panel2);
        v.widgets.hovered.bg_stroke = egui::Stroke::new(1.0_f32, dim.linear_multiply(0.6));
        v.widgets.active.bg_stroke = egui::Stroke::new(1.0_f32, accent);
        ctx.set_visuals(v);
    }

    /// Text styles reference the "bold" font family, which only exists once `set_fonts` took effect (next frame) —
    /// so this runs one frame after `apply` (egui panics on an unbound family).
    pub fn apply_text_styles(
        &self,
        ctx: &egui::Context,
        ui_scale: f32,
        font_scale: f32,
        button_scale: f32,
    ) {
        let mut style = (*ctx.style()).clone();
        let (s, t, b) = (ui_scale, ui_scale * font_scale, ui_scale * button_scale);
        // compact, editor-like defaults (smaller text and buttons than egui's)
        style.text_styles = [
            (
                TextStyle::Small,
                FontId::new(10.5 * t, FontFamily::Proportional),
            ),
            (
                TextStyle::Body,
                FontId::new(12.5 * t, FontFamily::Proportional),
            ),
            (
                TextStyle::Button,
                FontId::new(12.5 * t, FontFamily::Proportional),
            ),
            (
                TextStyle::Heading,
                FontId::new(15.5 * t, FontFamily::Name("bold".into())),
            ),
            (
                TextStyle::Monospace,
                FontId::new(12.5 * t, FontFamily::Monospace),
            ),
        ]
        .into();
        style.spacing.item_spacing = egui::vec2(6.0 * s, 4.0 * s);
        style.spacing.button_padding = egui::vec2(8.0 * b, 3.0 * b);
        style.spacing.interact_size = egui::vec2(28.0 * b, 22.0 * b);
        style.spacing.icon_width = 14.0 * b;
        style.spacing.icon_width_inner = 8.0 * b;
        style.spacing.combo_height = 280.0;
        style.spacing.slider_width = 100.0 * s;
        style.spacing.window_margin = egui::Margin::same((12.0 * s) as i8);
        style.spacing.menu_margin = egui::Margin::same((6.0 * s) as i8);
        style.spacing.indent = 14.0 * s;
        ctx.set_style(style);
    }
}

impl Theme {
    pub fn accent(&self) -> Color32 {
        hex(&self.ui.accent)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_skin_font_is_bundled_and_new_themes_exist() {
        let t = Themes::load();
        assert!(t.skins().len() >= 13);
        for s in t.skins() {
            for face in [&s.ui, &s.code] {
                let dir = t.cat.fonts.get(face).map(|e| e.dir.clone());
                assert!(dir.as_deref().and_then(|d| font_bytes(d, false)).is_some(), "{} / {face}", s.id);
            }
        }
        for id in ["midnight", "obsidian", "carbon", "deep-ocean", "forest", "ember", "rose-night", "slate-gold"] {
            assert!(t.theme(id).dark && t.theme(id).id == id);
        }
        for id in ["paper", "daylight"] {
            assert!(!t.theme(id).dark && t.theme(id).id == id);
        }
    }

    #[test]
    fn draft_is_not_saved_and_builtins_are_not_custom() {
        let mut t = Themes::load();
        let d = t.theme("midnight").clone();
        t.set_draft(d);
        assert!(t.is_custom(DRAFT_ID) && !t.is_custom("midnight"));
        t.clear_draft();
        assert_eq!(t.theme(DRAFT_ID).id, t.themes()[0].id);
    }
}
