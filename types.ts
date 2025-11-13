
export interface ChannelState {
  id: number;
  label: string;
  // Frequency range in Hz
  // FIX: The `as const` on `CHANNEL_DEFINITIONS` infers `freqRange` as a readonly tuple (e.g., `readonly [20, 60]`),
  // which is not assignable to a mutable tuple `[number, number]`. The type here must also be readonly.
  readonly freqRange: readonly [number, number];
  // Index range in the FFT data array
  fftIndexRange: [number, number];
  
  // --- Live Data ---
  currentSignal: number; // Smoothed signal strength (0-1)
  signalHistory: number[]; // For calculating novelty
  
  // --- Cybernetic State ---
  habituation: number; // "Boredom" level (0-1)
  threshold: number; // The signal must pass this to be active
  
  merit: number; // "Interest" score, based on novelty (0-1)
  lastNovelTimestamp: number; // Timestamp of last novel event
  
  attention: number; // How much focus the system gives this channel (0-1)
  isActive: boolean; // Is the light on?
}

export interface HarmonyState {
  pitch: number; // in Hz
  consonance: number; // 0-1, clarity/periodicity
  tension: number; // 0-1, 1 - consonance
  resolution: number; // 0-1, strength of recent consonance increase
  interLensConsonance: number[][];
}
