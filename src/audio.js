// Tiny WebAudio blip engine — a soft hum bed plus square-wave UI blips —
// plus a looping background music track. No samples needed for the SFX,
// keeps the bundle tiny; music is the one real asset, relative path so it
// works under GitHub Pages subpaths (vite base './').
const MUSIC_URL = 'audio/spySong.mp3';
const MUSIC_VOLUME = 0.35;

export class AudioEngine {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.soundOn = true;
    this.ctx = null;
    this.amp = null;
    this.music = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.amp = this.ctx.createGain();
      this.amp.gain.value = this.enabled ? 0.04 : 0;
      this.amp.connect(this.ctx.destination);
      const o1 = this.ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 55;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 82.5;
      o1.connect(this.amp);
      o2.connect(this.amp);
      o1.start();
      o2.start();
    } catch {
      // audio is optional; silently degrade
    }

    try {
      this.music = new Audio(MUSIC_URL);
      this.music.loop = true;
      this.music.volume = MUSIC_VOLUME;
      if (this.enabled && this.soundOn) this.music.play().catch(() => {});
    } catch {
      this.music = null;
    }
  }

  setSoundOn(on) {
    this.soundOn = on;
    if (this.amp) this.amp.gain.value = on ? 0.04 : 0;
    if (this.music) {
      if (on) this.music.play().catch(() => {});
      else this.music.pause();
    }
  }

  blip(freq) {
    if (!this.ctx || !this.soundOn) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, this.ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start();
      o.stop(this.ctx.currentTime + 0.13);
    } catch {
      // ignore transient audio errors
    }
  }
}
