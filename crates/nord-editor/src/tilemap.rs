//! Tilemap editing logic (M10-18) on the Nord tilemap JSON (`*.tilemap.json`: `tileWidth`, `tileHeight`, `tileset`, `layers[{name, data}]`,
//! `collides`, `animatedTiles`, `terrains`). Layer `data` is either rows of ints or a flat list with `width`; -1 = empty.
//! Pure functions so brushes, auto-tiling and layer management are unit-tested; the UI is in `panels/animation.rs`.
use crate::panels::animation::{get_cell, map_size, set_cell};
use serde_json::{json, Value};

pub fn new_map(tileset: &str, tile_w: u32, tile_h: u32, w: usize, h: usize) -> Value {
    json!({
        "tileset": tileset, "tileWidth": tile_w, "tileHeight": tile_h,
        "layers": [{ "name": "ground", "data": vec![vec![-1; w]; h] }],
    })
}

fn dims(map: &Value) -> (usize, usize) {
    map_size(map)
}

pub fn get(map: &Value, layer: usize, x: i64, y: i64) -> i64 {
    let (w, h) = dims(map);
    if x < 0 || y < 0 || x as usize >= w || y as usize >= h {
        return -1;
    }
    get_cell(&map["layers"][layer], w, x as usize, y as usize)
}

pub fn set(map: &mut Value, layer: usize, x: i64, y: i64, tile: i64) {
    let (w, h) = dims(map);
    if x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h {
        set_cell(&mut map["layers"][layer], w, x as usize, y as usize, tile);
    }
}

pub fn rect_fill(map: &mut Value, layer: usize, x0: i64, y0: i64, x1: i64, y1: i64, tile: i64) {
    for y in y0.min(y1)..=y0.max(y1) {
        for x in x0.min(x1)..=x0.max(x1) {
            set(map, layer, x, y, tile);
        }
    }
}

/// Flood fill of the connected cells that hold the same tile. Returns cells changed.
pub fn flood(map: &mut Value, layer: usize, x: i64, y: i64, tile: i64) -> usize {
    let target = get(map, layer, x, y);
    let (w, h) = dims(map);
    if target == tile || x < 0 || y < 0 || x as usize >= w || y as usize >= h {
        return 0;
    }
    let mut stack = vec![(x, y)];
    let mut n = 0;
    while let Some((cx, cy)) = stack.pop() {
        if cx < 0
            || cy < 0
            || cx as usize >= w
            || cy as usize >= h
            || get(map, layer, cx, cy) != target
        {
            continue;
        }
        set(map, layer, cx, cy, tile);
        n += 1;
        stack.extend([(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)]);
    }
    n
}

/// Deterministic pick for the random brush: the same cell always gets the same tile, so repainting does not flicker.
pub fn random_pick(tiles: &[i64], x: i64, y: i64, salt: u64) -> i64 {
    if tiles.is_empty() {
        return -1;
    }
    let mut h = (x as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15)
        ^ (y as u64).wrapping_mul(0xC2B2_AE3D_27D4_EB4F)
        ^ salt;
    h ^= h >> 29;
    h = h.wrapping_mul(0xBF58_476D_1CE4_E5B9);
    h ^= h >> 32;
    tiles[(h % tiles.len() as u64) as usize]
}

// ---------------------------------------------------------------- terrains (auto-tiling)

/// A terrain = 16 tile ids indexed by the neighbour mask: N = 1, E = 2, S = 4, W = 8 (a neighbour counts when it belongs to the terrain).
#[derive(Clone, Debug, PartialEq)]
pub struct Terrain {
    pub name: String,
    pub tiles: [i64; 16],
}

pub fn terrains(map: &Value) -> Vec<Terrain> {
    map["terrains"]
        .as_array()
        .map(|a| {
            a.iter()
                .map(|t| {
                    let mut tiles = [-1; 16];
                    for (i, v) in t["tiles"]
                        .as_array()
                        .into_iter()
                        .flatten()
                        .take(16)
                        .enumerate()
                    {
                        tiles[i] = v.as_i64().unwrap_or(-1);
                    }
                    Terrain {
                        name: t["name"].as_str().unwrap_or("terrain").into(),
                        tiles,
                    }
                })
                .collect()
        })
        .unwrap_or_default()
}

