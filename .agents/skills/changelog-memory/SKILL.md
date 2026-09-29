---
name: changelog-memory
description: Maintains an evergreen codebase memory and chronological change ledger. Activates at the start of any task to recall prior context, active objectives, and architectural decisions, tracks all changes during execution, and records atomic changelog entries before commits.
---

# Changelog & Codebase Memory Skill (`changelog-memory`)

This skill establishes a persistent, self-documenting feedback loop for the repository. It operates as both a **working memory** (enabling any agent or session to immediately resume work with full context) and a **chronological change ledger** (recording atomic modifications, architectural decisions, and verification records).

---

## 1. When to Activate This Skill

Activate this skill whenever:
1. **Starting a New Task or Session**:
   - User asks to "continue", "resume", "pick up where we left off", "what was done last?", or gives a new feature/fix request without full context.
   - Need to establish the active baseline, pending milestones, and architectural constraints before planning.
2. **During Development**:
   - Introducing new components, altering subsystem APIs, or modifying configurations.
   - Checking non-negotiable architectural or security invariants.
3. **Wrapping Up Work / Pre-Commit / Pre-Push**:
   - Before executing `git commit` or `git push`.
   - Recording what changed, which files were touched, why decisions were made, and updating active goals.

---

## 2. The 3-Phase Memory & Changelog Lifecycle

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  PHASE 1: BOOT/RESUME  │ ───▶ │   PHASE 2: EXECUTION   │ ───▶ │  PHASE 3: LOG & SYNC   │
│ Read MEMORY.md status  │      │ Track files & context  │      │ Atomic changelog entry │
│ Align on next tasks    │      │ Adhere to invariants   │      │ Update active goals    │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

### Phase 1: Boot & Context Recovery (Start of Work)

**Never write code blind.** At the start of a session or task:

1. **Query Memory Status**:
   Run the CLI helper to inspect current state, active objectives, and recent entries:
   ```bash
   node scripts/memory.js status
   # or: npm run memory status
   ```
   Or directly inspect `docs/MEMORY.md`.

2. **Reconcile with Working Tree**:
   ```bash
   git status --short
   git log -3 --oneline
   ```
   Determine:
   - What was the last completed milestone?
   - What are the currently pending items in `## 7. Active Objectives & Next Steps`?
   - Are there uncommitted changes left from a prior turn?

3. **Establish Intent**:
   Inform the user of the current baseline and how the requested task fits into the existing architecture.

---

### Phase 2: Execution & Invariants Guard

While implementing changes:

1. **Verify Invariants (`docs/MEMORY.md` Section 4)**:
   - Ensure new code conforms to documented system rules (e.g. zero remote asset dependencies, procedural audio synthesis, strict type/lint rules).
2. **Track Components Touched**:
   - Note which files are modified, added, or removed across `src/`, `docs/`, `scripts/`, or configuration files.

---

### Phase 3: Log & Synchronize (End of Task / Pre-Commit)

Once changes are implemented and verified:

1. **Run Integrity Verification**:
   ```bash
   npm run build
   ```
   Never commit or update memory on broken builds.

2. **Record Atomic Changelog Entry**:
   Append a structured entry using either the CLI helper or by editing `docs/MEMORY.md`:

   **Using CLI Helper:**
   ```bash
   node scripts/memory.js log \
     --type feat \
     --title "Implement audio volume controls" \
     --desc "Added master and SFX volume sliders to pause modal and hooked to audio.js" \
     --notes "Persists volume preference in localStorage"
   ```

   **Or Directly in `docs/MEMORY.md` (under Section 8: Evolution & Decision Log):**
   ```markdown
   ### [YYYY-MM-DD] TYPE: Short summary of change
   - **Description**: What was implemented, fixed, or refactored.
   - **Files Touched**: `file1.js`, `file2.css`
   - **Key Decisions / Notes**: Non-obvious rationale or trade-offs.
   - **Verification**: Tests or build verification command.
   ```

3. **Update Active Objectives**:
   - Check off completed items in `## 7. Active Objectives & Next Steps`: `- [x] ...`
   - Add new upcoming objectives as needed:
     ```bash
     node scripts/memory.js next "New upcoming task description"
     ```

4. **Update Subsystems Map**:
   - If new files were added to `src/` or new tools to `scripts/`, update Section 3 (Core Subsystems) in `docs/MEMORY.md`.

5. **Stage & Commit Memory with Code**:
   ```bash
   git add docs/MEMORY.md scripts/
   git commit -m "feat/fix: <summary>"
   ```

---

## 3. Standard Semantic Entry Types

When recording changes in the changelog, prefix entries with standard semantic categories:

| Type | When to Use |
|---|---|
| `FEAT` | New gameplay mechanics, visual features, audio synthesis, or user interfaces |
| `FIX` | Bug fixes, visual glitches, collision errors, or awareness logic corrections |
| `REFACTOR` | Code restructuring, performance tuning, or shader optimization without changing functionality |
| `ARCH` | Major architectural shifts, new subsystems, or build tooling updates |
| `DOCS` | GDD updates, mission bible revisions, or README expansions |
| `CHORE` | Dependency bumps, git configuration, or script maintenance |

---

## 4. Helper Tooling Reference (`scripts/memory.js`)

| Command | Purpose |
|---|---|
| `npm run memory status` | Displays last updated date, git branch/commit, dirty file count, active objectives, and recent changelog entries. |
| `npm run memory log --type <t> --title "<text>"` | Appends an atomic changelog entry to `docs/MEMORY.md` automatically capturing modified files from git. |
| `npm run memory next "<objective>"` | Appends a new pending item to the Active Objectives section. |
| `npm run memory check` | Verifies required memory sections exist and warns about uncommitted changes. |

---

## 5. Golden Rules

1. **Memory Travels With Code**: All persistent memory resides in `docs/MEMORY.md` inside version control.
2. **Radical Honesty**: Only document what is implemented and working. Aspirational features belong in `Active Objectives` as unchecked items (`- [ ]`).
3. **No Cold Starts**: Any agent turn should begin by reading `docs/MEMORY.md` to prevent regressing decisions or duplicating prior research.
4. **Synchronous Commits**: Never commit code without updating `docs/MEMORY.md` in the same commit.
