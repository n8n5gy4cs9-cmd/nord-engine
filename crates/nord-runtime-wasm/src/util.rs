use macroquad::prelude::{Color, KeyCode, Vec2};
use serde_json::Value;

/// `#rgb`, `#rrggbb` or `#rrggbbaa` → Color (white on parse failure).
pub fn parse_color(s: &str) -> Color {
    let h = s.trim_start_matches('#');
    let p = |i: usize, n: usize| u8::from_str_radix(&h[i..i + n], 16).ok();
    let v = match h.len() {
        3 => (|| Some((p(0, 1)? * 17, p(1, 1)? * 17, p(2, 1)? * 17, 255)))(),
        6 => (|| Some((p(0, 2)?, p(2, 2)?, p(4, 2)?, 255)))(),
        8 => (|| Some((p(0, 2)?, p(2, 2)?, p(4, 2)?, p(6, 2)?)))(),
        _ => None,
    };
    v.map(|(r, g, b, a)| Color::from_rgba(r, g, b, a)).unwrap_or(macroquad::color::WHITE)
}

/// Browser-style key code names used in `nord.project.json` (`KeyA`, `ArrowLeft`, `Space`, `Digit1`, `ShiftLeft`…).
pub fn keycode(name: &str) -> Option<KeyCode> {
    use KeyCode::*;
    if let Some(c) = name.strip_prefix("Key").and_then(|s| s.chars().next()).filter(|_| name.len() == 4) {
        return Some(match c {
            'A' => A, 'B' => B, 'C' => C, 'D' => D, 'E' => E, 'F' => F, 'G' => G, 'H' => H, 'I' => I, 'J' => J, 'K' => K, 'L' => L, 'M' => M,
            'N' => N, 'O' => O, 'P' => P, 'Q' => Q, 'R' => R, 'S' => S, 'T' => T, 'U' => U, 'V' => V, 'W' => W, 'X' => X, 'Y' => Y, 'Z' => Z,
            _ => return None,
        });
    }
    Some(match name {
        "Digit0" => Key0, "Digit1" => Key1, "Digit2" => Key2, "Digit3" => Key3, "Digit4" => Key4, "Digit5" => Key5, "Digit6" => Key6, "Digit7" => Key7, "Digit8" => Key8, "Digit9" => Key9,
        "ArrowLeft" => Left, "ArrowRight" => Right, "ArrowUp" => Up, "ArrowDown" => Down,
        "Space" => Space, "Enter" => Enter, "Escape" => Escape, "Tab" => Tab, "Backspace" => Backspace,
        "ShiftLeft" => LeftShift, "ShiftRight" => RightShift, "ControlLeft" => LeftControl, "ControlRight" => RightControl, "AltLeft" => LeftAlt, "AltRight" => RightAlt,
        "F1" => F1, "F2" => F2, "F3" => F3, "F4" => F4, "F5" => F5, "F6" => F6, "F7" => F7, "F8" => F8, "F9" => F9, "F10" => F10, "F11" => F11, "F12" => F12,
        _ => return None,
    })
}

pub fn f(v: &Value, key: &str, d: f32) -> f32 {
    v.get(key).and_then(Value::as_f64).map_or(d, |x| x as f32)
}
pub fn s<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str)
}
pub fn b(v: &Value, key: &str, d: bool) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(d)
}
pub fn v2(v: &Value, key: &str) -> Option<Vec2> {
    let a = v.get(key)?.as_array()?;
    Some(Vec2::new(a.first()?.as_f64()? as f32, a.get(1)?.as_f64()? as f32))
}
