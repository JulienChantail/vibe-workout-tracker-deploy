import type { Cue, CueKind } from './timer';

/**
 * Joue les annonces du chrono (voix + bips) avec la Web Audio API.
 *
 * Toutes les annonces sont programmées à l'avance sur l'horloge audio : elles
 * partent à l'heure même si la page est ralentie (onglet en arrière-plan, autre
 * appli au premier plan), tant que le navigateur garde le son actif.
 * Côté navigateur uniquement.
 */

const VOICE_FILES: Partial<Record<CueKind, string>> = {
  three: '/sounds/three.wav',
  two: '/sounds/two.wav',
  one: '/sounds/one.wav',
  go: '/sounds/go.wav',
  halfway: '/sounds/halfway.wav',
  end: '/sounds/time.wav',
};

// Les fichiers générés commencent par un court silence : on le retire pour que
// "three, two, one" tombent pile sur les secondes.
function trimSilence(ctx: BaseAudioContext, buffer: AudioBuffer, threshold = 0.02): AudioBuffer {
  const data = buffer.getChannelData(0);
  let start = 0;
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  let end = data.length - 1;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  start = Math.max(0, start - Math.round(buffer.sampleRate * 0.005));
  const length = Math.max(1, end - start + 1);
  const trimmed = ctx.createBuffer(1, length, buffer.sampleRate);
  trimmed.copyToChannel(data.subarray(start, start + length), 0);
  return trimmed;
}

function toneBuffer(ctx: BaseAudioContext, frequency: number, beeps: { at: number; duration: number }[]): AudioBuffer {
  const rate = ctx.sampleRate;
  const total = Math.max(...beeps.map((b) => b.at + b.duration));
  const buffer = ctx.createBuffer(1, Math.ceil(total * rate), rate);
  const data = buffer.getChannelData(0);
  for (const b of beeps) {
    const from = Math.floor(b.at * rate);
    const n = Math.floor(b.duration * rate);
    for (let i = 0; i < n; i++) {
      // attaque et extinction de 10 ms pour éviter les "clics"
      const env = Math.min(1, i / (0.01 * rate), (n - i) / (0.01 * rate));
      data[from + i] = Math.sin((2 * Math.PI * frequency * i) / rate) * env * 0.6;
    }
  }
  return buffer;
}

export class CueAudio {
  private ctx: AudioContext;
  private buffers = new Map<string, AudioBuffer>();
  private scheduled: AudioScheduledSourceNode[] = [];
  private keepAlive: OscillatorNode | null = null;
  // Temps audio (secondes) qui correspond au "go" : sert à détecter un décalage
  private anchor = 0;
  ready: Promise<void>;

  constructor() {
    this.ctx = new AudioContext();
    this.buffers.set('beep', toneBuffer(this.ctx, 880, [{ at: 0, duration: 0.35 }]));
    this.buffers.set('endBeep', toneBuffer(this.ctx, 1046, [
      { at: 0, duration: 0.25 },
      { at: 0.35, duration: 0.25 },
      { at: 0.7, duration: 0.6 },
    ]));
    this.ready = Promise.all(
      Object.entries(VOICE_FILES).map(async ([kind, url]) => {
        try {
          const res = await fetch(url!);
          const decoded = await this.ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(kind, trimSilence(this.ctx, decoded));
        } catch {
          // voix indisponible : seuls les bips seront joués pour cette annonce
        }
      })
    ).then(() => undefined);
  }

  /** À appeler depuis un clic : les navigateurs n'autorisent le son qu'après une action. */
  async unlock() {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
  }

  private play(name: string, when: number, gain = 1) {
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    source.connect(g).connect(this.ctx.destination);
    source.start(Math.max(when, this.ctx.currentTime));
    this.scheduled.push(source);
  }

  /** Programme les annonces à venir, sachant qu'il s'est écoulé `elapsedMs` depuis le "go". */
  schedule(cues: Cue[], elapsedMs: number) {
    this.stopAll();
    this.anchor = this.ctx.currentTime - elapsedMs / 1000;
    for (const cue of cues) {
      if (cue.atMs < elapsedMs - 50) continue;
      const when = this.anchor + cue.atMs / 1000;
      if (cue.kind === 'beep') this.play('beep', when, 0.6);
      else if (cue.kind === 'end') {
        this.play('endBeep', when, 0.7);
        this.play('end', when + 1.4);
      } else this.play(cue.kind, when);
    }
  }

  /** Écart (secondes) entre l'horloge audio et le temps réel : non nul si le son a été suspendu. */
  drift(elapsedMs: number): number {
    return this.ctx.currentTime - (this.anchor + elapsedMs / 1000);
  }

  get running() {
    return this.ctx.state === 'running';
  }

  stopAll() {
    for (const s of this.scheduled) {
      try {
        s.stop();
      } catch {
        // déjà terminé
      }
    }
    this.scheduled = [];
  }

  /**
   * Son inaudible en continu (25 Hz, -58 dB) : le navigateur considère la page
   * comme "en train de jouer du son" et ne la met pas en sommeil quand on passe
   * sur une autre appli (Android). À tester : certains téléphones pourraient
   * alors mettre la musique en pause.
   */
  startKeepAlive() {
    if (this.keepAlive) return;
    const osc = this.ctx.createOscillator();
    osc.frequency.value = 25;
    const g = this.ctx.createGain();
    g.gain.value = 0.0012;
    osc.connect(g).connect(this.ctx.destination);
    osc.start();
    this.keepAlive = osc;
  }

  stopKeepAlive() {
    try {
      this.keepAlive?.stop();
    } catch {
      // déjà arrêté
    }
    this.keepAlive = null;
  }

  close() {
    this.stopAll();
    this.stopKeepAlive();
    this.ctx.close().catch(() => {});
  }
}
