export type Phase = "preparation" | "incubation" | "illumination" | "verification";

export type Quote = {
  id: string;
  text: string;
  author: string;
  phase: Phase;
};

export type BoardLayout = "columns" | "grid" | "stacked";

export type Theme = {
  id: string;
  name: string;
  description: string;
  boardLayout: BoardLayout;
  accent: string;
  background: string;
  paper: string;
  text: string;
  muted: string;
  mosaicUrl: string;
  sound?: {
    wave?: OscillatorType;
    boostBase?: number;
    snapFreq?: number;
  };
};

export type SoundPack = "calm" | "arcade" | "cinematic" | "8bit";

export type GameConfig = {
  timeLimitSeconds: number;
  allowHints: boolean;
  hintsPerPlayer: number;
  boostsPerPlayer: number;
  boostsEnabled: boolean;
  themeId: string;
  showPhaseOutlines?: boolean;
};

export type BoostType = "double-points" | "add-time" | "reveal";

export type PlayerState = {
  id: string;
  clientId: string;
  name: string;
  score: number;
  correct: number;
  placements: Record<string, Phase>;
  hintsLeft: number;
  boostsLeft: number;
  timeBonus: number;
  status: "ready" | "playing" | "done";
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  score: number;
  time: number;
  timestamp: number;
};

export type RoomSnapshot = {
  code: string;
  status: "lobby" | "active" | "ended";
  startAt: number | null;
  gameConfig: GameConfig;
  players: PlayerState[];
  leaderboard: LeaderboardEntry[];
  gmToken?: string;
  pin?: string;
};

export type HostCredentials = {
  code: string;
  gmToken: string;
  pin: string;
  room: RoomSnapshot;
};

export type SocketEnvelope =
  | { type: "host:created"; payload: HostCredentials }
  | { type: "host:pin-rotated"; payload: { pin: string } }
  | { type: "room:update"; payload: RoomSnapshot }
  | { type: "game:started"; payload: RoomSnapshot }
  | { type: "game:ended"; payload: RoomSnapshot }
  | { type: "error"; message: string }
  | { type: "hint:grant"; payload: { quoteId: string; phase: Phase } }
  | { type: "boost:applied"; payload: { type: BoostType; targetId: string } };

export type SocketCommand =
  | {
      type: "host:create";
      payload: {
        name: string;
        config: GameConfig;
        gmPass?: string;
        playerPass?: string;
      };
    }
  | {
      type: "host:resume";
      payload: { code: string; gmToken: string; gmPass?: string };
    }
  | { type: "host:update-config"; payload: { config: GameConfig; gmToken: string } }
  | { type: "host:start"; payload: { code: string; gmToken: string } }
  | { type: "host:end"; payload: { code: string; gmToken: string } }
  | { type: "host:rotate-pin"; payload: { code: string; gmToken: string } }
  | {
      type: "player:join";
      payload: {
        code: string;
        name: string;
        clientId: string;
        pin?: string;
        playerPass?: string;
      };
    }
  | {
      type: "player:update-progress";
      payload: { clientId: string; placements: Record<string, Phase> };
    }
  | { type: "player:use-hint"; payload: { clientId: string; placements: Record<string, Phase> } }
  | { type: "player:use-boost"; payload: { clientId: string; type: BoostType } }
  | { type: "ping" };

