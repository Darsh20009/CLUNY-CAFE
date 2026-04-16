/**
 * Notification Sound System
 *
 * Rules:
 * - Only staff pages (dashboard, POS, kitchen, cashier) call playNotificationSound
 * - websocket.ts NEVER plays sounds
 * - Deduplication via localStorage prevents multi-tab double-plays
 * - Online orders: play a very loud alarm pattern via Web Audio API
 * - POS/cashier orders: play a short double-beep
 */

export type NotificationSoundType =
  | 'newOrder'
  | 'onlineOrderVoice'
  | 'cashierOrder'
  | 'statusChange'
  | 'success'
  | 'alert';

// --- AudioContext singleton ---
let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

// Resume (or eagerly create) AudioContext on user interaction (browser autoplay policy)
if (typeof window !== 'undefined') {
  const resume = () => {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      // Eagerly create so it starts in 'running' state for the next sound
      try {
        sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {}
    }
    if (sharedCtx && sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'].forEach(evt =>
    document.addEventListener(evt, resume, { capture: true, passive: true })
  );
}

// --- Deduplication: one tab plays, others skip (3s window) ---
const DEDUP_KEY = 'sound_last_played';
const DEDUP_WINDOW_MS = 3000;

function isDuplicate(type: NotificationSoundType): boolean {
  try {
    const raw = localStorage.getItem(DEDUP_KEY);
    if (!raw) return false;
    const { t, soundType } = JSON.parse(raw);
    return soundType === type && Date.now() - t < DEDUP_WINDOW_MS;
  } catch {
    return false;
  }
}

function markPlayed(type: NotificationSoundType): void {
  try {
    localStorage.setItem(DEDUP_KEY, JSON.stringify({ t: Date.now(), soundType: type }));
  } catch {}
}

// --- TING sound: single bell chime via Web Audio API ---
// A high-frequency sine wave with fast attack and slow exponential decay
// gives the classic "ting" bell sound. Runs entirely in Web Audio API —
// no external file needed, works on the media audio channel.
function playTing(ctx: AudioContext, startTime: number, freq = 1047): void {
  // Chain: Oscillator → OscGain → MasterGain → Destination
  const masterGain = ctx.createGain();
  masterGain.gain.value = 2.5; // boost well above 100%
  masterGain.connect(ctx.destination);

  // Primary tone
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  oscGain.gain.setValueAtTime(0, startTime);
  oscGain.gain.linearRampToValueAtTime(1.0, startTime + 0.002); // 2ms attack
  oscGain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2); // 1.2s decay
  osc.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + 1.3);

  // Slight harmonic at 2× for richness
  const osc2 = ctx.createOscillator();
  const osc2Gain = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.value = freq * 2;
  osc2Gain.gain.setValueAtTime(0, startTime);
  osc2Gain.gain.linearRampToValueAtTime(0.3, startTime + 0.002);
  osc2Gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
  osc2.connect(osc2Gain);
  osc2Gain.connect(masterGain);
  osc2.start(startTime);
  osc2.stop(startTime + 0.5);
}

// Plays "ting … ting" — two bell chimes with 0.55s gap
async function playOnlineOrderAlarm(): Promise<void> {
  const ctx = getCtx();

  if (ctx) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      if (ctx.state === 'running') {
        const now = ctx.currentTime;
        playTing(ctx, now);          // first ting
        playTing(ctx, now + 0.55);   // second ting
        // wait until both chimes finish (≈ 1.3s each from start)
        await new Promise<void>(r => setTimeout(r, 1900));
        return;
      }
    } catch {}
  }

  // Fallback: generate ting WAV and play via HTMLAudio
  try {
    const wav = generateTingWav();
    const play = (delayMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          const a = new Audio(wav);
          a.volume = 1.0;
          a.play().catch(() => {});
          a.onended = () => resolve();
          a.onerror = () => resolve();
          setTimeout(resolve, 1500);
        }, delayMs);
      });
    await play(0);
    await play(550);
  } catch {}
}

