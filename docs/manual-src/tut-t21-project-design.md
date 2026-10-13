---
title: T21 Plan a bigger Nord project
section: Tutorials
order: 21
summary: A plain-text game design and folder example, with responsibilities, milestones and practical scope choices.
---
A bigger game becomes manageable when you can say what each part does and where its files belong. You do not need a complicated framework. You need a small game plan, clear names and a working slice before adding more content.

This guide is text only. Its example project, **Harbour Lights**, is a planning example rather than another bundled game.

## 1. Write a one-page design

```text
Title: Harbour Lights
Genre: small top-down exploration and rescue game
Player: one harbour pilot steering a repair boat
Goal: restore three lighthouses and return all stranded crews home
Core loop: leave harbour → navigate → solve one rescue/repair → return → upgrade
Session length: 20–30 minutes
Controls: move, interact, open map, pause
Failure: boat damage sends you back to harbour; completed rescues remain saved
Tone: warm, readable, hopeful
First release: one harbour, three routes, three lighthouse encounters
Outside scope: open-world ocean, online multiplayer, procedural towns, crafting trees
```

**Core loop** means the few actions the player repeats. If you cannot describe it in one sentence, reduce the plan until you can. The features should support that loop; a feature is not automatically useful because another game has it.

## 2. Describe one minute of play
Write a concrete sequence:

```text
The player leaves the harbour.
A map marker points to a broken lighthouse.
A narrow route introduces steering around rocks.
A stranded crew asks for a lift.
The player docks, restores the light and sees the route become safe.
Returning to harbour adds one visible rescue and unlocks the next route.
```

This tells you what must exist: movement, a camera, rocks, an interaction, a small mission state, feedback and a return path. Build those together before adding twenty different boats.

::: dummies
A vertical slice is one small piece that works from beginning to end. One complete rescue with a save and result screen teaches you more about your project than ten unfinished levels.
:::

## 3. Pick the Nord tier
Use **2D** for this top-down game. That means Nord's Phaser adapter handles drawing and supported physics. Use Nord components for sprites, bodies, text and cameras; use `NordScript` for behavior.

Do not create your own Phaser Game alongside Nord. The project, scene and runtime are already connected. Choose 3D/Babylon or a Rust tier for a concrete need, not because they sound more advanced.

## 4. Start with this folder structure

```text
harbour-lights/
  nord.project.json             Project settings, start scene and input actions
  index.html                    Local runtime boot page
  README.md                     How to open, play and export
  GUIDE.md                      Controls and player help
  ASSETS.md                     Asset paths, sources and reuse permissions

  docs/
    GAME_DESIGN.md              One-page design and scope limits
    CONTENT.md                  Routes, encounters and reward numbers
    SAVE_FORMAT.md             Saved progress and its version

  scenes/
    title.scene.json            Title/menu scene
    harbour.scene.json          Home port and first playable slice
    coast-west.scene.json       One route
    coast-east.scene.json       Another route, added after the first works

  prefabs/
    boat.prefab.json            Reusable player boat
    rock.prefab.json            Reusable obstacle
    lighthouse.prefab.json      Reusable repair location
    stranded-crew.prefab.json   Reusable rescue location

  scripts/
    player/
      boat-controller.js        Read actions and move the boat
      boat-health.js            Apply damage and recovery
    camera/
      follow-boat.js            Follow and frame the player
    missions/
      rescue-rules.js           Mission state; no drawing or input code
      rescue-scene.js           Connect mission state to this scene
    ui/
      hud.js                    Show health, cargo and objective
      pause-menu.js             Pause/resume and save controls
      results.js                Show the completed rescue
    services/
      progress.js               Read/write the versioned save
      audio.js                  Choose music and named effects
    data/
      routes.js                 Route descriptions and rewards
      boats.js                  Boat speed, hull and upgrade numbers

  assets/
    sprites/
      boats.png
      boats.png.meta.json       Frame sizes and animation names
      people.png
      people.png.meta.json
    maps/
      harbour.json              Local tilemap file
      coast-west.json
    ui/
      icons.png
      icons.png.meta.json
    audio/
      music/harbour.ogg
      music/coast.ogg
      sfx/dock.wav
      sfx/repair.wav
    fonts/
      inter.woff2
      LICENSE

  .nord-cache/                  Generated previews/autosaves; not source assets
  dist/                         Exported game; keep separate from editable files
```

