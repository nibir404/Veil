# VEIL — Unreal Engine 5 Production Plan

The browser slice in this repo is the **systems prototype**: it proves the awareness model, Veil State timing, rain-as-gameplay, evidence, disguise, intel and the narrative beats. This document is the plan for building the AAA version.

---

## 1. Engine feature mapping

| VEIL need | UE5 implementation | Slice equivalent (`src/`) |
|---|---|---|
| Dense handcrafted cities | **World Partition** (per-mission levels, 64 m cells), **Level Instances** for building kits, **Data Layers** for Mission 10's "memory" variants of Mission 01 | `world.js` block generator + designed row |
| Photoreal geometry | **Nanite** for all hard-surface (buildings, grills, rebar, containers, hulls, rocks); Nanite foliage for mango/tea/mangrove | primitive meshes + instancing |
| Night neon & monsoon light | **Lumen** GI + reflections (hardware RT on PS5/XSX/PC), **Virtual Shadow Maps**, **MegaLights** for the hundreds of shop tubes, sodium lamps and bulbs | 12-light pool + analytic ground lamps |
| Wet streets | Material layer system: wetness mask driven by the weather subsystem (puddle height from vertex paint + RVT), rain ripple normals, Lumen reflections | `GroundShader` (planar reflection, puddle mask, ripples) |
| Rain / splashes / lens | **Niagara** GPU rain with collision depth, splash emitters, drip decals, screen-space lens drops | `weather.js`, `VeilShader` lens drops |
| Veil State | `UVeilSubsystem`: `SetGlobalTimeDilation(0.16)` + per-actor `CustomTimeDilation` on Raven (0.55/0.16 ≈ 3.4×); Post Process material (desat-except-hot, radial smear, CA, pulsed vignette); DOF focus on nearest threat; MetaSound submix snapshot | `veil.js`, `VeilShader`, `audio.js` |
| Characters | **MetaHuman** (Bangladeshi facial variety — scanned casting, not presets), strand hair (Groom), **Chaos Cloth** for lungi, saree, panjabi and rain-soaked jackets | `characters.js` rig |
| Locomotion | **Motion Matching** (Pose Search) + **Control Rig** full-body IK for hand placement on grills/pipes/weapons, foot locking, weapon IK, lean | procedural `animate()` |
| Traversal | Contextual traversal component using tagged surfaces (`Climb.Grill`, `Climb.Pipe`, `Ledge`, `Cable`) + Motion Warping into authored animation sets | `player.js` climb / vault / mantle |
| AI | **State Tree** per agent (six awareness states), **Smart Objects** (posts, tea stalls, radio check-ins), **EQS** for cover/flank/search points, **AI Perception** with custom sense config (behaviour-weighted sight, hearing, evidence), **Mass AI** for crowds and traffic | `ai.js` |
| Crowds & traffic | **Mass Entity** + Mass Crowd/Traffic (rickshaw, CNG, bus lanes; left-hand traffic), zone graph through bazaars | vehicle lanes + `Civilian` |
| Water | **Water plugin** (rivers, shorelines, buoyancy for boats), Single Layer Water material, underwater post, Niagara wakes | — (design only) |
| Destruction | **Chaos Destruction** (glass, plaster, tin roofs, crates); Geometry Collections for set pieces (container drop, crane) | — |
| Audio | **MetaSounds** (procedural rain/traffic beds), **Quartz** for music sync, **Audio Modulation** submix snapshots for Veil, convolution reverb per space | `audio.js` bus layout (world / music / ui / heart) |
| Cinematics | **Sequencer** only for bookends; in-mission beats are gameplay cameras with authored rails, CineCamera lens data (long lens, anamorphic) | `updateCamera()` |
| UI | **CommonUI** + UMG; diegetic widgets (phone, CCTV, documents) as 3D widget components | `ui.js` |

---

## 2. Content pipeline — making it *Bangladeshi*

