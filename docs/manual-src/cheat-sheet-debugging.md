---
title: Debugging, performance and testing cheatsheet
section: Guides
group: Test and ship
order: 30
summary: A symptom-first triage table, breakpoints and inspection, measurement rules, restart checks and export verification.
---
Use this page to narrow a problem before changing code. Start with a saved project, a repeatable action and one expected result.

::: dummies
A useful bug report is a recipe: which project, which scene, what you did, what you expected, and what happened instead. “Broken” is a feeling. “The score increases twice after restarting” is a testable clue.
:::

## First five checks
1. Reproduce once with the smallest relevant scene. Record the first incorrect result.
2. Open @ui[Console] and read the first error. Later errors can be consequences of that one.
3. Inspect the affected object in @ui[Hierarchy] and @ui[Inspector]. Confirm enabled state, attached scripts, components and paths.
4. Pause or inspect through the [Debugger](debugger.html) when you need current values. Compare the running value with the saved starting value.
5. Change one cause, run the same action again, then save a checkpoint if it fixes the result.

## Symptom lookup

| Symptom | First evidence to collect | Likely next check |
|---|---|---|
| Script never runs | Attached script and Console | Base class, callback capitalization, imports, enabled state |
| Object disappears | Position and active camera | Parent transform, scale, layer and renderer |
| Input is zero | Focused Game view and current action | Raw key versus named action, mapping and device |
| Movement jitters | Transform and body velocity | Two systems writing motion |
| Trigger never fires | Collider/body settings | Trigger flag, backend, layer filtering and callback name |
| Score updates twice | Number of listeners before/after restart | Subscription added repeatedly or never removed |
| UI remains after scene change | UI owner and handles | OnDestroy removal or shared-screen ownership |
| Audio is silent | User activation and bus levels | Resource path, decode error, mute and volume |
| Save seems missing | Project id, slot, origin and key | Different port/profile or shared slot mutation |
| Long load or frame hitch | Profiler recording | Asset loading, per-frame allocations, expensive queries |
| Works in editor, fails online | First exported Console/network error | File case, missing files, hosting and relative paths |

## Measure performance

| Question | Measure | Make the test useful |
|---|---|---|
| What makes a frame slow? | [Performance manual](performance.html) or [Profiler tutorial](tut-t52-profiler.html) | Compare the same scene and actions |
| Does work grow with enemies? | Object count and script/component cost | Test realistic counts before a stress case |
| Is memory growing? | Repeated scene restart and resource counts | Look for a trend, not one sample |
| Are queries expensive? | Frequency, collider count and query shapes | Some Unity-style geometry queries scan colliders |
| Is rendering expensive? | Draw work, effects and resolution | Change one quality setting and compare |
| Is the export too large? | Built file sizes and referenced assets | Check what shipped before optimizing source text |

Use a baseline and a single changed variable. Pooling, batching or caching helps only when it addresses measured work; do not add all three because the game feels slow.

## Debug output without a flood
Import `Debug` from `nord`. Use `Debug.Log(...)`, `LogWarning(...)`, or `LogError(...)` at meaningful state changes. Logging every Update can hide the event you need and affect performance. A named transition, entity id and relevant value are often more useful than a large object dump.

The editor Console reports output. The [in-game Dev Console](dev-console.html) is a deliberately added command UI; remove or configure debug-only behavior for the build you intend to share. See its guide for command registration.

## A practical regression checklist

| Check | Pass result |
|---|---|
| Fresh start | Correct scene and initial state |
| Normal interaction | One input produces one intended action |
| Hold versus press | Holding does not repeat a one-shot action accidentally |
| Restart three times | No duplicate labels, listeners or music |
| Missing target / empty save | Sensible fallback, no exception |
| Pause / resume | Active UI can resume; timers behave as documented |
| Exported build | Same essential behavior from the actual output |

## Check yourself
Write the reproduction steps and rerun them after the fix. State what you tested and what still needs hardware or human verification. A performance claim includes before/after measurements from comparable runs.

Next: [Export](cheat-sheet-export.html). Back to: [Cheatsheets](cookbook.html).
