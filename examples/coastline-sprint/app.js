import { COURSE, driver, traffic, updateDriver, padInput } from './track.js';
import { drawView } from './render.js';
import { RetroAudio } from './audio.js';
import { AUDIO } from './audio-config.js';
import { createUI } from './lib/nord-ui.js';
export async function mount(root) {
  // Page frame: a 16:9 canvas with room above/below for the UI bar and notice line.
  Object.assign(document.body.style, { margin: 0, background: '#101b2b' });
  const shell = Object.assign(document.createElement('div'), {
    style: 'position:relative;max-width:1100px;margin:auto;padding:56px 0 36px',
  });
  const canvas = Object.assign(document.createElement('canvas'), {
    width: 960,
    height: 540,
    tabIndex: 0,
    style: 'display:block;width:100%;image-rendering:pixelated',
  });
  shell.append(canvas);
  root.append(shell);
  // All menus and text live in ui/menu.ui.json (edit it in the UI Designer). The code only reacts to it.
  const menu = await createUI(shell).load('ui/menu.ui.json');
  const overlay = menu.$('overlay'),
    track = menu.$('track');
  const g = canvas.getContext('2d'),
    sound = new RetroAudio(AUDIO),
    keys = new Set();
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(Error('Missing ' + src));
      image.src = src;
    });
  const images = {
    cars: await load('assets/sprites/racing-cars.png'),
    roadside: await load('assets/sprites/roadside.png'),
  };
  let players = [driver()],
    cars = traffic(),
    mode = 1,
    state = 'menu',
    paused = false,
    last = performance.now(),
    engine = null,
    starting = false;
  const pad = () => Array.from(navigator.getGamepads?.() ?? []).find((p) => p?.connected);
  const keyboard = () => ({
    steer:
      (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    accel: keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0,
    brake: keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0,
    boost: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  });
  async function start(count) {
    if (starting) return;
    if (count === 2 && !pad()) {
      menu.set(
        'notice',
        'Connect a gamepad and press one of its buttons, then choose 2 player split.',
      );
      return;
    }
    starting = true;
    mode = count;
    players = Array.from({ length: mode }, (_, i) => driver(i));
    cars = traffic();
    paused = false;
    state = 'playing';
    keys.clear();
    overlay.visible = false;
    canvas.focus();
    try {
      await sound.unlock();
      await sound.music(track.index);
      if (engine) engine.source.stop();
      engine = await sound.play('engine', { loop: true, volume: 0.07 });
    } catch (error) {
      sound.problem = error.message;
    } finally {
      starting = false;
    }
  }
  function togglePause() {
    if (state !== 'playing') return;
    if (paused && mode === 2 && !pad()) return;
    paused = !paused;
    overlay.visible = paused;
    menu.$('ovTitle').text = 'PAUSED';
    menu.$('ovBody').text = 'Pause / Resume continues. Connect P2 gamepad if disconnected.';
    paused ? sound.suspend() : sound.resume();
    keys.clear();
  }
  menu.on('one', () => start(1));
  menu.on('two', () => start(2));
  menu.on('restart', () => start(mode));
  menu.on('pause', togglePause);
  menu.on('mute', () => {
    menu.$('mute').text = sound.mute() ? 'Unmute' : 'Mute';
  });
  menu.on('track', () => {
    if (sound.ctx) sound.music(track.index);
  });
  window.addEventListener('keydown', (e) => {
    if (
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code) &&
      state === 'playing'
    )
      e.preventDefault();
    if (e.code === 'KeyP' && !e.repeat) togglePause();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'playing' && !paused) togglePause();
  });
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (mode === 2 && state === 'playing' && !paused && !pad()) togglePause();
    if (state === 'playing' && !paused) {
      for (const car of cars) car.z += car.speed * dt;
      for (const p of players)
        for (const event of updateDriver(
          p,
          p.index ? padInput(pad()) : keyboard(),
          dt,
          cars,
        ))
          sound.play(event, { volume: event === 'crash' ? 0.65 : 0.5 });
      if (players.every((p) => p.finished || p.lost)) {
        state = 'result';
        if (engine) {
          engine.source.stop();
          engine = null;
        }
      }
    }
    if (engine) {
      engine.source.playbackRate.value = 0.7 + (players[0].speed / COURSE.maxSpeed) * 1.4;
      engine.gain.gain.value = paused
        ? 0
        : 0.035 + (players[0].speed / COURSE.maxSpeed) * 0.075;
    }
    const h = canvas.height / mode;
    players.forEach((p, i) => {
      g.save();
      g.beginPath();
      g.rect(0, i * h, canvas.width, h);
      g.clip();
      g.translate(0, i * h);
      drawView(g, p, cars, players, images, canvas.width, h);
      g.restore();
    });
    if (mode === 2) {
      g.fillStyle = '#0b1424';
      g.fillRect(0, h - 2, canvas.width, 4);
    }
    menu.set(
      'notice',
      sound.problem
        ? `Audio: ${sound.problem}`
        : mode === 2
          ? `P2 ${pad()?.id ?? 'GAMEPAD DISCONNECTED'} · ${state === 'result' ? 'Restart for a new race.' : 'P pauses both views.'}`
          : 'W/Up accelerates · S/Down brakes · A/D steer · Shift nitro · P pause',
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Read-only inspection seam used by browser checks; gameplay still runs through real inputs.
  window.__coast = {
    get players() {
      return players;
    },
    get paused() {
      return paused;
    },
    get state() {
      return state;
    },
    get sound() {
      return sound;
    },
  };
}
