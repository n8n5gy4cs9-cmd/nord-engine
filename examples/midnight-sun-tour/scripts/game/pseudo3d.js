// ============================================================================
// PSEUDO-3D SPRITE SCALER — OutRun-style road rendering module
// Correct front-to-back projection with curve accumulation
// Based on Sega Out Run (1986) — segment projection + painter's draw
//
// Usage:
//   var P3D = require("./pseudo3d.js");
//   var road = P3D.create({ segLen: 200, roadW: 2000, drawDist: 80, camH: 1000, camDepth: 0.84 });
//   road.buildSections(defs);
//   road.update(position, playerX);
//   road.draw(screenW, screenH, theme);       // returns maxClipY
//   var p = road.projectSprite(segIdx, offset, sw, sh);  // {x, y, w, scale, visible}
// ============================================================================

function createRoad(cfg) {
    var segLen   = cfg.segLen   || 200;
    var roadW    = cfg.roadW    || 2000;
    var drawDist = cfg.drawDist || 80;
    var camH     = cfg.camH     || 1000;
    var camDepth = cfg.camDepth || 0.84;
    var totalSegs = cfg.totalSegs || 600;
    var lanes    = cfg.lanes    || 2;

    var segments = [];
    var position = 0;
    var playerX  = 0;
    var baseSeg  = 0;
    var projected = [];

    function addSegment(curve, hill) {
        segments.push({
            worldZ: segments.length * segLen,
            worldY: hill || 0,
            curve:  curve || 0,
            color:  (Math.floor(segments.length / 3) % 2 === 0)
        });
    }

    function buildSections(defs) {
        segments = [];
        for (var i = 0; i < totalSegs; i++) {
            var curve = 0;
            var hill  = 0;
            for (var d = 0; d < defs.length; d++) {
                var def = defs[d];
                if (i >= def.start && i < def.end) {
                    if (def.curve !== undefined) curve = def.curve;
                    if (typeof def.hill === "function") hill = def.hill(i - def.start);
                    else if (def.hill !== undefined) hill = def.hill;
                }
            }
            addSegment(curve, hill);
        }
    }

    function update(pos, px) {
        position = pos;
        playerX  = px;
        baseSeg  = Math.floor(position / segLen);
        projected = [];
    }

    // Front-to-back projection pass (OutRun algorithm).
    // Accumulates curve offset x as second integral of curve coefficients.
    // Tracks maxY for hill occlusion.
    function projectRoad(sw, sh) {
        var camZ = position;
        var camX = playerX * roadW;
        var segCount = segments.length;
        var curSeg = segments[baseSeg % segCount];
        var camY = camH + (curSeg ? curSeg.worldY : 0);

        projected = [];
        var x = 0;
        var dx = 0;
        var maxY = sh;

        for (var n = 0; n <= drawDist; n++) {
            var segIdx = (baseSeg + n) % segCount;
            var seg = segments[segIdx];

            if (!seg) {
                projected.push({ sX: sw / 2, sY: sh, sW: 0, scale: 0, clip: true, seg: null });
                continue;
            }

            // Segment 0 is at/behind camera — anchor at screen bottom
            if (n === 0) {
                projected.push({ sX: sw / 2, sY: sh, sW: sw / 2, scale: 0, clip: false, seg: seg });
                x += dx;
                dx += seg.curve;
                continue;
            }

            var worldZ = (baseSeg + n) * segLen;
            var cz = worldZ - camZ;

            if (cz <= 0) {
                projected.push({ sX: sw / 2, sY: sh, sW: 0, scale: 0, clip: false, seg: seg });
                x += dx;
                dx += seg.curve;
                continue;
            }

            var scale = camDepth / cz;
            var sX = Math.round(sw / 2 + scale * (x - camX) * sw / 2);
            var sY = Math.round(sh / 2 - scale * (seg.worldY - camY) * sh / 2);
            var sW = Math.round(scale * roadW * sw / 2);

            var clip = (sY >= maxY);
            if (!clip) maxY = sY;

            projected.push({ sX: sX, sY: sY, sW: sW, scale: scale, clip: clip, seg: seg });
            x += dx;
            dx += seg.curve;
        }
    }

    // Draw road: calls projectRoad then paints back-to-front.
    // Returns topmost road pixel Y.
    function draw(sw, sh, theme) {
        projectRoad(sw, sh);

        if (theme.sky) {
            Draw2D.fillRect(0, 0, sw, sh * 0.5,
                theme.sky[0], theme.sky[1], theme.sky[2], theme.sky[3] || 1, -5);
        }
        if (theme.hills) {
            var hillH = (theme.hillH || 0.15) * sh;
            Draw2D.fillRect(0, sh * 0.5 - hillH, sw, hillH,
                theme.hills[0], theme.hills[1], theme.hills[2], 1);
        }

        var roadMaxY = sh;

        for (var n = drawDist; n >= 1; n--) {
            var p1 = projected[n];
            var p0 = projected[n - 1];
            if (!p1 || !p0 || p1.clip) continue;
            if (!p1.seg) continue;

            var y1 = p1.sY;
            var y0 = p0.clip ? roadMaxY : p0.sY;

            if (y1 > roadMaxY) continue;
            if (y0 > roadMaxY) y0 = roadMaxY;
            if (y1 <= 0 && y0 <= 0) continue;

            var stripH = y0 - y1;
            if (stripH <= 0) continue;

            var seg = p1.seg;
            var alt = seg.color ? 0 : 1;

            // Fog
            var fogAlpha = 0;
            if (theme.fog && theme.fogStart !== undefined) {
                var fogFrac = n / drawDist;
                if (fogFrac > theme.fogStart) {
                    fogAlpha = Math.min(1, (fogFrac - theme.fogStart) / (1.0 - theme.fogStart));
                }
            }

            // Grass
            var gc = theme.grass[alt];
            var gr = gc[0], gg = gc[1], gb = gc[2];
            if (fogAlpha > 0 && theme.fog) {
                gr += (theme.fog[0] - gr) * fogAlpha;
                gg += (theme.fog[1] - gg) * fogAlpha;
                gb += (theme.fog[2] - gb) * fogAlpha;
            }
            Draw2D.fillRect(0, y1, sw, stripH, gr, gg, gb, 1);

            // Road
            var rc = theme.road[alt];
            var rr = rc[0], rg2 = rc[1], rb = rc[2];
            if (fogAlpha > 0 && theme.fog) {
                rr += (theme.fog[0] - rr) * fogAlpha;
                rg2 += (theme.fog[1] - rg2) * fogAlpha;
                rb += (theme.fog[2] - rb) * fogAlpha;
            }
            var maxW = Math.max(p1.sW, p0.sW);
            var cx = (p1.sX + p0.sX) / 2;
            Draw2D.fillRect(cx - maxW, y1, maxW * 2, stripH, rr, rg2, rb, 1);

            // Rumble strips
            var rumbleC = theme.rumble ? theme.rumble[alt] : null;
            if (rumbleC) {
                var rw = Math.max(2, maxW / 6);
                Draw2D.fillRect(cx - maxW - rw, y1, rw, stripH,
                    rumbleC[0], rumbleC[1], rumbleC[2], 1);
                Draw2D.fillRect(cx + maxW, y1, rw, stripH,
                    rumbleC[0], rumbleC[1], rumbleC[2], 1);
            }

            // Shoulder lines
            if (theme.shoulder && seg.color) {
                var slw = Math.max(1, maxW / 20);
                Draw2D.fillRect(cx - maxW, y1, slw, stripH,
                    theme.shoulder[0], theme.shoulder[1], theme.shoulder[2], 1);
                Draw2D.fillRect(cx + maxW - slw, y1, slw, stripH,
                    theme.shoulder[0], theme.shoulder[1], theme.shoulder[2], 1);
            }

            // Lane markers (dashed)
            if (theme.lane && seg.color) {
                var lw = Math.max(1, maxW / 16);
                if (lanes === 2) {
                    Draw2D.fillRect(cx - lw / 2, y1, lw, stripH,
                        theme.lane[0], theme.lane[1], theme.lane[2], theme.lane[3] || 0.6);
                } else {
                    for (var la = 1; la < lanes; la++) {
                        var laneX = cx - maxW + (maxW * 2) * (la / lanes);
                        Draw2D.fillRect(laneX - lw / 2, y1, lw, stripH,
                            theme.lane[0], theme.lane[1], theme.lane[2], theme.lane[3] || 0.6);
                    }
                }
            }

            roadMaxY = y1;
        }

        return roadMaxY;
    }

    // Project sprite at road segment + lane offset.
    // Auto-populates projection cache if empty.
    function projectSprite(segIdx, offset, sw, sh) {
        if (projected.length === 0) {
            projectRoad(sw, sh);
        }

        var relSeg = segIdx - baseSeg;
        if (relSeg < 1 || relSeg > drawDist) return { x: 0, y: 0, w: 0, scale: 0, visible: false };
        if (relSeg >= projected.length) return { x: 0, y: 0, w: 0, scale: 0, visible: false };

        var p = projected[relSeg];
        if (!p || p.clip || p.scale <= 0) return { x: 0, y: 0, w: 0, scale: 0, visible: false };

        return {
            x: p.sX + offset * p.sW,
            y: p.sY,
            w: p.sW,
            scale: p.scale,
            visible: true
        };
    }

    function drawSprites(spriteList, sw, sh) {
        var items = [];
        for (var i = 0; i < spriteList.length; i++) {
            var sp = spriteList[i];
            var p = projectSprite(sp.segIdx, sp.offset, sw, sh);
            if (p.visible) {
                items.push({ sp: sp, p: p, dist: sp.segIdx - baseSeg });
            }
        }
        items.sort(function(a, b) { return b.dist - a.dist; });
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            item.sp.drawFn(item.p.x, item.p.y, item.p.w, item.p.scale, sw, sh);
        }
    }

    function drawSpriteAt(p, sprW, sprH, r, g, b, a) {
        if (!p.visible) return;
        var sW = Math.max(2, p.w * sprW / roadW);
        var sH = sW * (sprH / sprW);
        Draw2D.fillRect(p.x - sW / 2, p.y - sH, sW, sH, r, g, b, a || 1);
    }

    function drawSpriteImageAt(p, sprW, sprH, imagePath, sw, sh) {
        if (!p.visible) return;
        var sW = Math.max(2, p.w * sprW / roadW);
        var sH = sW * (sprH / sprW);
        Draw2D.drawImage(p.x - sW / 2, p.y - sH, sW, sH, imagePath, 1, 1, 1, 1);
    }

    return {
        segLen: segLen,
        roadW: roadW,
        drawDist: drawDist,
        camH: camH,
        camDepth: camDepth,
        totalSegs: totalSegs,
        lanes: lanes,

        addSegment: addSegment,
        buildSections: buildSections,
        getSegment: function(idx) { return segments[idx % segments.length]; },
        getSegmentCount: function() { return segments.length; },

        update: update,
        draw: draw,
        projectRoad: projectRoad,

        projectSprite: projectSprite,
        drawSprites: drawSprites,
        drawSpriteAt: drawSpriteAt,
        drawSpriteImageAt: drawSpriteImageAt,

        getBaseSeg: function() { return baseSeg; },
        getPosition: function() { return position; },
        getPlayerX: function() { return playerX; },
        getProjected: function() { return projected; }
    };
}

