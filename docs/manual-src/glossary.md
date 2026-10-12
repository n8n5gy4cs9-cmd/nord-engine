---
title: Glossary
section: Guides
order: 4
summary: Plain-language meanings of the words used in this manual.
---
::: dummies
Keep this open in a tab while you read — each term has a one-line "kitchen" version.
:::
| Term | Meaning |
|---|---|
| **Entity** | A thing in your scene (a player, a coin, a light). An empty box until it has components. |
| **Component** | A piece of data/behaviour on an entity: *what it looks like*, *how it collides*. |
| **Script** | JavaScript (or Rust) attached to an entity that decides *what it does*. |
| **Attribute** | A number/option on a script that you tweak in the Inspector instead of the code. |
| **Scene** | One level/screen: a JSON file listing entities. |
| **Prefab** | A saved entity you can stamp many times (bullet, enemy). |
| **Tag / Layer** | Labels to find groups of entities / to order them. |
| **Transform** | Position, rotation, scale. |
| **Frame / dt** | One drawn picture / the seconds it took. Multiply speeds by dt. |
| **Fixed update** | Code that runs at exactly 60 times per second, used with physics. |
| **Rigidbody / Collider** | "Obeys physics" / "this is my shape". |
| **Trigger** | An invisible zone that notices when something enters it. |
| **Tilemap / Tileset** | A level built from small repeating pictures on a grid / the picture sheet. |
| **Spritesheet** | One image containing many animation frames. |
| **Bus (audio)** | A volume group: music, sfx, ui, master. |
| **Hot reload** | Changing code while the game is running, without restarting. |
| **Tier** | Which engine runs the project: HTML, 2D, 3D, Rust game, Rust app. |
| **Export** | Packing the game into a folder others can play. |
| **WASM / WebAssembly** | A fast compiled format browsers can run (used for Rust and 3D physics). |
| **Escape hatch** | `entity.native`: direct access to the raw Phaser/Babylon object. |
