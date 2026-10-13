// X-KOM 2026 geoscape art: 8x8 world tiles (composed into world.png from assets/geo/world.map) + 16x16 map icons. Hand-typed pixels.
export const PAL = { '.': null, K: '#10101c', a: '#1c3a78', b: '#244a8c', c: '#2e5aa0', w: '#5a8ad0', g: '#3a7a34', h: '#4c9444', j: '#2c6228', d: '#b89a58', e: '#d0b470', f: '#9a7c40', i: '#e4eef8', n: '#b4c8e0', r: '#e03a2a', R: '#a01c1c', y: '#ffe060', G: '#6a7a8a', s: '#aab4c4', S: '#7a8494', B: '#3860b8', L: '#6a98e8', H: '#c0daff', o: '#ff9a30', E: '#d8f060', k: '#303040' };
export const TILES = {
  '~': ['aaaabaaa', 'aabaaaaa', 'aaaaaaba', 'baaaaaaa', 'aaaabaaa', 'aabaaaaa', 'aaaaaaab', 'abaaaaaa'],
  ',': ['aaaaaaaa', 'abbaaaaa', 'aawbaaaa', 'aaaaaaaa', 'aaaaabba', 'aaaaawba', 'aaaaaaaa', 'aaaaaaaa'],
  g: ['ggghgggg', 'gjgggghg', 'ggggjggg', 'hggggggg', 'gggjgghg', 'ggghgggg', 'gjggggjg', 'ggggghgg'],
  d: ['ddddeddd', 'dfdddded', 'ddddfddd', 'eddddddd', 'dddfddfd', 'ddedddde', 'dfddddfd', 'ddddedfd'],
  i: ['iiiiiniI'.replace('I', 'i'), 'iniiiiii', 'iiiiiiin', 'niiiiiii', 'iiiniiii', 'iiiiiini', 'inieiiii'.replace('e', 'i'), 'iiiiniii'],
};
export const ICONS = {
  base: ['................', '................', '.....KKKKKK.....', '...KKLLLLLLKK...', '..KLLLHHHHLLLK..', '.KLLHHLLLLHHLLK.', '.KLHLLLBBLLLHLK.', '.KLHLLBKKBLLHLK.', '.KLLLLBKKBLLLLK.', '.KLLLLLBBLLLLLK.', '.KBBBBBBBBBBBBK.', '..KKKKKKKKKKKK..', '................', '................', '................', '................'],
  ufo: ['................', '................', '................', '......KKKK......', '.....KssssK.....', '...KKKsssKKKK...', '..KsssssssssssK.', '.KSsrSsrSsrSsSK.', '..KSSSSSSSSSSK..', '...KKKKKKKKKK...', '................', '................', '................', '................', '................', '................'],
  terror: ['................', '.......o........', '......oyo.......', '.....oyyyo..o...', '..o..oyrro.oy...', '.oyo.oyrryoyyo..', '.oyyooyrryyyo...', '..oyyyrrrryo....', '..KKKKKKKKKKKK..', '..KkkKkkKkkKkK..', '..KkkKkkKkkKkK..', '..KKKKKKKKKKKK..', '................', '................', '................', '................'],
  hive: ['................', '................', '.....KKKKK......', '...KKhhhhhKK....', '..KhhgggghhhK...', '.KhgggrrgggghK..', '.KhggrRRrggghK..', '.KhgggrrgggghK..', '.KjggggggggjjK..', '..KKjjjjjjKK....', '....KKKKKK......', '................', '................', '................', '................', '................'],
};
export const ICON_NAMES = Object.keys(ICONS);
