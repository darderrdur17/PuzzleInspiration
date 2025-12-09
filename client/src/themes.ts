import type { Theme } from "./types";

export const themes: Theme[] = [
  {
    id: "biophilic",
    name: "Tropical Canopy",
    description: "Sunlit leaves, clay birds, soft parchment with torn edges.",
    boardLayout: "columns",
    accent: "#3fa37b",
    background: "linear-gradient(135deg, #f2f6ec 0%, #d9ead3 45%, #f8efe3 100%)",
    paper: "rgba(255, 255, 255, 0.92)",
    text: "#1f2d27",
    muted: "#5c6f62",
    mosaicUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=60",
    sound: { wave: "sine", boostBase: 500, snapFreq: 700 },
  },
  {
    id: "neon",
    name: "Synthwave Arcade",
    description: "Hot magenta + cyan grid glow on deep midnight.",
    boardLayout: "grid",
    accent: "#ff4fd8",
    background:
      "radial-gradient(circle at 15% 20%, rgba(255,79,216,0.35), transparent 35%), radial-gradient(circle at 80% 70%, rgba(0,255,255,0.25), transparent 45%), linear-gradient(145deg, #0a0b1d 0%, #0c122b 60%, #0a0f1f 100%)",
    paper: "rgba(12, 18, 43, 0.8)",
    text: "#e3e8ff",
    muted: "#8fa0c9",
    mosaicUrl:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=60",
    sound: { wave: "triangle", boostBase: 560, snapFreq: 760 },
  },
  {
    id: "blueprint",
    name: "Serene Blueprint",
    description: "Crisp vellum, cyan grid ink, soft industrial glow.",
    boardLayout: "stacked",
    accent: "#2a7fe7",
    background: "linear-gradient(160deg, #e8f1fb 0%, #d8e8fb 50%, #eef5ff 100%)",
    paper: "rgba(255, 255, 255, 0.95)",
    text: "#0f1a2d",
    muted: "#4b5d78",
    mosaicUrl:
      "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=900&q=60",
    sound: { wave: "square", boostBase: 520, snapFreq: 680 },
  },
  {
    id: "aurora",
    name: "Aurora Drift",
    description: "Northern lights sweep with glassy overlays and stars.",
    boardLayout: "grid",
    accent: "#7de1ff",
    background:
      "radial-gradient(circle at 20% 30%, rgba(125,225,255,0.35), transparent 40%), radial-gradient(circle at 70% 60%, rgba(255,160,255,0.32), transparent 45%), linear-gradient(180deg, #0a0f1a 0%, #0b1f2e 45%, #07101f 100%)",
    paper: "rgba(10, 18, 32, 0.78)",
    text: "#e8f7ff",
    muted: "#9ec4d8",
    mosaicUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=60",
    sound: { wave: "sine", boostBase: 540, snapFreq: 720 },
  },
  {
    id: "retro",
    name: "Retro Pop",
    description: "Playful shapes, bold primaries, dot halftones.",
    boardLayout: "columns",
    accent: "#ffb703",
    background:
      "radial-gradient(circle at 10% 15%, rgba(255,183,3,0.28), transparent 38%), radial-gradient(circle at 80% 20%, rgba(255,64,129,0.26), transparent 45%), linear-gradient(120deg, #fef6e4 0%, #fdf0d5 50%, #fde4cf 100%)",
    paper: "rgba(255, 255, 255, 0.96)",
    text: "#1f1b2d",
    muted: "#6b6075",
    mosaicUrl:
      "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=60",
    sound: { wave: "sawtooth", boostBase: 500, snapFreq: 750 },
  },
];

