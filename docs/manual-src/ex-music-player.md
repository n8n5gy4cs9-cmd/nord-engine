---
title: 9.5 · A music player and sound effects
section: Examples
order: 9.5
summary: Build a playlist player with autoplay, next/previous, stop and a volume control, then add clock sounds (a tick every second and a chime on the full hour), written Unity-style.
---

**Goal:** two small things you will build in almost every game. First a **music player**: songs that play one after another, with buttons to stop, skip and change the volume. Then **sound effects** for the clock from [page 3.5](ex-clock.html): a tick every second and a chime on the full hour.

Page [9 · Audio](ex-audio.html) lists every audio call. This page uses a few of them in two complete scripts.

::: dummies
Nord has two kinds of sound. **Music** is one long track at a time: starting another track fades the old one out. **Sound effects** are short sounds that play on top, as many as you like. They sit on separate volume knobs (*buses*), so a player can turn the music down and keep the effects.
:::

## What you need
Nord ships sample sounds. Copy these files into your project's `assets/audio/` folder (keep the sub-folder names), or use your own `.mp3`, `.ogg` or `.wav` files.

| File | Used for |
|---|---|
| `assets/audio/music/music_menu_chill.mp3` | song 1 |
| `assets/audio/music/music_ambient_space.mp3` | song 2 |
| `assets/audio/music/music_adventure.mp3` | song 3 |
| `assets/audio/sfx/tick.wav` | the clock tick |
| `assets/audio/sfx/bell.wav` | the hour chime |

Browsers only start audio after the player clicks or presses a key. Nord queues your calls until then, so autoplay "just works": the music starts on the first click.

## 1. Unity: the music player idea
In Unity you would hold an array of `AudioClip`s and one `AudioSource`, and start the next clip when the current one ends.

**Example** (not a file: the Unity version, for comparison)
```cs
public class MusicPlayer : MonoBehaviour
{
    [SerializeField] AudioClip[] songs;
    AudioSource source; int index;

    void Start() { source = GetComponent<AudioSource>(); Play(0); }
    void Play(int i) { index = i; source.clip = songs[i]; source.Play(); Invoke(nameof(Next), source.clip.length); }
    void Next() { Play((index + 1) % songs.Length); }
}
```

## 2. Nord: the music player
The Nord version has the same shape. `this.audio.music(path)` plays a track (it loops it and crossfades from the old one). A track does not tell you when it ends, so, as in the Unity code above, you read its length and call `Invoke` for the moment to switch.

**File: `scripts/MusicPlayer.js`** (new file, the whole file; attach it to an empty object called `Music Player`)
```js
import { MonoBehaviour, SerializeField, Mathf } from 'nord';

export default class MusicPlayer extends MonoBehaviour {
  static attributes = SerializeField({
    autoplay: true,
    volume: 0.6,
  });

  songs = [
    { title: 'Chill', path: 'assets/audio/music/music_menu_chill.mp3' },
    { title: 'Space', path: 'assets/audio/music/music_ambient_space.mp3' },
    { title: 'Adventure', path: 'assets/audio/music/music_adventure.mp3' },
  ];
  index = 0;
  playing = false;

  Start() {
    this.audio.volume('music', this.volume);
    this.title = this.ui.label('', { anchor: 'tl', x: 16, y: 16, size: 20 });
    this.ui.button('⏮', () => this.Previous(), { anchor: 'tl', x: 16, y: 56 });
    this.ui.button('▶', () => this.Play(), { anchor: 'tl', x: 72, y: 56 });
    this.ui.button('⏹', () => this.Stop(), { anchor: 'tl', x: 128, y: 56 });
    this.ui.button('⏭', () => this.Next(), { anchor: 'tl', x: 184, y: 56 });
    this.ui.button('Vol −', () => this.ChangeVolume(-0.1), { anchor: 'tl', x: 16, y: 104 });
    this.ui.button('Vol +', () => this.ChangeVolume(+0.1), { anchor: 'tl', x: 100, y: 104 });
    this.Refresh();
    if (this.autoplay) this.Play();
  }

  async Play() {
    this.CancelInvoke('Next');                    // forget the old "switch song" timer
    const song = this.songs[this.index];
    this.playing = true;
    this.audio.music(song.path, { fade: 1.5, volume: 1 });
    this.Refresh();
    const buffer = await this.audio.load(song.path);   // the decoded sound: its length is buffer.duration
    if (buffer && this.playing) this.Invoke('Next', buffer.duration - 1.5); // start the next song 1.5 s early so they overlap
  }

  Stop() {
    this.playing = false;
    this.CancelInvoke('Next');
    this.audio.stopMusic({ fade: 0.5 });
    this.Refresh();
  }

  Next() { this.index = (this.index + 1) % this.songs.length; this.Play(); }
  Previous() { this.index = (this.index - 1 + this.songs.length) % this.songs.length; this.Play(); }

  ChangeVolume(delta) {
    this.volume = Mathf.Clamp(this.volume + delta, 0, 1);
    this.audio.volume('music', this.volume);       // the "music" bus: effects keep their own volume
    this.Refresh();
  }

  Refresh() {
    const song = this.songs[this.index];
    this.title.set(`${this.playing ? '▶' : '⏹'} ${song.title}   vol ${Math.round(this.volume * 100)}%`);
  }

  OnDestroy() { this.Stop(); }
}
```

