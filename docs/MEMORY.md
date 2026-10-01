# VEIL — Persistent Codebase Memory

> **Last Updated**: 2026-10-01  
> **Status**: Active & Evergreen  
> **Repository**: [https://github.com/nibir404/Veil.git](https://github.com/nibir404/Veil.git)

---

## 1. Project Identity & Philosophy

- **Mission**: A psychological military thriller disguised as an assassin game, set in near-future Bangladesh.
- **Visual Thesis**: Real Bangladesh + Military Cinema + Assassin Stealth + Psychological Surrealism.
- **Narrative Arc**: The player controls Raven, an elite operative sent to eliminate an information broker ("The Cartographer") in Old Dhaka. As contradictions compound across the briefing, CCTV feeds, radio taps, and an unreliable intelligence board, the truth collapses into a psychological paradox: the target's identity photo is rendered live from Raven's own face.
- **Core Pillars**:
  1. *Stealth is control, not avoidance*: Stealth sets the terms of engagement, positioning, and enemy perception.
  2. *Grounded violence*: Real ballistics, physical brass casings, weapon spread/recoil, and lethal consequences.
  3. *Bangladesh is the protagonist's skin*: Authentic urban topography, architecture (*chhajja*, *chilekotha*, water tanks, tangled power cables), weather, and acoustic ecology.
  4. *Reality degrades, the image does not*: Surrealism emerges through structural wrongness within a photoreal frame.
  5. *Every optional thing pays*: Intel reveals routes, hazards, radio frequencies, and alters narrative outcomes.

---

## 2. Process Topology & Runtime Ports

| Service / Process | Command / Runtime | Port / Target | Purpose |
|---|---|---|---|
| **Vite Dev Server** | `npm run dev` (`vite --host`) | `5173` | Local browser development environment (HMR enabled) |
| **Vite Production Build** | `npm run build` (`vite build`) | `dist/` | Production bundle generation (ES modules, minified CSS/JS) |
| **Preview Server** | `npm run preview` (`vite preview`) | `4173` | Preview built production artifacts |

---

## 3. Core Subsystems & Architecture

```
Veil/
├── .agents/skills/     # Workspace skills (changelog-memory)
├── scripts/
│   └── memory.js       # Memory & Changelog CLI tool (status, log, next, check)
├── src/
│   ├── main.js         # Entry point, game loop, scene management, input capture, menus
│   ├── world.js        # Procedural Old Dhaka city generator, street grid, MRT viaduct, traffic, shaders
│   ├── dhaka.js        # Fictional compressed Old Dhaka riverfront, Buriganga quay, boats, Bengali signs
│   ├── player.js       # Raven controller: 3rd-person movement, parkour/climbing, stance, health, weapons
│   ├── ai.js           # 6-state awareness FSM, sight/hearing perception, squad radio, Cartographer AI
│   ├── combat.js       # Raycasting, projectile trajectories, damage calculations, takedowns, explosions
│   ├── veil.js         # Veil State policy: time dilation, Focus cost/generation, heartbeat triggers
│   ├── weather.js      # Monsoon rain simulation, puddles/wetness shader, lightning exposure, fog
│   ├── fx.js           # Visual effects: muzzle flash, tracers, physical shell casings, blood decals, post-proc
│   ├── audio.js        # Pure WebAudio procedural soundscape: rain beds, traffic, Karplus-Strong dotara, tabla
│   ├── ui.js           # Diegetic HUD, awareness arcs, intelligence board, document viewer, CCTV feed
│   ├── minimap.js      # GTA Vice City style circular radar mini-map with rotating map, North badge, teardrop player, GPS
│   ├── navigation.js   # Contextual mission routing and ground pathfinding
│   ├── physics.js      # Anti-tunneling swept integration, curb stepping, SimulationTimers
│   ├── quality.js      # Scalable performance presets (High, Balanced, Performance)
│   ├── mission01.js    # Mission 01 script: objectives, intel pickups, surreal sequences, debrief
│   ├── missions.js     # Campaign operations archive: 10-mission progression records
│   ├── raven-detail.js # Raven-specific tactical equipment and facial detailing
│   ├── characters.js   # Character models and procedural geometric representations
│   ├── verification.js # In-engine diagnostic inspection and assertion test suite
│   ├── style.css       # Complete UI theme, HUD overlays, typography (Rajdhani, JetBrains Mono, Hind Siliguri)
│   └── util.js         # Math, spatial helpers, raycasting utilities
```

### Key Subsystem Mechanics
- **Awareness Engine (`src/ai.js`)**: Evaluates 6 states (`UNKNOWN`, `SUSPICION`, `INVESTIGATION`, `ALERT`, `HUNT`, `FULL COMBAT`). Perception considers lighting levels, stance, rain attenuation (−38%), and momentary exposure during lightning flashes (+120%).
- **GTA Vice City Radar (`src/minimap.js`)**: Active in-game circular mini-map featuring iconic neon pink rim, rotating top-down city geometry (white buildings, dark asphalt roads, Buriganga river, green terrain), North compass badge on the rim, white teardrop player marker with forward view bias, golden GPS navigation ribbon, rim-clamped mission blips, awareness-colored guard dots, and neighborhood sector indicators.
- **Veil State (`src/veil.js`, `src/fx.js`, `src/audio.js`)**: Time slows to 16% for the world and 55% for Raven. Color desaturates to cold steel with hot highlights retained; audio passes through a steep low-pass filter (~350 Hz) with heartbeat prominence; bullet tracers become visible.
- **Procedural Soundscape (`src/audio.js`)**: Zero external audio samples. Generates rain ambience, thunderclaps, traffic rumble, rickshaw bells, gunshot echoes, and folk instruments (dotara plucks, bamboo flute, combat percussion) directly in WebAudio API.
- **Diegetic Intelligence Board (`src/ui.js`, `src/mission01.js`)**: Tracks collected evidence (SMS, CCTV logs, radio intercepts). Re-evaluates case integrity as contradictions mount.

---

## 4. Security & Safety Invariants

- **Zero Remote Asset Dependencies**: WebAudio and procedural geometry are generated client-side; no third-party CDNs required for runtime execution (fonts use Google Fonts with graceful system font fallbacks).
- **Clean Environment**: No sensitive tokens, API keys, or personal credentials stored in the codebase.
- **Git Hygiene**: Strict `.gitignore` enforcement for `node_modules/`, `dist/`, `.DS_Store`, and system log files.

---

## 5. AI Providers & Model Topology

- *Current Vertical Slice*: Autonomous deterministic agent FSMs with simulated sight cones, acoustic awareness, raycast line-of-sight checks, and coordinated squad radio networks.
- *Unreal Engine 5 Production Target*: Motion Matching, Mass Entity crowd systems, and StateTree hierarchical AI.

---

## 6. Verification & Test Suite

- **Build Pipeline**: `npm run build` executes `vite build` cleanly.
- **Automated Tests**: `npm test` runs 13 automated unit tests (`tests/physics.test.js` & `tests/minimap.test.js`) verifying swept collisions, fall damage, timers, and radar mathematical projection invariants.
- **Runtime Sanity**: High framerate 60 FPS Three.js canvas rendering with adaptive `?q=low` URL parameter for lower-power hardware.

---

## 7. Active Objectives & Next Steps

- [x] Initial public release of browser vertical slice & 10-mission design bible.
- [x] Initialize Git repository linked to `https://github.com/nibir404/Veil.git`.
- [x] Establish persistent memory & changelog architecture with automated tooling (`scripts/memory.js`).
- [x] Add player volume/sound FX toggles in pause menu.
- [x] Implement GTA Vice City circular radar mini-map (rotating map, North badge, teardrop marker, GPS ribbon, rim blips).
- [ ] Implement optional keybinding customization for accessibility.
- [ ] Expand Old Dhaka bazaar alley clutter and procedural neon signage variations.

---

## 8. Evolution & Decision Log (Changelog)

### [2026-10-01] FEAT: GTA Vice City Style Circular Mini-map
- **Description**: Implemented an authentic GTA Vice City circular radar mini-map in `src/minimap.js`, integrated with `src/ui.js`, `index.html`, and `src/style.css`.
- **Files Touched**: `src/minimap.js`, `src/ui.js`, `index.html`, `src/style.css`, `tests/minimap.test.js`, `docs/MEMORY.md`.
- **Key Decisions / Notes**:
  - Replaced the awkward top-left navigation banner with an active in-game circular radar at bottom-left.
  - Iconic Vice City neon pink rim with dark bevel borders.
  - Circular North ("N") badge mounted directly on the rim, revolving accurately with camera yaw.
  - Live rotating canvas map with white building footprints, dark asphalt streets, yellow dashed dividers, Buriganga river, and green open terrain.
  - White teardrop player marker positioned slightly below center for enhanced forward visibility.
  - Continuous yellow/gold GPS navigation route ribbon along street turns leading to the active objective.
  - Objective blips (target reticle, intel star, entrance, extraction) rendered on-map or clamped to the pink rim with colored badges when off-radar.
  - Awareness-colored guard dots (red for combat/alert, orange for suspicion, dim amber for calm) and subtle civilian crowd dots.
  - Dynamic district label below radar displaying current Old Dhaka neighborhood (`RIVER ROAD`, `BURIGANGA GHAT`, etc.) in English and Bengali.
  - Interactive zoom toggle (tactical 50m vs overview 92m) via radar click or `Z` key.
- **Verification**: `npm test` passes all 13 unit tests; `npm run build` builds cleanly with zero errors.

### [2026-10-01] FEAT: Original Raven tactical character detailing
- **Description**: Added shaped carrier, woven equipment materials, pouches, hydration pack, radio, scarf, earpiece, facial details, Bangladesh patch, gloves, knee pads, and boots to Raven's existing animated rig.
- **Files Touched**: `src/raven-detail.js`, `src/characters.js`, `docs/MEMORY.md`.
- **Key Decisions / Notes**: Original procedural design inspired by user-supplied tactical references; face remains exposed for story identification. This is prototype geometry, not a photoreal scanned asset. Cleared weapon type when holstering to allow same-weapon reattachment.
- **Verification**: Production build passed (existing bundle-size warning). Headless rig construction and finite-transform checks passed across walking, crouching, aiming, climbing, death; weapon reattachment checked. Visual browser inspection not performed.


### [2026-09-29] FEAT: Memory Skill, Changelog CLI & Repository Initialization
- **Description**: Initialized Git repository, authored comprehensive showcase README, built `docs/MEMORY.md`, and engineered `scripts/memory.js` changelog tracking CLI.
- **Files Touched**: `README.md`, `docs/MEMORY.md`, `.gitignore`, `package.json`, `scripts/memory.js`
- **Key Decisions / Notes**: Standardized on a dual-mode workflow (Boot/Resume check at turn start + Atomic Log at pre-commit).
- **Verification**: `npm run build` passes with zero errors; remote repository synced.
