---
title: Layout, layers and objects
section: Manual
group: 2D and 3D worlds
order: 22
summary: Layers with parallax and opacity, guides and rulers, aligning objects, object types, saved views and layouts — the Construct-style layout tools.
---

## Use this page

This chapter explains **layout, layers and objects**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Layers | [Read this section](#layers) |
| Layout properties | [Read this section](#layout-properties) |
| Rulers and guides | [Read this section](#rulers-and-guides) |
| Arrange | [Read this section](#arrange) |

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

The **Layout** tab collects everything that is about *where things are* in a scene (Construct calls a scene a *layout*).

<figure class="shot"><img src="assets/screenshots/ed-layout.png" alt="The Layout tab with the layer list and the properties of the World layer" loading="lazy"><figcaption>The Layout tab: layers on top, then layout properties, arranging, object types, an overview map, saved views and the list of layouts.</figcaption></figure>

## Layers
Every object has a **layer** number; higher numbers are drawn later (in front). In the panel each layer has a name, a **visible** checkbox, a 🔒 lock (locked layers cannot be picked in the scene view), and ▲▼ to reorder. Click a layer to edit:
- **Opacity** — fades everything on the layer.
- **Parallax** — `0` pins the layer to the screen (a HUD), `1` moves with the world, `0.5` scrolls half as fast (distant hills).
- **Blend** — normal, add (glow), multiply, screen.
- **Background** — a colour behind the layer when it is not transparent.
The same properties exist at runtime: change `scene.settings.layers["1"].opacity` from a script or an event and it takes effect at once.

## Layout properties
**Layout size** limits Bound-to-layout objects and the camera; tick **unbounded scrolling** to let the camera leave it. **Event sheet** links the layout to its sheet. **Guides** are lines objects snap to.

## Rulers and guides
The scene view has rulers on the top and left. Drag from a ruler to make a guide; drag a guide to move it; drop it back on the ruler to delete it. Objects snap to guides while you move them.

## Arrange
Select two or more objects (Hierarchy) and use **Left / Centre / Right / Top / Middle / Bottom** to align them, or **Distribute** three or more evenly.

## Object types and instances
An **object type** is every entity with the same name — what event sheets call an object. **＋ Instance** adds another one; **Sync instances** copies the first instance's components, behaviors, scripts and tags to all the others (positions stay), so a change made once reaches every coin. Drag an object type (⠿) onto the **Overview** map to place a new instance at that spot; click the map to look there.

## Views and layouts
**Save current view** remembers where the scene view is looking; *Go to* returns. **Layouts (scenes)** lists your scenes: open one, create a new one, duplicate the current one or choose the start layout.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
