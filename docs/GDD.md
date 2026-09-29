# VEIL — Game Design Document

> **YOU WERE NEVER HUNTING THEM.**
> *You were hunting yourself.*

A psychological military thriller disguised as an assassin game, set entirely in a near-future Bangladesh.
Third-person. Ten handcrafted missions. Dense cinematic sandboxes, not an open world.

**Visual thesis:** REAL BANGLADESH + MILITARY CINEMA + ASSASSIN STEALTH + PSYCHOLOGICAL SURREALISM
**Gameplay loop:** OBSERVE → INFILTRATE → MANIPULATE → ASSASSINATE → ESCALATE → SURVIVE → QUESTION REALITY
**Narrative arc:** The player begins as an elite operative hunting a hidden enemy. They end unsure whether the operative, the enemy, the memories or the mission were ever real.

---

## 1. Pillars

| Pillar | What it means in practice | What it forbids |
|---|---|---|
| **Stealth is control, not avoidance** | Stealth chooses *when* combat starts, *where* you stand when it does, and *what the enemy believes*. | Binary "detected = fail" stealth. |
| **Grounded violence** | Weapons have weight, recoil, reload choreography and consequence. Melee is fast, brutal, short. | Arcade hit-points, superhero combos. |
| **Bangladesh is the protagonist's skin** | Architecture, weather, sound, light, clothing, signage and social behaviour are specific and researched. | Generic "South Asia", cyberpunk neon soup. |
| **Reality degrades, the image does not** | Surrealism is conveyed through *wrongness* inside a photoreal frame. | Cartoon/fantasy visual switches. |
| **Every optional thing pays** | Optional content yields intel, a route, a secret, a character beat or a future-mission change. | Collectible filler, towers, fetch quests, map clutter. |

---

## 2. Protagonist — RAVEN

Early thirties. Bangladeshi special-operations operative. Codename only. Reconnaissance, covert ops, urban warfare, CT, CQB, parkour, infiltration, intelligence.

**Performance direction:** quiet, observant, restrained, analytical. He speaks in short lines. Character is carried by:
- **Body language:** he checks exits on entering rooms. Hands stay still. He touches walls when disoriented (a tell that grows across the campaign).
- **Micro-expressions:** a held breath before a kill; a half-second too long on a reflection.
- **Environmental interaction:** he straightens a crooked photo frame, turns off a running tap, lets rain hit his face on rooftops.
- **Fragments:** memory flashes inside Veil State (sensory, never expository).

Never: quips, one-liners, heroic monologues.

**Handler — ZAHIR.** Warm, dry, paternal, always slightly ahead of what Raven tells him (Mission 01 debrief: *"We'll talk about the photograph tomorrow." / "…I never told you about the photograph."*).

---

## 3. VEIL STATE (signature mechanic)

A neurological event, not a power-up. Under extreme threat Raven's perception fractures: time dilates, sound collapses to heartbeat and breath, detail becomes hyper-real.

### Rules
- **Trigger:** automatic the *first* time a weapon is raised at Raven in an engagement, and once more when critically wounded. Manual activation only with accumulated **Focus** (from takedowns, headshots, near-misses). It is scarce by design.
- **Time:** world 16% speed, Raven 55% — the player moves *relatively* faster, keeping full agency (shoot, dodge, slide to cover, disarm, melee, throw, switch weapons, escape).
- **Duration:** ~2.8 s auto; manual drains Focus.
- **Exit:** the full soundscape returns *explosively* (high-shelf swell + camera kick).

### Presentation
| Channel | Veil treatment |
|---|---|
| Image | Desaturation toward cold steel, **except hot highlights** (muzzle flash, fire, sparks keep colour). Radial time-smear, edge chromatic split, heartbeat-pulsed vignette, heavier grain. |
| Particles | Rain advected in world time — drops hang as beads. Dust, smoke, casings, sparks crawl. |
| Camera | FOV narrows ~7°, handheld sway suppressed, a shallow DOF focal plane locks on the nearest threat (UE5). |
| Sound | World bus low-passed to ~350 Hz and ducked; heart and breath buses forward; weapon mechanics close-miked; music removed. |
| Tracers | Enemy rounds visible **only** in Veil (narratively: he *sees* them). |
| Memory | A one-line sensory fragment may surface ("A woman's voice, in Sylheti: *come inside, it's raining.*") — seeds the identity mystery. |

### Canonical chain (Mission 10 is built around it)
Enemy aims rifle → Raven ducks → round passes overhead → time slows → slide to cover → pistol headshot → normal speed → second enemy rushes → grab weapon → disarm → rotate → fire → explosion in background → camera settles.

---

## 4. Awareness System

Six states per agent, plus a squad state:

```
UNKNOWN → SUSPICION → INVESTIGATION → ALERT → HUNT → FULL COMBAT
```

**Detection is behavioural.** In public, Raven is a man walking in the rain. What raises awareness:

| Behaviour | Weight |
|---|---|
| Trespassing (restricted zones, private roofs) | high |
| Weapon visible / aiming | very high |
| Dragging a body | extreme |
| Climbing a facade | medium |
| Sprinting near guards | low |
| Crouch-sneaking in public (it looks wrong) | low |
| Squad already hostile | overrides everything |

