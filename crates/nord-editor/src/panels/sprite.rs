//! Sprite editor (M10-15/16): paint tools for PNG images + sprite metadata (origin, named image points, collision polygon with
//! auto-trace, per-frame properties) stored in `<image>.meta.json`. Drawing primitives live in `crate::pixel`.
use crate::pixel::{self, Color};
use crate::state::{EditorState, LogLevel};
use egui::{Color32, Pos2, Rect, RichText, Sense, TextureOptions, Ui, Vec2};
use image::RgbaImage;
use nord_core::assets::AssetType;
use serde_json::{json, Value};

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Tool {
    #[default]
    Pencil,
    Brush,
    Eraser,
    Fill,
    Line,
    Rect,
    Ellipse,
    Eyedropper,
    Select,
    Move,
}

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum Mode {
    #[default]
    Paint,
    Points,
    /// import settings of the image: filter, wrap, pixels per unit, frame slicing
    Settings,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Down,
    Move,
    Up,
}

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum Place {
    #[default]
    Origin,
    Point,
    Vertex,
}

pub struct SpriteUi {
    pub path: Option<String>,
    pub img: Option<RgbaImage>,
    undo: Vec<RgbaImage>,
    redo: Vec<RgbaImage>,
    pub tool: Tool,
    pub mode: Mode,
    pub color: Color,
    pub size: i32,
    pub filled: bool,
    pub tolerance: u8,
    pub zoom: f32,
    pub grid: bool,
    pub dirty: bool,
    pub palette: Vec<Color>,
    start: Option<(i32, i32)>,
    last: Option<(i32, i32)>,
    base: Option<RgbaImage>,
    pub selection: Option<(i32, i32, i32, i32)>,
    floating: Option<(RgbaImage, i32, i32, (i32, i32))>,
    tex: Option<egui::TextureHandle>,
    tex_dirty: bool,
    pub new_w: u32,
    pub new_h: u32,
    pub name: String,
    // metadata
    pub meta: Value,
    pub place: Place,
    pub point_name: String,
    pub trace_threshold: u8,
    pub trace_points: usize,
    pub frame: usize,
    /// Scene object (Hierarchy selection id, also a prefab child) whose sprite texture follows the saved file.
    pub link: Option<String>,
}

/// The read-only white square every new Sprite object starts with (Unity's default sprite). It is never edited: opening it in the
/// Sprite editor starts a new image instead.
pub const DEFAULT_SPRITE: &str = "assets/sprites/default-white.png";
const SPRITES_DIR: &str = "assets/sprites";

/// Free `name`, `name-2`, … (no extension) inside the sprites folder.
pub fn unique_sprite_name(root: &std::path::Path, base: &str) -> String {
    let mut n = 1;
    loop {
        let name = if n == 1 {
            base.to_string()
        } else {
            format!("{base}-{n}")
        };
        if !root.join(format!("{SPRITES_DIR}/{name}.png")).exists() {
            return name;
        }
        n += 1;
    }
}

/// Point the first sprite component of `e` at `tex`; false when it has none.
pub fn apply_texture(e: &mut nord_core::scene::Entity, tex: &str) -> bool {
    match e
        .components
        .iter_mut()
        .find(|c| matches!(c.kind.as_str(), "sprite" | "animatedSprite"))
    {
        Some(c) => {
            c.fields.insert("texture".into(), json!(tex));
            true
        }
        None => false,
    }
}

impl EditorState {
    /// Create the default white sprite file when the project does not have it yet; returns its path.
    pub fn ensure_default_sprite(&mut self) -> Option<&'static str> {
        let root = self.root.clone()?;
        let full = root.join(DEFAULT_SPRITE);
        if !full.exists() {
            std::fs::create_dir_all(full.parent()?).ok()?;
            RgbaImage::from_pixel(64, 64, image::Rgba([255, 255, 255, 255]))
                .save(&full)
                .ok()?;
            self.refresh_assets();
        }
        Some(DEFAULT_SPRITE)
    }

    /// Open the Sprite editor for `tex`, tied to scene object `link` (its sprite follows the saved file). The default sprite or a
    /// missing file opens a new white image named for saving into the sprites folder.
    pub fn open_in_sprite_editor(&mut self, link: Option<String>, tex: &str) {
        let Some(root) = self.root.clone() else {
            return;
        };
        let loaded = (!tex.is_empty() && tex != DEFAULT_SPRITE)
            .then(|| image::open(root.join(tex)).ok())
            .flatten();
        match loaded {
            Some(i) => {
                let meta = nord_core::io::load_json(&root.join(format!("{tex}.meta.json")))
                    .unwrap_or(Value::Null);
                self.sprite.load_image(tex, i.to_rgba8(), meta);
                self.sprite.name.clear();
            }
            None => {
                let img = RgbaImage::from_pixel(64, 64, image::Rgba([255, 255, 255, 255]));
                self.sprite.load_image("", img, json!({}));
                self.sprite.path = None;
                self.sprite.name = unique_sprite_name(&root, "sprite");
                self.sprite.dirty = true;
            }
        }
        self.sprite.link = link;
        self.push(crate::state::Action::ShowTab(crate::app::Tab::Sprite));
    }
}

