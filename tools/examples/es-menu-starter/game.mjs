import { E, rect, text, project, C, A, sys, EV, setv, V, group, comment, SHARED_ASSETS } from '../es-lib.mjs';

const btn = (name, key, y, event) => E(name, { c: [{ type: 'uiButton', text: key, textKey: key, x: 0, y, anchor: 'c', w: 220, event }] });
const lbl = (name, key, y, size = 20) => E(name, { c: [{ type: 'uiLabel', text: key, textKey: key, x: 0, y, anchor: 'c', size }] });

export default () => {
  const menuEvents = [
    comment('Main menu: buttons emit game events (uiButton "event"); the sheet reacts with Events → On game event.'),
    EV([C('Events', 'on-event', { name: 'play' })], [A('Audio', 'play', { file: '"assets/audio/sfx/confirm.wav"', loop: '"once"' }), A('System', 'go-to-layout', { layout: '"game"' })]),
    EV([C('Events', 'on-event', { name: 'options' })], [A('System', 'go-to-layout', { layout: '"options"' })]),
  ];
  const optionEvents = [
    comment('Options: language switch (Localisation) and music volume (Audio). Strings live in nord.project.json → strings.'),
    V('volume', 0.8),
    EV([C('Events', 'on-event', { name: 'lang-en' })], [A('Localisation', 'set-language', { language: '"en"' })]),
    EV([C('Events', 'on-event', { name: 'lang-fi' })], [A('Localisation', 'set-language', { language: '"fi"' })]),
    EV([C('Events', 'on-event', { name: 'vol-up' })], [setv('volume', 'min(1, volume + 0.1)'), A('Audio', 'set-volume', { bus: 'music', volume: 'volume' })]),
    EV([C('Events', 'on-event', { name: 'vol-down' })], [setv('volume', 'max(0, volume - 0.1)'), A('Audio', 'set-volume', { bus: 'music', volume: 'volume' })]),
    EV([C('Events', 'on-event', { name: 'back' })], [A('System', 'go-to-layout', { layout: '"menu"' })]),
    EV([sys('every-tick')], [A('VolumeLabel', 'set-text', { text: 'Localisation.Text("volume") & ": " & round(volume * 100) & "%"' })]),
  ];
  const gameEvents = [
    comment('Your game goes here. Escape returns to the menu.'),
    EV([C('Keyboard', 'on-key-pressed', { key: 'Escape' })], [A('System', 'go-to-layout', { layout: '"menu"' })]),
  ];
  const strings = {
    en: { title: 'MY GAME', play: 'Play', options: 'Options', language: 'Language', volume: 'Volume', back: 'Back', 'vol-up': 'Louder', 'vol-down': 'Quieter', hint: 'Press Esc to go back to the menu', 'lang-en': 'English', 'lang-fi': 'Suomi' },
    fi: { title: 'PELINI', play: 'Pelaa', options: 'Asetukset', language: 'Kieli', volume: 'Äänenvoimakkuus', back: 'Takaisin', 'vol-up': 'Kovemmalle', 'vol-down': 'Hiljemmalle', hint: 'Paina Esc palataksesi valikkoon', 'lang-en': 'English', 'lang-fi': 'Suomi' },
  };
  const bg = (c) => rect('Background', 320, 180, 640, 360, c, { z: -10 });
  const pr = project('es-menu-starter', 'Menu Starter', '2d', { bg: '#2e3440', physics: { engine: 'none', gravity: [0, 0, 0] }, input: {} });
  pr.strings = strings; pr.defaultLanguage = 'en'; pr.startScene = 'scenes/menu.scene.json';
  return {
    name: 'Menu starter (event sheet)',
    project: pr,
    scenes: {
      menu: { settings: { eventSheet: 'events/menu.events.json' }, entities: [bg('#2e3440'), lbl('Title', 'title', -110, 44), btn('PlayButton', 'play', -30, 'play'), btn('OptionsButton', 'options', 30, 'options')] },
      options: { settings: { eventSheet: 'events/options.events.json' }, entities: [bg('#3b4252'), lbl('Heading', 'options', -130, 32), lbl('LangLabel', 'language', -70),
        E('EnButton', { c: [{ type: 'uiButton', text: 'English', x: -70, y: -30, anchor: 'c', w: 120, event: 'lang-en' }] }), E('FiButton', { c: [{ type: 'uiButton', text: 'Suomi', x: 70, y: -30, anchor: 'c', w: 120, event: 'lang-fi' }] }),
        E('VolumeLabel', { c: [{ type: 'uiLabel', text: '', x: 0, y: 20, anchor: 'c', size: 18 }] }),
        E('DownButton', { c: [{ type: 'uiButton', text: 'vol-down', textKey: 'vol-down', x: -70, y: 60, anchor: 'c', w: 120, event: 'vol-down' }] }), E('UpButton', { c: [{ type: 'uiButton', text: 'vol-up', textKey: 'vol-up', x: 70, y: 60, anchor: 'c', w: 120, event: 'vol-up' }] }),
        btn('BackButton', 'back', 120, 'back')] },
      game: { settings: { eventSheet: 'events/game.events.json' }, entities: [bg('#434c5e'), lbl('Hint', 'hint', 150, 14), text('Placeholder', 320, 170, 'Your game here', { size: 28 })] },
    },
    files: { 'events/menu.events.json': { format: 1, name: 'menu', events: menuEvents }, 'events/options.events.json': { format: 1, name: 'options', events: optionEvents }, 'events/game.events.json': { format: 1, name: 'game', events: gameEvents } },
    assets: [...SHARED_ASSETS, 'assets/audio/sfx/confirm.wav'],
    template: { id: 'es-menu-starter', title: 'Menu starter (event sheet)', description: 'Main menu, options (language + volume) and a game scene, wired with game events and string tables (English/Finnish).' },
    readme: '# Menu starter (event sheet)\nThree scenes: `menu`, `options`, `game`. Buttons are `uiButton` components with an `event` name; each scene\'s event sheet reacts with **Events → On game event** and switches scenes (*Go to layout*), language (*Localisation*) or volume (*Audio*). Texts use `textKey` + `nord.project.json → strings`, so they follow the language. Replace the `game` scene with yours.\n',
  };
};
