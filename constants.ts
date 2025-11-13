// --- Cybernetic Tuning ---
export const HABITUATION_RATE = 0.005; // How quickly the system gets "bored"
export const HABITUATION_DECAY = 0.99; // How quickly "boredom" fades
export const BASE_THRESHOLD = 0.15; // Minimum signal to activate a light
export const THRESHOLD_SCALE = 0.8; // How much habituation affects the threshold
export const SIGNAL_SMOOTHING = 0.7; // Smoothing factor for incoming signal (0-1)
export const MERIT_SMOOTHING = 0.95; // Smoothing for the "merit" score
export const SIGNAL_HISTORY_LENGTH = 30; // How many frames to check for novelty
export const RECENCY_WEIGHT = 0.05; // How much "interest" is driven by exploring old channels
export const ATTENTION_SMOOTHING = 0.9; // Smoothing for attention shifts

// --- Audio Processing ---
export const FFT_SIZE = 4096;
export const SAMPLE_RATE = 44100; // a typical sample rate

// --- Channel Definitions ---
// Defines the frequency bands the system "listens" to.
// FIX: Add 'as const' to infer a narrow type for freqRange, satisfying the [number, number] tuple type in ChannelState.
export const CHANNEL_DEFINITIONS = [
  { id: 1, label: 'Sub Bass', freqRange: [20, 60] },
  { id: 2, label: 'Bass', freqRange: [60, 250] },
  { id: 3, label: 'Low Mids', freqRange: [250, 500] },
  { id: 4, label: 'Midrange', freqRange: [500, 2000] },
  { id: 5, label: 'Upper Mids', freqRange: [2000, 4000] },
  { id: 6, label: 'Presence', freqRange: [4000, 6000] },
  { id: 7, label: 'Brilliance', freqRange: [6000, 20000] },
] as const;