// Fallback WAV generator: decaying sine = "ting" shape
function generateTingWav(freq = 1047, decayMs = 1200, sampleRate = 44100): string {
  const numSamples = Math.floor(sampleRate * decayMs / 1000);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  write(0, 'RIFF'); view.setUint32(4, 36 + numSamples * 2, true);
  write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); write(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  const decayRate = Math.log(1000) / (sampleRate * decayMs / 1000);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.002));
    const decay = Math.exp(-decayRate * i);
    const sample = Math.sin(2 * Math.PI * freq * t) * attack * decay;
    view.setInt16(44 + i * 2, Math.round(sample * 32000), true);
  }
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(bin);
}

// --- WAV Beep Generator (used for POS / non-online orders) ---
function generateBeepWav(frequencies: number[], durationMs: number, sampleRate = 22050): string {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const write = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  write(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.01));
    const fade = Math.min(1, (numSamples - i) / (numSamples * 0.25));
    const env = attack * fade;
    let sample = 0;
    for (const f of frequencies) {
      sample += Math.sin(2 * Math.PI * f * t) / frequencies.length;
    }
    view.setInt16(44 + i * 2, Math.round(sample * env * 32000), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:audio/wav;base64,' + btoa(binary);
}

const audioCache: Partial<Record<NotificationSoundType, string>> = {};

function getAudioDataUrl(type: NotificationSoundType): string {
  if (!audioCache[type]) {
    switch (type) {
      case 'newOrder':
        audioCache[type] = generateBeepWav([523, 659, 784], 350);
        break;
      case 'cashierOrder':
        audioCache[type] = generateBeepWav([660, 880], 180);
        break;
      case 'success':
        audioCache[type] = generateBeepWav([523, 659], 250);
        break;
      case 'statusChange':
        audioCache[type] = generateBeepWav([440], 300);
        break;
      case 'alert':
        audioCache[type] = generateBeepWav([880, 659], 300);
        break;
      default:
        audioCache[type] = generateBeepWav([523, 659, 784], 350);
    }
  }
  return audioCache[type]!;
}

function playBeepWebAudio(type: NotificationSoundType, volume: number): boolean {
  try {
    const ctx = getCtx();
    if (!ctx || ctx.state !== 'running') return false;

    const freqMap: Record<string, number[]> = {
      newOrder: [523, 659, 784],
      cashierOrder: [660, 880],
      success: [523, 659],
      statusChange: [440],
      alert: [880, 659],
    };
    const freqs = freqMap[type] || [523, 659, 784];
    const master = ctx.createGain();
    master.gain.value = Math.min(volume * 2, 2.0);
    master.connect(ctx.destination);

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1 / freqs.length, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.start(start);
      osc.stop(start + 0.3);
    });

    return true;
  } catch {
    return false;
  }
}

async function playBeep(type: NotificationSoundType, volume: number): Promise<void> {
  if (playBeepWebAudio(type, volume)) return;

  try {
    const audio = new Audio(getAudioDataUrl(type));
    audio.volume = Math.max(0, Math.min(1, volume));
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      setTimeout(resolve, 800);
    });
  } catch {
    // Browser blocked audio
  }
}

// --- Main export: playNotificationSound ---
export async function playNotificationSound(
  type: NotificationSoundType = 'newOrder',
  volume: number = 0.85
): Promise<void> {
  if (isDuplicate(type)) return;
  markPlayed(type);

  if (type === 'onlineOrderVoice') {
    // Play the very loud alarm for online orders — uses Web Audio API media channel
    await playOnlineOrderAlarm();
    // Play a second time after a short pause for extra attention
    await new Promise(r => setTimeout(r, 400));
    await playOnlineOrderAlarm();
  } else if (type === 'newOrder') {
    await playBeep('newOrder', volume);
    await new Promise(r => setTimeout(r, 400));
    await playBeep('newOrder', volume * 0.9);
  } else if (type === 'cashierOrder') {
    await playBeep('cashierOrder', volume);
    await new Promise(r => setTimeout(r, 200));
    await playBeep('cashierOrder', volume * 0.9);
  } else {
    await playBeep(type, volume);
  }
}

export async function playNotificationSequence(
  types: NotificationSoundType[],
  delayMs = 300
): Promise<void> {
  for (const type of types) {
    await playNotificationSound(type);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
}
