import { DHAKA_SECTORS } from './dhaka.js';
import { groundRoute } from './navigation.js';
import { clamp } from './util.js';

export class Minimap {
  constructor(game) {
    this.g = game;
    this.wrap = document.getElementById('minimap-wrap');
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.districtEl = document.getElementById('minimap-district');
    this.districtBnEl = document.getElementById('minimap-district-bn');

    this.zoom = 50; // Tactical view radius in meters (50m default)
    this.zoomedOut = false;
    this.pulseTime = 0;
    this.routeTimer = 0;
    this.cachedRoute = [];
    this.currentSectorName = '';

    // Click on radar to toggle tactical / overview zoom
    if (this.wrap) {
      this.wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleZoom();
      });
    }

    this.resize();
  }

  toggleZoom() {
    this.zoomedOut = !this.zoomedOut;
    this.zoom = this.zoomedOut ? 92 : 50;
    this.g.ui.toast(this.zoomedOut ? 'RADAR: OVERVIEW (92m)' : 'RADAR: TACTICAL (50m)');
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssSize = 184;
    this.canvas.width = Math.round(cssSize * dpr);
    this.canvas.height = Math.round(cssSize * dpr);
    this.canvasSize = cssSize;
    this.dpr = dpr;
  }

  update(dt, nav) {
    if (!this.canvas || !this.ctx) return;
    const g = this.g, P = g.player, W = g.world, ai = g.ai;
    if (!P || !W) return;

    this.pulseTime += dt;

    // Refresh pathfinding route periodically to avoid running A* every frame
    this.routeTimer -= dt;
    if (this.routeTimer <= 0) {
      this.routeTimer = 0.25;
      if (nav && W.findPath) {
        this.cachedRoute = groundRoute(W, P.pos, nav) || [];
      } else {
        this.cachedRoute = [];
      }
    }

    // Update current neighborhood / district label (GTA Vice City style)
    this.updateSectorLabel(P.pos);

    // Setup coordinates and dimensions
    const ctx = this.ctx;
    const dpr = this.dpr;
    const size = this.canvasSize * dpr;
    const cx = size / 2;
    // Position player slightly below center to give more forward view (GTA style)
    const pyOffset = 13 * dpr;
    const py = cx + pyOffset;
    const px = cx;

    const outerRadius = (size / 2) - (2 * dpr);
    const rimWidth = 9.5 * dpr;
    const innerRadius = outerRadius - rimWidth;
    const rimRadius = (outerRadius + innerRadius) / 2;
    const scale = (innerRadius / this.zoom);

    ctx.save();
    ctx.clearRect(0, 0, size, size);

    // -------------------------------------------------------------
    // 1. CLIPPED RADAR CONTENT (Rotating World Map)
    // -------------------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cx, innerRadius, 0, Math.PI * 2);
    ctx.clip();

    // Base background: GTA Vice City dark park / urban green
    ctx.fillStyle = '#32582f';
    ctx.fillRect(0, 0, size, size);

    // Affine Transform: World (X, Z) -> Screen Pixel Coordinates
    // +X is East, +Z is North in world space.
    // Forward view direction is UP on screen.
    const yaw = P.yaw;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const a = -cosY * scale;
    const b = sinY * scale;
    const c = sinY * scale;
    const d = cosY * scale;
    const e = px - (a * P.pos.x + c * P.pos.z);
    const f = py - (b * P.pos.x + d * P.pos.z);

    ctx.setTransform(a, b, c, d, e, f);

    // Helper: convert world point to radar local screen coordinates
    const toRadar = (wx, wz) => {
      const dx = wx - P.pos.x;
      const dz = wz - P.pos.z;
      const rx = (-dx * cosY + dz * sinY) * scale;
      const ry = (dx * sinY + dz * cosY) * scale;
      return {
        x: px + rx,
        y: py + ry,
        rx,
        ry,
        dist: Math.hypot(rx, ry),
        angle: Math.atan2(ry, rx)
      };
    };

    // A. Buriganga River (Water south of z = -43)
    ctx.fillStyle = '#183a42';
    ctx.fillRect(-220, -190, 440, 147); // z: -190 to -43

    // Water ripple accents
    ctx.strokeStyle = '#224e58';
    ctx.lineWidth = 1.2 / scale;
    for (let rz = -55; rz > -160; rz -= 18) {
      ctx.beginPath();
      ctx.moveTo(-120, rz);
      ctx.lineTo(120, rz);
      ctx.stroke();
    }

    // Riverfront Quay Wall & Railing at z = -43
    ctx.fillStyle = '#5c6361';
    ctx.fillRect(-100, -44.5, 200, 1.5);
    ctx.strokeStyle = '#85908e';
    ctx.lineWidth = 0.8 / scale;
    ctx.beginPath();
    ctx.moveTo(-100, -43);
    ctx.lineTo(100, -43);
    ctx.stroke();

    // Passenger Launches & River Boats
    if (W.riverBoats) {
      for (const boat of W.riverBoats) {
        ctx.fillStyle = boat.launch ? '#2c434f' : '#4f4332';
        ctx.fillRect(boat.baseX - 4, boat.baseZ - 2, 8, 4);
      }
    }

    // B. Paved City Blocks / Courtyards
    ctx.fillStyle = '#4f5757';
    ctx.fillRect(-85, -43, 170, 101);

    // C. Streets & Alleys (Dark Asphalt with Sidewalk Borders)
    // 1. River Road (Main East-West Road at z = 0, z: -6 to +6)
    ctx.fillStyle = '#141517';
    ctx.fillRect(-90, -6.5, 180, 13);
    ctx.strokeStyle = '#7c8687';
    ctx.lineWidth = 1.0 / scale;
    ctx.beginPath();
    ctx.moveTo(-90, -6.5); ctx.lineTo(90, -6.5);
    ctx.moveTo(-90, 6.5); ctx.lineTo(90, 6.5);
    ctx.stroke();

    // River Road Yellow Dashed Center Line
    ctx.strokeStyle = '#d6b136';
    ctx.lineWidth = 0.4 / scale;
    ctx.setLineDash([2.5 / scale, 2.5 / scale]);
    ctx.beginPath();
    ctx.moveTo(-85, 0); ctx.lineTo(85, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Bazaar Lane (North-South Pedestrian Bazaar, x: -5.5 to +5.5)
    ctx.fillStyle = '#18191c';
    ctx.fillRect(-5.5, -43, 11, 101);
    ctx.strokeStyle = '#737d7e';
    ctx.lineWidth = 0.8 / scale;
    ctx.beginPath();
    ctx.moveTo(-5.5, -43); ctx.lineTo(-5.5, 58);
    ctx.moveTo(5.5, -43); ctx.lineTo(5.5, 58);
    ctx.stroke();

    // 3. Side Roads (East & West)
    ctx.fillStyle = '#141517';
    ctx.fillRect(-85, -43, 9, 101);
    ctx.fillRect(76, -43, 9, 101);

    // 4. Inter-building Alleys (East-West secondary lanes)
    ctx.fillStyle = '#1d1f22';
    ctx.fillRect(-76, 20, 152, 4.2);
    ctx.fillRect(-76, 37, 152, 4.2);
    ctx.fillRect(-76, 54, 152, 4.2);

    // D. Overhead MRT Viaduct along z = 0
    ctx.strokeStyle = '#434c4f';
    ctx.lineWidth = 3.6 / scale;
    ctx.beginPath();
    ctx.moveTo(-85, 0); ctx.lineTo(85, 0);
    ctx.stroke();
    // MRT Viaduct Pillars
    ctx.fillStyle = '#677174';
    for (const pxP of [-72, -48, -24, 0, 24, 48, 72]) {
      ctx.fillRect(pxP - 0.8, -0.8, 1.6, 1.6);
    }

    // E. Buildings (Crisp White / Light Solid Blocks — Quintessential GTA Vice City Style)
    if (W.buildings) {
      for (const b of W.buildings) {
        const bw = b.x1 - b.x0;
        const bd = b.z1 - b.z0;
        // White building body
        ctx.fillStyle = '#f4f6f8';
        ctx.fillRect(b.x0, b.z0, bw, bd);
        // Dark outline
        ctx.strokeStyle = '#222528';
        ctx.lineWidth = 0.7 / scale;
        ctx.strokeRect(b.x0, b.z0, bw, bd);

        // Rooftop stair-head / chilekotha inset structure
        if (b.h >= 6) {
          ctx.fillStyle = '#cbd3d6';
          ctx.fillRect(b.x0 + bw * 0.2, b.z0 + bd * 0.2, bw * 0.45, bd * 0.45);
        }
      }
    }

    // F. GPS Navigation Route Ribbon (Yellow/Gold Line — Iconic GTA Style)
    if (this.cachedRoute && this.cachedRoute.length > 1) {
      // Dark under-stroke
      ctx.strokeStyle = '#281700';
      ctx.lineWidth = 6.2 / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(P.pos.x, P.pos.z);
      for (const pt of this.cachedRoute) {
        ctx.lineTo(pt.x, pt.z);
      }
      ctx.stroke();

      // Bright yellow/gold GPS line
      ctx.strokeStyle = '#f6be26';
      ctx.lineWidth = 4.2 / scale;
      ctx.stroke();
    } else if (nav && nav.pos) {
      // Direct dashed bearing line if no ground path
      ctx.strokeStyle = '#f6be26';
      ctx.lineWidth = 2.5 / scale;
      ctx.setLineDash([4 / scale, 3 / scale]);
      ctx.beginPath();
      ctx.moveTo(P.pos.x, P.pos.z);
      ctx.lineTo(nav.pos.x, nav.pos.z);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore(); // Restore world transform to screen coordinates

    // -------------------------------------------------------------
    // 2. RADAR ENTITIES & BLIPS (Screen Pixel Space)
    // -------------------------------------------------------------
    const rimClampedBlips = [];

    // A. Civilians (Small subtle dots for crowd-blending stealth awareness)
    if (ai && ai.civilians) {
      ctx.fillStyle = 'rgba(150, 205, 175, 0.65)';
      for (const civ of ai.civilians) {
        if (!civ.alive) continue;
        const rPos = toRadar(civ.pos.x, civ.pos.z);
        if (rPos.dist < innerRadius - (3 * dpr)) {
          ctx.beginPath();
          ctx.arc(rPos.x, rPos.y, 1.8 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // B. Enemy Guards
    if (ai && ai.guards) {
      for (const gd of ai.guards) {
        const rPos = toRadar(gd.pos.x, gd.pos.z);
        if (rPos.dist >= innerRadius - (2 * dpr)) continue;

        if (!gd.alive) {
          // Neutralized guard: subtle dark cross
          ctx.strokeStyle = '#62676b';
          ctx.lineWidth = 1.4 * dpr;
          const sz = 3 * dpr;
          ctx.beginPath();
          ctx.moveTo(rPos.x - sz, rPos.y - sz); ctx.lineTo(rPos.x + sz, rPos.y + sz);
          ctx.moveTo(rPos.x + sz, rPos.y - sz); ctx.lineTo(rPos.x - sz, rPos.y + sz);
          ctx.stroke();
        } else {
          // Live guard: colored by awareness state
          let col = '#d2caa8'; // calm / unaware
          let radius = 2.5 * dpr;

          if (gd.state >= 4) { // Combat / Hunt: Vivid Red
            col = '#ff2525';
            radius = 3.6 * dpr;
          } else if (gd.state >= 2) { // Suspicion / Alert: Vivid Orange
            col = '#ff9800';
            radius = 3.2 * dpr;
          }

          // Guard position dot
          ctx.fillStyle = col;
          ctx.strokeStyle = '#121214';
          ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath();
          ctx.arc(rPos.x, rPos.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Guard look direction tick
          const guardFacing = gd.yaw;
          const lookAngle = Math.atan2(Math.sin(guardFacing - yaw - Math.PI / 2), Math.cos(guardFacing - yaw - Math.PI / 2));
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath();
          ctx.moveTo(rPos.x, rPos.y);
          ctx.lineTo(rPos.x + Math.cos(lookAngle) * 5.5 * dpr, rPos.y + Math.sin(lookAngle) * 5.5 * dpr);
          ctx.stroke();

          // Tagged highlight
          if (gd.tagged) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 1.5 * dpr;
            ctx.strokeRect(rPos.x - 4 * dpr, rPos.y - 4 * dpr, 8 * dpr, 8 * dpr);
          }
        }
      }
    }

    // C. Mission Objective Blip (Cartographer / Tea Stall / Entrance / Extraction)
    if (nav && nav.pos) {
      const rPos = toRadar(nav.pos.x, nav.pos.z);
      const isTarget = nav.kind === 'target';
      const isExit = nav.kind === 'exit';
      const isIntel = nav.kind === 'intel';
      const isEntry = nav.kind === 'entry';

      let blipCol = isTarget ? '#ff2a44' : isExit ? '#00e676' : isIntel ? '#ffc107' : '#00e5ff';
      let icon = isTarget ? '⌖' : isExit ? '➜' : isIntel ? '★' : '▲';

      if (rPos.dist < innerRadius - (9 * dpr)) {
        // Inside radar: draw pulsing on-map objective blip
        const pulse = 0.5 + 0.5 * Math.sin(this.pulseTime * 6);
        ctx.fillStyle = blipCol;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5 * dpr;

        // Pulsing ring
        ctx.strokeStyle = blipCol;
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, (6 + pulse * 4) * dpr, 0, Math.PI * 2);
        ctx.stroke();

        // Inner solid marker
        ctx.fillStyle = blipCol;
        ctx.beginPath();
        ctx.arc(rPos.x, rPos.y, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#121214';
        ctx.stroke();
      } else {
        // Outside radar: clamp badge to the pink rim
        rimClampedBlips.push({
          angle: rPos.angle,
          col: blipCol,
          icon,
          label: nav.title
        });
      }
    }

    // -------------------------------------------------------------
    // 3. PLAYER TEARDROP MARKER (Iconic GTA Vice City Style)
    // -------------------------------------------------------------
    // Centered at (px, py), pointing UP
    ctx.save();
    ctx.translate(px, py);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 6 * dpr;

    const s = 8.5 * dpr; // Teardrop size
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111114';
    ctx.lineWidth = 1.8 * dpr;

    ctx.beginPath();
    // Tip at top
    ctx.moveTo(0, -s * 1.55);
    // Right curve down to rounded base
    ctx.bezierCurveTo(s * 0.95, -s * 0.4, s * 0.95, s * 0.75, 0, s * 0.95);
    // Left curve from bottom back to tip
    ctx.bezierCurveTo(-s * 0.95, s * 0.75, -s * 0.95, -s * 0.4, 0, -s * 1.55);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();

    // -------------------------------------------------------------
    // 4. ICONIC GTA VICE CITY PINK RIM BORDER
    // -------------------------------------------------------------
    // Main Pink Ring
    ctx.save();
    ctx.strokeStyle = '#ff5eb5'; // Signature Vice City Neon Pink
    ctx.lineWidth = rimWidth;
    ctx.beginPath();
    ctx.arc(cx, cx, rimRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer Dark Outline
    ctx.strokeStyle = '#430623';
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cx, outerRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Dark Divider
    ctx.strokeStyle = '#270314';
    ctx.lineWidth = 1.8 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cx, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // -------------------------------------------------------------
    // 5. RIM CLAMPED OBJECTIVE BADGES (L, Target, Cassette GTA Style)
    // -------------------------------------------------------------
    for (const b of rimClampedBlips) {
      const bx = cx + Math.cos(b.angle) * rimRadius;
      const by = cx + Math.sin(b.angle) * rimRadius;
      const bRad = 9 * dpr;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 5 * dpr;

      // Badge circular background
      ctx.fillStyle = '#0f1114';
      ctx.strokeStyle = b.col;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc(bx, by, bRad, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Badge Icon / Glyph
      ctx.shadowBlur = 0;
      ctx.fillStyle = b.col;
      ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.icon, bx, by + (0.5 * dpr));
      ctx.restore();
    }

    // -------------------------------------------------------------
    // 6. NORTH "N" BADGE (Centered directly on the Pink Rim)
    // -------------------------------------------------------------
    // In world coordinates, +Z is North (dx = 0, dz = 1).
    // The relative angle from screen center to North:
    const northAngle = Math.atan2(cosY, sinY);
    const nx = cx + Math.cos(northAngle) * rimRadius;
    const ny = cx + Math.sin(northAngle) * rimRadius;
    const nRadius = 9.5 * dpr;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 6 * dpr;

    // Black circle with white border
    ctx.fillStyle = '#0d0e12';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.0 * dpr;
    ctx.beginPath();
    ctx.arc(nx, ny, nRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Bold "N"
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + (0.5 * dpr));
    ctx.restore();

    ctx.restore(); // Restore all canvas state
  }

  updateSectorLabel(pos) {
    if (!this.districtEl) return;
    let closest = DHAKA_SECTORS[0];
    let bestDist = Infinity;
    for (const s of DHAKA_SECTORS) {
      const d = Math.hypot(pos.x - s.x, pos.z - s.z);
      if (d < bestDist) {
        bestDist = d;
        closest = s;
      }
    }

    if (this.currentSectorName !== closest.name) {
      this.currentSectorName = closest.name;
      this.districtEl.textContent = closest.name;
      if (this.districtBnEl) {
        this.districtBnEl.textContent = closest.bn;
      }
    }
  }
}