pub fn set_terrains(map: &mut Value, t: &[Terrain]) {
    map["terrains"] = json!(t
        .iter()
        .map(|t| json!({"name": t.name, "tiles": t.tiles}))
        .collect::<Vec<_>>());
}

fn member(t: &Terrain, tile: i64) -> bool {
    tile >= 0 && t.tiles.contains(&tile)
}

fn mask(map: &Value, layer: usize, x: i64, y: i64, t: &Terrain) -> usize {
    [(0, -1, 1), (1, 0, 2), (0, 1, 4), (-1, 0, 8)]
        .iter()
        .filter(|(dx, dy, _)| member(t, get(map, layer, x + dx, y + dy)))
        .map(|(_, _, b)| *b)
        .sum()
}

fn refresh(map: &mut Value, layer: usize, x: i64, y: i64, t: &Terrain) {
    if member(t, get(map, layer, x, y)) {
        let m = mask(map, layer, x, y, t);
        set(map, layer, x, y, t.tiles[m]);
    }
}

/// Paint terrain at a cell: it and its four neighbours pick the right variant.
pub fn paint_terrain(map: &mut Value, layer: usize, x: i64, y: i64, t: &Terrain) {
    let m = mask(map, layer, x, y, t);
    // the painted cell is a member from now on, so its neighbours must see it: set first, then refresh all five
    set(map, layer, x, y, t.tiles[m.min(15)]);
    for (dx, dy) in [(0, 0), (0, -1), (1, 0), (0, 1), (-1, 0)] {
        refresh(map, layer, x + dx, y + dy, t);
    }
}

pub fn erase_terrain(map: &mut Value, layer: usize, x: i64, y: i64, t: &Terrain) {
    set(map, layer, x, y, -1);
    for (dx, dy) in [(0, -1), (1, 0), (0, 1), (-1, 0)] {
        refresh(map, layer, x + dx, y + dy, t);
    }
}

// ---------------------------------------------------------------- layers, collision, animated tiles

pub fn add_layer(map: &mut Value, name: &str) {
    let (w, h) = dims(map);
    if let Some(a) = map["layers"].as_array_mut() {
        a.push(json!({ "name": name, "data": vec![vec![-1; w]; h] }));
    }
}

pub fn delete_layer(map: &mut Value, i: usize) -> bool {
    match map["layers"].as_array_mut() {
        Some(a) if a.len() > 1 && i < a.len() => {
            a.remove(i);
            true
        }
        _ => false,
    }
}

pub fn move_layer(map: &mut Value, i: usize, up: bool) -> Option<usize> {
    let a = map["layers"].as_array_mut()?;
    let j = if up {
        i.checked_add(1).filter(|j| *j < a.len())?
    } else {
        i.checked_sub(1)?
    };
    a.swap(i, j);
    Some(j)
}

/// Toggle a tile id in the map's `collides` list (tiles that block movement).
pub fn toggle_collide(map: &mut Value, tile: i64) -> bool {
    let mut list: Vec<i64> = map["collides"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_i64).collect())
        .unwrap_or_default();
    let now = if let Some(p) = list.iter().position(|t| *t == tile) {
        list.remove(p);
        false
    } else {
        list.push(tile);
        list.sort_unstable();
        true
    };
    map["collides"] = json!(list);
    now
}

