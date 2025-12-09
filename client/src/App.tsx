import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import "./App.css";
import { quotes } from "./data/quotes";
import { createSocketClient } from "./services/socket";
import type {
  BoostType,
  GameConfig,
  Phase,
  PlayerState,
  RoomSnapshot,
  Theme,
  SocketCommand,
  SoundPack,
} from "./types";
import { themes } from "./themes";
import { useCountdown } from "./hooks/useCountdown";

const phases: { id: Phase; title: string; helper: string }[] = [
  {
    id: "preparation",
    title: "Preparation",
    helper: "Gather inputs, research, and inspirations.",
  },
  {
    id: "incubation",
    title: "Incubation",
    helper: "Let ideas simmer in the background.",
  },
  {
    id: "illumination",
    title: "Illumination",
    helper: "The aha! moment appears.",
  },
  {
    id: "verification",
    title: "Verification",
    helper: "Test, refine, and polish.",
  },
];

const defaultConfig: GameConfig = {
  timeLimitSeconds: 240,
  allowHints: true,
  hintsPerPlayer: 2,
  boostsEnabled: true,
  boostsPerPlayer: 2,
  themeId: themes[0].id,
};

function TimerDisplay({ remainingMs }: { remainingMs: number }) {
  const seconds = Math.max(0, Math.floor(remainingMs / 1000));
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return <div className="pill timer">⏱ {m}:{s}</div>;
}

