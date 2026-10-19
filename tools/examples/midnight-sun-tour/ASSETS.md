# Assets — Midnight Sun Tour

Source of truth: `tools/examples/midnight-sun-tour/`. Generate only this example with
`node tools/gen_examples.mjs midnight-sun-tour`. Never edit `examples/` directly.

## Art, 2026-10-19

The owner's **MikkoLevon_title.png is unchanged**. All 97 other legacy PNGs are replaced.
Original art was generated with the built-in ImageGen tool, with the title and the owner's
Amiga references providing direction. No commercial-game pixels or external game source were copied.
Palette: indigo, copper, lilac, magenta sunset, muted forest green; worn Finnish rock-tour equipment.
Mikko and the band are weathered middle-aged musicians, with tired eyes, lined faces and worn clothes.

| File | Purpose |
|---|---|
| `assets/sprites/tour_environments.png` | Forest, stage, campsite and harbor backgrounds, 2 × 2 atlas |
| `assets/sprites/tour_cast_source.png` | Authoritative ImageGen cast/vehicles/gear source, final aged-band edit |
| `assets/sprites/tour_cast.png` | Exact 8 × 4 packed transparent atlas consumed by the new games |
| `assets/sprites/tour_facilities_source.png` / `tour_facilities.png` | Five isometric festival buildings / exact packed atlas |
| `assets/sprites/tour_map_source.png` | Authoritative painted terrain map; gameplay markers/roads drawn separately |
| `assets/sprites/tour_events_source.png` | 4 × 4 original encounter and ending illustrations |
| Existing sprite filenames | Repacked art, preserving their existing dimensions except the map (now 640 × 360) |
| `assets/fonts/vt323.woff2` | Existing VT323 font, OFL |

`python3 tools/art/midnight/pack.py` packs the reviewed source crops and redraws the code-native
copper UI exports. It does **not** call an image API and never changes the title. The source atlas
has unequal cells, so its reviewed bounds are explicit; runtime atlas cells are exactly 256 × 256.
The source images remain ordinary editable PNG files. Customer clothing, hair, skin tones and two-leg walking animation are code-drawn in `festival_visitors.js`; no additional audio or image dependencies. UI chrome in `tour_art.js` and
`nordscrap/compat.js` is drawn in code. Some retained legacy raster slots (including the old bitmap
font sheet) are unused; live text uses the vendored font.

## Audio and replacement slots

**No new sound files were needed or generated.** The original missing headlight effect reference now reuses `assets/sfx/ui_click.mp3`. Existing owner's 22 music MP3s, six artist
recordings and 40 SFX are retained. Their paths are in `scripts/game/game_constants.js`.
Replace a recording with another MP3 at the same path; keep the filename, then regenerate this example.

| Artist / role | File |
|---|---|
| Queen | `assets/music/band_music/queen_live.mp3` |
| Brian Jonestown Massacre | `assets/music/band_music/bjm_live.mp3` |
| Aldous Harding | `assets/music/band_music/aldous_harding_live.mp3` |
| Burial | `assets/music/band_music/burial_dj_set.mp3` |
| Islaja | `assets/music/band_music/islaja_live.mp3` |
| Karhumauri | `assets/music/band_music/karhumauri_live.mp3` |
| Mikko's set / fictional acts without recordings | `assets/music/gig_performance.mp3` |
| Festival planning | `assets/music/festival_good.mp3` |
| New jobs | Existing `assets/music/arcade.mp3` |
| Runner / shootout | Existing `runner.mp3` / `kickoff.mp3` |

Ruisrock is a management game, with no rhythm minigame. A booked artist's recording starts with
that artist's set. Sets last 90 seconds; N advances to the next set and ENTER closes the day.
An artist without a recording uses the original generic performance loop. Unbooked artists are
never selected as fallback music. Artist recordings remain third-party recordings from the owner's
original project; provenance is recorded in root `THIRD_PARTY.md`.

## ImageGen prompts (built-in tool; no CLI/API fallback)

### Environment atlas
Use case: stylized-concept. Production game environment atlas for Finnish rock band road trip Midnight Sun Tour. Original Amiga 1991 pixel art, detailed hand-dithered dark indigo, violet, magenta sunset, copper amber, moss green palette matching supplied title inspiration. One image arranged EXACTLY 2 columns by 2 rows, four equal rectangular panels with no borders or text: TOP LEFT Finnish pine forest roadside at midnight sunset, horizontal side-view landscape empty ground foreground for platform game; TOP RIGHT rock festival stage at dusk with amps drums lighting trusses and tiny crowd along bottom, empty central stage; BOTTOM LEFT top-down richly detailed green campsite with gravel paths tents birches parked rusty blue tour bus near edge, open central grass play area; BOTTOM RIGHT top-down dark Baltic water harbor with wooden piers around edges, empty navigable central water. No text, no UI, no lettering, no logos. Consistent crisp pixel shapes, atmospheric layered scenery, detailed but readable at 640x360. All four panels fill their quadrants.

