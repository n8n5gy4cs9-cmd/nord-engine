//! Sandboxed process spawning (program-name allow-list, no shell) and the HTTP client (host allow-list).
use crate::{caps::Permissions, DesktopError, Result};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct Output {
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

/// Runs `program` (a bare name listed in `process`; never a path, never through a shell) and waits.
pub fn run(
    caps: &Permissions,
    program: &str,
    args: &[String],
    cwd: Option<&std::path::Path>,
) -> Result<Output> {
    if program.is_empty() || program.contains(['/', '\\', '\0']) {
        return Err(DesktopError::denied("program must be a bare name"));
    }
    caps.require(
        caps.process.iter().any(|p| p == program),
        &format!("process:{program}"),
    )?;
    let mut c = std::process::Command::new(program);
    c.args(args);
    if let Some(d) = cwd {
        c.current_dir(d);
    }
    let o = c.output()?;
    Ok(Output {
        code: o.status.code(),
        stdout: String::from_utf8_lossy(&o.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&o.stderr).into_owned(),
    })
}

pub fn host_of(url: &str) -> Option<String> {
    let rest = url.split_once("://")?.1;
    let auth = rest.split(['/', '?', '#']).next()?;
    let auth = auth.rsplit('@').next()?; // strip userinfo
    let host = if let Some(h) = auth.strip_prefix('[') {
        h.split(']').next()?
    } else {
        auth.split(':').next()?
    };
    (!host.is_empty()).then(|| host.to_ascii_lowercase())
}

#[cfg(feature = "http")]
pub fn fetch(
    caps: &Permissions,
    method: &str,
    url: &str,
    headers: &[(String, String)],
    body: Option<&str>,
) -> Result<(u16, String)> {
    let host = host_of(url).ok_or_else(|| DesktopError::invalid("bad URL"))?;
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err(DesktopError::invalid("only http(s)"));
    }
    caps.require(caps.host_allowed(&host), &format!("net:{host}"))?;
    let mut r = ureq::request(method, url).timeout(std::time::Duration::from_secs(30));
    for (k, v) in headers {
        r = r.set(k, v);
    }
    let res = match body {
        Some(b) => r.send_string(b),
        None => r.call(),
    };
    match res {
        Ok(x) | Err(ureq::Error::Status(_, x)) => {
            let s = x.status();
            Ok((
                s,
                x.into_string()
                    .map_err(|e| DesktopError::new("io", e.to_string()))?,
            ))
        }
        Err(e) => Err(DesktopError::new("io", e.to_string())),
    }
}
#[cfg(not(feature = "http"))]
pub fn fetch(
    _: &Permissions,
    _: &str,
    _: &str,
    _: &[(String, String)],
    _: Option<&str>,
) -> Result<(u16, String)> {
    Err(DesktopError::unsupported(
        "built without the `http` feature",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn process_allow_list() {
        let mut p = Permissions::default();
        assert_eq!(
            run(&p, "echo", &["x".into()], None).unwrap_err().code,
            "denied"
        );
        p.process = vec!["echo".into()];
        if cfg!(unix) {
            assert_eq!(
                run(&p, "echo", &["hi".into()], None).unwrap().stdout,
                "hi\n"
            );
        }
        for bad in ["/bin/echo", "../echo", "echo;ls", ""] {
            assert_eq!(run(&p, bad, &[], None).unwrap_err().code, "denied", "{bad}");
        }
    }
    #[test]
    fn host_parsing_defeats_tricks() {
        assert_eq!(
            host_of("https://API.x.com:8443/p?q#f").as_deref(),
            Some("api.x.com")
        );
        assert_eq!(
            host_of("https://good.com@evil.com/").as_deref(),
            Some("evil.com")
        );
        assert_eq!(host_of("http://[::1]:80/").as_deref(), Some("::1"));
        assert_eq!(host_of("nonsense"), None);
    }
}
