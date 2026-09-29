import { damp, lerp, S, pick } from './util.js';

// VEIL STATE. Not a power-up: a neurological event. It triggers on its own the first time a
// weapon is raised at Raven in an engagement (and again when he is badly hurt); it can be
// forced only with accumulated charge (takedowns, headshots, near-misses). The player keeps
// full control — the world slows to 16%, Raven only to 55%.

const FRAGMENTS = [
  'A boat. Rain on a tin roof. Someone calls a name. It isn\'t yours.',
  'You have stood in this exact spot before.',
  'Your hands already know where he will fall.',
  'A woman\'s voice, in Sylheti: "come inside, it\'s raining."',
  'Count the heartbeats. You always count them.',
  'A photograph, face down on a table.',
];

export class Veil {
  constructor(game) {
    this.g = game;
    this.active = false; this.amount = 0; this.timer = 0; this.cooldown = 0;
    this.mode = null; this.engagementUsed = false; this.pulse = 0; this.uses = 0;
  }
  get worldScale() { return lerp(1, 0.16, this.amount); }
  get playerScale() { return lerp(1, 0.55, this.amount); }
  canManual() { return !this.active && this.g.player.veilCharge >= 50; }

  onThreat() {
    const P = this.g.player;
    if (this.active || this.cooldown > 0 || P.health <= 0) return;
    if (!this.engagementUsed || (P.health < 40 && !this.lowUsed)) {
      if (P.health < 40) this.lowUsed = true;
      this.engagementUsed = true;
      this.enter('auto');
    }
  }
  enter(mode) {
    this.active = true; this.mode = mode; this.timer = mode === 'auto' ? 2.8 : 99; this.uses++;
    this.g.audio.veilEnter();
    this.g.stats.veil++;
    if (this.uses === 1 || Math.random() < 0.35) this.g.ui.fragment(pick(FRAGMENTS));
  }
  exit() {
    if (!this.active) return;
    this.active = false; this.cooldown = 8;
    this.g.audio.veilExit();
    this.g.cam.shake = Math.max(this.g.cam.shake, 0.35);
  }
  update(dt, input) {
    const P = this.g.player;
    this.cooldown -= dt;
    if (this.g.ai.squadState < S.ALERT) { this.engagementUsed = false; }
    if (input.pressed('KeyQ')) {
      if (this.active && this.mode === 'manual') this.exit();
      else if (this.canManual()) this.enter('manual');
      else if (!this.active) this.g.ui.toast('VEIL: NOT ENOUGH FOCUS');
    }
    if (this.active) {
      this.timer -= dt;
      if (this.mode === 'manual') { P.veilCharge -= 20 * dt; if (P.veilCharge <= 0) { P.veilCharge = 0; this.exit(); } }
      if (this.timer <= 0 || P.health <= 0) this.exit();
    }
    this.amount = damp(this.amount, this.active ? 1 : 0, this.active ? 9 : 4, dt);
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.g.audio.veil = this.amount;
  }
}
