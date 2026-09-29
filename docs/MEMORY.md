# VEIL — Persistent Codebase Memory

> **Last Updated**: 2026-09-29  
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
src/
├── main.js         # Entry point, game loop, scene management, input capture, menus
├── world.js        # Procedural Old Dhaka city generator, street grid, MRT viaduct, traffic, shaders
├── player.js       # Raven controller: 3rd-person movement, parkour/climbing, stance, health, weapons
├── ai.js           # 6-state awareness FSM, sight/hearing perception, squad radio, Cartographer AI
├── combat.js       # Raycasting, projectile trajectories, damage calculations, takedowns, explosions
├── veil.js         # Veil State policy: time dilation, Focus cost/generation, heartbeat triggers
├── weather.js      # Monsoon rain simulation, puddles/wetness shader, lightning exposure, fog
├── fx.js           # Visual effects: muzzle flash, tracers, physical shell casings, blood decals, post-proc
├── audio.js        # Pure WebAudio procedural soundscape: rain beds, traffic, Karplus-Strong dotara, tabla
├── ui.js           # Diegetic HUD, awareness arcs, intelligence board, document viewer, CCTV feed
├── mission01.js    # Mission 01 script: objectives, intel pickups, surreal sequences, debrief
├── missions.js     # Campaign operations archive: 10-mission progression records
├── characters.js   # Character models and procedural geometric representations
├── style.css       # Complete UI theme, HUD overlays, typography (Rajdhani, JetBrains Mono, Hind Siliguri)
└── util.js         # Math, spatial helpers, raycasting utilities
```

### Key Subsystem Mechanics
- **Awareness Engine (`src/ai.js`)**: Evaluates 6 states (`UNKNOWN`, `SUSPICION`, `INVESTIGATION`, `ALERT`, `HUNT`, `FULL COMBAT`). Perception considers lighting levels, stance, rain attenuation (−38%), and momentary exposure during lightning flashes (+120%).
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
- **Runtime Sanity**: High framerate 60 FPS Three.js canvas rendering with adaptive `?q=low` URL parameter for lower-power hardware.

---

## 7. Evolution & Decision Log

- **2026-09-29**:
  - Initialized official public Git repository linked to `https://github.com/nibir404/Veil.git`.
  - Created standardized `docs/MEMORY.md` persistent memory record following the `codebase-memory` specification.
  - Refactored `.gitignore` to protect against unwanted OS artifacts and local environment overrides.
  - Authored comprehensive production README showcasing the prototype, design bible, mechanics, controls, and UE5 transition roadmap.
