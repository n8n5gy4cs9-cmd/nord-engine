---
title: Organising your project
section: Manual
group: Getting oriented
order: 39
summary: Colour folders, custom folder icons, colour tags and descriptions for any asset, the Notes manager, the Console with tags and search, and the Transform grid. Saved per project.
---

## Use this page

This chapter explains **organising your project**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Assets: colours, icons, tags, descriptions | [Read this section](#assets-colours-icons-tags-descriptions) |
| Notes manager | [Read this section](#notes-manager) |
| Console (like Console Pro) | [Read this section](#console-like-console-pro) |
| Inspector: Transform grid | [Read this section](#inspector-transform-grid) |

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

## Assets: colours, icons, tags, descriptions
Right-click any folder or asset in the @ui[Assets] tab. Everything is saved **per project** in `.nord/asset-meta.json` (commit it to share with your team).

| Feature | How |
|---|---|
| @term[Folder colour] | Folders are the filled folder shape in your theme's accent colour. @ui[Folder color] ▸ pick a swatch; @ui[Default color] goes back to the theme colour. Shown in the tree, grid and list. |
| @term[Folder icon] | @ui[Folder icon] ▸ pick one of 28 icons (drawn as a badge on the folder), **or** @ui[Your own image…] to use any image of the project instead of the folder shape, **or** @ui[Automatic (by content)] for a badge of what the folder mostly contains. |
| @term[Automatic badges] | Off by default. Turn on in @ui[View]: folders without their own icon get a small badge for what they mostly contain (images, audio, models, scripts, prefabs…). |
| @term[Colour tags] | @ui[Tags ▸ New tag…] makes a tag (name + colour); tick tags on any asset or folder. Coloured dots show next to the name; filter the browser with the @ui[Tags] drop-down. |
| @term[Descriptions] | @ui[Description…] on any asset or folder. Shown as a tooltip when you hover it. |
| @term[Zebra striping] and @term[indent guides] | @ui[View] menu of the Assets toolbar: alternate row shading and vertical guide lines in the folder tree. |

Renaming, moving and deleting keep the colours, icons, tags and descriptions in sync.

## Notes manager
@ui[Window ▸ Editors ▸ Notes] opens a notes and planning board that lives in the project (`.nord/notes.json`).
1. @ui[+ New note], type a title.
2. Pick a **colour** and a **status**: Note, Planned, In progress, Done. The list on the left shows the colour stripe, status and task progress; filter by status or search.
3. Add **tasks** (type and press @key[Enter]), tick them off, and watch the progress bar.
4. Write ideas, bugs and design text in the big text area. Everything saves as you type.

## Console (like Console Pro)
@ui[Console] tab:
* **Colours and icons:** grey info, yellow warnings, red errors, accent-coloured build lines; each filter button shows how many lines it holds.
* **[Tag] prefix:** a log line that starts with `[Combat]` gets a tag. Pick tags in the @ui[All tags] drop-down. In your game: `console.log('[Combat] hit')` or `log.combat('hit')` from the Dev Console library.
* **Search** highlights matches in yellow. **Time** shows when each line arrived. **Collapse** groups identical lines with a count. **Auto-scroll** follows the newest line.
* **Click a line** to see its full text in the resizable detail pane (drag the splitter). **Double-click** a line with `file.js:12` to open the file at that line. Right-click ▸ copy, or show only that tag.
* **Font size** slider, **Clear on Play**, **Pause on error** (pauses the game when an error is logged), **Export…** (writes the visible lines to `logs/console-<time>.txt` for bug reports).

## Inspector: Transform grid
The Transform section is a grid: **Position / Rotation / Scale** rows, and the columns are the axes with coloured letters, X red, Y green, Z blue, so values line up like in Unity. The same coloured letters are used in every vector field of the Inspector. Icon buttons such as @ui[Show in Assets] are centred on their row.


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