function Leaderboard({
  players,
  accent,
}: {
  players: PlayerState[];
  accent: string;
}) {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.correct - a.correct;
  });
  return (
    <div className="panel">
      <div className="panel-title">Live Leaderboard</div>
      <div className="stack">
        {sorted.map((p, idx) => (
          <div
            key={p.id}
            className="leader-row"
            style={{ borderColor: idx === 0 ? accent : "transparent" }}
          >
            <div className="leader-rank">#{idx + 1}</div>
      <div>
              <div className="leader-name">{p.name}</div>
              <div className="muted small">
                Correct {p.correct} • Hints left {p.hintsLeft} • Boosts left{" "}
                {p.boostsLeft}
              </div>
            </div>
            <div className="leader-score">{p.score} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteCard({
  text,
  author,
  accent,
  ghost,
}: {
  text: string;
  author: string;
  accent: string;
  ghost?: boolean;
}) {
  return (
    <div
      className="quote-card"
      style={{
        borderColor: accent,
        opacity: ghost ? 0.6 : 1,
      }}
    >
      <p>{text}</p>
      <span className="muted small">— {author}</span>
    </div>
  );
}

function ThemeSelector({
  themes,
  value,
  onChange,
}: {
  themes: Theme[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="theme-row">
      {themes.map((t) => (
        <button
          key={t.id}
          className={`chip ${value === t.id ? "chip-active" : ""}`}
          onClick={() => onChange(t.id)}
          style={{
            borderColor: t.accent,
          }}
        >
          <div
            className="chip-thumb"
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.3), rgba(0,0,0,0)), url(${t.mosaicUrl})`,
            }}
          />
          <div>
            <div className="chip-title">{t.name}</div>
            <div className="chip-sub">{t.description}</div>
            <div className="chip-sub">SFX: {t.sound?.wave ?? "triangle"}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function BoostTray({
  onUse,
  disabled,
  boostsLeft,
}: {
  onUse: (type: BoostType) => void;
  disabled: boolean;
  boostsLeft: number;
}) {
  const options: { type: BoostType; label: string; desc: string }[] = [
    { type: "double-points", label: "Double Points", desc: "Next drop +2" },
    { type: "add-time", label: "Add 10s", desc: "Extend your clock" },
    { type: "reveal", label: "Reveal", desc: "Reveal a correct bird" },
  ];
  return (
    <div className="panel">
      <div className="panel-title">
        Boosts <span className="muted">({boostsLeft} left)</span>
      </div>
      <div className="boost-grid">
        {options.map((opt) => (
          <button
            key={opt.type}
            className="boost-btn"
            onClick={() => onUse(opt.type)}
            disabled={disabled || boostsLeft <= 0}
          >
            <div className="boost-title">{opt.label}</div>
            <div className="boost-desc">{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MosaicProgress({
  correctCount,
  totalPieces,
  mosaicUrl,
}: {
  correctCount: number;
  totalPieces: number;
  mosaicUrl: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [readyUrl, setReadyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setLoading(true);
        const img = new Image();
        img.src = mosaicUrl;
        img.onload = () => {
          if (cancelled) return;
          setReadyUrl(mosaicUrl);
          setLoading(false);
        };
        img.onerror = () => {
          if (cancelled) return;
          setLoading(false);
        };
        observer.disconnect();
      },
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [mosaicUrl]);

  const progress = Math.round((correctCount / totalPieces) * 100);

  return (
    <div
      ref={ref}
      className="mosaic"
      data-loading={loading && !readyUrl ? "true" : "false"}
      style={
        {
          "--mosaic-img": readyUrl ? `url(${readyUrl})` : "none",
          "--mosaic-progress": `${progress}%`,
        } as React.CSSProperties
      }
    >
      <div className="mosaic-reveal" />
      {Array.from({ length: totalPieces }).map((_, idx) => (
        <div
          key={idx}
          className={`mosaic-tile ${idx < correctCount ? "filled" : ""}`}
        />
      ))}
    </div>
  );
}

function App() {
  const [role, setRole] = useState<"gm" | "player" | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPin, setJoinPin] = useState("");
  const [playerPass, setPlayerPass] = useState("");
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [gmToken, setGmToken] = useState("");
  const [gmCode, setGmCode] = useState("");
  const [resumeCode, setResumeCode] = useState("");
  const [resumeToken, setResumeToken] = useState("");
  const [gmPass, setGmPass] = useState("");
  const [gmPin, setGmPin] = useState<string>("");
  const [placements, setPlacements] = useState<Record<string, Phase>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [highlightZone, setHighlightZone] = useState<Phase | null>(null);
  const [highlightHint, setHighlightHint] = useState<{
    quoteId: string;
    phase: Phase;
  } | null>(null);
  const [config, setConfig] = useState<GameConfig>(defaultConfig);
  const [connection, setConnection] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  const [connectionNonce, setConnectionNonce] = useState(0);
  const [shouldShowReconnect, setShouldShowReconnect] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [boostFlash, setBoostFlash] = useState<BoostType | null>(null);
  const boostOscRef = useRef<OscillatorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("creativity-sound");
    return stored ? stored === "true" : true;
  });
  const [soundPack, setSoundPack] = useState<SoundPack>(() => {
    const stored = localStorage.getItem("creativity-sound-pack");
    if (stored === "arcade" || stored === "cinematic" || stored === "8bit")
      return stored;
    return "calm";
  });
  const [soundVolumeBoost, setSoundVolumeBoost] = useState<number>(() => {
    const stored = localStorage.getItem("creativity-sound-vol-boost");
    const num = stored ? Number(stored) : 0.14;
    return Number.isFinite(num) ? Math.min(Math.max(num, 0), 1) : 0.14;
  });
  const [soundVolumeSnap, setSoundVolumeSnap] = useState<number>(() => {
    const stored = localStorage.getItem("creativity-sound-vol-snap");
    const num = stored ? Number(stored) : 0.1;
    return Number.isFinite(num) ? Math.min(Math.max(num, 0), 1) : 0.1;
  });
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem("creativity-haptics");
    return stored ? stored === "true" : true;
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    const stored = localStorage.getItem("creativity-contrast");
    return stored ? stored === "true" : false;
  });
  const [snapPhase, setSnapPhase] = useState<Phase | null>(null);
  const [clientId] = useState<string>(() => {
    const existing =
      localStorage.getItem("creativity-client-id") || crypto.randomUUID();
    localStorage.setItem("creativity-client-id", existing);
    return existing;
  });
  const clientIdRef = useRef<string>(clientId);
  const socketRef = useRef<ReturnType<typeof createSocketClient> | null>(null);
  const autoResumeSent = useRef(false);
  const latestRoleRef = useRef<"gm" | "player" | null>(null);
  const [keyboardCarryId, setKeyboardCarryId] = useState<string | null>(null);
  const [keyboardTargetPhase, setKeyboardTargetPhase] = useState<Phase>(
    phases[0].id
  );
  const phaseIds = useMemo(() => phases.map((p) => p.id), []);

  useEffect(() => {
    latestRoleRef.current = role;
    if (!role) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setShouldShowReconnect(false);
      setKeyboardCarryId(null);
      setHighlightZone(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [role]);

  useEffect(() => {
    const saved = localStorage.getItem("creativity-gm");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      /* eslint-disable react-hooks/set-state-in-effect */
      if (parsed.gmToken) {
        setGmToken(parsed.gmToken);
        setResumeToken(parsed.gmToken);
      }
      if (parsed.code) {
        setGmCode(parsed.code);
        setResumeCode(parsed.code);
      }
      if (parsed.pin) {
        setGmPin(parsed.pin);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch (err) {
      console.error("Failed to read stored GM credentials", err);
    }
  }, []);

  const theme =
    themes.find((t) => t.id === (room?.gameConfig.themeId || config.themeId)) ||
    themes[0];
  const activeTheme = theme;
  const correctCount = useMemo(() => {
    return Object.entries(placements).reduce((acc, [qid, ph]) => {
      const q = quotes.find((qq) => qq.id === qid);
      if (q && q.phase === ph) return acc + 1;
      return acc;
    }, 0);
  }, [placements]);
  const totalPieces = quotes.length;

  useEffect(() => {
    if (gmToken && gmCode) {
      localStorage.setItem(
        "creativity-gm",
        JSON.stringify({ gmToken, code: gmCode, pin: gmPin })
      );
    }
  }, [gmToken, gmCode, gmPin]);

  useEffect(() => {
    localStorage.setItem("creativity-sound", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("creativity-sound-pack", soundPack);
  }, [soundPack]);

  useEffect(() => {
    localStorage.setItem("creativity-sound-vol-boost", String(soundVolumeBoost));
  }, [soundVolumeBoost]);

  useEffect(() => {
    localStorage.setItem("creativity-sound-vol-snap", String(soundVolumeSnap));
  }, [soundVolumeSnap]);

  useEffect(() => {
    localStorage.setItem("creativity-haptics", String(hapticsEnabled));
  }, [hapticsEnabled]);

  useEffect(() => {
    localStorage.setItem("creativity-contrast", String(highContrast));
  }, [highContrast]);

  const currentPlayer: PlayerState | undefined = useMemo(() => {
    if (!room) return undefined;
    return room.players.find((p) => p.clientId === clientId);
  }, [clientId, room]);

  useEffect(() => {
    if (!role) {
      socketRef.current?.socket.close();
      /* eslint-disable react-hooks/set-state-in-effect */
      setConnection("disconnected");
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    setConnection("connecting");
    setShouldShowReconnect(false);
    const client = createSocketClient({
      onMessage: (data) => {
        if (data.type === "error") {
          setMessage(data.message);
          return;
        }
        if (data.type === "host:created") {
          setGmToken(data.payload.gmToken);
          setGmCode(data.payload.code);
          setResumeCode(data.payload.code);
          setResumeToken(data.payload.gmToken);
          setGmPin(data.payload.pin);
          setRoom(data.payload.room);
          setConfig(data.payload.room.gameConfig);
          setMessage("Room created and GM token stored securely.");
          return;
        }
        if (
          data.type === "room:update" ||
          data.type === "game:started" ||
          data.type === "game:ended"
        ) {
          setRoom(data.payload);
          if (data.payload.gmToken) {
            setGmToken(data.payload.gmToken);
            setResumeToken(data.payload.gmToken);
          }
          if (data.payload.code) {
            setGmCode(data.payload.code);
            setResumeCode(data.payload.code);
          }
          if (data.payload.pin) {
            setGmPin(data.payload.pin);
          }
          setConfig(data.payload.gameConfig);
          const mine = data.payload.players.find(
            (p) => p.clientId === clientIdRef.current
          );
          if (mine) {
            setPlacements(mine.placements);
          }
        }
        if (data.type === "hint:grant") {
          setHighlightHint(data.payload);
          setTimeout(() => setHighlightHint(null), 4000);
        }
        if (data.type === "boost:applied") {
          setBoostFlash(data.payload.type);
          setMessage(
            `Boost ${data.payload.type} applied for ${data.payload.targetId}`
          );
        }
        if (data.type === "host:pin-rotated") {
          setGmPin(data.payload.pin);
          setMessage(`New PIN generated: ${data.payload.pin}`);
        }
      },
      onError: (msg) => {
        setMessage(msg);
        setShouldShowReconnect(true);
      },
      onOpen: () => {
        setConnection("connected");
        setShouldShowReconnect(false);
      },
      onClose: () => {
        setConnection("disconnected");
        if (latestRoleRef.current) {
          setShouldShowReconnect(true);
          setMessage((prev) => prev ?? "Connection lost. Retry?");
        }
      },
    });
    socketRef.current = client;
    return () => client.socket.close();
  }, [role, connectionNonce]);

  const send = useCallback((command: SocketCommand) => {
    if (!socketRef.current) return;
    socketRef.current.send(command);
  }, []);

  useEffect(() => {
    if (
      connection === "connected" &&
      role === "gm" &&
      gmToken &&
      gmCode &&
      !room &&
      !autoResumeSent.current
    ) {
      autoResumeSent.current = true;
      send({
        type: "host:resume",
        payload: { code: gmCode, gmToken },
      });
    }
    if (connection === "disconnected") {
      autoResumeSent.current = false;
    }
  }, [connection, role, gmToken, gmCode, room, send]);

  const endAt = useMemo(() => {
    if (!room?.startAt) return null;
    const base = room.startAt + room.gameConfig.timeLimitSeconds * 1000;
    const bonus = currentPlayer?.timeBonus || 0;
    return base + bonus;
  }, [room, currentPlayer]);

  const remainingMs = useCountdown(room?.status === "active" ? endAt : null);

  const boardPlacements = useMemo(() => {
    const byPhase: Record<Phase, string[]> = {
      preparation: [],
      incubation: [],
      illumination: [],
      verification: [],
    };
    Object.entries(placements).forEach(([quoteId, phase]) => {
      byPhase[phase].push(quoteId);
    });
    return byPhase;
  }, [placements]);

  const availableQuotes = useMemo(() => {
    const placedIds = new Set(Object.keys(placements));
    return quotes.filter((q) => !placedIds.has(q.id));
  }, [placements]);

  const retryConnection = () => {
    socketRef.current?.socket.close();
    setShouldShowReconnect(false);
    setConnection("connecting");
    setConnectionNonce((n) => n + 1);
  };

  const handleCreateRoom = () => {
    send({
      type: "host:create",
      payload: {
        name: playerName || "GM",
        config,
        gmPass: gmPass || undefined,
        playerPass: playerPass || undefined,
      },
    });
  };

  const handleResumeRoom = () => {
    if (!resumeCode || !resumeToken) {
      setMessage("Provide room code and GM token to resume.");
      return;
    }
    send({
      type: "host:resume",
      payload: {
        code: resumeCode.trim().toUpperCase(),
        gmToken: resumeToken,
        gmPass: gmPass || undefined,
      },
    });
  };

  const handleUpdateConfig = (next: Partial<GameConfig>) => {
    const merged = { ...config, ...next };
    setConfig(merged);
    if (!gmToken && role === "gm") {
      setMessage("Missing GM token. Resume or create a room first.");
      return;
    }
    if (room?.code) {
      send({ type: "host:update-config", payload: { config: merged, gmToken } });
    }
  };

  const handleJoin = () => {
    if (!joinCode) return;
    send({
      type: "player:join",
      payload: {
        code: joinCode.trim().toUpperCase(),
        name: playerName,
        clientId: clientIdRef.current,
        pin: joinPin || undefined,
        playerPass: playerPass || undefined,
      },
    });
  };

  const playSnapSound = useCallback(() => {
    if (!soundEnabled) return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const wave =
      soundPack === "arcade" || soundPack === "8bit"
        ? "square"
        : soundPack === "cinematic"
        ? "sine"
        : activeTheme.sound?.wave || "sine";
    const baseFreq = activeTheme.sound?.snapFreq ?? 680;
    const freq =
      soundPack === "arcade"
        ? baseFreq + 80
        : soundPack === "8bit"
        ? baseFreq + 40
        : soundPack === "cinematic"
        ? baseFreq - 40
        : baseFreq;
    const baseGain =
      soundPack === "arcade"
        ? 0.13
        : soundPack === "8bit"
        ? 0.15
        : soundPack === "cinematic"
        ? 0.08
        : 0.1;
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.value = baseGain * soundVolumeSnap;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    if (hapticsEnabled && "vibrate" in navigator) {
      navigator.vibrate?.(12);
    }
  }, [soundEnabled, activeTheme, soundPack, soundVolumeSnap, hapticsEnabled]);

  const handleDrop = useCallback(
    (phase: Phase, quoteId: string) => {
      setPlacements((prev) => {
        const next = { ...prev, [quoteId]: phase };
        send({
          type: "player:update-progress",
          payload: { clientId: clientIdRef.current, placements: next },
        });
        return next;
      });
      setSnapPhase(phase);
      setTimeout(() => setSnapPhase(null), 600);
      playSnapSound();
      if (hapticsEnabled && "vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
    },
    [hapticsEnabled, playSnapSound, send]
  );

  const updateKeyboardTarget = useCallback(
    (direction: 1 | -1) => {
      setKeyboardTargetPhase((prev) => {
        const idx = phaseIds.indexOf(prev);
        const next =
          phaseIds[(idx + direction + phaseIds.length) % phaseIds.length];
        setHighlightZone(next);
        return next;
      });
    },
    [phaseIds]
  );

  const beginKeyboardGrab = useCallback(
    (quoteId: string, currentPhase?: Phase) => {
      const startPhase = currentPhase ?? keyboardTargetPhase ?? phaseIds[0];
      setKeyboardCarryId(quoteId);
      setKeyboardTargetPhase(startPhase);
      setHighlightZone(startPhase);
      setMessage((prev) => prev ?? "Use arrow keys to pick a phase, Enter to drop.");
    },
    [keyboardTargetPhase, phaseIds]
  );

  const cancelKeyboardGrab = useCallback(() => {
    setKeyboardCarryId(null);
    setHighlightZone(null);
  }, []);

  const commitKeyboardDrop = useCallback(() => {
    if (!keyboardCarryId) return;
    handleDrop(keyboardTargetPhase, keyboardCarryId);
    setKeyboardCarryId(null);
    setHighlightZone(null);
  }, [handleDrop, keyboardCarryId, keyboardTargetPhase]);

  const handleUseHint = () => {
    if (!room?.gameConfig.allowHints) return;
    send({
      type: "player:use-hint",
      payload: { clientId: clientIdRef.current, placements },
    });
  };

  const handleUseBoost = (type: BoostType) => {
    send({
      type: "player:use-boost",
      payload: { clientId: clientIdRef.current, type },
    });
  };

  const handleStart = () => {
    if (!room?.code || !gmToken) {
      setMessage("Missing room code or GM token.");
      return;
    }
    send({ type: "host:start", payload: { code: room.code, gmToken } });
  };

  const handleEnd = () => {
    if (!room?.code || !gmToken) {
      setMessage("Missing room code or GM token.");
      return;
    }
    send({ type: "host:end", payload: { code: room.code, gmToken } });
  };

  const handleRotatePin = () => {
    if (!room?.code || !gmToken) {
      setMessage("Missing room code or GM token.");
      return;
    }
    send({ type: "host:rotate-pin", payload: { code: room.code, gmToken } });
  };

  useEffect(() => {
    if (room?.status === "active" && remainingMs === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessage("Time is up!");
    }
  }, [room?.status, remainingMs]);

  useEffect(() => {
    if (!keyboardCarryId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelKeyboardGrab();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        commitKeyboardDrop();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        updateKeyboardTarget(1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        updateKeyboardTarget(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelKeyboardGrab, commitKeyboardDrop, keyboardCarryId, updateKeyboardTarget]);

  useEffect(() => {
    if (!boostFlash) return;
    if (soundEnabled) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const baseRaw = activeTheme.sound?.boostBase ?? 520;
      const base =
        soundPack === "arcade"
          ? baseRaw + 60
          : soundPack === "8bit"
          ? baseRaw + 20
          : soundPack === "cinematic"
          ? baseRaw - 40
          : baseRaw;
      const freq =
        boostFlash === "add-time"
          ? base + 120
          : boostFlash === "double-points"
          ? base + 40
          : base - 60;
      const wave =
        soundPack === "arcade" || soundPack === "8bit"
          ? "square"
          : soundPack === "cinematic"
          ? "sine"
          : activeTheme.sound?.wave || "triangle";
      osc.type = wave;
      osc.frequency.value = freq;
      const baseGain =
        soundPack === "arcade"
          ? 0.16
          : soundPack === "8bit"
          ? 0.18
          : soundPack === "cinematic"
          ? 0.09
          : 0.12;
      gain.gain.value = baseGain * soundVolumeBoost;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      boostOscRef.current = osc;
      if (hapticsEnabled && "vibrate" in navigator) {
        navigator.vibrate?.(15);
      }
    }
    const t = setTimeout(() => setBoostFlash(null), 1800);
    return () => clearTimeout(t);
  }, [boostFlash, soundEnabled, activeTheme, hapticsEnabled, soundVolumeBoost, soundPack]);

  return (
    <div
      className="app"
      style={
        {
          "--accent": activeTheme.accent,
          "--paper": activeTheme.paper,
          "--text": activeTheme.text,
          "--muted": activeTheme.muted,
          "--bg": activeTheme.background,
        } as React.CSSProperties
      }
      data-layout={activeTheme.boardLayout}
      data-theme={activeTheme.id}
      data-contrast={highContrast ? "high" : "normal"}
    >
      <header className="topbar">
        <div>
          <div className="eyebrow">Creativity is… Puzzle</div>
          <h1>Cross-device real-time puzzle</h1>
          <p className="muted">
            Two roles: Game Master sets the rules; players race the clock, use
            boosts, and climb the leaderboard.
          </p>
          <div className="tag-row">
            <span className="pill">Realtime sync</span>
            <span className="pill">Timer fairness</span>
            <span className="pill">Boosts & hints</span>
            <span className="pill">3 themed layouts</span>
          </div>
        </div>
        <div className="status">
          <div className="pill ghost">
            Connection: {connection === "connected" ? "Live" : connection}
          </div>
          {room?.code && <div className="pill code">Room: {room.code}</div>}
          {role === "gm" && gmPin && (
            <div className="pill pin-pill">PIN: {gmPin}</div>
          )}
          <button
            className="pill ghost"
            onClick={() => setSoundEnabled((v) => !v)}
          >
            Sound: {soundEnabled ? "On" : "Off"}
          </button>
          <button
            className="pill ghost"
            onClick={() => setHighContrast((v) => !v)}
          >
            Contrast: {highContrast ? "High" : "Normal"}
          </button>
          <div className="pill ghost sound-menu">
            <details>
              <summary>Sound: {soundEnabled ? soundPack : "Off"}</summary>
              <div className="sound-panel">
                <button
                  className="secondary"
                  onClick={() => setSoundEnabled((v) => !v)}
                  aria-label="Toggle sound"
                >
                  Sound {soundEnabled ? "On" : "Off"}
                </button>
                <button
                  className="secondary"
                  onClick={() =>
                    setSoundPack((p) => {
                      if (p === "calm") return "arcade";
                      if (p === "arcade") return "cinematic";
                      if (p === "cinematic") return "8bit";
                      return "calm";
                    })
                  }
                  aria-label="Cycle sound pack"
                >
                  Pack: {soundPack}
                </button>
                <button
                  className="secondary"
                  onClick={() => setHapticsEnabled((v) => !v)}
                  aria-label="Toggle haptics"
                >
                  Haptics {hapticsEnabled ? "On" : "Off"}
                </button>
                <label className="small muted">Boost vol</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={soundVolumeBoost}
                  onChange={(e) => setSoundVolumeBoost(Number(e.target.value))}
                  aria-label="Boost volume"
                />
                <label className="small muted">Snap vol</label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={soundVolumeSnap}
                  onChange={(e) => setSoundVolumeSnap(Number(e.target.value))}
                  aria-label="Snap volume"
                />
              </div>
            </details>
          </div>
          <div className="pill ghost slider-pill">
            <span className="muted small">Boost vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={soundVolumeBoost}
              onChange={(e) => setSoundVolumeBoost(Number(e.target.value))}
            />
          </div>
          <div className="pill ghost slider-pill">
            <span className="muted small">Snap vol</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={soundVolumeSnap}
              onChange={(e) => setSoundVolumeSnap(Number(e.target.value))}
            />
          </div>
        </div>
      </header>

      <ThemeSelector
        themes={themes}
        value={activeTheme.id}
        onChange={(id) => handleUpdateConfig({ themeId: id })}
      />

      {!role && (
        <div className="grid two">
          <div className="panel">
            <div className="panel-title">Game Master</div>
            <p className="muted">
              Create the room, tune the timer, hints, boosts, and kick things
              off.
            </p>
            <button className="primary" onClick={() => setRole("gm")}>
              Enter as Game Master
            </button>
          </div>
          <div className="panel">
            <div className="panel-title">Player</div>
            <p className="muted">
              Join from any device, drop quotes to birds, use hints and boosts.
            </p>
            <button className="secondary" onClick={() => setRole("player")}>
              Enter as Player
            </button>
          </div>
        </div>
      )}

      {role === "gm" && (
        <div className="grid two">
          <div className="panel">
            <div className="panel-title">Room Controls</div>
            <label className="field">
              <span>Display name</span>
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Prof. Ada"
              />
            </label>
            <div className="grid two tight">
              <label className="field">
                <span>Time limit (seconds)</span>
                <input
                  type="number"
                  min={60}
                  max={900}
                  value={config.timeLimitSeconds}
                  onChange={(e) =>
                    handleUpdateConfig({ timeLimitSeconds: Number(e.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>Hints per player</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={config.hintsPerPlayer}
                  onChange={(e) =>
                    handleUpdateConfig({ hintsPerPlayer: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="grid two tight">
              <label className="field">
                <span>Room code (resume)</span>
                <input
                  value={resumeCode}
                  onChange={(e) => setResumeCode(e.target.value)}
                  placeholder="ABCD"
                />
              </label>
              <label className="field">
                <span>GM token (resume)</span>
                <input
                  value={resumeToken}
                  onChange={(e) => setResumeToken(e.target.value)}
                  placeholder="Paste GM token"
                />
              </label>
            </div>
            <div className="grid two tight">
              <label className="field">
                <span>Boosts per player</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={config.boostsPerPlayer}
                  onChange={(e) =>
                    handleUpdateConfig({ boostsPerPlayer: Number(e.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>Allow hints?</span>
                <select
                  value={String(config.allowHints)}
                  onChange={(e) =>
                    handleUpdateConfig({ allowHints: e.target.value === "true" })
                  }
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
            <div className="grid two tight">
              <label className="field">
                <span>Enable boosts?</span>
                <select
                  value={String(config.boostsEnabled)}
                  onChange={(e) =>
                    handleUpdateConfig({ boostsEnabled: e.target.value === "true" })
                  }
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Show correct outlines (assist mode)</span>
              <select
                value={String(config.showPhaseOutlines ?? false)}
                onChange={(e) =>
                  handleUpdateConfig({ showPhaseOutlines: e.target.value === "true" })
                }
              >
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </label>
            <div className="grid two tight">
              <label className="field">
                <span>GM pass (optional)</span>
                <input
                  type="password"
                  value={gmPass}
                  onChange={(e) => setGmPass(e.target.value)}
                  placeholder="Protect GM controls"
                />
              </label>
              <label className="field">
                <span>Player pass (optional)</span>
                <input
                  type="password"
                  value={playerPass}
                  onChange={(e) => setPlayerPass(e.target.value)}
                  placeholder="Require for joins"
                />
              </label>
            </div>
            <div className="button-row">
              {!room && (
                <button className="primary" onClick={handleCreateRoom}>
                  Create room
                </button>
              )}
              {!room && (
                <button className="secondary" onClick={handleResumeRoom}>
                  Resume with token
                </button>
              )}
              {room && room.status === "lobby" && (
                <button className="primary" onClick={handleStart}>
                  Start game
                </button>
              )}
              {room && room.status === "active" && (
                <button className="secondary" onClick={handleEnd}>
                  End game
                </button>
              )}
              {room && (
                <button className="secondary" onClick={handleRotatePin}>
                  Rotate PIN
                </button>
              )}
            </div>
            {room?.code && (
              <div className="muted small">
                Share code with players: <strong>{room.code}</strong>
                <br />
                GM token stored locally for you:{" "}
                <code className="code">
                  {gmToken ? `${gmToken.slice(0, 8)}…` : "N/A"}
                </code>
                <br />
                Current PIN: <code className="code">{gmPin || "N/A"}</code>
              </div>
            )}
          </div>
          <div>
            <div className="stack">
              <Leaderboard players={room?.players || []} accent={theme.accent} />
              {room?.leaderboard?.length ? (
                <div className="panel">
                  <div className="panel-title">Saved leaderboard</div>
                  <div className="stack">
                    {room.leaderboard.map((entry, idx) => (
                      <div className="leader-row" key={entry.id + idx}>
                        <div className="leader-rank">#{idx + 1}</div>
                        <div>
                          <div className="leader-name">{entry.name}</div>
                          <div className="muted small">
                            Score {entry.score} • {Math.round(entry.time / 1000)}s
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {role === "player" && (
        <>
          {!room && (
            <div className="panel">
              <div className="panel-title">Join a room</div>
              <label className="field">
                <span>Name</span>
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="field">
                <span>Room code</span>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="ABCD"
                />
              </label>
              <label className="field">
                <span>PIN (if required)</span>
                <input
                  value={joinPin}
                  onChange={(e) => setJoinPin(e.target.value)}
                  placeholder="1234"
                />
              </label>
              <label className="field">
                <span>Player pass (if required)</span>
                <input
                  type="password"
                  value={playerPass}
                  onChange={(e) => setPlayerPass(e.target.value)}
                  placeholder="••••"
                />
              </label>
              <button className="primary" onClick={handleJoin}>
                Join
              </button>
            </div>
          )}

          {room && (
            <div className="grid three">
              <div className="panel">
                <div className="panel-title">
                  Time & status
                  <div className="muted small">
                    Game is {room.status}. Theme {activeTheme.name}.
                  </div>
                </div>
                <TimerDisplay remainingMs={remainingMs} />
                <MosaicProgress
                  key={activeTheme.mosaicUrl}
                  correctCount={correctCount}
                  totalPieces={totalPieces}
                  mosaicUrl={activeTheme.mosaicUrl}
                />
            <div className="phase-legend">
              {phases.map((p) => (
                <div key={p.id} className="legend-item">
                  <span className={`legend-dot phase-${p.id}`} />
                  <span>{p.title}</span>
                </div>
              ))}
            </div>
                {room.status === "lobby" && (
                  <div className="muted">Waiting for the Game Master…</div>
                )}
                <Leaderboard players={room.players} accent={theme.accent} />
              </div>

              <div className="panel board">
                <div className="panel-title">Puzzle Board</div>
                <div className="board-grid">
                  {phases.map((phase) => (
                    <div
                      key={phase.id}
                      className={`board-col phase-${phase.id} ${
                        highlightZone === phase.id ? "board-col-highlight" : ""
                      } ${snapPhase === phase.id ? "board-col-snap" : ""} ${
                        room?.gameConfig.showPhaseOutlines ? "board-col-correct" : ""
                      } ${
                        keyboardCarryId && keyboardTargetPhase === phase.id
                          ? "board-col-target"
                          : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setHighlightZone(phase.id);
                      }}
                      onDragLeave={() => setHighlightZone(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const qid = e.dataTransfer.getData("text/plain");
                        handleDrop(phase.id, qid);
                        setHighlightZone(null);
                      }}
                    >
                      <div className="phase-title">{phase.title}</div>
                      <div className="muted small">{phase.helper}</div>
                      <div className="stack">
                        {boardPlacements[phase.id].map((qid) => {
                          const q = quotes.find((qq) => qq.id === qid);
                          if (!q) return null;
                          const hintGlow =
                            highlightHint?.quoteId === qid &&
                            highlightHint.phase === phase.id;
                          return (
                            <div
                              key={qid}
                              className={`quote-wrap ${
                                hintGlow ? "hint-glow" : ""
                              }`}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", qid);
                                setDraggedId(qid);
                              }}
                              onDragEnd={() => setDraggedId(null)}
                              tabIndex={0}
                              role="button"
                              aria-grabbed={keyboardCarryId === qid}
                              data-grabbed={keyboardCarryId === qid ? "true" : "false"}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  beginKeyboardGrab(qid, phase.id);
                                }
                                if (e.key === "Escape" && keyboardCarryId === qid) {
                                  e.preventDefault();
                                  cancelKeyboardGrab();
                                }
                              }}
                            >
                              <QuoteCard
                                text={q.text}
                                author={q.author}
                                accent={theme.accent}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">
                  Quote Bank{" "}
                  <span className="muted">({availableQuotes.length} left)</span>
                </div>
                <div className="stack scroll">
                  {availableQuotes.map((q) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", q.id);
                        setDraggedId(q.id);
                      }}
                      onDragEnd={() => setDraggedId(null)}
                      tabIndex={0}
                      role="button"
                      aria-grabbed={keyboardCarryId === q.id}
                      data-grabbed={keyboardCarryId === q.id ? "true" : "false"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          beginKeyboardGrab(q.id);
                        }
                        if (e.key === "Escape" && keyboardCarryId === q.id) {
                          e.preventDefault();
                          cancelKeyboardGrab();
                        }
                      }}
                    >
                      <QuoteCard
                        text={q.text}
                        author={q.author}
                        accent={theme.accent}
                        ghost={draggedId === q.id}
                      />
                    </div>
                  ))}
                </div>
                {room?.gameConfig.allowHints && currentPlayer && (
                  <button
                    className="secondary"
                    onClick={handleUseHint}
                    disabled={currentPlayer.hintsLeft <= 0}
                  >
                    Use hint ({currentPlayer.hintsLeft} left)
                  </button>
                )}
                {room?.gameConfig.boostsEnabled && currentPlayer && (
                  <BoostTray
                    boostsLeft={currentPlayer.boostsLeft}
                    onUse={handleUseBoost}
                    disabled={currentPlayer.boostsLeft <= 0}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {boostFlash && (
        <div className="boost-flash">
          Boost {boostFlash} activated!
        </div>
      )}
      <div className="toast-stack">
        {shouldShowReconnect && role && (
          <div className="toast danger">
            <div>Connection lost. We paused syncing.</div>
            <div className="toast-actions">
              <button
                className="secondary"
                onClick={retryConnection}
                disabled={connection === "connecting"}
              >
                {connection === "connecting" ? "Reconnecting…" : "Retry"}
              </button>
            </div>
          </div>
        )}
        {message && <div className="toast">{message}</div>}
        {room?.status === "ended" && (
          <div className="toast">Game ended. Waiting for restart.</div>
        )}
      </div>
    </div>
  );
}

export default App;
