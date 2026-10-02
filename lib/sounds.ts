// Utilitaire sonore Web Audio API - Zéro dépendance externe
class SoundEffects {
  private ctx: AudioContext | null = null;
  private ringOscillator: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Son de message envoyé (pop subtil style WhatsApp)
  playSend() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      console.warn('Audio send error:', e);
    }
  }

  // Son de message reçu (double note mélodieuse style WhatsApp)
  playReceive() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Note 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Note 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.08); // A5
      gain2.gain.setValueAtTime(0.18, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.28);
    } catch (e) {
      console.warn('Audio receive error:', e);
    }
  }

  // Sonnerie d'appel entrant/sortant
  startRinging() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      this.stopRinging();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.ringOscillator = osc;
      this.ringGain = gain;
    } catch (e) {
      console.warn('Audio ring error:', e);
    }
  }

  stopRinging() {
    try {
      if (this.ringOscillator) {
        this.ringOscillator.stop();
        this.ringOscillator.disconnect();
        this.ringOscillator = null;
      }
      if (this.ringGain) {
        this.ringGain.disconnect();
        this.ringGain = null;
      }
    } catch (e) {
      console.warn('Stop ringing error:', e);
    }
  }

  // Synthèse vocale pour lire le texte à voix haute
  speak(text: string, lang: 'fr' | 'dyu' = 'fr') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'dyu' ? 'fr-FR' : 'fr-FR'; // Fallback fluide
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

export const soundEffects = new SoundEffects();
