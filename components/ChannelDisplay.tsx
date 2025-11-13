import React from 'react';
import { ChannelState } from '../types';
// FIX: Moved import to top of file for better code organization.
import { BASE_THRESHOLD } from '../constants';

interface ChannelDisplayProps {
  channel: ChannelState;
}

const ChannelDisplay: React.FC<ChannelDisplayProps> = ({ channel }) => {
  const { currentSignal, threshold, isActive, attention, label } = channel;

  const size = 100 + attention * 80;
  const signalBrightness = 50 + currentSignal * 50;
  const attentionGlow = attention > 0.1 ? `drop-shadow-[0_0_20px_rgba(110,231,183,${attention * 0.8})]` : '';

  return (
    <div className="relative flex flex-col items-center justify-center gap-2 p-4 text-center">
      {/* Visual Representation */}
      <div
        className="relative rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          filter: attentionGlow,
        }}
      >
        {/* Threshold Ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-emerald-900 transition-all duration-500"
          style={{ transform: `scale(${threshold * 2})`, opacity: threshold > BASE_THRESHOLD ? 0.3 : 0 }}
        />
        
        {/* Main Signal Orb */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-200"
          style={{
            backgroundColor: `hsl(150, 100%, ${signalBrightness}%)`,
            opacity: isActive ? 1 : 0.05,
            transform: `scale(${Math.max(0.1, currentSignal)})`,
          }}
        />
      </div>
      {/* Label */}
      <span className="text-xs font-mono text-emerald-400 opacity-60 transition-opacity duration-300" style={{opacity: 0.4 + attention * 0.6}}>
        {label}
      </span>
    </div>
  );
};

export default ChannelDisplay;
