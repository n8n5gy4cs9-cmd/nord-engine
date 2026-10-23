---
title: Node graph reference
section: Guides
order: 4
summary: Pins, events, flow, the full node list, the runner and the component.
---

A **graph** is a program drawn as boxes (nodes) and wires. It is saved as `graphs/<name>.graph.json` by the **Graph** tab and run by the engine with no code. Decision: ADR-032. The canvas is **litegraph.js** (MIT, `vendor/litegraph`); the node library and the runner are Nord's own (`runtime/core/graph/`), so a graph can reach everything in the engine: entities, components, input, physics, audio, save data, UI scenes, events, scenes, and — through the *Advanced* nodes — any property, method or JavaScript.

## Concepts
* **Event nodes** (red) start a flow: *On Start*, *On Update*, *On Input Action*, *On UI Action*, *On Game Event*, *On Entity Event*, *On Collision / Trigger*, *On Timer*, *On Destroy*, *Custom Event*.
* **Flow pins** (white arrows) run nodes in order. **Data pins** (coloured dots) carry values: `number`, `string`, `boolean`, `vec3`, `entity`, `array`, `object`, `color`, `any`. Compatible types connect (`any` fits everything; numbers/booleans/text convert).
* **Pure nodes** (no flow pins: Math, Logic, Vector, Text, Get Variable, Find Entity…) are evaluated on demand when something reads their output.
* An **unconnected input** uses the value typed in the node's widget. A connected input uses the wire.
* **Variables** live in the *Variables* panel of the graph (name + default). *Get/Set/Add To Variable* nodes use them; each running graph has its own copy.
* A **target** input left empty means *this entity* (the entity the graph is attached to).
* Flow nodes can wait: *Delay*, *Wait Until*, *Tween Position* pause only their own chain; the game and other chains keep running.

## Running a graph
| How | Use for |
|---|---|
| **`graph` component** on an entity: `{ "type": "graph", "file": "graphs/player.graph.json" }` | Behaviour of one entity (movement, enemy AI). *This entity* = the owner. |
| **Scene setting** `"settings": { "graphs": ["graphs/game.graph.json"] }` | Game rules, HUD, scene flow. No owner entity. |
| **Run Graph File** node | Call a reusable graph from another graph (arguments `a`, `b` become variables). |
| Code: `await attachGraph(game, scene, 'graphs/x.graph.json', entity)` | From a script. Returns the graph (`.stop()`, `.vars`). |

Inspector: add the **graph** component (Add component ▸ graph) or use **Hierarchy ▸ Create ▸ Graph (visual script)**.

## The Graph editor
Search the palette (left) or double-click the canvas; drag from a pin to connect; **Del** deletes; **Ctrl/Cmd+D** duplicates; **Ctrl/Cmd+S** saves; **F** fits the view. **Templates** start common graphs. **Arrange** tidies nodes left to right. **Validate** reports unknown nodes, missing events, and flow nodes that no event can reach.

## Errors and limits
An error in one node is reported to the Console and the editor overlay (as `graph <file>`); other chains keep running. A single flow stops with an error after 200 000 steps (infinite loop guard). Pure-node cycles are detected.

## Escape hatches (the *Advanced* category)
*Get/Set Property* (`pos.0`, `vars.hp`, any path), *Call Method* (any function on any object, awaits promises), *Game / Scene Service* (game, scene, input, audio, ui, physics, events, save), *Entity Script* and *Entity Component* (reach your own scripts and component data), *JavaScript Expression* and *Run JavaScript* (`a b c d ctx game scene entity vars`).

## Node list
<!-- GENERATED NODES -->

