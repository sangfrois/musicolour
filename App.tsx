
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ChannelState, HarmonyState } from './types';
import { 
  CHANNEL_DEFINITIONS, 
  FFT_SIZE, 
  SAMPLE_RATE,
  HABITUATION_RATE,
  HABITUATION_DECAY,
  BASE_THRESHOLD,
  THRESHOLD_SCALE,
  SIGNAL_SMOOTHING,
  SIGNAL_HISTORY_LENGTH,
  MERIT_SMOOTHING,
  RECENCY_WEIGHT,
  ATTENTION_SMOOTHING,
} from './constants';
import P5Canvas from './components/P5Canvas';

// Helper to convert frequency to FFT index
const freqToIndex = (freq: number, fftSize: number, sampleRate: number): number => {
  return Math.round((freq / (sampleRate / 2)) * (fftSize / 2));
};

// Initial channel states
const initialChannels: ChannelState[] = CHANNEL_DEFINITIONS.map(def => ({
  ...def,
  fftIndexRange: [
    freqToIndex(def.freqRange[0], FFT_SIZE, SAMPLE_RATE),
    freqToIndex(def.freqRange[1], FFT_SIZE, SAMPLE_RATE)
  ],
  currentSignal: 0,
  signalHistory: Array(SIGNAL_HISTORY_LENGTH).fill(0),
  habituation: 0,
  threshold: BASE_THRESHOLD,
  merit: 0,
  lastNovelTimestamp: Date.now(),
  attention: 1 / CHANNEL_DEFINITIONS.length,
  isActive: false,
}));

// New analysis function for harmony using Harmonic Product Spectrum
const analyzeHarmony = (fftData: Uint8Array, sampleRate: number, fftSize: number): { pitch: number; consonance: number } => {
  const spectrum = Array.from(fftData).map(v => v / 255.0); // Normalize
  const hps = new Float32Array(spectrum.length);
  const harmonics = 5;

  for (let i = 0; i < spectrum.length; i++) {
    hps[i] = spectrum[i];
  }

  for (let h = 2; h <= harmonics; h++) {
    for (let i = 0; i < Math.floor(spectrum.length / h); i++) {
      hps[i] *= spectrum[i * h];
    }
  }

  let maxVal = 0;
  let maxIndex = 0;
  const minFreq = 60; // Hz
  const maxFreq = 1200; // Hz
  const minIndex = Math.floor(minFreq / (sampleRate / fftSize));
  const maxIndexSearch = Math.ceil(maxFreq / (sampleRate / fftSize));
  
  for (let i = minIndex; i < maxIndexSearch && i < hps.length; i++) {
    if (hps[i] > maxVal) {
      maxVal = hps[i];
      maxIndex = i;
    }
  }

  const pitch = maxIndex * (sampleRate / fftSize);
  const consonance = Math.pow(maxVal, 1 / harmonics);

  return { pitch, consonance };
};

// --- New Interharmonic Analysis ---
const CONSONANT_RATIOS = [3/2, 4/3, 5/4, 6/5, 5/3]; // Common ratios within an octave
const CONSONANCE_TOLERANCE = 0.05; // 5% tolerance for a ratio to be considered consonant

const analyzeInterharmonics = (fftData: Uint8Array, channels: ChannelState[], sampleRate: number, fftSize: number): number[][] => {
  // 1. Find the strongest frequency peak in each channel
  const peaks = channels.map(channel => {
    const [start, end] = channel.fftIndexRange;
    let maxVal = 0;
    let maxIndex = start;
    for (let i = start; i <= end; i++) {
      if (fftData[i] > maxVal) {
        maxVal = fftData[i];
        maxIndex = i;
      }
    }
    // Only consider the peak significant if its magnitude is above a threshold
    if (maxVal < 20) {
      return { freq: 0, mag: 0 };
    }
    const freq = maxIndex * (sampleRate / fftSize);
    return { freq, mag: maxVal };
  });

  const consonanceMatrix: number[][] = Array(channels.length).fill(0).map(() => Array(channels.length).fill(0));

  // 2. Calculate consonance score for each pair of channels
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < peaks.length; j++) {
      const peak1 = peaks[i];
      const peak2 = peaks[j];

      if (peak1.freq === 0 || peak2.freq === 0) continue;

      let ratio = peak2.freq > peak1.freq ? peak2.freq / peak1.freq : peak1.freq / peak2.freq;
      // Bring ratio into the [1, 2) octave to compare with base ratios
      while (ratio >= 2) ratio /= 2;
      while (ratio < 1) ratio *= 2; 

      let minDistance = Infinity;
      for (const target of CONSONANT_RATIOS) {
        const dist = Math.abs(ratio - target);
        if (dist < minDistance) {
          minDistance = dist;
        }
      }
      
      // The score is based on how close the ratio is to a pure consonant one,
      // and weighted by the volume (magnitude) of the peaks.
      const rawScore = Math.max(0, 1 - minDistance / CONSONANCE_TOLERANCE);
      const magnitudeWeight = Math.min(peak1.mag / 128, peak2.mag / 128); // Normalize magnitude
      const score = rawScore * magnitudeWeight;

      consonanceMatrix[i][j] = score;
      consonanceMatrix[j][i] = score; // Matrix is symmetric
    }
  }
  return consonanceMatrix;
};


