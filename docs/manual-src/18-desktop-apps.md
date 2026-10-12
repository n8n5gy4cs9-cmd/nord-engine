---
title: Desktop apps
section: Manual
order: 18
summary: PLANNED (M9) — native desktop apps with file access, dialogs, notifications, tray and more.
---
::: todo
**This chapter is intentionally a stub.** Milestone **M9 "Desktop apps"** (16 tasks) is planned but not started; the design document (M9-01) comes first. Nothing on this page is implemented.
:::

## What is planned
A way to build *real* desktop apps — not just games in a window — from the same projects, using a shared Rust backend (`nord-desktop`) exposed two ways: to **JavaScript** through an IPC bridge and to **Rust apps** directly.

| Area | Planned capability |
|---|---|
| Files & folders | scoped read/write/list/watch with per-app allowed roots and path-traversal protection |
| Dialogs | open/save file, pick folder, message/confirm, recent locations |
| Notifications | system notifications, badges, dock/taskbar progress |
| Storage | key-value + structured data, settings, OS keychain secrets |
| Clipboard & integration | clipboard, drag & drop, file associations, deep links, single instance |
| Windows & menus | multi-window, native menu bar, context menus, global shortcuts, tray icon, frameless/transparent windows |
| Permissions & packaging | capability model, sandboxing, signed bundles |

::: todo
TODO (fill in when M9 lands): API reference for the JS bridge (`nord.desktop.*`), the Rust `Ctx`/service traits, the permission manifest format, packaging per platform, and a "your first desktop app" tutorial.
:::

Progress is tracked in `task.md` (M9-01…M9-16). Until then, use the web export or the Mac app wrapper ([Export](export.html)).
