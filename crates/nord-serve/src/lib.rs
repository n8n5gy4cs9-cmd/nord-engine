//! `nord serve` (also embedded in the editor). The server itself is native-only; `Hub`/`LogEntry` build everywhere so the
//! web editor (wasm32) shares the same viewport message types.
mod hub;
pub use hub::{Hub, LogEntry};

#[cfg(not(target_arch = "wasm32"))]
mod server;
#[cfg(not(target_arch = "wasm32"))]
pub use server::*;
