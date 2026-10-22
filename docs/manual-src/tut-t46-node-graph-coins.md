---
title: T46 Node graph — build a coin collector with no code
section: Tutorials
order: 46
summary: Move a player, collect coins and show a win screen using only graphs and a UI file. Then change the rules by rewiring nodes.
---
**Result:** a small 2D game: arrow keys move the player, touching a coin collects it, the HUD counts, and five coins show **You win!** with a *Play again* button.
**Start from:** *New project ▸ Node graph: coin collector* (or open `examples/nodegraph-coins` and read along). Allow 30 minutes.

<figure class="shot"><img src="assets/screenshots/graph-example-win.png" alt="Coin Collector win screen" loading="lazy"><figcaption>The finished game.</figcaption></figure>

::: dummies
You will not type code. You connect boxes. The game has two graphs: **player** (what the blue circle does) and **game** (loads the score screen and handles *Play again*).
:::

## 1. Look at what is in the project
| File | What it is |
|---|---|
| `scenes/main.scene.json` | Camera, background, a Player entity with the **graph** component, eight Coin entities tagged `coin`. The scene also lists `graphs/game.graph.json`. |
| `graphs/player.graph.json` | Movement and coin pickup. |
| `graphs/game.graph.json` | Loads the HUD on start, restarts on the *restart* action. |
| `ui/hud.ui.json` | The score label, the hidden win panel and its button (made in the [UI Designer](ui-designer.html)), skinned with `assets/ui/skin/pixel.skin.json`. |

Press **Play** and move with the arrow keys or WASD.

## 2. Read the movement chain
Open the **Graph** tab and the file `graphs/player.graph.json` (double-click it in Assets).

<figure class="shot"><img src="assets/screenshots/graph-editor-overview.png" alt="The player graph" loading="lazy"><figcaption>The player graph. Top-left: movement. Below: coin pickup.</figcaption></figure>

Follow the top group from left to right:
1. **On Update** fires every frame and gives `dt` (seconds since the last frame).
2. **Direction Vector** reads the left/right/up/down actions as one vector.
3. **A × B** multiplies `dt` by 180 (the speed in pixels per second).
4. **Vector × Number** scales the direction by that amount.
5. **Move By** adds the result to *this entity's* position.

Change the `180` in the multiply node to `300`, **Save**, press **Play**: faster player, no code touched.

## 3. Read the pickup chain
Every frame **On Update** also runs **For Each** over **Find Entities By Tag** `coin`. For each coin:
1. **Get Position** (this entity) and **Get Position** (the coin) feed **Distance**.
2. **Compare** `<` 22 decides a **Branch (If)**.
3. *then*: **Destroy Entity** (the coin) ▸ **Add To Variable** `score` +1 ▸ **Play Sound** ▸ **Set UI Variable** (`hud`, `score`).
4. A second **Compare** `score ≥ 5` and **Branch** run **Set UI Node Property**: the `win` panel becomes visible.

The score label in the UI file contains `{score}`; **Set UI Variable** fills it. Nothing else connects the graph to the label.

## 4. Change the rules
Try these, saving and playing after each:
* **Different goal:** change `5` in the second Compare to `8` (there are eight coins).
* **Coins that cost points:** add a second **Add To Variable** with `amount -1` before the first one.
* **Slow-mo on pickup:** after **Play Sound**, add **Set Time Scale** `0.3`, **Delay** `0.5`, **Set Time Scale** `1`.
* **Spawn effects:** use **Spawn Prefab** at the coin's position (create a prefab first).
* **A timer:** add **On Timer** (1 second) ▸ **Add To Variable** `time`, and show it with **Set UI Variable**.

## Log what is happening
Add a **Log** node (Game category) after **Add To Variable** and connect its *message* input to the variable's *value* output. Save, press **Play**, collect a coin: the number appears in the editor **Console** (use the *level* widget for warn or error). If it does not, the graph is not attached: the **Problems** list says so and offers **Add to current scene**. More in [Logging](performance.html#logging).

## 5. Connect a new button
Open `ui/hud.ui.json` in the UI Designer, add a button, set its **Action** to `quit`. The **Actions** tab shows *⚠ nothing listens*. In the Graph tab add **On UI Action** (`quit`) ▸ **Load Scene** (`scenes/menu.scene.json`). Back in the Designer, Refresh the Actions tab: it now shows `graphs/…:NN` with an **Open** button.

## What you learned
* Events start flows; flow wires order the work; value wires carry data.
* Pure nodes (math, vectors, find) compute on demand.
* Graphs, UI files and skins cooperate through **action names** and **variables**.
* The reference for every node: [Node graph reference](graph-reference.html); the guide: [Node graphs](graph.html).