impl Default for SpriteUi {
    fn default() -> Self {
        let pal = [
            "#2e3440", "#3b4252", "#4c566a", "#d8dee9", "#eceff4", "#bf616a", "#d08770", "#ebcb8b",
            "#a3be8c", "#88c0d0", "#81a1c1", "#5e81ac", "#b48ead", "#000000", "#ffffff", "#8b5a2b",
        ];
        Self {
            path: None,
            img: None,
            undo: vec![],
            redo: vec![],
            tool: Tool::Pencil,
            mode: Mode::Paint,
            color: [235, 203, 139, 255],
            size: 1,
            filled: true,
            tolerance: 0,
            zoom: 12.0,
            grid: true,
            dirty: false,
            palette: pal.iter().filter_map(|h| pixel::parse_hex(h)).collect(),
            start: None,
            last: None,
            base: None,
            selection: None,
            floating: None,
            tex: None,
            tex_dirty: true,
            new_w: 32,
            new_h: 32,
            name: String::new(),
            meta: json!({}),
            place: Place::Origin,
            point_name: String::new(),
            trace_threshold: 8,
            trace_points: 8,
            frame: 0,
            link: None,
        }
    }
}

impl SpriteUi {
    pub fn load_image(&mut self, rel: &str, img: RgbaImage, meta: Value) {
        self.path = Some(rel.into());
        self.img = Some(img);
        self.meta = if meta.is_object() { meta } else { json!({}) };
        self.undo.clear();
        self.redo.clear();
        self.selection = None;
        self.floating = None;
        self.dirty = false;
        self.tex_dirty = true;
    }

    pub fn new_image(&mut self, w: u32, h: u32) {
        self.load_image(
            "",
            RgbaImage::new(w.clamp(1, 2048), h.clamp(1, 2048)),
            json!({}),
        );
        self.path = None;
    }

    fn snapshot(&mut self) {
        if let Some(i) = &self.img {
            self.undo.push(i.clone());
            if self.undo.len() > 100 {
                self.undo.remove(0);
            }
            self.redo.clear();
        }
    }

    pub fn undo(&mut self) -> bool {
        match (self.undo.pop(), self.img.take()) {
            (Some(prev), Some(cur)) => {
                self.redo.push(cur);
                self.img = Some(prev);
                self.dirty = true;
                self.tex_dirty = true;
                self.floating = None;
                true
            }
            (_, cur) => {
                self.img = cur;
                false
            }
        }
    }

    pub fn redo(&mut self) -> bool {
        match (self.redo.pop(), self.img.take()) {
            (Some(next), Some(cur)) => {
                self.undo.push(cur);
                self.img = Some(next);
                self.dirty = true;
                self.tex_dirty = true;
                true
            }
            (_, cur) => {
                self.img = cur;
                false
            }
        }
    }

    fn touch(&mut self) {
        self.dirty = true;
        self.tex_dirty = true;
    }

