/**
 * Game sounds using Web Audio API for low-latency game audio
 * Now includes real audio file support for realistic sound effects
 */
import { useCallback, useRef, useEffect } from "react";
import axeChopSound from "@/assets/sfx/axe-chop.mp3";
import axeChopAltSound from "@/assets/sfx/axe-chop-alt.mp3";

type SoundType = 
  | "eat" 
  | "chop" 
  | "shoot" 
  | "hit" 
  | "gameOver" 
  | "rotate" 
  | "lineClear" 
  | "drop"
  | "move"
  | "levelUp";

const useGameSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const chopBufferRef = useRef<AudioBuffer | null>(null);
  const chopAltBufferRef = useRef<AudioBuffer | null>(null);
  const chopIndexRef = useRef(0);

  // Load audio files into buffers for low-latency playback
  useEffect(() => {
    const loadAudioBuffers = async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        
        // Load main chop sound
        const chopResponse = await fetch(axeChopSound);
        const chopArrayBuffer = await chopResponse.arrayBuffer();
        chopBufferRef.current = await ctx.decodeAudioData(chopArrayBuffer);
        
        // Load alternate chop sound for variety
        const chopAltResponse = await fetch(axeChopAltSound);
        const chopAltArrayBuffer = await chopAltResponse.arrayBuffer();
        chopAltBufferRef.current = await ctx.decodeAudioData(chopAltArrayBuffer);
      } catch (err) {
        console.warn("Failed to load audio buffers:", err);
      }
    };
    
    loadAudioBuffers();
  }, []);

  useEffect(() => {
    // Create audio context on first user interaction
    const createContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
    };
    
    document.addEventListener("touchstart", createContext, { once: true });
    document.addEventListener("click", createContext, { once: true });
    
    return () => {
      document.removeEventListener("touchstart", createContext);
      document.removeEventListener("click", createContext);
    };
  }, []);

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = "square", volume = 0.3) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  }, []);

  const playNoise = useCallback((duration: number, volume = 0.2, filterFreq = 2000) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    source.start(ctx.currentTime);
  }, []);

  // Play audio buffer with pitch/volume variation for realism
  const playBuffer = useCallback((buffer: AudioBuffer, volume = 0.7, pitchVariation = 0.05) => {
    if (!audioContextRef.current || !buffer) return;
    
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    source.buffer = buffer;
    // Add slight pitch variation for realism (0.95-1.05)
    source.playbackRate.value = 1 + (Math.random() - 0.5) * pitchVariation * 2;
    
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Slight volume variation (0.9-1.0 of target)
    const actualVolume = volume * (0.9 + Math.random() * 0.1);
    gainNode.gain.setValueAtTime(actualVolume, ctx.currentTime);
    
    source.start(ctx.currentTime);
  }, []);

  const play = useCallback((sound: SoundType) => {
    switch (sound) {
      case "eat":
        // Rising pitch for eating food
        playTone(400, 0.1, "square", 0.2);
        setTimeout(() => playTone(600, 0.1, "square", 0.2), 50);
        break;
        
      case "chop":
        // Play real axe chop sound - alternate between two sounds for variety
        const buffer = chopIndexRef.current % 2 === 0 
          ? chopBufferRef.current 
          : (chopAltBufferRef.current || chopBufferRef.current);
        
        if (buffer) {
          playBuffer(buffer, 0.8, 0.08);
          chopIndexRef.current++;
        } else {
          // Fallback to synthesized sound if buffers not loaded
          playNoise(0.08, 0.5, 800);
          playTone(55, 0.12, "triangle", 0.5);
          setTimeout(() => {
            playNoise(0.06, 0.3, 3500);
            playTone(220, 0.04, "sawtooth", 0.2);
          }, 30);
        }
        break;
        
      case "shoot":
        // Laser pew sound
        playTone(800, 0.1, "sawtooth", 0.15);
        setTimeout(() => playTone(400, 0.1, "sawtooth", 0.1), 30);
        break;
        
      case "hit":
        // Enemy hit explosion
        playNoise(0.15, 0.25);
        playTone(200, 0.15, "square", 0.2);
        break;
        
      case "gameOver":
        // Descending game over melody
        playTone(400, 0.2, "square", 0.3);
        setTimeout(() => playTone(300, 0.2, "square", 0.3), 200);
        setTimeout(() => playTone(200, 0.4, "square", 0.3), 400);
        break;
        
      case "rotate":
        // Quick blip for tetris rotate
        playTone(500, 0.05, "square", 0.15);
        break;
        
      case "lineClear":
        // Ascending success sound
        playTone(523, 0.1, "square", 0.2);
        setTimeout(() => playTone(659, 0.1, "square", 0.2), 80);
        setTimeout(() => playTone(784, 0.15, "square", 0.2), 160);
        break;
        
      case "drop":
        // Thud for piece landing
        playTone(100, 0.1, "triangle", 0.3);
        playNoise(0.05, 0.1);
        break;
        
      case "move":
        // Subtle movement sound
        playTone(300, 0.03, "square", 0.08);
        break;
        
      case "levelUp":
        // Victory fanfare
        playTone(523, 0.1, "square", 0.2);
        setTimeout(() => playTone(659, 0.1, "square", 0.2), 100);
        setTimeout(() => playTone(784, 0.1, "square", 0.2), 200);
        setTimeout(() => playTone(1047, 0.3, "square", 0.25), 300);
        break;
    }
  }, [playTone, playNoise, playBuffer]);

  return { play };
};

export default useGameSounds;
