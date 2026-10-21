//! WKWebView denies DOM pointer lock unless its host answers this delegate callback.
//! WebKit currently exposes it as SPI; keep this compatibility shim isolated.
use objc2::{
    msg_send,
    runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel},
    sel,
};
use std::{ffi::CStr, sync::OnceLock};
use wry::WebViewExtMacOS;

fn permitted(host: &str, key_window: bool) -> bool {
    key_window && host == "127.0.0.1"
}

extern "C-unwind" fn request(
    _delegate: &AnyObject,
    _selector: Sel,
    view: &AnyObject,
    completion: &block2::Block<dyn Fn(Bool)>,
) {
    // WebKit already enforces the DOM user gesture and iframe permissions.
    // Restrict the host grant to the focused editor's loopback game server.
    let allow = unsafe {
        let window: Option<&AnyObject> = msg_send![view, window];
        let focused: Bool = window
            .map(|w| msg_send![w, isKeyWindow])
            .unwrap_or(Bool::NO);
        let url: Option<&AnyObject> = msg_send![view, URL];
        let host: Option<&AnyObject> = url.and_then(|u| msg_send![u, host]);
        let host = host.map(|h| {
            let ptr: *const std::ffi::c_char = msg_send![h, UTF8String];
            CStr::from_ptr(ptr).to_string_lossy()
        });
        permitted(host.as_deref().unwrap_or(""), focused.as_bool())
    };
    completion.call((Bool::new(allow),));
}

pub fn install(webview: &wry::WebView) {
    static CLASS: OnceLock<&'static AnyClass> = OnceLock::new();
    let view = webview.webview();
    unsafe {
        let delegate: Option<&AnyObject> = msg_send![&*view, UIDelegate];
        let Some(delegate) = delegate else { return };
        let implemented: Bool = msg_send![delegate, respondsToSelector: sel!(_webViewDidRequestPointerLock:completionHandler:)];
        if implemented.as_bool() {
            return;
        }
        let subclass = CLASS.get_or_init(|| {
            let mut builder = ClassBuilder::new(c"NordPointerLockUIDelegate", delegate.class())
                .expect("unique pointer-lock delegate class");
            builder.add_method(
                sel!(_webViewDidRequestPointerLock:completionHandler:),
                request as extern "C-unwind" fn(_, _, _, _),
            );
            builder.register()
        });
        // Add no ivars and override no existing methods: Wry owns/retains the
        // same delegate, whose upload/media handlers remain inherited.
        AnyObject::set_class(delegate, subclass);
        // WebKit caches respondsToSelector when the delegate is assigned.
        let _: () = msg_send![&*view, setUIDelegate: delegate];
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_focused_loopback_content_can_capture() {
        assert!(permitted("127.0.0.1", true));
        assert!(!permitted("127.0.0.1", false));
        assert!(!permitted("example.com", true));
        assert!(!permitted("", true));
    }
}