    /// Feed a pointer event in image pixel coordinates to the active tool.
    pub fn pointer(&mut self, phase: Phase, x: i32, y: i32) {
        let Some(mut img) = self.img.take() else {
            return;
        };
        let (tool, c, size) = (self.tool, self.color, self.size);
        let mut changed = true;
        match (tool, phase) {
            (Tool::Pencil | Tool::Brush | Tool::Eraser, Phase::Down) => {
                self.undo.push(img.clone());
                self.redo.clear();
                let (col, sz) = Self::stroke_params(tool, c, size);
                pixel::brush(&mut img, x, y, sz, col);
                self.last = Some((x, y));
            }
            (Tool::Pencil | Tool::Brush | Tool::Eraser, Phase::Move) => {
                if let Some((lx, ly)) = self.last {
                    let (col, sz) = Self::stroke_params(tool, c, size);
                    pixel::line(&mut img, lx, ly, x, y, sz, col);
                    self.last = Some((x, y));
                }
            }
            (Tool::Fill, Phase::Down) => {
                self.undo.push(img.clone());
                self.redo.clear();
                pixel::fill(&mut img, x, y, c, self.tolerance);
            }
            (Tool::Eyedropper, Phase::Down) => {
                if let Some(p) = pixel::get(&img, x, y) {
                    self.color = p;
                }
                changed = false;
            }
            (Tool::Line | Tool::Rect | Tool::Ellipse, Phase::Down) => {
                self.undo.push(img.clone());
                self.redo.clear();
                self.start = Some((x, y));
                self.base = Some(img.clone());
                Self::shape(&mut img, tool, (x, y), (x, y), size, c, self.filled);
            }
            (Tool::Line | Tool::Rect | Tool::Ellipse, Phase::Move) => {
                if let (Some(s), Some(b)) = (self.start, &self.base) {
                    img = b.clone();
                    Self::shape(&mut img, tool, s, (x, y), size, c, self.filled);
                }
            }
            (Tool::Select, Phase::Down) => {
                self.start = Some((x, y));
                self.selection = Some((x, y, x, y));
                changed = false;
            }
            (Tool::Select, Phase::Move) => {
                if let Some((sx, sy)) = self.start {
                    self.selection = Some((sx.min(x), sy.min(y), sx.max(x), sy.max(y)));
                }
                changed = false;
            }
            (Tool::Move, Phase::Down) => {
                if let Some((x0, y0, x1, y1)) = self
                    .selection
                    .filter(|s| x >= s.0 && x <= s.2 && y >= s.1 && y <= s.3)
                {
                    self.undo.push(img.clone());
                    self.redo.clear();
                    let piece = pixel::crop(&img, x0, y0, x1, y1);
                    pixel::clear_box(&mut img, x0, y0, x1, y1);
                    self.floating = Some((piece, x0, y0, (x - x0, y - y0)));
                } else {
                    changed = false;
                }
            }
            (Tool::Move, Phase::Move) => {
                if let Some((_, fx, fy, grab)) = &mut self.floating {
                    *fx = x - grab.0;
                    *fy = y - grab.1;
                }
                changed = false;
                self.tex_dirty = true;
            }
            (Tool::Move, Phase::Up) => {
                if let Some((piece, fx, fy, _)) = self.floating.take() {
                    pixel::paste(&mut img, &piece, fx, fy);
                    self.selection = Some((
                        fx,
                        fy,
                        fx + piece.width() as i32 - 1,
                        fy + piece.height() as i32 - 1,
                    ));
                }
            }
            (_, Phase::Up) => {
                self.start = None;
                self.last = None;
                self.base = None;
                changed = tool != Tool::Select && tool != Tool::Eyedropper;
            }
            _ => changed = false,
        }
        self.img = Some(img);
        if changed {
            self.touch();
        }
        if matches!(phase, Phase::Up) {
            self.start = None;
            self.last = None;
            self.base = None;
        }
    }

    fn stroke_params(tool: Tool, c: Color, size: i32) -> (Color, i32) {
        match tool {
            Tool::Pencil => (c, 1),
            Tool::Eraser => ([0, 0, 0, 0], size.max(1)),
            _ => (c, size.max(1)),
        }
    }

    fn shape(
        img: &mut RgbaImage,
        tool: Tool,
        a: (i32, i32),
        b: (i32, i32),
        size: i32,
        c: Color,
        filled: bool,
    ) {
        match tool {
            Tool::Line => pixel::line(img, a.0, a.1, b.0, b.1, size.max(1), c),
            Tool::Rect => pixel::rect(img, a.0, a.1, b.0, b.1, size.max(1), c, filled),
            _ => pixel::ellipse(img, a.0, a.1, b.0, b.1, size.max(1), c, filled),
        }
    }

    /// Flip/rotate the selection (flip only) or the whole image.
    pub fn transform(&mut self, op: &str) {
        let Some(img) = self.img.clone() else { return };
        self.snapshot();
        let mut out = img.clone();
        match (op, self.selection) {
            ("flip-h" | "flip-v", Some((x0, y0, x1, y1))) => {
                let piece = pixel::crop(&img, x0, y0, x1, y1);
                let flipped = if op == "flip-h" {
                    pixel::flip_h(&piece)
                } else {
                    pixel::flip_v(&piece)
                };
                pixel::clear_box(&mut out, x0, y0, x1, y1);
                pixel::paste(&mut out, &flipped, x0, y0);
            }
            ("flip-h", None) => out = pixel::flip_h(&img),
            ("flip-v", None) => out = pixel::flip_v(&img),
            ("rot-cw", _) => out = pixel::rotate_cw(&img),
            ("rot-ccw", _) => out = pixel::rotate_ccw(&img),
            ("clear", Some((x0, y0, x1, y1))) => pixel::clear_box(&mut out, x0, y0, x1, y1),
            ("clear", None) => out = RgbaImage::new(img.width(), img.height()),
            _ => {}
        }
        self.img = Some(out);
        self.touch();
    }

    // ---- metadata (M10-16)