### Try it
1. @ui[Hierarchy ▸ + Create ▸ Empty], rename it `Music Player`.
2. @ui[Assets ▸ right-click `scripts` ▸ New MonoBehaviour script], name it `MusicPlayer`, replace the whole file with the code above.
3. Select `Music Player`, @ui[Inspector ▸ + Add script ▸ scripts/MusicPlayer.js]. The fields **autoplay** and **volume** appear.
4. Press @ui[Play] and click once inside the Game view. The first song fades in. The buttons skip, stop and change the volume.

::: dummies
`Invoke('Next', 30)` means "call my `Next` method in 30 seconds". We ask the sound how long it is (`buffer.duration`) and use that as the wait, so `Next` runs when the song is nearly over. `CancelInvoke('Next')` cancels a waiting timer, which we need when you press a button yourself; otherwise the old timer would still fire.
:::

**What you see:** a small panel in the corner with the song name and four buttons, and music. Pressing ⏭ crossfades to the next song; ⏹ fades the music out and keeps the label on the current song; **Vol −/+** moves the music volume in 10 % steps.

**Traps**
* No sound at all? You must click in the Game view once (browsers block sound until then).
* The same song requested again is *not* restarted. That is why `Play()` after `Stop()` works: `stopMusic` clears the current track first.
* The `⏮ ▶ ⏹ ⏭` characters are plain text. If your font lacks one, write `Prev`, `Play`, `Stop`, `Next`.

## 3. Sound effects: the clock tick and the hour chime
Sound effects use `this.audio.play(path, options)`. Add them to the `Clock.js` from page 3.5. The clock already computes `totalSeconds` (seconds since midnight) every frame; a new sound should play only when the *whole second* changes, not every frame.

**File: `scripts/Clock.js`** (from page 3.5: add the `lastSecond` field and the `PlaySounds` method, and call it as the last line of `Update()`; the `import` line stays as it is)
```js
// 1. inside the class, next to the static attributes:
lastSecond = -1;

// 2. a new method:
PlaySounds(totalSeconds) {
  const second = Math.floor(totalSeconds);         // 0..86399: changes once per second
  if (second === this.lastSecond) return;          // same second as last frame: nothing to do
  this.lastSecond = second;

  const secondOfHour = second % 3600;
  if (secondOfHour === 0) this.audio.play('assets/audio/sfx/bell.wav', { volume: 1 });   // full hour
  else this.audio.play('assets/audio/sfx/tick.wav', { volume: 0.4 });                    // every other second
}

// 3. last line of Update():
this.PlaySounds(totalSeconds);
```

**What you see and hear:** a quiet tick each second. At 12:00:00, 13:00:00 and so on a bell rings instead of the tick.

::: dummies
Why remember `lastSecond`? `Update` runs about 60 times a second, so without it the tick would play 60 times each second. We play only when the number of whole seconds *changed*.
:::

### Make the chime ring once per hour (like a real clock)
A coroutine can wait between bells. Replace the bell line with a call to `Chime`.

**File: `scripts/Clock.js`** (replace the `if (secondOfHour === 0) ...` line in `PlaySounds` with the call below, and add the `Chime` method)
```js
if (secondOfHour === 0) this.StartCoroutine(this.Chime(Math.floor(second / 3600) % 12 || 12));
// …
*Chime(times) {
  for (let i = 0; i < times; i++) {
    this.audio.play('assets/audio/sfx/bell.wav', { volume: 0.9, rate: 1 - i * 0.01 }); // a hair lower each bell
    yield new WaitForSeconds(1.2);
  }
}
```
Add `WaitForSeconds` to the `import` line of `Clock.js`: `import { MonoBehaviour, SerializeField, EntityRef, Quaternion, WaitForSeconds } from 'nord';`. At 3:00 you now hear three bells, at 12:00 twelve.

### Quiet at night, and a sound that follows the music volume
* Effects use the `sfx` bus and music the `music` bus: `this.audio.volume('sfx', 0.5)` lowers every effect at once, and `this.audio.mute('sfx', true)` silences them.
* `{ pan: -1 }` plays a sound in the left speaker, `{ pan: 1 }` in the right; `{ rate: 1.2 }` plays it 20 % faster (and higher).
* To avoid hard-coding file names in gameplay code, see *Sounds from events* on page [9 · Audio](ex-audio.html).

**Check yourself:**
1. Press @ui[Play] and click in the Game view. Music starts and the label shows the first song.
2. Press ⏭ and the music crossfades; press ⏹ and it fades out.
3. With the clock scene running you hear one tick per second. Change your computer clock, or temporarily change `secondOfHour === 0` to `secondOfHour % 10 === 0`, and the bell sounds every ten seconds, which is an easy way to test the chime.

**Next:** [10 · Saving and loading](ex-save-load.html): remember the music volume between sessions.
