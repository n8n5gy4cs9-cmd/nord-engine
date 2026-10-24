//! Lucide icons (assets/icons/lucide, ISC) embedded as SVG; `currentColor` is replaced so egui can tint them.
use egui::{Color32, Image, ImageSource, Ui, Vec2};
use std::{borrow::Cow, sync::Arc};

macro_rules! icons {
    ($($name:literal),* $(,)?) => {
        fn svg(name: &str) -> Option<&'static str> {
            match name {
                $($name => Some(include_str!(concat!("../../../assets/icons/lucide/", $name, ".svg"))),)*
                // a few simple icons drawn for Nord (assets/icons/nord, same stroke style as Lucide)
                "paint-bucket" => Some(include_str!("../../../assets/icons/nord/paint-bucket.svg")),
                "flip-horizontal" => Some(include_str!("../../../assets/icons/nord/flip-horizontal.svg")),
                "flip-vertical" => Some(include_str!("../../../assets/icons/nord/flip-vertical.svg")),
                "line" => Some(include_str!("../../../assets/icons/nord/line.svg")),
                "folder-fill" => Some(include_str!("../../../assets/icons/nord/folder-fill.svg")),
                "box-select" => Some(include_str!("../../../assets/icons/nord/box-select.svg")),
                _ => None,
            }
        }
    };
}

icons!(
    "play",
    "square",
    "refresh-cw",
    "move",
    "rotate-cw",
    "scaling",
    "hand",
    "globe",
    "grid-3x3",
    "magnet",
    "plus",
    "trash-2",
    "copy",
    "folder",
    "folder-open",
    "file",
    "file-code",
    "file-text",
    "image",
    "music",
    "box",
    "boxes",
    "search",
    "settings",
    "book-open",
    "terminal",
    "layout-grid",
    "list",
    "save",
    "undo-2",
    "redo-2",
    "x",
    "chevron-right",
    "chevron-down",
    "eye",
    "eye-off",
    "layers",
    "package",
    "film",
    "map",
    "library",
    "alert-circle",
    "alert-triangle",
    "info",
    "download",
    "upload",
    "video",
    "lightbulb",
    "type",
    "component",
    "sparkles",
    "crosshair",
    "pencil",
    "home",
    "external-link",
    "arrow-up",
    "arrow-down",
    "lock",
    "unlock",
    "grip-vertical",
    "brush",
    "eraser",
    "pipette",
    "circle",
    "rotate-ccw",
    "minus",
    "camera",
    "star",
    "more-vertical",
    "focus",
    "git-branch",
    "workflow",
    "users",
    "bug",
    "zap",
    "scissors",
    "clipboard",
    "clipboard-paste",
    "maximize",
    "hammer",
);

/// Lucide icon that stands for a component type in the Inspector header (falls back to the generic component icon).
pub fn component_icon(kind: &str) -> &'static str {
    match kind {
        "model" | "mesh" => "box",
        "sprite" | "animatedSprite" | "uiImage" | "parallax" => "image",
        "tilemap" => "grid-3x3",
        "text" | "uiLabel" => "type",
        "camera" => "camera",
        "light" => "lightbulb",
        "material" | "skybox" => "brush",
        "rigidbody" | "collider" | "trigger" => "magnet",
        "audioSource" | "audioListener" => "music",
        "uiPanel" | "uiButton" | "uiBar" => "layout-grid",
        "particles" | "postProcess" => "sparkles",
        "path" => "line",
        "spawner" => "plus",
        "graph" => "workflow",
        "animator" => "film",
        "netSync" => "globe",
        _ => "component",
    }
}