    pub fn set_origin(&mut self, x: f64, y: f64) {
        self.meta["origin"] = json!([x, y]);
        self.dirty = true;
    }
    pub fn set_point(&mut self, name: &str, x: f64, y: f64) {
        if !self.meta["points"].is_object() {
            self.meta["points"] = json!({});
        }
        self.meta["points"][name] = json!([x, y]);
        self.dirty = true;
    }
    pub fn add_vertex(&mut self, x: f64, y: f64) {
        if !self.meta["collision"].is_array() {
            self.meta["collision"] = json!([]);
        }
        self.meta["collision"]
            .as_array_mut()
            .unwrap()
            .push(json!([x, y]));
        self.dirty = true;
    }
    pub fn remove_nearest_vertex(&mut self, x: f64, y: f64) {
        if let Some(a) = self.meta["collision"].as_array_mut() {
            let d = |v: &Value| {
                (v[0].as_f64().unwrap_or(0.0) - x).powi(2)
                    + (v[1].as_f64().unwrap_or(0.0) - y).powi(2)
            };
            if let Some((i, _)) = a
                .iter()
                .enumerate()
                .min_by(|a, b| d(a.1).total_cmp(&d(b.1)))
            {
                a.remove(i);
                self.dirty = true;
            }
        }
    }
    /// Replace the collision polygon with the traced outline of the image's opaque pixels.
    pub fn auto_trace(&mut self) {
        let Some(img) = &self.img else { return };
        let poly = pixel::auto_trace(img, self.trace_threshold, self.trace_points);
        self.meta["collision"] = json!(poly);
        self.dirty = true;
    }
    pub fn set_frame_prop(&mut self, frame: usize, key: &str, v: Value) {
        if !self.meta["frameProps"].is_object() {
            self.meta["frameProps"] = json!({});
        }
        let k = frame.to_string();
        if !self.meta["frameProps"][&k].is_object() {
            self.meta["frameProps"][&k] = json!({});
        }
        self.meta["frameProps"][&k][key] = v;
        self.dirty = true;
    }
}

pub fn ui(st: &mut EditorState, ui: &mut Ui) {
    let Some(root) = st.root.clone() else {
        ui.weak("No project open");
        return;
    };
    top_bar(st, ui, &root);
    ui.separator();
    if st.sprite.img.is_none() {
        ui.weak("Pick an image from the project, or create a new one.");
        return;
    }
    ui.horizontal(|ui| {
        ui.selectable_value(&mut st.sprite.mode, Mode::Paint, "Paint");
        ui.selectable_value(
            &mut st.sprite.mode,
            Mode::Points,
            "Origin, points, collision",
        );
        ui.selectable_value(&mut st.sprite.mode, Mode::Settings, "Settings");
        ui.separator();
        ui.add(
            egui::Slider::new(&mut st.sprite.zoom, 1.0..=48.0)
                .text("zoom")
                .logarithmic(true),
        );
        ui.checkbox(&mut st.sprite.grid, "pixel grid");
    });
    egui::SidePanel::left("sprite-tools")
        .resizable(false)
        .default_width(190.0)
        .show_inside(ui, |ui| match st.sprite.mode {
            Mode::Paint => paint_tools(&mut st.sprite, ui),
            Mode::Points => points_tools(&mut st.sprite, ui),
            Mode::Settings => settings_tools(&mut st.sprite, ui),
        });
    canvas(st, ui);
}

fn top_bar(st: &mut EditorState, ui: &mut Ui, root: &std::path::Path) {
    let images: Vec<String> = st
        .assets
        .iter()
        .filter(|a| {
            matches!(a.kind, AssetType::Image | AssetType::Spritesheet)
                && a.path.to_ascii_lowercase().ends_with(".png")
        })
        .map(|a| a.path.clone())
        .collect();
    let mut save = false;
    ui.horizontal_wrapped(|ui| {
        egui::ComboBox::from_id_salt("sprite-pick")
            .width(220.0)
            .selected_text(
                st.sprite
                    .path
                    .clone()
                    .unwrap_or_else(|| "(choose image)".into()),
            )
            .show_ui(ui, |ui| {
                for p in &images {
                    if ui
                        .selectable_label(st.sprite.path.as_deref() == Some(p), p)
                        .clicked()
                    {
                        st.sprite.link = None;
                        match image::open(root.join(p)) {
                            Ok(i) => {
                                let meta =
                                    nord_core::io::load_json(&root.join(format!("{p}.meta.json")))
                                        .unwrap_or(Value::Null);
                                st.sprite.load_image(p, i.to_rgba8(), meta);
                            }
                            Err(e) => st.log(LogLevel::Error, format!("{p}: {e}")),
                        }
                    }
                }
            });
        ui.add(
            egui::DragValue::new(&mut st.sprite.new_w)
                .range(1..=2048)
                .prefix("w "),
        );
        ui.add(
            egui::DragValue::new(&mut st.sprite.new_h)
                .range(1..=2048)
                .prefix("h "),
        );
        if ui.button("New image").clicked() {
            let (w, h) = (st.sprite.new_w, st.sprite.new_h);
            st.sprite.new_image(w, h);
            st.sprite.link = None;
            st.sprite.name = unique_sprite_name(root, "sprite");
        }
        ui.add(
            egui::TextEdit::singleline(&mut st.sprite.name)
                .hint_text("name (saved in assets/sprites)")
                .desired_width(220.0),
        );
        if ui
            .add_enabled(st.sprite.img.is_some(), egui::Button::new("Save"))
            .clicked()
        {
            save = true;
        }
        if ui
            .add_enabled(
                st.sprite.img.is_some() && !st.sprite.undo.is_empty(),
                egui::Button::new("Undo"),
            )
            .clicked()
        {
            st.sprite.undo();
        }
        if ui
            .add_enabled(
                st.sprite.img.is_some() && !st.sprite.redo.is_empty(),
                egui::Button::new("Redo"),
            )
            .clicked()
        {
            st.sprite.redo();
        }
        if st.sprite.dirty {
            ui.weak("unsaved •");
        }
    });
    if save {
        let rel = if !st.sprite.name.trim().is_empty() {
            let mut n = st.sprite.name.trim().to_string();
            if !n.contains('/') {
                n = format!("{SPRITES_DIR}/{n}");
            }
            if n.ends_with(".png") {
                n
            } else {
                format!("{n}.png")
            }
        } else {
            st.sprite.path.clone().unwrap_or_default()
        };
        if rel.is_empty() || rel.contains("..") || rel.starts_with('/') {
            st.toast("Give the sprite a name");
            return;
        }
        if rel == DEFAULT_SPRITE {
            st.toast("The default white sprite is read-only: save under another name");
            return;
        }
        let full = root.join(&rel);
        if let Some(p) = full.parent() {
            let _ = std::fs::create_dir_all(p);
        }
        let res = st
            .sprite
            .img
            .as_ref()
            .unwrap()
            .save(&full)
            .map_err(|e| e.to_string())
            .and_then(|_| {
                let m = &st.sprite.meta;
                if m.as_object().is_some_and(|o| !o.is_empty()) {
                    nord_core::io::save_json(&root.join(format!("{rel}.meta.json")), m)
                        .map_err(|e| e.to_string())
                } else {
                    Ok(())
                }
            });
        match res {
            Ok(()) => {
                st.sprite.path = Some(rel.clone());
                st.sprite.name.clear();
                st.sprite.dirty = false;
                st.refresh_assets();
                st.rev += 1; // viewport reloads the changed image
                if let Some(l) = st.sprite.link.clone() {
                    // the Inspector points the object's sprite at the file (works for prefab instances and children too)
                    st.sprite_apply = Some((l.clone(), rel.clone()));
                    st.select(Some(l));
                }
                st.toast(format!("Saved {rel}"));
            }
            Err(e) => st.log(LogLevel::Error, e),
        }
    }
}