Create folders when their files exist. Do not make thirty empty folders on day one. A five-file prototype can grow into this structure when its responsibilities become clear.

## 5. Give each module one useful job

| Module | Owns | Should not own |
|---|---|---|
| boat-controller | Input and movement | Campaign saves or inventory menus |
| rescue-rules | Which objectives are complete | Sprite creation or mouse coordinates |
| rescue-scene | Connecting rules to scene entities | Every mission in the entire game |
| hud | Displaying values | Deciding whether a rescue counts |
| progress | Save version and storage | Drawing the map |
| routes data | Route names and numbers | Frame-by-frame update behavior |

The purpose is to make a change easy to find. For example, change boat speed in boat data; change how speed is applied in the controller; change how speed is displayed in the HUD.

## 6. Separate settings, rules and presentation
A reusable boat prefab describes its sprite, body and attached scripts. Script attributes expose settings such as speed in the Inspector. The controller applies those settings.

A mission's rules can be ordinary JavaScript functions that receive data and return a result. The scene script calls them and then changes Nord entities. This keeps mission logic readable without making every helper inherit from NordScript.

Star-Not uses this same small separation: `sn/data.js` holds content and campaign rules; `sn/flight.js` handles movement; `star-not.js` connects those pieces to Nord entities and menus.

## 7. Keep scene names and file paths boring
Use readable names: `PlayerBoat`, `HarbourCamera`, `WestLighthouse`. Avoid `Thing7` and filenames such as `final-final-new2.js`.

Assets use project-relative paths such as `assets/sprites/boats.png`. Keep the PNG and its metadata together. Exact capitals matter on many hosts. Keep internet URLs out of asset-loading code so an exported game remains offline.

## 8. Plan the save before adding content
Write down what needs to survive closing the game:

```text
Save version: 1
Completed rescue IDs: [west-lighthouse]
Current harbour upgrade: 1
Boat selection: starter
Settings: sound volumes and input preferences
Checkpoint: harbour
```

Do not save live runtime objects such as DOM elements, entity instances or physics bodies. Store IDs and plain data. On load, create the scene normally, then apply the saved progress.

Choose whether a save restarts an encounter or resumes its exact frame. Tell the player. Star-Not intentionally returns to a planet checkpoint; Notepaint preserves the actual text and picture.

## 9. Give the player feedback for every rule
The player should see why an action did or did not work:

- Repair complete → the light turns on, a short sound plays and the objective updates.
- Not enough supplies → the button explains the requirement.
- Damage → health changes visibly; the player can recover.
- A save failed → say it failed and offer a portable export where possible.

A hidden number is not enough. The game needs an understandable result on screen.

## 10. Split the work into small milestones

```text
Milestone 1: one boat moves; one camera follows; one harbour loads
Milestone 2: one route; one obstacle; one interaction
Milestone 3: one complete rescue; return to harbour; result shown
Milestone 4: progress saves; pause and help explain the controls
Milestone 5: two more routes reuse the existing pieces
Milestone 6: art/audio replacements; readable UI; complete beginning and ending
Milestone 7: export and distribution instructions
```

Finish the first route before multiplying it. A second scene should reuse the boat and mission pieces rather than copy one enormous script with different filenames.

## 11. Treat art and audio as replaceable content
Keep an asset inventory with path, purpose, size/frame contract, source and licence. Document which files are plain authoritative artwork and which are generated.

Reuse the new example packs if useful: [Notepaint's UI sprites](tut-t19-notepaint.html#5-copy-the-reusable-artwork-and-font) and [Star-Not's game/UI/audio pack](tut-t20-star-not.html#6-copy-the-reusable-sprites-and-audio). Copy the relevant sidecar and licence. Replace one asset at a stable path before changing a whole code system.

## 12. Grow only when the small game works for a player
After the first complete slice, ask concrete questions: Is the goal clear? Does movement feel right? Can a player recover from mistakes? Are saves understandable? Does the ending acknowledge what they did?

Add content that answers those questions. Keep the first release small enough that you can explain its entire structure to another developer in a few minutes.