**Modifiers:** distance falloff; light at Raven's chest (street lamps, shop tube-lights, the target's floodlight); stance; core vs. peripheral vision; rain (−38% view range); **lightning flashes (+120% for a frame — the storm can expose you)**; crowd blending (≥2 civilians within 3 m, walking → ×0.3); disguise (context-dependent, fails at <4 m or on conspicuous behaviour); per-agent *bias* that grows after each false alarm (enemies adapt).

**Evidence they react to:** unexplained sounds (footsteps, landings, bodyfall, suppressed shots, impacts, glass), shell casings (only if lit), blood pools, bodies (dark bodies are found only up close), broken lights, disabled cameras, missing patrol members (radio check-ins every 35 s — *"Rubel, do you copy?"*), civilians who saw a weapon (they scream and point), open doors / stolen weapons / footprints (UE5 full build).

**Squad behaviour:** radio call-outs, converging HUNT on last known position, flankers, exit security (the escape car), roof searches, reinforcement requests after sustained combat, return-to-post with raised bias.

**Dialogue:** Bangla (transliterated) with English subtitle, e.g. *"Ke oikhane?" — Who's there?*, *"Laash! Ekhane ekta laash!" — A body! There's a body here!* Tapping the enemy radio (intel) lets Raven hear the whole squad.

---

## 5. Traversal & Movement

Contextual traversal authored for Bangladeshi architecture: window grills, drainpipes, balcony slabs, *chhajja* sunshades, rebar stubs, bamboo scaffolding, stair-head rooftop rooms (*chilekotha*), water-tank stands, tangled power cables (rope-traversal set pieces), launch railings, container stacks, mangrove roots.

Moves: walk / crouch / sprint / tactical sprint / prone / slide / vault (armed) / mantle / climb / shimmy / ledge hang / drop / rooftop gap jump / rope & cable traverse / rappel / window entry / crawl / swim / dive / underwater hide / boat-to-boat jump.

Animation: motion matching (UE5 Pose Search) with hand IK to real grip points; no floating, no foot slide. Fall damage is real (>7.5 m hurts, >13 m kills).

---

## 6. Weapons & Combat

| Class | Example | Identity |
|---|---|---|
| Suppressed pistol | P-9 | quiet, *not silent*: 7 m noise, still ejects casings that become evidence |
| Pistol | Service 9 mm | loud backup |
| SMG | compact 9 mm | CQB in stairwells and launch cabins |
| Assault rifle | KR-7 | 85 m noise radius; dramatically escalates awareness |
| DMR | — | long-range farmland/port overwatch |
| Sniper | — | Rajshahi & Chattogram set pieces |
| Shotgun | pump | tea-estate mansion CQB |
| LMG | belt-fed | Mission 09 checkpoint breach |
| Knife | — | silent takedowns, knife encounters |
| Improvised | dao, brick, pipe, bamboo pole | environmental melee |
| Throwables | frag, smoke, flash | smoke is thick and wet in monsoon |
| Environmental | generators, transformers, diesel drums, gas cylinders, crane loads, boats | assassination tools |

Weapons carry recoil patterns, sway, weight, magazine choreography, shell ejection, muzzle flash, wet-weapon handling. Unsuppressed fire is a *narrative decision*.

**Melee:** silent takedown (from behind or on unaware targets), contextual takedowns (ledges, water, railings, doorways), disarm, counter, knife duels, emergency defensive actions. Short, heavy, never balletic.

---

## 7. Assassination Approaches

Every target supports all ten: **social infiltration, rooftop infiltration, long-range, silent close-range, environmental, tactical assault, disguise, sabotage, explosive diversion, information-driven.**

Every major space supports six routes: **ROOFTOP · GROUND · SOCIAL · UNDERGROUND · WATER · DIRECT COMBAT.**

Information-driven assassination is the connective tissue: intel changes the sandbox (tapped radio → hear all call-outs; SMS → target location; radio log → patrol rotation & the leaking generator; CCTV → escape route).

---

## 8. Disguise

Disguise is **context**, not a costume. A Nirapotta security jacket reads as "belongs here" on a guarded roof at 20 m, and as "who are you?" at 3 m. It fails on conspicuous behaviour (running, climbing, aiming) and is irrelevant once the squad is hostile. Region-specific disguises: dock worker (Chattogram), launch crew (Barishal), estate labourer (Sylhet), researcher (Mymensingh), checkpoint soldier (Cumilla).

---

## 9. Intelligence & the Memory Board

Collectibles are replaced by **intelligence**: documents, recordings, photographs, encrypted files, surveillance footage, biometrics, environmental clues. They feed the **Intelligence Board** — pinned cards and red string.

The board **degrades**. It has an *integrity* value that drops when contradictory records are pinned. Cards glitch. Later, cards change between visits. By Mission 07, the board contains cards the player never collected, in Raven's handwriting.

