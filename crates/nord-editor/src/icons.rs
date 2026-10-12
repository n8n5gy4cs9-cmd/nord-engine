//! Lucide icons (assets/icons/lucide, ISC) embedded as SVG; `currentColor` is replaced so egui can tint them.
use egui::{Color32, Image, ImageSource, Ui, Vec2};
use std::{borrow::Cow, sync::Arc};

macro_rules! icons {
    ($($name:literal),* $(,)?) => {
        fn svg(name: &str) -> Option<&'static str> {
            match name {
                $($name => Some(include_str!(concat!("../../../assets/icons/lucide/", $name, ".svg"))),)*
                _ => None,
            }
        }
    };
}

icons!(
    "play", "square", "refresh-cw", "move", "rotate-cw", "scaling", "grid-3x3", "magnet", "plus", "trash-2", "copy",
    "folder", "folder-open", "file", "file-code", "file-text", "image", "music", "box", "boxes", "search", "settings",
    "book-open", "terminal", "save", "undo-2", "redo-2", "x", "chevron-right", "chevron-down", "eye", "eye-off",
    "layers", "package", "film", "map", "library", "alert-circle", "alert-triangle", "info", "download", "upload",
    "video", "lightbulb", "type", "component", "sparkles", "crosshair", "pencil", "home", "external-link",
);

pub fn source(name: &'static str) -> ImageSource<'static> {
    let s = svg(name).unwrap_or("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'/>");
    let s = s.replace("currentColor", "#ffffff");
    ImageSource::Bytes {
        uri: Cow::Owned(format!("bytes://lucide/{name}.svg")),
        bytes: egui::load::Bytes::Shared(Arc::from(s.into_bytes().into_boxed_slice())),
    }
}

pub fn icon(name: &'static str, size: f32, tint: Color32) -> Image<'static> {
    Image::new(source(name)).fit_to_exact_size(Vec2::splat(size)).tint(tint)
}

/// Icon-only button with tooltip.
pub fn button(ui: &mut Ui, name: &'static str, tip: &str, selected: bool) -> egui::Response {
    let tint = if selected { ui.visuals().selection.stroke.color } else { ui.visuals().text_color() };
    let b = egui::Button::image(icon(name, 16.0, tint)).selected(selected);
    ui.add(b).on_hover_text(tip)
}

pub fn label_icon(ui: &mut Ui, name: &'static str, text: &str) -> egui::Response {
    let tint = ui.visuals().text_color();
    ui.add(egui::Button::image_and_text(icon(name, 14.0, tint), text))
}