fn paint_tools(s: &mut SpriteUi, ui: &mut Ui) {
    ui.label(RichText::new("Tools").strong());
    ui.horizontal_wrapped(|ui| {
        for (t, label, tip) in [
            (Tool::Pencil, "pencil", "Pencil (1 px)"),
            (Tool::Brush, "brush", "Brush (size)"),
            (Tool::Eraser, "eraser", "Eraser"),
            (Tool::Fill, "paint-bucket", "Flood fill"),
            (Tool::Line, "line", "Line"),
            (Tool::Rect, "square", "Rectangle"),
            (Tool::Ellipse, "circle", "Ellipse"),
            (Tool::Eyedropper, "pipette", "Pick colour"),
            (Tool::Select, "box-select", "Select"),
            (Tool::Move, "move", "Move selection"),
        ] {
            if crate::icons::button(ui, label, tip, s.tool == t).clicked() {
                s.tool = t;
            }
        }
    });
    ui.add(
        egui::DragValue::new(&mut s.size)
            .range(1..=32)
            .prefix("size "),
    );
    ui.checkbox(&mut s.filled, "filled shapes");
    ui.add(
        egui::DragValue::new(&mut s.tolerance)
            .range(0..=255)
            .prefix("fill tolerance "),
    );
    ui.separator();
    ui.label(RichText::new("Colour").strong());
    let mut c = Color32::from_rgba_unmultiplied(s.color[0], s.color[1], s.color[2], s.color[3]);
    if ui.color_edit_button_srgba(&mut c).changed() {
        s.color = c.to_srgba_unmultiplied();
    }
    ui.horizontal_wrapped(|ui| {
        for p in s.palette.clone() {
            let col = Color32::from_rgba_unmultiplied(p[0], p[1], p[2], p[3]);
            let (r, resp) = ui.allocate_exact_size(Vec2::splat(18.0), Sense::click());
            ui.painter().rect_filled(r, 2.0, col);
            if s.color == p {
                ui.painter().rect_stroke(
                    r,
                    2.0,
                    egui::Stroke::new(2.0_f32, Color32::WHITE),
                    egui::StrokeKind::Outside,
                );
            }
            if resp.clicked() {
                s.color = p;
            }
        }
    });
    if ui.small_button("+ Add colour to palette").clicked() && !s.palette.contains(&s.color) {
        s.palette.push(s.color);
    }
    ui.separator();
    ui.label(RichText::new("Transform").strong());
    ui.horizontal_wrapped(|ui| {
        for (label, op, icon) in [
            ("Flip H", "flip-h", "flip-horizontal"),
            ("Flip V", "flip-v", "flip-vertical"),
            ("Rotate right", "rot-cw", "rotate-cw"),
            ("Rotate left", "rot-ccw", "rotate-ccw"),
            ("Clear", "clear", "eraser"),
        ] {
            if crate::icons::label_icon(ui, icon, label)
                .on_hover_text("applies to the selection (flip/clear) or the whole image")
                .clicked()
            {
                s.transform(op);
            }
        }
    });
    if let Some((a, b, c, d)) = s.selection {
        ui.weak(format!("selection {}×{} at {a},{b}", c - a + 1, d - b + 1));
    }
}

