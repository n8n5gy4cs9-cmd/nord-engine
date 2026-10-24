---
title: In-game Dev Console
section: Manual
order: 38
summary: Drop one prefab into your game and get a command console with cheats, autocomplete and your own commands. Add commands with one line of code.
---

The **Dev Console** is a command line inside your running game, for cheats, QA and debugging. Press the key left of @key[1] (@key[§] on Nordic keyboards, @key[`] on US) and type. It is a library prefab: nothing to install, works in every Nord project (2D and 3D), exports with the game unless you turn it off.

::: dummies
A **command** is a word you type, like `heal 20` or `spawn prefabs/enemy.prefab.json 100 50 0`. The console runs the matching function you (or the engine) wrote. It is the quickest way to test "what happens if I have 999 coins?" without changing the game.
:::

## Add it to a game (1 minute)
1. Open the @ui[Library] tab, search @ui[console], select @ui[Dev Console (in-game command console)] and press @ui[Insert]. This copies `scripts/dev-console.js` and `prefabs/dev-console.prefab.json` into your project and places a *Dev Console* object in the scene.
   *Or drag it yourself:* the files are in the project's `prefabs` folder after inserting once: drag `dev-console.prefab.json` from @ui[Assets] into the @ui[Hierarchy] of any other scene.
2. Press @ui[Play] and press the key left of @key[1]. The console slides down. @key[Esc] or the same key closes it.
3. Type @api[help]. Done.

AI agents: `library_add {id:"prefab.dev-console"}` in the MCP server does step 1.

## Built-in commands
| Command | What it does |
|---|---|
| @api[help] `[command]` (also `man`, `?`) | list commands, or the usage of one |
| @api[entities] / @api[find] `text` | list or search objects in the scene |
| @api[get-object-info] `object` | transform, components, scripts, children |
| @api[set-pos] `object x y z` | move an object |
| @api[set-active] `object on` | enable / disable an object |
| @api[instantiate] `prefab [x y z]` (also `spawn`) | spawn a prefab |
| @api[destroy] `object` | remove an object |
| @api[call-instance] `object method args` | call a method on an object's scripts |
| @api[emit] `event json` | send a game event |
| @api[timescale] `n` | game speed: 1 normal, 0.1 slow motion |
| @api[pause] / @api[resume] / @api[restart] / @api[load-scene] `path` | control the game |
| @api[save-get] / @api[save-set] | read and write saved data |
| @api[exec] `javascript` | run a JavaScript expression with `game` and `scene` |
| @api[console-key] `code` | change the opening key (saved), e.g. `console-key F1` |
| @api[#define] `name = cmd; cmd` | make a macro; chain commands with `;` |
| @api[clear], @api[echo], @api[fps], @api[macros], @api[hello] | small helpers; `hello` shows an interactive command |

Quotes group words: `get-object-info "Dev Console"`. @key[Tab] completes command names, enum values and object names. @key[↑] @key[↓] browse your history.

## Add your own commands
In any script of your game:

```js
import { command, bindVar } from './dev-console.js';

// a simple cheat
command('heal', function (amount) { Player.instance.hp += amount; return `hp ${Player.instance.hp}`; },
        { description: 'Heal the player', params: 'amount:number=10' });

// get / set a variable: "god" prints it, "god true" sets it
bindVar('god', () => Player.instance.god, (v) => (Player.instance.god = v), 'bool', 'Take no damage');
```

* **Parameters** are a string: `name:type=default`, separated by spaces. Types: @term[number], @term[int], @term[bool], @term[string], @term[rest] (all remaining text), @term[vec3] (three numbers), @term[entity] (an object by name, you receive the object), @term[enum(a|b|c)] (autocomplete lists the options). A `=default` makes the parameter optional.
* **Overloads:** register the same name again with a different parameter list (like `instantiate` with and without a position).
* **Async:** return a Promise (or write an `async` function); the console waits and prints the result.
* **Interactive:** write a generator and `yield` a question: `command('name', function* () { const n = yield 'Your name?'; return 'Hi ' + n; })`.
* **Lambda / at runtime:** call `command(...)` any time, for example when a level loads. Remove with `removeCommand('name')`.
* **Platform:** `{ platform: 'desktop' }` or `'mobile'` limits a command.
* **Aliases:** `{ aliases: ['h'] }`.

## Settings (Inspector, on the Dev Console object)
| Field | Meaning |
|---|---|
| `toggleKey` | the key that opens it (`Backquote` = left of 1). Also `console-key` in the console |
| `startOpen` | open when the game starts |
| `pauseWhileOpen` | freeze the game while typing |
| `captureLogs` | show `console.log` / `warn` / `error` lines in the console |
| `allowExec` | allow `exec` (runs JavaScript). **Turn off for shipped games** or delete the object |
| `persist` | keep the console when you load another scene |

## Tagged logs (also for the editor Console)
`log.combat('hit for 5')`, `log.ui(...)`, `log.network(...)`, `log.tag('Boss', ...)`, `log.if(cond, ...)`, `log.timed('label', fn)` print lines that start with `[Tag]`. The editor @ui[Console] can filter by tag (see [Organising your project](organise-project.html)). 18 presets: Combat, UI, Network, AI, Player, Save, Audio, Physics, Level, Input, Scene, Inventory, Quest, Dialogue, Economy, Debug, Perf, Tutorial.

::: warn
The console can change anything in a running game. Ship builds with `allowExec` off, or remove the prefab from the final scene.
:::
