// Pitch detection using the YIN algorithm.
// Returns { freq, clarity } or null when no clear pitch is found.
const Pitch = {
  MIN_FREQ: 60,   // a little below C2 so Drop C works
  MAX_FREQ: 1100, // well above high E (330 Hz) to catch harmonics if tuned up
  THRESHOLD: 0.15,

  rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  },

  detect(buf, sampleRate) {
    const maxTau = Math.min(Math.floor(sampleRate / Pitch.MIN_FREQ), Math.floor(buf.length / 2));
    const minTau = Math.max(2, Math.floor(sampleRate / Pitch.MAX_FREQ));
    const win = Math.min(2048, buf.length - maxTau);
    if (win <= 0) return null;

    // Difference function
    const d = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < win; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      d[tau] = sum;
    }

    // Cumulative mean normalized difference
    const cmnd = new Float32Array(maxTau + 1);
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      running += d[tau];
      cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
    }

    // First dip under the threshold, then walk to its local minimum
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (cmnd[t] < Pitch.THRESHOLD) {
        while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau === -1) return null;

    // Parabolic interpolation for sub-sample accuracy
    let better = tau;
    if (tau > 1 && tau < maxTau) {
      const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
      const denom = a + c - 2 * b;
      if (denom !== 0) better = tau + (a - c) / (2 * denom);
    }

    return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
  },
};
