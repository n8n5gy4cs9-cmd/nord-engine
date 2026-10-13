---
title: Programming for dummy developers
section: Start here
order: 3
summary: Read your first Nord script, understand values and calls, and fix a small error.
---
You can use templates before writing code. When you want your own behavior, learn a few pieces at a time. This page assumes you have never written a game script.

## What the code is saying
Save this as `scripts/spinner.js`, then attach it to a visible entity through **Inspector → Add script**. The script file is a complete JavaScript module:

```js
import { NordScript } from 'nord';

export default class Spinner extends NordScript {
  update(dt) {
    this.entity.rot[2] += 90 * dt;
    this.entity.touch();
  }
}
```

Press Play. The entity rotates 90 degrees per second around its Z axis. In a 2D project, that is a turn on the screen. If nothing turns, check that the script is attached to the entity with the picture, and read Console for errors.

| Code | Meaning |
|---|---|
| `import { NordScript } from 'nord'` | Bring in Nord's base script class. `nord` is the import name provided by the project. |
| `export default class Spinner extends NordScript` | Give Nord a script named Spinner. The braces contain its behavior. |
| `update(dt)` | Nord calls this every frame. `dt` is the number of seconds since the previous frame. |
| `this.entity` | The entity this script belongs to. |
| `rot[2]` | The third number in its rotation array: Z. Arrays count from zero. |
| `+= 90 * dt` | Add a small turn. Multiplying by seconds keeps the speed similar on different computers. |
| `touch()` | Tell Nord you changed numbers inside a transform array, so the picture updates. |

## Values, names and functions
A **value** is data: `90` is a number, `'Player'` is text, and `true` is yes. A **variable** gives a value a name:

```js
const speed = 90;
const message = 'Hello Nord';
console.log(message);
```

A **function call** asks something to do work. In `console.log(message)`, the parentheses hold the input. The Console displays `Hello Nord`.

A **property** stores a value on an object: `this.entity.name`. A **method** is a function on an object: `this.entity.touch()`. The parentheses are the useful clue.

## Arrays and objects
An **array** is an ordered list. Nord positions use `[x, y, z]`:

```js
this.entity.pos = [100, 80, 0];
```

An **object** names its values. Scene component settings use objects:

```json
{ "type": "text", "text": "Hello Nord", "size": 32 }
```

JSON is a file format for data. It uses double quotes and does not allow JavaScript comments or functions. JavaScript is the language that runs your behavior.

## When to use start and update
Use `start()` for something that should happen once. Use `update(dt)` for something that changes while the game runs.

```js
import { NordScript } from 'nord';

export default class Greeting extends NordScript {
  start() {
    console.log('The scene is ready!');
  }
}
```

Do not print a message in `update` unless you want it repeated every frame. [The lifecycle table](scripting.html#lifecycle) lists the other moments Nord can call your script.

## Make a setting editable
An **attribute** is a script setting shown in the Inspector. In [T03: Your first script](tut-t03-first-script.html), attributes let you change the size and speed of a pulse. The code reads these settings from `this.attrs`.

Scene overrides can replace defaults in the file. If changing a default does not change an existing entity, check its value in the Inspector.

## Read an error without panicking
1. Read the **first** error in Console. Later errors may be caused by it.
2. Open its file and line number.
3. Check spelling, missing brackets, quotes and commas.
4. Save and try again. If you changed an imported helper file, restart Play.

`undefined` means a value is missing. For example, a wrong entity name can make a lookup return no entity; a missing component can make `getComponent(...)` return no handle. Check that the thing exists before using it.

Next: [T03: Your first script](tut-t03-first-script.html). Keep [NordScript](api-nordscript.html) nearby when you want the complete method list.
