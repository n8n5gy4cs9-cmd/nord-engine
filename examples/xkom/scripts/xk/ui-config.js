// All UI font sizes in one place. Canvas sizes are logical pixels (game zoom = 3).
// Existing per-label `scale` values multiply these sizes. Reload after editing.
export const FONT_SIZES = {
  body: 7,          // X-KOM menus, HUD, radar, research and help
  heading: 5,       // multiplied by heading scale (usually 2)
  title: 5,         // multiplied by title scale (usually 4)
  button: 7,        // centered labels in buttons and facility tiles
  bitmap: 6,        // smaller bitmap glyphs; RTS and font-load fallback
  redFrontBody: 10,
  redFrontHeading: 5,
  redFrontTitle: 7,
  pause: 12,        // DOM overlay sizes are actual screen pixels
  pauseNote: 10,
  console: 11,
};
