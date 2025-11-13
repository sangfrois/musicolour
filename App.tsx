
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ChannelState } from './types';
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


const App: React.FC = () => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelState[]>(initialChannels);

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
  }, []);


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
         <P5Canvas channels={channels} />
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
