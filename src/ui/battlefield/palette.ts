// Colours for the scene: one palette per level band, per race, per resource. Matches the dark fantasy CSS tokens.

export type Feature = 'fence' | 'firs' | 'sparse' | 'bog' | 'ruins' | 'peaks' | 'towers' | 'castle';

export interface BandPalette {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  ground: string;
  groundDark: string;
  mist: string;
  feature: Feature;
  stars: boolean;
  /** Ambient particle colour (fireflies, embers, dust). */
  mote: string;
}

export const BANDS: BandPalette[] = [
  { skyTop: '#2a2540', skyBottom: '#7a5238', far: '#3a3040', near: '#2b2a22', ground: '#3a301e', groundDark: '#241d12', mist: 'rgba(210,170,130,0.10)', feature: 'fence', stars: false, mote: '#f0d890' },
  { skyTop: '#121e26', skyBottom: '#34463c', far: '#1d2b2a', near: '#14201c', ground: '#222c1a', groundDark: '#151c11', mist: 'rgba(140,180,160,0.12)', feature: 'firs', stars: true, mote: '#c8f080' },
  { skyTop: '#241f2c', skyBottom: '#56402f', far: '#2d2830', near: '#201d1b', ground: '#30261a', groundDark: '#1e170f', mist: 'rgba(190,160,130,0.10)', feature: 'sparse', stars: false, mote: '#e8c070' },
  { skyTop: '#142324', skyBottom: '#40564a', far: '#26363a', near: '#1b2a26', ground: '#222e24', groundDark: '#141c16', mist: 'rgba(150,200,180,0.20)', feature: 'bog', stars: true, mote: '#90f0c0' },
  { skyTop: '#2a1616', skyBottom: '#6a3424', far: '#3c2220', near: '#271a18', ground: '#2c1f18', groundDark: '#1a110d', mist: 'rgba(200,120,90,0.12)', feature: 'ruins', stars: false, mote: '#ff9a5a' },
  { skyTop: '#1c2236', skyBottom: '#566178', far: '#384056', near: '#2a3040', ground: '#32312b', groundDark: '#201f1b', mist: 'rgba(200,215,235,0.14)', feature: 'peaks', stars: true, mote: '#dbe8ff' },
  { skyTop: '#1c1c2c', skyBottom: '#5e4a40', far: '#34303c', near: '#25222a', ground: '#302a22', groundDark: '#1d1914', mist: 'rgba(180,160,150,0.12)', feature: 'towers', stars: false, mote: '#e0b070' },
  { skyTop: '#120c18', skyBottom: '#40222e', far: '#2a1c2a', near: '#1b1219', ground: '#251a1c', groundDark: '#150e10', mist: 'rgba(160,100,140,0.14)', feature: 'castle', stars: true, mote: '#ff7a8a' },
];

export interface RacePalette {
  tunic: string;
  trim: string;
  skin: string;
  shield: string;
  helm: string;
  banner: string;
}

export const RACES: Record<string, RacePalette> = {
  humans: { tunic: '#2f5486', trim: '#aebccb', skin: '#d9b48f', shield: '#3a6aa8', helm: '#9aa9b8', banner: '#2f5486' },
  orcs: { tunic: '#44702f', trim: '#8a8a7a', skin: '#6f9a4a', shield: '#7a3a2a', helm: '#6a6a60', banner: '#a8402f' },
  dwarves: { tunic: '#7a4a24', trim: '#d0a860', skin: '#d8a888', shield: '#8a6a2a', helm: '#b8a080', banner: '#8a5a22' },
};

export function racePalette(id: string): RacePalette {
  return RACES[id] ?? RACES.humans!;
}

export const LOOT_COLOR: Record<string, string> = {
  food: '#d9573c',
  wood: '#9a6a38',
  stone: '#a8a8a0',
  ore: '#d89a4a',
  iron: '#8fb0d0',
};

export const RESOURCE_ORDER = ['food', 'wood', 'stone', 'ore', 'iron'];
