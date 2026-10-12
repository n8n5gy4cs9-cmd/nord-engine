//! Nord desktop backend (ADR-020, docs/DESKTOP_APPS.md). One set of services, two front-ends: the JS bridge ([`bridge::Bridge`], used by
//! `nord-player` over wry IPC and by `nord serve` over HTTP) and Rust apps (`nord-app-wasm`). Every call is checked against the app's
//! [`caps::Permissions`]. OS services sit behind traits ([`services`]); `native` implements them, [`services::Headless`] is scripted for tests/CI.
pub mod bridge;
pub mod caps;
pub mod fs;
pub mod lifecycle;
pub mod paths;
pub mod process;
pub mod services;
pub mod store;
pub mod window;

use serde::Serialize;
use std::sync::Arc;

/// Error with a stable machine code (JS gets `{code, message}`).
#[derive(Debug, thiserror::Error, Serialize, Clone, PartialEq)]
#[error("{code}: {message}")]
pub struct DesktopError {
    /// `denied` | `unsupported` | `not_found` | `invalid` | `io` | `cancelled`
    pub code: &'static str,
    pub message: String,
}
impl DesktopError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    pub fn denied(m: impl Into<String>) -> Self {
        Self::new("denied", m)
    }
    pub fn unsupported(m: impl Into<String>) -> Self {
        Self::new("unsupported", m)
    }
    pub fn invalid(m: impl Into<String>) -> Self {
        Self::new("invalid", m)
    }
}
impl From<std::io::Error> for DesktopError {
    fn from(e: std::io::Error) -> Self {
        let code = if e.kind() == std::io::ErrorKind::NotFound {
            "not_found"
        } else {
            "io"
        };
        Self::new(code, e.to_string())
    }
}
pub type Result<T> = std::result::Result<T, DesktopError>;

/// Everything an app can use, wired to one permission set.
pub struct Desktop {
    pub app_id: String,
    pub caps: Arc<caps::Permissions>,
    pub roots: Arc<paths::Roots>,
    pub fs: fs::ScopedFs,
    pub store: store::Store,
    pub dialogs: Box<dyn services::Dialogs>,
    pub notifier: Box<dyn services::Notifier>,
    pub clipboard: Box<dyn services::Clipboard>,
    pub shell: Box<dyn services::Shell>,
    pub secrets: Box<dyn services::Secrets>,
    pub audit: caps::Audit,
}

impl Desktop {
    /// Native services when built with `native`, otherwise [`services::Headless`].
    pub fn new(
        app_id: &str,
        caps: caps::Permissions,
        base: Option<std::path::PathBuf>,
    ) -> Result<Self> {
        let roots = Arc::new(match base {
            Some(b) => paths::Roots::with_base(app_id, &b),
            None => paths::Roots::system(app_id),
        });
        #[cfg(feature = "native")]
        let (dialogs, notifier, clipboard, shell) = services::native::all();
        #[cfg(not(feature = "native"))]
        let (dialogs, notifier, clipboard, shell) = {
            let h = services::Headless::default();
            (
                Box::new(h.clone()) as Box<dyn services::Dialogs>,
                Box::new(h.clone()) as Box<dyn services::Notifier>,
                Box::new(h.clone()) as Box<dyn services::Clipboard>,
                Box::new(h) as Box<dyn services::Shell>,
            )
        };
        Self::with_services(app_id, caps, roots, dialogs, notifier, clipboard, shell)
    }

    pub fn with_services(
        app_id: &str,
        caps: caps::Permissions,
        roots: Arc<paths::Roots>,
        dialogs: Box<dyn services::Dialogs>,
        notifier: Box<dyn services::Notifier>,
        clipboard: Box<dyn services::Clipboard>,
        shell: Box<dyn services::Shell>,
    ) -> Result<Self> {
        let caps = Arc::new(caps);
        std::fs::create_dir_all(roots.app_data())?;
        Ok(Self {
            app_id: app_id.into(),
            fs: fs::ScopedFs::new(caps.clone(), roots.clone()),
            store: store::Store::open(roots.app_data().join("store.json"))?,
            audit: caps::Audit::new(roots.app_data().join("audit.log")),
            caps,
            roots,
            secrets: {
                #[cfg(feature = "keychain")]
                {
                    Box::new(services::Keychain)
                }
                #[cfg(not(feature = "keychain"))]
                {
                    Box::new(services::MemorySecrets::default())
                }
            },
            dialogs,
            notifier,
            clipboard,
            shell,
        })
    }
}