### Events

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **On Start** *(event → then)* | `event/start` | — | — | — |
| **On Update** *(event → then)* | `event/update` | — | dt:number | — |
| **On Input Action** *(event → then)* | `event/key` | — | — | action="jump", mode (pressed|released|down) |
| **On UI Action** *(event → then)* | `event/ui` | — | payload:any | action="play" |
| **On Game Event** *(event → then)* | `event/game` | — | data:any | name="my-event" |
| **On Entity Event** *(event → then)* | `event/entity` | — | data:any | name="click" |
| **On Collision / Trigger** *(event → then)* | `event/collision` | — | other:entity, info:object | method (onCollisionEnter|onCollisionExit|onTriggerEnter|onTriggerExit|onClick) |
| **On Timer** *(event → then)* | `event/timer` | — | count:number | seconds=1, repeat=true |
| **On Destroy** *(event → then)* | `event/destroy` | — | — | — |
| **Custom Event** *(event → then)* | `event/custom` | — | a:any, b:any | name="my-custom" |

### Flow

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Branch (If)** *(flow → then / else)* | `flow/branch` | condition:boolean=true | — | — |
| **Sequence** *(flow → then / then 2 / then 3)* | `flow/sequence` | — | — | — |
| **Delay** *(flow → then)* | `flow/delay` | seconds:number=1 | — | — |
| **Wait Until** *(flow → then)* | `flow/wait-until` | condition:boolean=false | — | — |
| **For Loop** *(flow → body / done)* | `flow/for` | first:number=0, last:number=9 | index:number | — |
| **For Each** *(flow → body / done)* | `flow/foreach` | array:array | item:any, index:number | — |
| **While** *(flow → body / done)* | `flow/while` | condition:boolean=false | — | — |
| **Do Once** *(flow → then)* | `flow/once` | — | — | — |
| **Flip Flop** *(flow → A / B)* | `flow/flipflop` | — | isA:boolean | — |
| **Switch** *(flow → case 1 / case 2 / case 3 / default)* | `flow/switch` | value:any | — | case0="a", case1="b", case2="c" |
| **Call Custom Event** *(flow → then)* | `flow/call-event` | name:string="my-custom", a:any, b:any | — | — |
| **Run Graph File (Subgraph)** *(flow → then)* | `flow/call-graph` | file:string="graphs/other.graph.json", a:any, b:any | a:any, b:any | — |
| **Return** *(flow)* | `flow/return` | a:any, b:any | — | — |
| **Stop Graph** *(flow → then)* | `flow/stop` | — | — | — |

### Variables

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Get Variable** *(pure)* | `var/get` | — | value:any | name="score" |
| **Set Variable** *(flow → then)* | `var/set` | value:any | value:any | name="score" |
| **Add To Variable** *(flow → then)* | `var/add` | amount:number=1 | value:number | name="score" |
| **Get Entity Variable** *(pure)* | `var/entity-get` | entity:entity | value:any | name="hp" |
| **Set Entity Variable** *(flow → then)* | `var/entity-set` | entity:entity, value:any | — | name="hp" |
| **Save: Get** *(pure)* | `save/get` | key:string="best", default:any | value:any | — |
| **Save: Set** *(flow → then)* | `save/set` | key:string="best", value:any | — | — |

