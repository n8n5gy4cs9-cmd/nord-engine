//! Autocomplete sources: nord.js API names (from docs/SCRIPTING_API.md) + snippets.

pub struct Item {
    pub label: String,
    pub insert: String,
    pub detail: &'static str,
}

const API: &[(&str, &str)] = &[
    ("this.entity", "Entity"),
    ("this.scene", "Scene"),
    ("this.game", "Game"),
    ("this.attrs", "script attributes"),
    ("this.input.down('')", "action held"),
    ("this.input.pressed('')", "action pressed this frame"),
    ("this.input.released('')", "action released this frame"),
    ("this.input.axis('left', 'right')", "-1..1"),
    ("this.input.vec('left', 'right', 'up', 'down')", "{x,y}"),
    ("this.input.key('KeyW')", "raw key"),
    ("this.input.pointer", "{x,y,worldX,worldY,down}"),
    ("this.audio.play('')", "play sound"),
    ("this.time", "time info"),
    ("this.events.emit('')", "emit event"),
    ("this.events.on('', (e) => {})", "listen"),
    ("this.ui", "UI builder"),
    ("this.physics", "physics helpers"),
    ("this.save", "save/load"),
    ("this.rng", "seeded random"),
    ("this.tween({})", "tween"),
    ("this.after(1, () => {})", "run later"),
    ("this.every(1, () => {})", "repeat"),
    ("entity.find('')", "find by name"),
    ("entity.findByTag('')", "find by tag"),
    ("entity.getComponent('')", "component"),
    ("entity.addComponent('', {})", "add component"),
    ("entity.getScript()", "script instance"),
    ("entity.destroy()", "destroy"),
    ("entity.clone()", "clone"),
    ("entity.pos", "position"),
    ("entity.rot", "rotation"),
    ("entity.scale", "scale"),
    ("entity.worldPos", "world position"),
    ("entity.native", "Phaser/Babylon object"),
    ("NordScript", "base class"),
    ("static attributes = {}", "inspector fields"),
    ("onCollisionEnter(other, contact) {}", "hook"),
    ("onCollisionExit(other) {}", "hook"),
    ("onTriggerEnter(other) {}", "hook"),
    ("onTriggerExit(other) {}", "hook"),
    ("fixedUpdate(dt) {}", "hook"),
    ("lateUpdate(dt) {}", "hook"),
    ("onEnable() {}", "hook"),
    ("onDisable() {}", "hook"),
    ("onDestroy() {}", "hook"),
];

const SNIPPETS: &[(&str, &str)] = &[
    ("script", "import { NordScript } from 'nord';\n\nexport default class MyScript extends NordScript {\n  static attributes = {\n    speed: { type: 'number', default: 100 },\n  };\n\n  start() {}\n\n  update(dt) {}\n}\n"),
    ("update", "update(dt) {\n  \n}"),
    ("start", "start() {\n  \n}"),
    ("attr", "speed: { type: 'number', default: 1, min: 0, max: 10 },"),
    ("for", "for (let i = 0; i < n; i++) {\n  \n}"),
    ("fn", "function name() {\n  \n}"),
    ("log", "console.log();"),
];

pub fn candidates(prefix: &str, text: &str) -> Vec<Item> {
    if prefix.is_empty() {
        return vec![];
    }
    let p = prefix.to_lowercase();
    let mut out: Vec<Item> = vec![];
    for (s, body) in SNIPPETS {
        if s.starts_with(&p) && *s != prefix {
            out.push(Item { label: format!("{s} (snippet)"), insert: body.to_string(), detail: "snippet" });
        }
    }
    for (a, d) in API {
        if a.to_lowercase().starts_with(&p) && *a != prefix {
            out.push(Item { label: a.to_string(), insert: a.to_string(), detail: d });
        }
    }
    // words already in the file
    let mut words: Vec<&str> = text
        .split(|c: char| !(c.is_alphanumeric() || c == '_' || c == '$'))
        .filter(|w| w.len() > 2 && w.to_lowercase().starts_with(&p) && *w != prefix)
        .collect();
    words.sort_unstable();
    words.dedup();
    for w in words.into_iter().take(6) {
        out.push(Item { label: w.to_string(), insert: w.to_string(), detail: "word" });
    }
    out.truncate(10);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn completes_api_snippets_and_words() {
        let c = candidates("this.inp", "");
        assert!(c.iter().any(|i| i.label.starts_with("this.input.down")));
        let c = candidates("upd", "let updater = 1");
        assert!(c.iter().any(|i| i.detail == "snippet" && i.insert.starts_with("update(dt)")));
        assert!(c.iter().any(|i| i.label == "updater"));
        assert!(candidates("", "x").is_empty());
    }
}