### Initial cast atlas
Use case: stylized-concept. Production 2D game sprite atlas for Finnish rock band bus trip, crisp detailed Amiga pixel art, dark indigo outlines purple highlights copper rust amber and muted teal. TRANSPARENT background. STRICT 8 columns x 4 rows equal cells, each sprite fully inside its cell with wide empty padding, no overlap. Row 1 left to right: rusty blue tour bus side view; same bus front view; same bus rear view; red Lada rear view; green pine tree; white birch tree; brown moose side view; gray boulder. Row 2: full body black haired bearded leather jacket rock singer standing; same singer running left leg forward; same singer running right leg forward; blond guitarist standing; dark haired bass player standing; woman drummer standing; small blue motorboat top-down; orange rescue buoy. Row 3: guitar amp; drum kit; twin PA speakers; cardboard merch box with shirts; spare tire; beer crate; black guitar case; red petrol pump. Row 4: closeup portrait black haired bearded rock singer; blond guitarist portrait; bass player portrait; woman drummer portrait; khaki tent; silver mixing console; green alien arcade invader; silver spaceship. No text, no labels, no grid lines. Consistent game sprite sheet with 32 separate recognizable subjects in exact order. Artwork useful at 48 to 96 pixels, clean silhouettes, restrained dither textures.

### Final aged-band edit
Inputs: initial cast atlas, unchanged owner title. Transparent background.
Use case: precise-object-edit. Edit the FIRST image, a game sprite atlas. Preserve exact image dimensions, transparent background, every object position and size, all vehicles, trees, moose, gear, boat, tent, mixer, alien and ship unchanged. Change ONLY the human band character sprites in the second row and four portrait faces at bottom left. Use the SECOND image as Mikko identity/style reference: black shaggy unwashed hair, tired heavy-lidded visible eyes WITHOUT sunglasses, full scruffy beard, rough lined face, worn black leather jacket and faded gray shirt, Finnish road musician aged around 48. Make all four band members weathered middle-aged artists aged 45-60 who have lived on the road and had plenty of beer: wrinkles, under-eye bags, stubble on men, tired expressions, unkempt hair, worn denim and leather, believable lived-in bodies. Keep blond guitarist identity but older with unkempt thinning blond hair and reddish beard stubble, bass player older scruffy dark-haired with gray streaks, drummer woman older with crow's-feet and tousled reddish hair and worn band shirt rather than glamorous outfit. Keep full body character poses and animation silhouettes. Maintain detailed Amiga pixel art, dark indigo outlines and muted copper-purple palette. No text or new objects. Preserve all non-human sprites exactly.

### Map
Use case: stylized-concept. Original Amiga pixel art illustrated Finland road trip map background, no text no markers no roads no border, to fill 640x360 game map. Top-down painted forest and lakes landscape, Finnish coastline diagonally from bottom-left near x180 y310 to x320 y170 then x360 y30; Baltic dark purple water on left and bottom-left; green pine forest and many irregular small blue lakes in right two thirds. Land must cover positions (500,50),(420,93),(390,128),(410,163),(340,205),(280,240),(230,280),(190,300). Beautiful atlas cartography with clusters of tiny trees, rocky shores, moss-green land, indigo sea, lilac highlights, subtle copper sunset lighting. Use entire frame as geographic map, no sky or horizon. Crisp pixel art with dither texture. Absolutely no labels, no title, no typography.

### Encounter and ending cards
Use case: illustration-story. Original Amiga 1991 pixel art illustrated event-card atlas for Finnish rock band bus road trip. Exact 4 columns by 4 rows, 16 equal landscape panels, no borders no text. Every panel separate scene, consistent detailed pixel illustration dark indigo purple magenta sunset amber rusty blue bus moss green pine palette. Row 1: moose blocking forest road; lakeside wood sauna cabin; roadside speed camera; small karaoke bar with bearded singer. Row 2: rusty blue bus lost at forest crossroads; rainstorm over Finnish road; hitchhiker beside bus; roadworks with orange barriers. Row 3: local rock band playing basement; broken wooden bridge over stream; festival posters pasted on kiosk without lettering; midsummer bonfire by lake. Row 4: triumphant huge outdoor rock festival crowd; intimate successful rock show; tired band resting by rusty blue bus; rainy empty festival field. Each panel composed as a complete game illustration filling its cell. Rich painterly dither textures and crisp pixel shapes. No text, no letters, no logos or UI.

### Festival facilities
Use case: stylized-concept. Original Amiga pixel art game sprites for a Finnish 1991 rock festival tycoon. Exactly FIVE separate isometric building sprites in ONE horizontal row, five equally spaced equal-width cells left to right, transparent background, no overlap, no text or labels. 1: small rustic grilled sausage food kiosk with copper roof, counter and tiny warm lamps. 2: block of four clearly recognizable blue portable toilet cubicles with doors and little roof vents. 3: purple-and-copper merchandise canopy tent with hanging T-shirts and records on counter. 4: outdoor concert stage with black truss roof, loudspeakers, drum kit and amber spotlights. 5: little camping plot with three olive tents, birch tree and campfire. Consistent isometric top-down three-quarter view like 1990s Theme Park / Transport Tycoon art, dark indigo outlines, muted moss green, aged wood, magenta and copper highlights. No people. Each sprite fully inside its own cell with generous transparent padding. Crisp pixel shapes and rich restrained dither detail, readable as small game icons.
