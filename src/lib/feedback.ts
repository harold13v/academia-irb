/** Feedback físico de un logro: vibración corta en Android y cuenco opcional (apagado por defecto). */
export function haptic() {
  try {
    if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.(30);
  } catch {}
}

export function bowl() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // cuenco tibetano aproximado: fundamental + parciales inarmónicos con caída larga
    for (const [f, g, d] of [[220, 0.18, 4.5], [553, 0.08, 3.2], [1013, 0.04, 2.2]] as const) {
      const o = ctx.createOscillator();
      const v = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      v.gain.setValueAtTime(0, now);
      v.gain.linearRampToValueAtTime(g, now + 0.02);
      v.gain.exponentialRampToValueAtTime(0.0001, now + d);
      o.connect(v).connect(ctx.destination);
      o.start(now);
      o.stop(now + d);
    }
    setTimeout(() => void ctx.close(), 5000);
  } catch {}
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
