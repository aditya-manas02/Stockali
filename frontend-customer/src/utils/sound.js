// Web Audio API Synthesizer Chimes for Customer App
export const playCustomerChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Pleasant ascending tri-tone (C5 -> E5 -> G5)
    playTone(523.25, now, 0.25);
    playTone(659.25, now + 0.12, 0.25);
    playTone(783.99, now + 0.24, 0.45);
  } catch (err) {
    console.warn('Audio chime unsupported or blocked:', err);
  }
};
