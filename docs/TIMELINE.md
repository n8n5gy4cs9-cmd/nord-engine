# Timelines (M10-21 runtime)
`runtime/core/timeline.js`, tests in `eventsheet.test.mjs`. Format (scene `settings.timelines`): see the header of the file — tracks (`target` = name/tag/family, `property` = x y z angle scaleX scaleY opacity, `var:name`, `comp:type.field`), keys `{t, v, ease}` (ease = util.ease name or cubic-bezier `[x1,y1,x2,y2]`), `events: [{t, name}]`, `duration`, `loop`.
API: `scene.timelines.play/pause/resume/stop/seek/time/progress`. Event sheet: *Timeline* plugin (Play, Pause, Resume, Stop, Set time; On finished, On event, Is playing; `Timeline.Time(name)`, `Timeline.Progress(name)`).
Editor: see the *Timeline* tab (docs/EDITOR_UI.md) once built.
