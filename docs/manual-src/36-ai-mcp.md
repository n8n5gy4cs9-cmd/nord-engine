---
title: AI and MCP
section: Manual
group: Projects, objects and scripts
order: 36
summary: Let Claude Code, opencode, Codex or pi build a Nord game for you: install the Nord MCP server, what the tools do, and the 3D Modeler tools with a preview the AI can look at.
---

## Use this page

This chapter explains **ai and mcp**. Open a saved project before following editor steps. Use the topic links below for a specific task; follow [Tutorials](tutorials.html) when you want a complete project to build in order.

| Find the instructions for | Go to |
|---|---|
| Install (once) | [Read this section](#install-once) |
| Use | [Read this section](#use) |
| Safety | [Read this section](#safety) |
| 3D Modeler tools | [Read this section](#3d-modeler-tools) |

::: dummies
This is a reference chapter: you do not have to complete every section. Choose one task, make that change in the editor, and press Play to check the result. An **entity** is an object in your scene; a **component** adds a capability; a **script** adds your own rules.
:::

Nord ships an **MCP server** (`mcp/nord-mcp.mjs`, Node 18+, no installs) so an AI coding agent can create a project, edit scenes and scripts, validate, build and play-test it, and model 3D props. It starts with built-in guidance (`nord_guide`) that reads the engine's own docs, so the AI learns the real API instead of guessing.

## Install (once)
1. Build the CLI: `cargo build -p nord-cli` in the engine folder.
2. Print the configuration for your agent, then paste it where it says:

**Terminal** (in the Nord Engine folder):
```bash
node mcp/nord-mcp.mjs --config claude --project /path/to/my-game
```
Replace `claude` with `opencode`, `codex` or `pi`. For Claude Code that is `claude mcp add nord -- node …/mcp/nord-mcp.mjs --project /path/to/my-game`. (pi needs the `pi-mcp-adapter` extension: it has no MCP client of its own.) Use `--only modeler` for a server that only has the 3D tools. Full reference of every tool: `docs/MCP.md`.

## Use
Tell the agent what you want ("make a 2D platformer with three levels") and let it read `nord_guide` first. Ready-made prompts: `make-a-game` and `model-a-prop`. The agent works in a loop: create/open project → read the guide topic it needs → add entities and scripts → `check_project` → `serve_start` (open the URL, live reload) → `build_project`.

## Safety
File tools only touch the project folder, there is no shell tool and no delete tool. `.git`, `target` and `node_modules` are protected. Review the changes with git as with any AI-edited project.

## 3D Modeler tools
The `modeler_*` tools edit the same files as the **3D Modeler** tab (`models/<name>.mesh.json` + `.glb`). The AI builds from primitives, extrudes, mirrors, unwraps, paints the texture with simple shapes and, most importantly, calls **`modeler_preview`**: a built-in software renderer returns images of the model (iso, front, top…), so the AI sees and corrects its work. `modeler_open` also opens a `.glb` that is used in a scene; open the result afterwards in the editor's Modeler tab to continue by hand.

## Keeping it current
The guide text and `docs/MCP.md` are part of the engine and updated together with it (a test fails when the generated reference is stale).


## Check yourself

- Save the project, then repeat the action from the section you used. Confirm the stated result before moving on.
- If Play fails, check the Console for the first error and compare file paths and capitalisation with the example.
- For platform or feature limits, check [Known issues](known-issues.html).

Next: [Choose a worked example](examples.html). Back to: [Manual reading paths](manual-paths.html).
