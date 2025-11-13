

export interface ChannelState {
  id: number;
  label: string;
  // Frequency range in Hz
  // FIX: Make freqRange readonly to match the readonly tuple type from `CHANNEL_DEFINITIONS`.
  readonly freqRange: [number, number];
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