const App: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelState[]>(initialChannels);
  const [harmonyState, setHarmonyState] = useState<HarmonyState>({
    pitch: 0,
    consonance: 0,
    tension: 1,
    resolution: 0,
    interLensConsonance: Array(CHANNEL_DEFINITIONS.length).fill(0).map(() => Array(CHANNEL_DEFINITIONS.length).fill(0)),
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const calculateStdDev = (arr: number[]): number => {
    const n = arr.length;
    if (n === 0) return 0;
    const mean = arr.reduce((a, b) => a + b) / n;
    const variance = arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n;
    return Math.sqrt(variance);
  };

  const animationLoop = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // --- Harmony Analysis ---
    const newHarmony = analyzeHarmony(dataArray, SAMPLE_RATE, FFT_SIZE);
    const newInterLensConsonance = analyzeInterharmonics(dataArray, channels, SAMPLE_RATE, FFT_SIZE);
    setHarmonyState(prev => {
      const smoothedConsonance = prev.consonance * 0.9 + newHarmony.consonance * 0.1;
      const resolution = Math.max(0, smoothedConsonance - prev.consonance) * 8;
      return {
        pitch: prev.pitch * 0.8 + newHarmony.pitch * 0.2,
        consonance: smoothedConsonance,
        tension: 1 - smoothedConsonance,
        resolution: Math.min(1, resolution),
        interLensConsonance: newInterLensConsonance,
      };
    });

    // --- Channel Analysis ---
    setChannels(prevChannels => {
      const updatedChannels = [...prevChannels];
      let attentionScores: number[] = [];

      // 1. Update signal, habituation, and merit for each channel
      for (let i = 0; i < updatedChannels.length; i++) {
        const channel = { ...updatedChannels[i] };
        const [start, end] = channel.fftIndexRange;
        const relevantData = dataArray.slice(start, end + 1);
        const rawSignal = relevantData.length > 0 ? relevantData.reduce((sum, val) => sum + val, 0) / relevantData.length / 255 : 0;
        
        channel.currentSignal = channel.currentSignal * SIGNAL_SMOOTHING + rawSignal * (1 - SIGNAL_SMOOTHING);
        
        channel.signalHistory.push(channel.currentSignal);
        if (channel.signalHistory.length > SIGNAL_HISTORY_LENGTH) {
          channel.signalHistory.shift();
        }
        const novelty = calculateStdDev(channel.signalHistory) * 5;
        channel.merit = channel.merit * MERIT_SMOOTHING + novelty * (1 - MERIT_SMOOTHING);

        if (channel.merit > 0.1) {
            channel.lastNovelTimestamp = Date.now();
        }

        if (channel.currentSignal > channel.threshold && novelty < 0.05) {
          channel.habituation = Math.min(1, channel.habituation + HABITUATION_RATE);
        } else {
          channel.habituation *= HABITUATION_DECAY;
        }
        channel.threshold = BASE_THRESHOLD + channel.habituation * THRESHOLD_SCALE;
        
        channel.isActive = channel.currentSignal > channel.threshold;

        updatedChannels[i] = channel;

        const timeSinceNovel = (Date.now() - channel.lastNovelTimestamp) / 1000;
        const recencyBonus = timeSinceNovel * RECENCY_WEIGHT;
        attentionScores.push(channel.merit + recencyBonus);
      }

      // 2. Normalize attention scores
      const totalScore = attentionScores.reduce((sum, score) => sum + score, 0);
      if (totalScore > 0) {
        const normalizedScores = attentionScores.map(score => score / totalScore);
        for (let i = 0; i < updatedChannels.length; i++) {
          updatedChannels[i].attention = updatedChannels[i].attention * ATTENTION_SMOOTHING + normalizedScores[i] * (1 - ATTENTION_SMOOTHING);
        }
      }
      
      return updatedChannels;
    });

    animationFrameRef.current = requestAnimationFrame(animationLoop);
  }, [channels]); // Added channels dependency for analyzeInterharmonics


  const startListening = async () => {
    if (isListening) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyserRef.current = analyser;
      const source = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;
      source.connect(analyser);
      
      setIsListening(true);
      setError(null);
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    } catch (err) {
      setError('Microphone access was denied. Please allow microphone access in your browser settings.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopListening = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setChannels(initialChannels); // Reset state
  }, []);

  useEffect(() => {
    // Automatically start listening on component mount to create an immediate "device" feel.
    startListening();
    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="fixed inset-0 w-full h-full bg-[#1a2019]">
      {isListening ? (
         <P5Canvas channels={channels} harmonyState={harmonyState} />
      ) : (
         <div className="w-full h-full flex flex-col items-center justify-center">
            <button
              onClick={startListening}
              className="px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold rounded-lg hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-colors duration-300 text-lg"
              >
              Begin Conversation
          </button>
           {error && <p className="mt-4 text-center text-red-400 bg-black/50 p-2 rounded">{error}</p>}
         </div>
      )}
      
       {isListening && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
            <button
                onClick={stopListening}
                className="px-4 py-2 bg-black/30 backdrop-blur-sm border border-gray-500/50 text-gray-300 font-semibold rounded-lg hover:bg-gray-700/50 hover:border-gray-400 transition-colors duration-300"
                >
                End Conversation
            </button>
        </div>
       )}
    </div>
  );
};

export default App;
