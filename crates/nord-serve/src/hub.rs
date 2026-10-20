//! Portable part of nord-serve (compiles for wasm32 too): the shared editor <-> viewport/game state.
use std::sync::Mutex;
use tokio::sync::broadcast;

/// Shared state between the server and an in-process embedder (the editor): game console, viewport messages, commands.
pub struct Hub {
    pub logs: Mutex<Vec<LogEntry>>,
    /// viewport -> editor messages (selection, transforms, ...)
    pub inbox: Mutex<Vec<serde_json::Value>>,
    /// editor -> viewport commands (JSON strings), delivered over SSE
    pub edit_tx: broadcast::Sender<String>,
    pub reload_tx: broadcast::Sender<Vec<String>>,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct LogEntry {
    pub level: String,
    pub text: String,
}