### Math

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Number** *(pure)* | `const/number` | — | value:number | value=0 |
| **A + B** *(pure)* | `math/add` | a:number=0, b:number=0 | result:number | — |
| **A − B** *(pure)* | `math/sub` | a:number=0, b:number=0 | result:number | — |
| **A × B** *(pure)* | `math/mul` | a:number=0, b:number=0 | result:number | — |
| **A ÷ B** *(pure)* | `math/div` | a:number=0, b:number=0 | result:number | — |
| **A mod B** *(pure)* | `math/mod` | a:number=0, b:number=0 | result:number | — |
| **A ^ B** *(pure)* | `math/pow` | a:number=0, b:number=0 | result:number | — |
| **Min** *(pure)* | `math/min` | a:number=0, b:number=0 | result:number | — |
| **Max** *(pure)* | `math/max` | a:number=0, b:number=0 | result:number | — |
| **Atan2(A, B)** *(pure)* | `math/atan2` | a:number=0, b:number=0 | result:number | — |
| **Abs** *(pure)* | `math/abs` | value:number=0 | result:number | — |
| **Floor** *(pure)* | `math/floor` | value:number=0 | result:number | — |
| **Ceil** *(pure)* | `math/ceil` | value:number=0 | result:number | — |
| **Round** *(pure)* | `math/round` | value:number=0 | result:number | — |
| **Sin** *(pure)* | `math/sin` | value:number=0 | result:number | — |
| **Cos** *(pure)* | `math/cos` | value:number=0 | result:number | — |
| **Sqrt** *(pure)* | `math/sqrt` | value:number=0 | result:number | — |
| **Sign** *(pure)* | `math/sign` | value:number=0 | result:number | — |
| **Negate** *(pure)* | `math/negate` | value:number=0 | result:number | — |
| **Clamp** *(pure)* | `math/clamp` | value:number=0, min:number=0, max:number=1 | result:number | — |
| **Lerp** *(pure)* | `math/lerp` | a:number=0, b:number=1, t:number=0.5 | result:number | — |
| **Remap** *(pure)* | `math/remap` | value:number=0, from min:number=0, from max:number=1, to min:number=0, to max:number=100 | result:number | — |
| **Random Number** *(pure)* | `math/random` | min:number=0, max:number=1 | value:number | — |
| **Random Integer** *(pure)* | `math/random-int` | min:number=0, max:number=10 | value:number | — |
| **Time** *(pure)* | `math/time` | — | elapsed:number, delta:number | — |

### Logic

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Boolean** *(pure)* | `const/boolean` | — | value:boolean | value=true |
| **Compare** *(pure)* | `logic/compare` | a:any=0, b:any=0 | result:boolean | op (==|!=|<|<=|>|>=) |
| **And** *(pure)* | `logic/and` | a:boolean=true, b:boolean=true | result:boolean | — |
| **Or** *(pure)* | `logic/or` | a:boolean=false, b:boolean=false | result:boolean | — |
| **Not** *(pure)* | `logic/not` | value:boolean=false | result:boolean | — |
| **Select (A ? B : C)** *(pure)* | `logic/select` | condition:boolean=true, if true:any, if false:any | value:any | — |
| **Is Valid** *(pure)* | `logic/is-valid` | value:any | valid:boolean | — |

### Vector

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Vector3** *(pure)* | `const/vec3` | x:number=0, y:number=0, z:number=0 | vec:vec3 | — |
| **Split Vector3** *(pure)* | `vec/split` | vec:vec3 | x:number, y:number, z:number | — |
| **Vector A + B** *(pure)* | `vec/add` | a:vec3, b:vec3 | result:vec3 | — |
| **Vector A − B** *(pure)* | `vec/sub` | a:vec3, b:vec3 | result:vec3 | — |
| **Vector × Number** *(pure)* | `vec/scale` | vec:vec3, scale:number=1 | result:vec3 | — |
| **Vector Length** *(pure)* | `vec/length` | vec:vec3 | length:number | — |
| **Normalize** *(pure)* | `vec/normalize` | vec:vec3 | result:vec3 | — |
| **Distance** *(pure)* | `vec/distance` | a:vec3, b:vec3 | distance:number | — |
| **Vector Lerp** *(pure)* | `vec/lerp` | a:vec3, b:vec3, t:number=0.5 | result:vec3 | — |

### Text

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Text** *(pure)* | `const/string` | — | value:string | value="hello" |
| **Color** *(pure)* | `const/color` | — | color:color | color="#88c0d0" |
| **Join Text** *(pure)* | `text/concat` | a:any="", b:any="" | text:string | separator="" |
| **Format Text** *(pure)* | `text/format` | a:any, b:any, c:any | text:string | template="Score: {a}" |
| **To Text** *(pure)* | `text/to-string` | value:any | text:string | — |
| **To Number** *(pure)* | `text/to-number` | text:any | number:number | — |
| **Text Length** *(pure)* | `text/length` | text:string="" | length:number | — |

