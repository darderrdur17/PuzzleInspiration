# Creativity is... - Interactive Puzzle Game

An interactive web-based puzzle game that takes players on a journey through the four phases of the creative process: **Preparation**, **Incubation**, **Illumination**, and **Verification**.

## 🎮 Game Overview

Players are challenged to sort famous quotes about creativity into their corresponding phases. The game features a calming, organic design with watercolor bird illustrations representing each phase.

### Key Features
*   **Interactive Puzzle Board**: Drag and drop quotes and titles to the correct "birds" (phases).
*   **Mobile-Optimized**: Fully responsive touch controls using `@dnd-kit`.
*   **Immersive Experience**: Custom sound effects for interactions and success states.
*   **Personal Touch**: Players contribute their own definition of creativity to start the game.
*   **Leaderboard**: Local session-based leaderboard to track high scores and completion times.
*   **Organic Design**: Biophilic aesthetic with warm paper textures and fluid animations.

## 🛠️ Tech Stack

*   **Framework**: React 19 + Vite
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS 4
*   **Animations**: Framer Motion
*   **Drag & Drop**: @dnd-kit (Core, Sortable, Modifiers)
*   **UI Components**: shadcn/ui (Radix Primitives)
*   **Icons**: Lucide React

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18 or higher)
*   pnpm (recommended) or npm

### Installation

1.  Clone the repository (or unzip the project file):
    ```bash
    cd creativity_game
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Start the development server:
    ```bash
    pnpm dev
    ```

4.  Open your browser and navigate to `http://localhost:3000`.

## 🎨 Design Philosophy

The project follows an **Organic / Biophilic** design approach:
*   **Color Palette**: Earthy tones (Sage Green, Terracotta, Soft Clay) on a warm paper texture.
*   **Typography**: *Playfair Display* for headings (evoking classic literature) and *Nunito* for body text (friendly and rounded).
*   **Interaction**: Fluid, elastic animations that mimic natural movement.

## 📂 Project Structure

```
client/
  src/
    components/    # Game components (PuzzleBoard, QuoteCard, etc.)
    data/          # Static game data (quotes list)
    hooks/         # Custom hooks (useSound, etc.)
    pages/         # Main game pages
    types/         # TypeScript definitions
  public/
    images/        # Generated watercolor assets
    sounds/        # Sound effects
```

## 📄 License

This project is open-source and available for educational and creative use.
