<div align="center">

# V E I L

### *A Psychological Military Thriller Disguised as an Assassin Game*

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.169-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![WebAudio API](https://img.shields.io/badge/WebAudio-Procedural-blueviolet?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Status](https://img.shields.io/badge/Status-Playable_Vertical_Slice-00C853?style=for-the-badge)](#run-it)
[![Documentation](https://img.shields.io/badge/Docs-Complete_GDD_%26_UE5_Bible-blue?style=for-the-badge)](docs/)

> **"YOU WERE NEVER HUNTING THEM. YOU WERE HUNTING YOURSELF."**

</div>

---

## 👁️ Overview

Set in a near-future Bangladesh, **VEIL** is a third-person psychological military thriller disguised as an assassin game. The player takes the role of **Raven**, an elite operative executing a contract against an elusive intelligence broker known as **The Cartographer** across a rain-swept block of Old Dhaka. 

As the operation unfolds, contradictions compound across wiretapped radios, future CCTV feeds, and an unreliable intelligence board—culminating in a psychological paradox where the lines between the hunter, the target, and memory itself dissolve.

This repository serves as both:
1. **A Playable Browser Vertical Slice** of **Mission 01 — *The City That Never Sleeps***, engineered with Three.js and procedural WebAudio.
2. **The Production & Design Bible** for the full 10-mission commercial game targeting Unreal Engine 5.

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18.0+
- Modern desktop browser with WebGL & WebAudio support (Chrome, Edge, Firefox, Brave)

### Installation & Launch

```bash
# Clone the repository
git clone https://github.com/nibir404/Veil.git
cd Veil

# Install dependencies
npm install

# Start local development server
npm run dev
```

Navigate to `http://localhost:5173` in your browser.

> [!TIP]
> - **Audio:** Use **headphones**. The entire ambient soundscape, spatialized gunfire, and traditional instruments are synthesized in real-time via WebAudio.
> - **Performance:** Append `?q=low` to the URL (`http://localhost:5173/?q=low`) on lightweight integrated GPUs for optimized rendering.

---

## 🎮 Controls

| Action | Input | Description |
|---|---|---|
| **Movement** | `W` `A` `S` `D` | Omnidirectional navigation |
| **Sprint** | `Shift` (Hold) | Fast movement (increases footstep acoustic footprint) |
| **Crouch** | `C` | Lowers silhouette, reduces noise, enables stealth traversal |
| **Parkour / Climb** | `Space` | Vault over obstacles, mantle ledges, scale facades (Hold `W` against wall) |
| **Drop Down** | `C` (while climbing) | Release grip and drop from wall/ledge |
| **Aim / Fire** | `RMB` (Hold) / `LMB` | Precision over-the-shoulder aim and trigger discharge |
| **Reload** | `R` | Tactical reload (leaves physical brass casings) |
| **Weapon Selection** | `1` / `2` | `1`: Suppressed 9mm Pistol · `2`: KR-7 Assault Carbine |
| **Camera Shoulder** | `V` | Toggle camera view between left and right shoulder |
| **Takedown** | `F` | Silent close-quarters execution (from rear or non-hostile targets) |
| **Interact** | `E` | Read documents, manipulate generators, hack CCTV feeds |
| **Drag / Drop Body** | `G` | Conceal neutralized guards to prevent patrol alerts |
| **Observe & Tag** | `X` (Hold) | Mark guards in line-of-sight and identify environmental hazards |
| **Veil State** | `Q` | Activate neurological time dilation (requires ≥50 Focus) |
| **Intelligence Board** | `Tab` | Open diegetic investigation dossier and evidence matrix |
| **Toggle Key Reference** | `H` | Show/hide the on-screen controls overlay |

---

## 🕹️ Gameplay Systems & Mechanics

### 1. Six-Stage Behavioral Awareness AI
Guards and civilians don't rely on binary detection cones. Enemy awareness is driven by behavioral perception:
```
UNKNOWN ──▶ SUSPICION ──▶ INVESTIGATION ──▶ ALERT ──▶ HUNT ──▶ FULL COMBAT
```
- **Context-Sensitive Detection:** Walking on public sidewalks is ignored. Trespassing in restricted rooftop zones, scaling walls, drawing a weapon, sprinting, or dragging bodies triggers immediate escalation.
- **Environmental Modifiers:**
  - **Monsoon Rain:** Reduces enemy visual range by **38%** and muffles footsteps.
  - **Lightning Strikes:** Flashes spike ambient illumination by **+120%**, momentarily exposing Raven in shadows.
  - **Crowd Blending:** Blending within groups of civilians reduces detection rates by **70%**.
  - **Disguises:** Stealing a *Nirapotta Solutions* security jacket allows safe passage through perimeter checkpoints.
- **Forensic Investigation:** Patrols dynamically investigate broken streetlights, blood spatters, unsuppressed gunshots, dropped bullet casings, disabled cameras, and missing comrades who fail scheduled 35-second radio check-ins.

### 2. The Signature "Veil State"
Veil State is a neurological trauma response, not an arcade power-up:
- **Triggers:** Automatically sparks the first time a lethal weapon is leveled at Raven, on critical injury, or manually when burning accumulated **Focus** (earned from clean takedowns and near-miss dodges).
- **Time Dilation:** The external world drops to **16% speed**, while Raven retains **55% speed** for tactical evasion, aiming, or repositioning.
- **Visual & Audio Transformation:** The renderer shifts to a cold monochrome steel grading while retaining intense hot highlights on muzzle flashes, electrical arcs, and sparks. The audio collapses into a deep 350 Hz low-pass filter dominated by Raven’s pulsing heartbeat and breath.
- **Visible Ballistics:** Enemy rounds become visible as glowing projectile traces slicing through hanging raindrops.

### 3. Contextual Bangladeshi Parkour & Urban Traversal
Engineered specifically around Old Dhaka’s dense vernacular architecture:
- Scale window grills, balcony slabs, concrete sunshades (*chhajja*), water-tank scaffolding, and stair-head rooftop rooms (*chilekotha*).
- Traverse roof gaps, sprint along corrugated tin canopies, and drop silently into narrow alleyways.

### 4. Non-Linear Infiltration & Multiple Approaches
Every contract can be solved through diverse playstyles:
- **Ghost (Social & Stealth):** Disguise yourself in a guard jacket, slip past perimeter cameras, and dispatch the target silently.
- **Tactical Sniper:** Scale the opposite rooftop water tower and eliminate the target from long range through the monsoon rain.
- **Environmental Sabotage:** Hack the circuit or shoot the fuel feed of a leaking diesel generator to trigger a catastrophic explosion.
- **Aggressive Assault:** Secure a KR-7 carbine from a patrol guard and fight through the squad.
- **Target Escape Contingency:** If the Cartographer is alerted to your presence, he initiates an escape sequence across four interconnected rooftops toward an extraction vehicle on the east avenue.

---

## 📻 100% Procedural WebAudio Soundscape

VEIL features zero external audio files. The entire acoustic world is synthesized in real-time using native WebAudio oscillators, noise generators, and biquad filter nodes:
- **Atmospheric Beds:** Continuous synthesis of monsoon rainfall on concrete and corrugated metal, distant Dhaka traffic drone, generator hums, rickshaw bells, and CNG horns.
- **Spatial Ballistics:** Positional gunshots with physical urban reverb, subsonic suppressor pops, and metallic brass casings pinging against rooftops.
- **Dynamic Score:** Procedural music combining Karplus-Strong physical modeling of a traditional *dotara* lute, synthesized bamboo flute melodies, and high-tension tabla rhythm generators that react to combat states.

---

## 🗺️ Campaign Scope: The Ten Missions

While Mission 01 is fully playable in this prototype, the full campaign design bible is documented in [`docs/MISSIONS.md`](docs/MISSIONS.md):

| # | Mission Name | Setting | Division | Core Theme & Atmosphere |
|---|---|---|---|---|
| **01** | **The City That Never Sleeps** | Old Dhaka Rooftops & Bazaar | Dhaka | *Paranoia* · Monsoon rain, MRT tracks, crowded alleyways *(Playable)* |
| **02** | **The Port** | Container Terminal & Shipyard | Chattogram | *Conspiracy* · Sea fog, gantry cranes, container canyons, shipbreaking |
| **03** | **The Ghost Farm** | Silk Mills & Mango Orchards | Rajshahi | *Identity* · Golden dusk, industrial silk looms, agricultural ruins |
| **04** | **The Drowned Forest** | Mangrove Delta & Smuggler Outpost | Sundarbans | *Isolation* · Tidal changes, roots, wooden trawlers, no public zones |
| **05** | **The Tea Garden** | Colonial Manor & Terraced Hills | Sylhet | *Class & Colonial Echoes* · Rolling fog, terraced estates, heavy downpours |
| **06** | **The Brick Kilns** | Clay Pits & Smoke Stacks | Rangpur | *Labor & Heat* · Choking soot, towering chimneys, scorching kilns |
| **07** | **The River Crossing** | Multi-Deck Passenger Launch | Mymensingh / Meghna | *Containment* · Steamer ferry in night transit, tight cabin corridors |
| **08** | **The Floating Market** | Guava Canals & Waterways | Barishal | *Fluidity* · Country boats, wooden boardwalks, submerged pathways |
| **09** | **The Border Post** | Zero Line & Checkpoint Barracks | Cumilla | *Sovereignty* · Razor wire, watchtowers, searchlights, contested ground |
| **10** | **The Return** | Modern Glass Tower & Dhaka Rain | Dhaka | *Dissolution* · Corporate high-rise, full psychological unraveling |

---

## 🏗️ Repository Architecture

```
Veil/
├── index.html           # HTML5 shell, HUD layouts, modal screens (briefing, archive, debrief)
├── package.json         # Project metadata and build scripts
├── vite.config.js       # Vite bundler configuration
├── docs/                # Comprehensive Design & Production Bible
│   ├── GDD.md           # Game Design Document: mechanics, AI, Veil State, art direction
│   ├── MISSIONS.md      # Full 10-mission campaign design, beats, intel, and set pieces
│   ├── UE5_PRODUCTION.md# Unreal Engine 5 production pipeline, budgets, and milestones
│   └── MEMORY.md        # Persistent codebase memory & architectural invariants
└── src/
    ├── main.js          # Game shell, loop orchestration, camera controller, input binding
    ├── world.js         # Procedural Dhaka generator, street grid, traffic, custom shaders
    ├── player.js        # Raven entity: movement physics, parkour raycasting, health, inventory
    ├── ai.js            # 6-state awareness FSM, perception systems, Cartographer escape AI
    ├── combat.js        # Raycasted & projectile ballistics, damage models, takedown animations
    ├── veil.js          # Veil State mechanics, time scaling, Focus accumulation
    ├── weather.js       # Monsoon rain particles, puddle reflection shaders, lightning engine
    ├── fx.js            # Muzzle flash, bullet tracers, shell casings, blood decals, bloom
    ├── audio.js         # Pure procedural WebAudio sound engine and dynamic soundtrack
    ├── ui.js            # Diegetic HUD, awareness meters, CCTV terminal, intelligence board
    ├── mission01.js     # Mission 01 state machine, scripted intel drops, debrief sequence
    ├── missions.js      # Operations archive database tracking all 10 mission logs
    ├── characters.js    # Procedural geometry representations for Raven, guards, and civilians
    ├── style.css        # Cyber-tactical UI styling, typography, and responsive HUD layout
    └── util.js          # Linear algebra, spatial math, and collision detection helpers
```

---

## 🎯 Production Roadmap (Unreal Engine 5)

Full commercial production specifications are outlined in [`docs/UE5_PRODUCTION.md`](docs/UE5_PRODUCTION.md):
- **Core Technology:** Unreal Engine 5 (Nanite, Lumen dynamic GI, MegaLights, Niagara VFX).
- **Character Systems:** MetaHuman frameworks with Motion Matching for reactive parkour and fluid CQB transitions.
- **Crowd & AI Systems:** Mass Entity framework for dense South Asian city crowd simulation coupled with StateTree AI logic.
- **Audio Architecture:** Unreal Engine MetaSound with spatialized binaural audio rendering.

---

## 📄 License & Credits

Developed by **[Nibir Imtiaz](https://github.com/nibir404)**.  
Designed and prototyped as a vertical slice and game design bible for **VEIL**.
All rights reserved.