pub fn source(name: &'static str) -> ImageSource<'static> {
    let s = svg(name).unwrap_or("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/>");
    let s = s.replace("currentColor", "#ffffff");
    ImageSource::Bytes {
        uri: Cow::Owned(format!("bytes://lucide/{name}.svg")),
        bytes: egui::load::Bytes::Shared(Arc::from(s.into_bytes().into_boxed_slice())),
    }
}

/// Colour of a type icon (PlayCanvas-style coloured asset/entity icons). `fallback` is used for icons without a colour.
pub fn kind_color(name: &str, fallback: Color32) -> Color32 {
    match name {
        "folder" | "folder-open" | "folder-fill" => Color32::from_rgb(232, 168, 56),
        "image" => Color32::from_rgb(108, 203, 122),
        "music" => Color32::from_rgb(181, 140, 240),
        "box" | "boxes" => Color32::from_rgb(76, 201, 216),
        "map" => Color32::from_rgb(255, 138, 61),
        "package" => Color32::from_rgb(90, 169, 255),
        "film" | "video" => Color32::from_rgb(224, 123, 208),
        "file-code" => Color32::from_rgb(121, 184, 255),
        "lightbulb" => Color32::from_rgb(255, 214, 90),
        "type" => Color32::from_rgb(160, 180, 200),
        "component" => Color32::from_rgb(159, 179, 217),
        "star" => Color32::from_rgb(255, 214, 90),
        "workflow" => Color32::from_rgb(110, 170, 255),
        "circle" => Color32::from_rgb(240, 120, 160),
        _ => fallback,
    }
}

/// Collapsing-header arrow in the accent colour (PlayCanvas-style orange ▼ / ▶): `CollapsingHeader::new(..).icon(icons::accent_arrow)`.
pub fn accent_arrow(ui: &mut Ui, openness: f32, response: &egui::Response) {
    let c = if response.hovered() {
        ui.visuals().strong_text_color()
    } else {
        ui.visuals().hyperlink_color
    };
    let r = response.rect;
    let (cx, cy, s) = (r.center().x, r.center().y, r.width().min(r.height()) * 0.28);
    let pts = if openness > 0.5 {
        vec![
            egui::pos2(cx - s, cy - s * 0.6),
            egui::pos2(cx + s, cy - s * 0.6),
            egui::pos2(cx, cy + s * 0.8),
        ]
    } else {
        vec![
            egui::pos2(cx - s * 0.6, cy - s),
            egui::pos2(cx - s * 0.6, cy + s),
            egui::pos2(cx + s * 0.8, cy),
        ]
    };
    ui.painter()
        .add(egui::Shape::convex_polygon(pts, c, egui::Stroke::NONE));
}

pub fn icon(name: &'static str, size: f32, tint: Color32) -> Image<'static> {
    Image::new(source(name))
        .fit_to_exact_size(Vec2::splat(size))
        .tint(tint)
}

/// Icon-only button with tooltip. Drawn by hand: `egui::Button::image` sizes a not-yet-loaded image to *all* remaining
/// space, which starves the next widget (negative sizes -> panic) on the first frame.
pub fn button(ui: &mut Ui, name: &'static str, tip: &str, selected: bool) -> egui::Response {
    let side = ui.spacing().interact_size.y.max(20.0);
    let (rect, resp) = ui.allocate_exact_size(Vec2::splat(side), egui::Sense::click());
    resp.widget_info(|| {
        egui::WidgetInfo::selected(egui::WidgetType::Button, ui.is_enabled(), selected, tip)
    });
    if ui.is_rect_visible(rect) {
        let v = ui.style().interact_selectable(&resp, selected);
        let fill = if selected {
            ui.visuals().selection.bg_fill
        } else if resp.hovered() {
            v.bg_fill
        } else {
            Color32::TRANSPARENT
        };
        ui.painter().rect_filled(rect, v.corner_radius, fill);
        let r = egui::Rect::from_center_size(rect.center(), Vec2::splat(15.0));
        let c = if selected {
            ui.visuals().hyperlink_color
        } else {
            v.fg_stroke.color
        };
        icon(name, 15.0, c).paint_at(ui, r);
    }
    resp.on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text(tip)
}

pub fn label_icon(ui: &mut Ui, name: &'static str, text: &str) -> egui::Response {
    let tint = ui.visuals().text_color();
    ui.add(egui::Button::image_and_text(icon(name, 14.0, tint), text))
}

/// Small (20 px) icon-only button for dense rows (reorder, delete, duplicate…). The tooltip is also its accessible name.
pub fn mini(ui: &mut Ui, name: &'static str, tip: &str) -> egui::Response {
    mini_toggle(ui, name, tip, false)
}

pub fn mini_toggle(ui: &mut Ui, name: &'static str, tip: &str, selected: bool) -> egui::Response {
    let (rect, resp) = ui.allocate_exact_size(Vec2::splat(20.0), egui::Sense::click());
    resp.widget_info(|| {
        egui::WidgetInfo::selected(egui::WidgetType::Button, ui.is_enabled(), selected, tip)
    });
    if ui.is_rect_visible(rect) {
        let v = ui.style().interact_selectable(&resp, selected);
        let fill = if selected {
            ui.visuals().selection.bg_fill
        } else if resp.hovered() {
            v.bg_fill
        } else {
            Color32::TRANSPARENT
        };
        ui.painter().rect_filled(rect, v.corner_radius, fill);
        icon(name, 13.0, v.fg_stroke.color).paint_at(
            ui,
            egui::Rect::from_center_size(rect.center(), Vec2::splat(13.0)),
        );
    }
    resp.on_hover_cursor(egui::CursorIcon::PointingHand)
        .on_hover_text(tip)
}