### Array

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Make Array** *(pure)* | `array/make` | a:any, b:any, c:any, d:any | array:array | — |
| **Array Get** *(pure)* | `array/get` | array:array, index:number=0 | item:any | — |
| **Array Length** *(pure)* | `array/length` | array:array | length:number | — |
| **Random Item** *(pure)* | `array/random` | array:array | item:any | — |
| **Array Push** *(flow → then)* | `array/push` | array:array, item:any | — | — |

### Entity

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **This Entity** *(pure)* | `entity/self` | — | entity:entity | — |
| **Find Entity By Name** *(pure)* | `entity/find` | name:string="Player" | entity:entity | — |
| **Find Entities By Tag** *(pure)* | `entity/find-tag` | tag:string="enemy" | entities:array | — |
| **Get Position** *(pure)* | `entity/get-pos` | entity:entity | pos:vec3, x:number, y:number, z:number | — |
| **Set Position** *(flow → then)* | `entity/set-pos` | entity:entity, pos:vec3 | — | — |
| **Move By** *(flow → then)* | `entity/translate` | entity:entity, delta:vec3 | — | — |
| **Get Rotation** *(pure)* | `entity/get-rot` | entity:entity | rot:vec3 | — |
| **Set Rotation** *(flow → then)* | `entity/set-rot` | entity:entity, rot:vec3 | — | — |
| **Set Scale** *(flow → then)* | `entity/set-scale` | entity:entity, scale:vec3 | — | — |
| **Set Enabled** *(flow → then)* | `entity/set-enabled` | entity:entity, enabled:boolean=true | — | — |
| **Destroy Entity** *(flow → then)* | `entity/destroy` | entity:entity | — | — |
| **Spawn Prefab** *(flow → then)* | `entity/spawn` | prefab:string="prefabs/bullet.prefab.json", pos:vec3 | entity:entity | — |
| **Clone Entity** *(flow → then)* | `entity/clone` | entity:entity | entity:entity | — |
| **Has Tag** *(pure)* | `entity/has-tag` | entity:entity, tag:string="enemy" | result:boolean | — |
| **Get Name** *(pure)* | `entity/name` | entity:entity | name:string | — |
| **Set Component Value** *(flow → then)* | `entity/set-component` | entity:entity, value:any | — | component="sprite", key="tint" |
| **Tween Position** *(flow → then)* | `entity/tween` | entity:entity, to:vec3, seconds:number=1 | — | ease (quadOut|linear|quadIn|quadInOut|cubicOut|bounceOut) |

### Physics

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Set Velocity** *(flow → then)* | `physics/velocity` | entity:entity, velocity:vec3 | — | — |
| **Apply Impulse** *(flow → then)* | `physics/impulse` | entity:entity, impulse:vec3 | — | — |
| **Get Velocity** *(pure)* | `physics/get-velocity` | entity:entity | velocity:vec3 | — |
| **Is Grounded** *(pure)* | `physics/grounded` | entity:entity | grounded:boolean | — |

### Input

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Action Held** *(pure)* | `input/down` | — | down:boolean | action="jump" |
| **Action Pressed** *(pure)* | `input/pressed` | — | pressed:boolean | action="jump" |
| **Axis** *(pure)* | `input/axis` | — | value:number | negative="left", positive="right" |
| **Direction Vector** *(pure)* | `input/vec` | — | vec:vec3, x:number, y:number | left="left", right="right", up="up", down="down" |
| **Pointer** *(pure)* | `input/pointer` | — | x:number, y:number, down:boolean | — |

### UI

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Load UI Screen** *(flow → then)* | `ui/load` | file:string="ui/menu.ui.json" | — | — |
| **Show / Hide Screen** *(flow → then)* | `ui/show` | screen:string="menu", visible:boolean=true | — | — |
| **Set UI Text** *(flow → then)* | `ui/set-text` | screen:string="menu", node:string="score", text:any | — | — |
| **Set UI Variable** *(flow → then)* | `ui/set-var` | screen:string="menu", name:string="score", value:any | — | — |
| **Set UI Node Property** *(flow → then)* | `ui/set-prop` | screen:string="menu", node:string="play", value:any | — | property (text|value|visible|disabled|color|src|checked) |
| **Get UI Value** *(pure)* | `ui/get-value` | screen:string="menu", node:string="name" | value:any | — |
| **Use UI Skin** *(flow → then)* | `ui/skin` | file:string="ui/skin.json" | — | — |