fn settings_tools(s: &mut SpriteUi, ui: &mut Ui) {
    ui.label(RichText::new("Image settings").strong());
    ui.weak("Saved with the sprite; every object that uses it follows.");
    let mut meta = s.meta.as_object().cloned().unwrap_or_default();
    let before = meta.clone();
    for (key, label, opts, def, tip) in [
        (
            "filter",
            "Filter",
            ["linear", "nearest"],
            "linear",
            "nearest = crisp pixel art, linear = smooth",
        ),
        (
            "wrap",
            "Wrap",
            ["repeat", "clamp"],
            "repeat",
            "repeat tiles the image, clamp stretches the edge pixels",
        ),
    ] {
        let mut cur = meta
            .get(key)
            .and_then(Value::as_str)
            .unwrap_or(def)
            .to_string();
        ui.horizontal(|ui| {
            ui.label(label).on_hover_text(tip);
            egui::ComboBox::from_id_salt(key)
                .selected_text(cur.clone())
                .show_ui(ui, |ui| {
                    for o in opts {
                        ui.selectable_value(&mut cur, o.to_string(), o);
                    }
                });
        });
        meta.insert(key.into(), json!(cur));
    }
    let mut ppu = meta.get("ppu").and_then(Value::as_f64).unwrap_or(1.0);
    ui.horizontal(|ui| {
        ui.label("Pixels per unit")
            .on_hover_text("sprites are drawn at size ÷ this value");
        ui.add(
            egui::DragValue::new(&mut ppu)
                .speed(0.1)
                .range(0.01..=10000.0),
        );
    });
    meta.insert("ppu".into(), json!(ppu));
    ui.separator();
    ui.label(RichText::new("Slice into frames").strong());
    let sliced = meta.contains_key("frameWidth");
    let mut on = sliced;
    ui.checkbox(&mut on, "Sprite sheet (grid of frames)");
    if on && !sliced {
        let (w, h) = s.img.as_ref().map_or((16, 16), |i| (i.width(), i.height()));
        meta.insert("frameWidth".into(), json!(w));
        meta.insert("frameHeight".into(), json!(h));
    } else if !on && sliced {
        meta.remove("frameWidth");
        meta.remove("frameHeight");
    }
    if on {
        for (key, label) in [("frameWidth", "frame w"), ("frameHeight", "frame h")] {
            let mut v = meta.get(key).and_then(Value::as_u64).unwrap_or(16);
            ui.add(
                egui::DragValue::new(&mut v)
                    .range(1..=4096)
                    .prefix(format!("{label} ")),
            );
            meta.insert(key.into(), json!(v));
        }
    }
    if meta != before {
        s.meta = Value::Object(meta);
        s.dirty = true;
    }
}

fn points_tools(s: &mut SpriteUi, ui: &mut Ui) {
    ui.label(RichText::new("Click the image to place").strong());
    ui.radio_value(&mut s.place, Place::Origin, "Origin (pivot)");
    ui.radio_value(&mut s.place, Place::Point, "Image point");
    ui.add_enabled(
        s.place == Place::Point,
        egui::TextEdit::singleline(&mut s.point_name)
            .hint_text("point name, e.g. muzzle")
            .desired_width(150.0),
    );
    ui.radio_value(
        &mut s.place,
        Place::Vertex,
        "Collision vertex (right-click removes)",
    );
    ui.separator();
    if let Some(o) = s.meta["origin"].as_array() {
        ui.label(format!(
            "origin {:.1}, {:.1}",
            o[0].as_f64().unwrap_or(0.0),
            o[1].as_f64().unwrap_or(0.0)
        ));
    }
    let pts: Vec<(String, Value)> = s.meta["points"]
        .as_object()
        .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();
    let mut remove = None;
    for (k, v) in &pts {
        ui.horizontal(|ui| {
            ui.label(format!(
                "{k}: {:.0}, {:.0}",
                v[0].as_f64().unwrap_or(0.0),
                v[1].as_f64().unwrap_or(0.0)
            ));
            if crate::icons::mini(ui, "x", "Remove point").clicked() {
                remove = Some(k.clone());
            }
        });
    }
    if let Some(k) = remove {
        s.meta["points"].as_object_mut().map(|o| o.remove(&k));
        s.dirty = true;
    }
    ui.separator();
    ui.label(RichText::new("Collision polygon").strong());
    let n = s.meta["collision"].as_array().map_or(0, Vec::len);
    ui.weak(format!("{n} vertices"));
    ui.add(
        egui::DragValue::new(&mut s.trace_threshold)
            .range(0..=254)
            .prefix("alpha > "),
    );
    ui.add(
        egui::DragValue::new(&mut s.trace_points)
            .range(3..=64)
            .prefix("max points "),
    );
    ui.horizontal(|ui| {
        if ui
            .button("Auto-trace")
            .on_hover_text("outline of the opaque pixels")
            .clicked()
        {
            s.auto_trace();
        }
        if ui.button("Clear").clicked() {
            s.meta.as_object_mut().map(|o| o.remove("collision"));
            s.dirty = true;
        }
    });
    if let Some(fw) = s.meta["frameWidth"].as_u64() {
        ui.separator();
        ui.label(RichText::new("Frame properties").strong());
        let cols = s
            .img
            .as_ref()
            .map_or(1, |i| (i.width() as u64 / fw.max(1)).max(1)) as usize;
        let rows = s.img.as_ref().map_or(1, |i| {
            (i.height() as u64 / s.meta["frameHeight"].as_u64().unwrap_or(fw).max(1)).max(1)
        }) as usize;
        ui.add(
            egui::DragValue::new(&mut s.frame)
                .range(0..=(cols * rows).saturating_sub(1))
                .prefix("frame "),
        );
        let cur = s.meta["frameProps"][s.frame.to_string()].clone();
        let mut dur = cur["duration"].as_f64().unwrap_or(1.0);
        if ui
            .add(
                egui::DragValue::new(&mut dur)
                    .speed(0.05)
                    .range(0.1..=10.0)
                    .prefix("duration × "),
            )
            .changed()
        {
            let f = s.frame;
            s.set_frame_prop(f, "duration", json!(dur));
        }
        let mut ev = cur["event"].as_str().unwrap_or("").to_string();
        if ui
            .add(
                egui::TextEdit::singleline(&mut ev)
                    .hint_text("event on this frame")
                    .desired_width(150.0),
            )
            .changed()
        {
            let f = s.frame;
            s.set_frame_prop(f, "event", json!(ev));
        }
    }
}