pub fn set_animated(map: &mut Value, tile: i64, frames: &[i64], fps: f64) {
    if frames.len() < 2 {
        if let Some(o) = map["animatedTiles"].as_object_mut() {
            o.remove(&tile.to_string());
        }
        return;
    }
    if !map["animatedTiles"].is_object() {
        map["animatedTiles"] = json!({});
    }
    map["animatedTiles"][tile.to_string()] = json!({ "frames": frames, "fps": fps });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid(s: &[&str]) -> Value {
        let rows: Vec<Vec<i64>> = s
            .iter()
            .map(|r| {
                r.chars()
                    .map(|c| {
                        if c == '.' {
                            -1
                        } else {
                            c.to_digit(10).unwrap() as i64
                        }
                    })
                    .collect()
            })
            .collect();
        json!({ "tileWidth": 16, "tileHeight": 16, "layers": [{ "name": "g", "data": rows }] })
    }
    fn dump(m: &Value) -> Vec<String> {
        let (w, h) = dims(m);
        (0..h)
            .map(|y| {
                (0..w)
                    .map(|x| match get(m, 0, x as i64, y as i64) {
                        -1 => '.',
                        n => char::from_digit(n as u32, 10).unwrap(),
                    })
                    .collect()
            })
            .collect()
    }

    #[test]
    fn rect_flood_random_and_bounds() {
        let mut m = new_map("t.png", 16, 16, 5, 4);
        rect_fill(&mut m, 0, 1, 1, 3, 2, 7);
        assert_eq!(dump(&m), [".....", ".777.", ".777.", "....."]);
        assert_eq!(flood(&mut m, 0, 0, 0, 3), 14, "outside area (20 - 6)");
        assert_eq!(flood(&mut m, 0, 0, 0, 3), 0);
        set(&mut m, 0, 99, 99, 1); // ignored
        assert_eq!(get(&m, 0, -1, 0), -1);
        let a = random_pick(&[1, 2, 3], 4, 5, 9);
        assert_eq!(a, random_pick(&[1, 2, 3], 4, 5, 9), "deterministic");
        let picks: std::collections::HashSet<i64> = (0..40)
            .map(|i| random_pick(&[1, 2, 3], i, i * 3, 1))
            .collect();
        assert_eq!(picks.len(), 3, "all tiles occur");
        assert_eq!(random_pick(&[], 0, 0, 0), -1);
    }

    #[test]
    fn terrain_picks_variants_by_neighbours() {
        // ids 10..25: tile = 10 + mask
        let t = Terrain {
            name: "wall".into(),
            tiles: std::array::from_fn(|i| 10 + i as i64),
        };
        let mut m = new_map("t.png", 16, 16, 5, 3);
        for x in 1..=3 {
            paint_terrain(&mut m, 0, x, 1, &t);
        }
        // a horizontal run: left end has only an east neighbour (mask 2), middle E+W (10), right end W only (8)
        assert_eq!(
            [get(&m, 0, 1, 1), get(&m, 0, 2, 1), get(&m, 0, 3, 1)],
            [12, 20, 18]
        );
        paint_terrain(&mut m, 0, 2, 0, &t); // a cell above the middle: it has S (4) and the middle gains N (1)
        assert_eq!(get(&m, 0, 2, 0), 14);
        assert_eq!(get(&m, 0, 2, 1), 21);
        erase_terrain(&mut m, 0, 3, 1, &t);
        assert_eq!(get(&m, 0, 3, 1), -1);
        assert_eq!(get(&m, 0, 2, 1), 19, "N + W");
        assert_eq!(
            terrains(&{
                let mut x = json!({});
                set_terrains(&mut x, &[t.clone()]);
                x
            }),
            vec![t]
        );
    }

    #[test]
    fn layers_collision_and_animated_tiles() {
        let mut m = grid(&["12", "34"]);
        add_layer(&mut m, "top");
        assert_eq!(m["layers"].as_array().unwrap().len(), 2);
        set(&mut m, 1, 0, 0, 9);
        assert_eq!(move_layer(&mut m, 1, false), Some(0));
        assert_eq!(get(&m, 0, 0, 0), 9);
        assert_eq!(move_layer(&mut m, 0, false), None);
        assert!(delete_layer(&mut m, 0));
        assert!(!delete_layer(&mut m, 0), "the last layer stays");
        assert!(toggle_collide(&mut m, 3));
        assert!(toggle_collide(&mut m, 1));
        assert_eq!(m["collides"], json!([1, 3]));
        assert!(!toggle_collide(&mut m, 3));
        set_animated(&mut m, 5, &[5, 6, 7], 6.0);
        assert_eq!(m["animatedTiles"]["5"]["frames"], json!([5, 6, 7]));
        set_animated(&mut m, 5, &[5], 6.0);
        assert!(m["animatedTiles"].get("5").is_none());
    }
}
