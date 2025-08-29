import cloudTexture from "@/assets/cloud.png";
import hillTexture from "@/assets/hill.png";
import fireTexture from "@/assets/fire.png";
import { notes, type NoteSequence, type SoundConfig } from "@/utils/audio";

export const config = {
  game: {
    helpers: false,
    speed: 2,
  },
  directional: {
    enabled: true,
    helper: false,
    intensity: 2,
  },
  blocks: {
    helper: false,
    size: 30,
    spacing: 150,
  },
  player: {
    helper: true,
    speed: 25,
    maxJump: 100,
    heightOffset: 10,
    collisionThreshold: 38,
    jump: {
      height: 100,
      duration: 1000,
      isActive: false,
      velocity: 0,
      startTime: 0,
    },
  },
  backgrounds: {
    layers: [
      {
        texture: cloudTexture,
        speed: 2,
        size: 200,
        ratio: 2.5,
        yPosition: 130,
        xVariation: 100,
        yVariation: 20,
        zPosition: -300,
        count: 4,
        spacing: 600,
        opacity: 0.5,
      },
      {
        texture: cloudTexture,
        speed: 2,
        size: 200,
        ratio: 2.5,
        yPosition: 150,
        xVariation: 100,
        yVariation: 20,
        zPosition: -100,
        count: 3,
        spacing: 600,
        opacity: 0.5,
      },
      {
        texture: cloudTexture,
        speed: 2,
        size: 200,
        ratio: 2.5,
        yPosition: 140,
        xVariation: 100,
        yVariation: 10,
        zPosition: 20,
        count: 3,
        spacing: 600,
        opacity: 0.7,
      },
      {
        texture: hillTexture,
        speed: 2,
        size: 1000,
        ratio: 1,
        xVariation: 100,
        yPosition: 70,
        yVariation: 70,
        zPosition: -800,
        count: 10,
        spacing: 1000,
        opacity: 0.5,
      },
      {
        texture: fireTexture,
        speed: 2,
        size: 12,
        ratio: 1,
        xVariation: 100,
        yPosition: 8,
        yVariation: 0,
        zVariation: 50,
        zPosition: -70,
        count: 10,
        spacing: 100,
        opacity: 0.4,
      },
      {
        texture: fireTexture,
        speed: 2,
        size: 12,
        ratio: 1,
        xVariation: 100,
        yPosition: 8,
        yVariation: 0,
        zVariation: 30,
        zPosition: 100,
        count: 10,
        spacing: 300,
        opacity: 0.4,
      },
    ],
  },
};

// Mario-inspired background music sequence - [note, duration] tuples (lower octave, shorter durations for faster tempo)
export const soundtrackSequence: NoteSequence = [
  // Main melody - cheerful and upbeat like classic Mario games (much lower octave, faster tempo)
  [notes.E3, 0.2], [notes.E3, 0.2], [notes.REST, 0.2], [notes.E3, 0.2],
  [notes.REST, 0.2], [notes.C3, 0.2], [notes.E3, 0.4], [notes.G3, 0.4],
  [notes.REST, 0.4], [notes.G2, 0.4], [notes.REST, 0.4],

  // Second phrase
  [notes.C3, 0.4], [notes.REST, 0.2], [notes.G2, 0.4], [notes.REST, 0.2],
  [notes.E2, 0.4], [notes.REST, 0.2], [notes.A2, 0.4], [notes.B2, 0.4],
  [notes.REST, 0.2], [notes.A2, 0.2], [notes.G2, 0.6],

  // Third phrase - continuing the melody
  [notes.E3, 0.3], [notes.G3, 0.3], [notes.A3, 0.4], [notes.F3, 0.3],
  [notes.G3, 0.2], [notes.REST, 0.2], [notes.E3, 0.3], [notes.C3, 0.3],
  [notes.D3, 0.3], [notes.B2, 0.6],

  // Fourth phrase - bridge section
  [notes.C3, 0.3], [notes.G2, 0.2], [notes.REST, 0.1], [notes.E2, 0.3],
  [notes.A2, 0.4], [notes.B2, 0.4], [notes.A2, 0.3], [notes.G2, 0.2],
  [notes.E3, 0.3], [notes.G3, 0.3], [notes.A3, 0.4],

  // Fifth phrase - variation
  [notes.F3, 0.3], [notes.G3, 0.2], [notes.REST, 0.2], [notes.E3, 0.3],
  [notes.C3, 0.3], [notes.D3, 0.3], [notes.B2, 0.6],

  // Sixth phrase - building up
  [notes.G3, 0.2], [notes.F3, 0.2], [notes.E3, 0.2], [notes.D3, 0.3],
  [notes.E3, 0.3], [notes.G2, 0.3], [notes.A2, 0.3], [notes.C3, 0.4],

  // Seventh phrase - climax
  [notes.A2, 0.3], [notes.C3, 0.3], [notes.D3, 0.4], [notes.G3, 0.2],
  [notes.F3, 0.2], [notes.E3, 0.2], [notes.D3, 0.3], [notes.E3, 0.3],

  // Eighth phrase - resolution and ending
  [notes.C3, 0.3], [notes.A2, 0.3], [notes.G2, 0.4], [notes.REST, 0.4],

  // Final resolution
  [notes.REST, 0.8], // Shorter pause before loop for faster tempo
];

// Game status enum-like values
export const GAME_STATUS = {
  START: "start",
  PLAYING: "playing",
  GAME_OVER: "gameOver",
} as const;

export const SOUNDS: Record<string, SoundConfig> = {
  jump: {
    startFreq: 400,
    endFreq: 120,
    duration: 0.15,
    volume: 0.25,
    waveType: "square",
    attackTime: 0.005,
    releaseTime: 0.08,
  },
  collision: {
    startFreq: 300,
    endFreq: 80,
    duration: 0.4,
    volume: 0.25,
    waveType: "sine",
    attackTime: 0.02,
    releaseTime: 0.15,
  },
};