Seeds laid in Mission 01:
- **FILE · RAHMAN** — `TARGET: RAHMAN / STATUS: KILLED / OPERATIVE: RAVEN / 14.08.2025` — Raven was not in Dhaka in August. The target's building is "Rahman Telecom".
- Later: `TARGET: RAHMAN / STATUS: ACTIVE` (M05). Finally: `RAHMAN NEVER EXISTED` (M08).
- **CCTV** — shows Raven at the terminal with a timestamp three minutes in the future.
- **PHOTOGRAPH** — the Cartographer's identification photo is Raven, dated two years before his recruitment.

---

## 10. Surrealism rules

1. Never break the photoreal frame. Reality is *wrong*, not *stylised*.
2. One wrong thing at a time, with a normal-world alibi (a recorder delay, a man in white who is "probably nobody").
3. The handler normalises everything. The player's doubt grows from the gap between what they saw and what they're told.
4. Wrongness escalates across the campaign's colour language (below).

Toolbox: a recurring man in a white panjabi who vanishes when you look away · rain alley → dry street · a location subtly changes off-camera · radio broadcasting Raven's voice · CCTV of events that haven't happened · photographs that predate Raven · villagers who remember him · a Janus half-face mark stencilled on walls, only noticed by observant players.

---

## 11. UI — military intelligence, not HUD

- Minimal, diegetic-first. Earpiece dialogue (subtitled), a single objective line, a phone, surveillance screens, documents, radio.
- **Awareness arcs** at screen edge (colour = state, length = awareness), tagged-agent diamonds after **Observe** (hold X — LOS required, not wallhack).
- No minimap. No quest arrows by default. Observe mode surfaces opportunities (generator, lights, cameras, intel) with small labels.
- Weapon/ammo and vitals fade when not relevant.

---

## 12. Mission Rating (narrative, not a score)

Tracked: **STEALTH · DETECTION · PRECISION · INTELLIGENCE · DAMAGE · CIVILIAN IMPACT · TACTICAL EFFICIENCY**. Surfaced as prose in the post-operation analysis ("No civilians harmed. Old Dhaka will wake up and not know you were here."). Internally it drives: handler tone, NPC memory in later missions (villagers in Rajshahi reference how "you" behaved in Dhaka), news radio chatter, and the number of Nirapotta units in Mission 10.

---

## 13. Weather

Rain is gameplay: puddles/reflections, slippery sprinting, view range −38%, footstep masking, lens drops, fog density, dripping clothing, wet weapons, flooded streets, condensation. Lightning is a detection hazard. Heat shimmer (Rajshahi) distorts scopes. Fog (Sundarbans, Barishal) collapses long sightlines. Night changes patrols and light. Weather changes mid-mission on an authored schedule.

## 14. Water

Bangladesh is rivers. Swimming, diving, underwater hiding, boat traversal, river infiltration, boat combat, jumping between boats, flooded streets, underwater facility approaches. Water rendering: UE5 Water + Single Layer Water with rain ripples, silt, floating hyacinth, debris.

---

## 15. Colour language across the campaign

| Missions | Grade |
|---|---|
| 01–03 | Natural, realistic, slightly muted. Sodium orange, tube-light cyan, monsoon grey, golden Rajshahi light. |
| 04–06 | More contrast, deeper shadows, colour relationships start to be "off" (greens too even, whites too clean). |
| 07–09 | Desaturation, unusual light sources, fragmented colour, distorted reflections (reflections lag the subject by a frame). |
| 10 | Realistic Dhaka + impossible elements (rain falling upward in one alley; Mission 01's street layered over the facility). |

Bangladesh stays visually rich: golden sun, green paddies, colourful markets and boats, blue skies, warm interiors. **Darkness comes from atmosphere and story, never from a black-and-red grade.**

---

## 16. Audio

**Music:** Bangladeshi textures as *emotion*, not cliché — dotara-like plucks, bamboo flute (bashi) timbre, tabla/dhol-derived percussion, bowed strings, deep drones, distorted vocal textures, industrial percussion, sub-bass, electronic atmospheres. Exploration = sparse plucks and breathy flute over a drone; combat = tabla + industrial pulses; Veil = silence, heartbeat.

**Sound design:** traffic, rickshaw bells, CNG two-strokes, bus horns, rain on tin and concrete, market voices, distant civic sounds, rivers, launch engines, port machinery, insects, generators, transformers, trains, wind, surface-specific footsteps, cloth, weapon mechanics, casings, impacts, glass, debris, explosions, per-space reverb.

**Mix:** dynamic. Veil State collapses the world bus to ~350 Hz and restores it explosively.

---

## 17. Cinematography

Long-lens compression on streets; handheld during combat; controlled shake; shallow DOF in psychological beats; wide establishing shots; low-angle hero framing; reflections and silhouettes; volumetric light; rain-covered lens; realistic exposure adaption; timed transitions. **Set pieces keep player control** whenever possible.

---

## 18. What the vertical slice proves (this repo)

See `README.md`. The browser slice implements Mission 01 end-to-end with the awareness system, Veil State, rain-as-gameplay, rooftop traversal, weapons & evidence, disguise, intel board, surreal beats, the photograph reveal and the narrative debrief. It is the systems prototype for the UE5 production described in `UE5_PRODUCTION.md`.