var THEME_DAY = {
    sky:       [0.35, 0.55, 0.80, 1],
    hills:     [0.15, 0.30, 0.15],
    hillH:     0.15,
    fog:       null,
    grass:     [[0.10, 0.35, 0.08], [0.12, 0.30, 0.10]],
    road:      [[0.30, 0.30, 0.32], [0.28, 0.28, 0.30]],
    rumble:    [[0.85, 0.15, 0.15], null],
    lane:      [0.85, 0.85, 0.85, 0.6],
    shoulder:  [0.80, 0.80, 0.80]
};

var THEME_NIGHT = {
    sky:       [0.01, 0.01, 0.03, 1],
    hills:     null,
    fog:       null,
    grass:     [[0.02, 0.06, 0.02], [0.02, 0.08, 0.02]],
    road:      [[0.18, 0.18, 0.20], [0.16, 0.16, 0.18]],
    rumble:    null,
    lane:      [0.40, 0.40, 0.40, 0.3],
    shoulder:  [0.50, 0.50, 0.40]
};

var THEME_SUNSET = {
    sky:       [0.80, 0.45, 0.20, 1],
    hills:     [0.20, 0.15, 0.10],
    hillH:     0.12,
    fog:       [0.85, 0.50, 0.25],
    fogStart:  0.7,
    grass:     [[0.12, 0.30, 0.08], [0.14, 0.25, 0.10]],
    road:      [[0.28, 0.25, 0.25], [0.26, 0.23, 0.23]],
    rumble:    [[0.80, 0.30, 0.10], null],
    lane:      [0.80, 0.70, 0.50, 0.5],
    shoulder:  null
};

module.exports = {
    create: createRoad,
    THEME_DAY: THEME_DAY,
    THEME_NIGHT: THEME_NIGHT,
    THEME_SUNSET: THEME_SUNSET
};