fn canvas(st: &mut EditorState, ui: &mut Ui) {
    let s = &mut st.sprite;
    let Some(img) = &s.img else { return };
    let (w, h) = (img.width() as usize, img.height() as usize);
    // show a floating (being moved) selection on top of the image
    let mut shown = img.clone();
    if let Some((piece, fx, fy, _)) = &s.floating {
        pixel::paste(&mut shown, piece, *fx, *fy);
    }
    if s.tex_dirty || s.tex.is_none() || s.floating.is_some() {
        let ci = egui::ColorImage::from_rgba_unmultiplied([w, h], shown.as_raw());
        match &mut s.tex {
            Some(t) => t.set(ci, TextureOptions::NEAREST),
            None => {
                s.tex = Some(
                    ui.ctx()
                        .load_texture("sprite-editor", ci, TextureOptions::NEAREST),
                )
            }
        }
        s.tex_dirty = false;
    }
    let z = s.zoom;
    egui::ScrollArea::both().show(ui, |ui| {
        let (r, resp) = ui.allocate_exact_size(
            Vec2::new(w as f32 * z, h as f32 * z),
            Sense::click_and_drag(),
        );
        // checkerboard behind transparent pixels
        let cell = (z * 4.0).max(8.0);
        let (c1, c2) = (Color32::from_gray(52), Color32::from_gray(64));
        let painter = ui.painter_at(r);
        let (nx, ny) = (
            (r.width() / cell).ceil() as i32,
            (r.height() / cell).ceil() as i32,
        );
        for j in 0..ny {
            for i in 0..nx {
                let rr = Rect::from_min_size(
                    r.min + Vec2::new(i as f32 * cell, j as f32 * cell),
                    Vec2::splat(cell),
                );
                painter.rect_filled(rr.intersect(r), 0.0, if (i + j) % 2 == 0 { c1 } else { c2 });
            }
        }
        if let Some(t) = &s.tex {
            painter.image(
                t.id(),
                r,
                Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
                Color32::WHITE,
            );
        }
        if s.grid && z >= 6.0 {
            for x in 0..=w {
                painter.vline(
                    r.left() + x as f32 * z,
                    r.y_range(),
                    egui::Stroke::new(1.0_f32, Color32::from_white_alpha(14)),
                );
            }
            for y in 0..=h {
                painter.hline(
                    r.x_range(),
                    r.top() + y as f32 * z,
                    egui::Stroke::new(1.0_f32, Color32::from_white_alpha(14)),
                );
            }
        }
        if let Some((a, b, c, d)) = s.selection {
            let sr = Rect::from_min_max(
                r.min + Vec2::new(a as f32 * z, b as f32 * z),
                r.min + Vec2::new((c + 1) as f32 * z, (d + 1) as f32 * z),
            );
            painter.rect_stroke(
                sr,
                0.0,
                egui::Stroke::new(1.5_f32, Color32::from_rgb(120, 200, 255)),
                egui::StrokeKind::Outside,
            );
        }
        let to_px = |p: Pos2| {
            (
                (((p.x - r.left()) / z).floor() as i32),
                (((p.y - r.top()) / z).floor() as i32),
            )
        };
        let to_f = |p: Pos2| (((p.x - r.left()) / z) as f64, ((p.y - r.top()) / z) as f64);
        match s.mode {
            Mode::Paint => {
                let pos = resp.interact_pointer_pos().or(resp.hover_pos());
                if let Some(p) = pos {
                    let (x, y) = to_px(p);
                    if resp.drag_started_by(egui::PointerButton::Primary)
                        || (resp.clicked_by(egui::PointerButton::Primary) && !resp.dragged())
                    {
                        s.pointer(Phase::Down, x, y);
                        if resp.clicked() && !resp.dragged() {
                            s.pointer(Phase::Up, x, y);
                        }
                    } else if resp.dragged_by(egui::PointerButton::Primary) {
                        s.pointer(Phase::Move, x, y);
                    }
                    if resp.drag_stopped() {
                        s.pointer(Phase::Up, x, y);
                    }
                    if resp.secondary_clicked() {
                        let t = s.tool;
                        s.tool = Tool::Eyedropper;
                        s.pointer(Phase::Down, x, y);
                        s.tool = t;
                    }
                }
            }
            Mode::Settings => {}
            Mode::Points => {
                if let Some(p) = resp.interact_pointer_pos() {
                    let (x, y) = to_f(p);
                    if resp.clicked_by(egui::PointerButton::Primary) {
                        match s.place {
                            Place::Origin => {
                                s.set_origin((x * 2.0).round() / 2.0, (y * 2.0).round() / 2.0)
                            }
                            Place::Point if !s.point_name.trim().is_empty() => {
                                let n = s.point_name.trim().to_string();
                                s.set_point(&n, x.round(), y.round());
                            }
                            Place::Vertex => s.add_vertex(x.round(), y.round()),
                            _ => {}
                        }
                    } else if resp.secondary_clicked() && s.place == Place::Vertex {
                        s.remove_nearest_vertex(x, y);
                    }
                }
                // overlays
                let at = |x: f64, y: f64| r.min + Vec2::new(x as f32 * z, y as f32 * z);
                if let Some(poly) = s.meta["collision"].as_array() {
                    let pts: Vec<Pos2> = poly
                        .iter()
                        .map(|v| at(v[0].as_f64().unwrap_or(0.0), v[1].as_f64().unwrap_or(0.0)))
                        .collect();
                    if pts.len() >= 2 {
                        painter.add(egui::Shape::closed_line(
                            pts.clone(),
                            egui::Stroke::new(2.0_f32, Color32::from_rgb(107, 255, 138)),
                        ));
                    }
                    for p in pts {
                        painter.circle_filled(p, 3.5, Color32::from_rgb(107, 255, 138));
                    }
                }
                if let Some(o) = s.meta["origin"].as_array() {
                    let p = at(o[0].as_f64().unwrap_or(0.0), o[1].as_f64().unwrap_or(0.0));
                    let st = egui::Stroke::new(2.0_f32, Color32::from_rgb(255, 100, 100));
                    painter.line_segment([p - Vec2::new(8.0, 0.0), p + Vec2::new(8.0, 0.0)], st);
                    painter.line_segment([p - Vec2::new(0.0, 8.0), p + Vec2::new(0.0, 8.0)], st);
                }
                if let Some(pts) = s.meta["points"].as_object() {
                    for (k, v) in pts {
                        let p = at(v[0].as_f64().unwrap_or(0.0), v[1].as_f64().unwrap_or(0.0));
                        painter.circle_stroke(
                            p,
                            5.0,
                            egui::Stroke::new(2.0_f32, Color32::from_rgb(255, 209, 102)),
                        );
                        painter.text(
                            p + Vec2::new(8.0, -8.0),
                            egui::Align2::LEFT_BOTTOM,
                            k,
                            egui::FontId::proportional(11.0),
                            Color32::from_rgb(255, 209, 102),
                        );
                    }
                }
            }
        }
    });
}

#[cfg(test)]
mod link_tests {
    use super::*;

    #[test]
    fn apply_texture_sets_first_sprite_component() {
        let mut e = nord_core::scene::Entity::new("S");
        assert!(!apply_texture(&mut e, "a.png"));
        e.components.push(
            serde_json::from_value(json!({"type":"sprite","texture":DEFAULT_SPRITE})).unwrap(),
        );
        assert!(apply_texture(&mut e, "assets/sprites/hero.png"));
        assert_eq!(e.components[0].fields["texture"], "assets/sprites/hero.png");
    }

    #[test]
    fn unique_name_skips_existing_files() {
        let d = std::env::temp_dir().join(format!("nord-sprite-{}", std::process::id()));
        std::fs::create_dir_all(d.join(SPRITES_DIR)).unwrap();
        assert_eq!(unique_sprite_name(&d, "sprite"), "sprite");
        std::fs::write(d.join(SPRITES_DIR).join("sprite.png"), b"").unwrap();
        assert_eq!(unique_sprite_name(&d, "sprite"), "sprite-2");
        let _ = std::fs::remove_dir_all(&d);
    }
}
