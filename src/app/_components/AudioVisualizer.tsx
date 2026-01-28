import React, { useRef, useEffect, useState } from 'react';

interface AudioVisualizerProps {
  width: number;
  height: number;
  gradientColors: string[];
  barWidth?: number;
  barSpacing?: number;
  smoothingTimeConstant?: number;
  fftSize?: number;
  minDecibels?: number;
  maxDecibels?: number;
  stream: MediaStream;
}

interface AudioState {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

// Add type for webkitAudioContext
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export function AudioVisualizer({
  width,
  height,
  gradientColors,
  barWidth = 2,
  barSpacing = 1,
  smoothingTimeConstant = 0.8,
  fftSize = 512,
  minDecibels = -75,
  maxDecibels = -30,
  stream,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioState, setAudioState] = useState<AudioState>({
    audioContext: null,
    analyser: null,
    source: null,
  });
  const audioRef = useRef<AudioState>({
    audioContext: null,
    analyser: null,
    source: null,
  });
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    let isActive = true;

    const initializeAudio = async () => {
      try {
        console.log('🎹 Visualizer Init: Starting initialization');
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        console.log('🎹 Visualizer Init: Created audio context and analyser');

        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyser.minDecibels = minDecibels;
        analyser.maxDecibels = maxDecibels;
        console.log('🎹 Visualizer Init: Configured analyser node');

        source.connect(analyser);
        if (isActive) {
          const nextState = { audioContext, analyser, source };
          audioRef.current = nextState;
          setAudioState(nextState);
          console.log('🎹 Visualizer Init: Setup complete');
        }
      } catch (error) {
        console.error('🎹 Visualizer Error: Failed to initialize:', error);
      }
    };

    void initializeAudio();

    return () => {
      console.log('🎹 Visualizer Cleanup: Starting cleanup');
      isActive = false;
      
      // Clean up audio resources
      if (audioRef.current.source) {
        console.log('🎹 Visualizer Cleanup: Disconnecting audio source');
        audioRef.current.source.disconnect();
      }
      
      // Close audio context if it exists and is not already closed
      const ctx = audioRef.current.audioContext;
      if (ctx && ctx.state !== 'closed') {
        console.log('🎹 Visualizer Cleanup: Closing AudioContext');
        void ctx.close().catch(error => {
          console.error('🎹 Visualizer Error: Failed to close audio context:', error);
        });
      }

      // Cancel any pending animation frame
      if (animationFrameId.current !== null) {
        console.log('🎹 Visualizer Cleanup: Canceling animation frame');
        cancelAnimationFrame(animationFrameId.current);
      }

      // Reset audio state
      audioRef.current = { audioContext: null, analyser: null, source: null };
      setAudioState(audioRef.current);
      console.log('🎹 Visualizer Cleanup: Complete');
    };
  }, [stream, fftSize, smoothingTimeConstant, minDecibels, maxDecibels]);

  useEffect(() => {
    if (!canvasRef.current || !audioState.analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const createGradient = () => {
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradientColors.forEach((color, index) => {
        gradient.addColorStop(index / (gradientColors.length - 1), color);
      });
      return gradient;
    };

    const draw = () => {
      const context = ctx;
      if (!audioState.analyser || !context) return;

      const bufferLength = audioState.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      audioState.analyser.getByteFrequencyData(dataArray);

      context.clearRect(0, 0, width, height);

      const barCount = Math.min(bufferLength, Math.floor(width / (barWidth + barSpacing)));
      const totalWidth = barCount * (barWidth + barSpacing);
      const startX = (width - totalWidth) / 2;

      context.fillStyle = createGradient();

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i] ?? 0;
        const barHeight = (value / 255.0) * height;
        const x = startX + i * (barWidth + barSpacing);
        const y = height - barHeight;

        context.fillRect(x, y, barWidth, barHeight);
      }

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [width, height, barWidth, barSpacing, gradientColors, audioState.analyser]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: width,
        height: height,
        display: 'block',
      }}
    />
  );
} 