### Audio

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Play Sound** *(flow → then)* | `audio/play` | clip:string="assets/audio/sfx/click.wav", volume:number=1 | — | bus (sfx|ui|music) |
| **Play Music** *(flow → then)* | `audio/music` | clip:string="assets/audio/music.mp3" | — | — |
| **Stop Music** *(flow → then)* | `audio/stop-music` | — | — | — |
| **Set Volume** *(flow → then)* | `audio/volume` | volume:number=1 | — | bus (master|music|sfx|ui) |

### Game

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Load Scene** *(flow → then)* | `game/load-scene` | scene:string="scenes/main.scene.json" | — | — |
| **Restart Scene** *(flow → then)* | `game/restart` | — | — | — |
| **Pause / Resume** *(flow → then)* | `game/pause` | paused:boolean=true | — | — |
| **Set Time Scale** *(flow → then)* | `game/timescale` | scale:number=1 | — | — |
| **Emit Game Event** *(flow → then)* | `game/emit` | name:string="my-event", data:any | — | — |
| **Emit Entity Event** *(flow → then)* | `game/emit-entity` | entity:entity, name:string="click", data:any | — | — |
| **Log** *(flow → then)* | `game/log` | message:any | — | level (log|warn|error) |
| **Open URL** *(flow → then)* | `game/quit-browser` | url:string="…://" | — | — |

### Advanced

| Node | Type id | Inputs | Outputs | Settings |
|---|---|---|---|---|
| **Get Property** *(pure)* | `adv/get-prop` | object:any, path:string="pos.0" | value:any | — |
| **Set Property** *(flow → then)* | `adv/set-prop` | object:any, path:string="name", value:any | — | — |
| **Call Method** *(flow → then)* | `adv/call` | object:any, method:string="emit", a:any, b:any, c:any | result:any | — |
| **Game / Scene Service** *(pure)* | `adv/game` | — | object:any | service (game|scene|input|audio|ui|physics|events|save) |
| **Entity Script** *(pure)* | `adv/script` | entity:entity | script:object | class="" |
| **Entity Component** *(pure)* | `adv/component` | entity:entity | component:object | type="sprite" |
| **JavaScript Expression** *(pure)* | `adv/js-expr` | a:any, b:any, c:any, d:any | result:any | code="a + b" |
| **Run JavaScript** *(flow → then)* | `adv/js` | a:any, b:any, c:any, d:any | result:any | code="console.log(game.time.elapsed)" |
| **Reroute** *(pure)* | `util/reroute` | in:any | out:any | — |
| **Comment** *(pure)* | `util/comment` | — | — | text="Note" |

<!-- END GENERATED NODES -->

## Credits
Canvas: litegraph.js © Javi Agenjo, MIT (`vendor/litegraph/LICENSE`). Graph model inspired by Unity Visual Scripting / GraphView and Unreal Blueprints (concepts only; no code copied — Unity's C# reference repository is reference-only).

## Subgraphs and the live flow highlight
* **Run Graph File** (`flow/call-graph`) runs another graph file as a subgraph: the values on its `a` and `b` pins become the variables `a` and `b` inside; a **Return** node (`flow/return`) hands two values back through the call node's `a` / `b` outputs. The editor's **Make subgraph** button builds such a file from the selected nodes (exactly one flow link in, at most one out, at most two values each way) and replaces them with the call node.
* **Live flow highlight:** while a Graph editor page is open it sends a heartbeat to `/api/graph-trace`. The running game (served by `nord serve` / the editor, `window.__nordServed`) polls that endpoint once a second; only when someone is watching does it batch the ids of executed nodes and post them to `/__edit/cmd` (`{t:"graph-trace", nodes:{ "<graph file>": [ids] }}`), and the editor flashes those nodes green. Shipped games never poll.
