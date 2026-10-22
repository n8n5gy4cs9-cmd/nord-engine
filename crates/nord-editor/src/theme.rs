//! Skins + themes from the shared `assets/themes/themes.json` (same file the web runtime UI uses), applied to egui.
use egui::{Color32, FontData, FontDefinitions, FontFamily, FontId, TextStyle};
use serde::Deserialize;
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

#[derive(Deserialize, Clone, Default)]
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

#[derive(Deserialize, Clone, Default)]
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

#[derive(Deserialize, Clone)]
pub struct Theme {
    pub id: String,
    pub name: String,
    pub dark: bool,
    pub ui: UiColors,
    pub code: CodeColors,
}

#[derive(Deserialize)]
struct FontEntry {
    dir: String,
}

#[derive(Deserialize)]
struct Catalog {
    skins: Vec<Skin>,
    fonts: BTreeMap<String, FontEntry>,
    themes: Vec<Theme>,
}

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
    "ibm-plex-mono"
);

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
        Self { cat }
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
        f.families
            .entry(FontFamily::Name("bold".into()))
            .or_default()
            .push("ui".into());
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
        v.window_corner_radius = egui::CornerRadius::same(10);
        v.menu_corner_radius = egui::CornerRadius::same(6);
        v.selection.bg_fill = bg.lerp_to_gamma(accent, 0.28);
        v.selection.stroke = egui::Stroke::new(1.0_f32, fg);
        let rounding = egui::CornerRadius::same(if theme == "playcanvas" { 2 } else { 5 });
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
        v.widgets.inactive.bg_stroke = egui::Stroke::new(1.0, panel2);
        v.widgets.hovered.bg_stroke = egui::Stroke::new(1.0, dim.linear_multiply(0.6));
        v.widgets.active.bg_stroke = egui::Stroke::new(1.0, accent);
        ctx.set_visuals(v);
    }

    /// Text styles reference the "bold" font family, which only exists once `set_fonts` took effect (next frame) —
    /// so this runs one frame after `apply` (egui panics on an unbound family).
    pub fn apply_text_styles(&self, ctx: &egui::Context, ui_scale: f32) {
        let mut style = (*ctx.style()).clone();
        let s = ui_scale;
        style.text_styles = [
            (
                TextStyle::Small,
                FontId::new(11.0 * s, FontFamily::Proportional),
            ),
            (
                TextStyle::Body,
                FontId::new(13.0 * s, FontFamily::Proportional),
            ),
            (
                TextStyle::Button,
                FontId::new(13.0 * s, FontFamily::Proportional),
            ),
            (
                TextStyle::Heading,
                FontId::new(17.0 * s, FontFamily::Name("bold".into())),
            ),
            (
                TextStyle::Monospace,
                FontId::new(13.0 * s, FontFamily::Monospace),
            ),
        ]
        .into();
        style.spacing.item_spacing = egui::vec2(8.0 * s, 6.0 * s);
        style.spacing.button_padding = egui::vec2(10.0 * s, 5.0 * s);
        style.spacing.interact_size = egui::vec2(32.0 * s, 26.0 * s);
        style.spacing.window_margin = egui::Margin::same(16);
        style.spacing.menu_margin = egui::Margin::same(8);
        ctx.set_style(style);
    }
}

impl Theme {
    pub fn accent(&self) -> Color32 {
        hex(&self.ui.accent)
    }
}