1. **Reference capture trips** per division: photogrammetry of facades, grills, shutters, signage, rickshaw art, boats, tea bushes, mangroves; HDRI at the right hours (monsoon overcast, sodium night, Rajshahi golden hour); LiDAR of two real lane geometries for scale truth (never reproduced 1:1).
2. **Audio field recording**: traffic beds at 6 times of day, rain on tin/concrete/tarp/water, launch engines, port machinery, bazaar walla, rickshaw bells, tea-stall clink, crowd walla in Dhakaiya, Chittagonian, Sylheti, Rangpuri and Barishali dialects.
3. **Cultural advisory board**: architecture, dialect and clothing consultants; religious and civic sound handled with respect (distant, never used as a gameplay cue or for shock).
4. **Kits:** Old Dhaka mid-rise kit (modular floors, 3 m), Gulshan glass kit, port kit, rural homestead kit, tea-estate kit, stilt/river kit, ruin kit — each Nanite, each with wetness and ageing layers.
5. **Signage generator:** Bangla typographic system (hand-painted, flex-print, neon) with a curated shop-name corpus, avoiding real brands.

---

## 3. Performance targets

| Platform | Target | Notes |
|---|---|---|
| PS5 / Xbox Series X | 30 fps Quality (TSR from ~1440p, HW Lumen) · 60 fps Performance (SW Lumen, reduced MegaLights) | Crowds via Mass LOD, rain GPU-only |
| PC high | 60+ fps at 4K w/ DLSS/FSR/XeSS, HW RT | |
| Veil State | must hold frame rate — time dilation *reduces* sim cost; post-process budget ≤ 1.2 ms | |

Sandbox budgets per mission: ≤ 250 active AI (≤ 30 combat-capable), ≤ 400 Mass civilians/vehicles, ≤ 2,000 dynamic lights via MegaLights.

---

## 4. Team & schedule (indicative)

| Phase | Duration | Core team | Exit criteria |
|---|---|---|---|
| Pre-production | 9–12 months | 25–40 | UE5 vertical slice of Mission 01 at target fidelity (this repo is the paper/prototype layer) |
| Production | 24–30 months | 150–250 (+ outsourcing) | All 10 missions content-complete |
| Alpha → Beta → Gold | 8–10 months | full | Cert, performance, localisation (Bangla VO, English, + 10 subtitle languages) |

Disciplines: level design (one lead LD per mission), AI (6–8 engineers), animation (motion capture with Bangladeshi performers; stunt team for traversal), environment art (largest group), VFX, audio (in-house + field teams), narrative (writers fluent in Bangla dialects), UI/UX, cinematics, tech art (weather + Veil), QA.

---

## 5. Milestone plan

1. **M0 – Prototype (this repo):** awareness, Veil timing, evidence, disguise, rain-as-gameplay, intel board, Mission 01 script — *done in browser*.
2. **M1 – Grey-box all ten sandboxes** with routes and AI posts; playtest route discoverability.
3. **M2 – UE5 Mission 01 beauty slice:** MetaHuman Raven, Old Dhaka kit, rain/wet, rooftop chase, CCTV and photograph beats.
4. **M3 – Systems lock:** traversal, weapons, melee, disguise, water, boats, Veil v2 (Duplicate contest).
5. **M4 – Narrative lock:** Intelligence Board degradation, carry-overs, the three endings' evidence sets.
6. **M5 – Content complete → polish.**

---

## 6. Porting the slice's logic

The slice's gameplay code is intentionally engine-agnostic:
- `ai.js` `Guard.perceive()` → a custom `UAISense_VeilSight` (behaviour score × distance × light × stance × periphery × crowd × rain × lightning).
- `Guard.update()` switch → State Tree with the same six states and transitions.
- `AI.noise()` → `UAISense_Hearing` reports with tagged stimuli (`Noise.Footsteps`, `Noise.Suppressed`, `Noise.Glass`, `Noise.Scream`…).
- `scanEvidence()` → Smart Object "evidence" actors (casings, blood, bodies, broken lights, disabled cameras) with discovery rules.
- `AI.radioCheck()` → a Squad Coordinator subsystem (check-ins, missing buddy, reinforcements).
- `Veil` → `UVeilSubsystem` (trigger policy, Focus economy, dilation, snapshot).
- `Mission01` → a mission Blueprint/StateTree driving objectives, dialogue, surreal events and the rating tracker.
