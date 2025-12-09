const { WebSocketServer } = require("ws");
const { quotes } = require("./quotes");
const fs = require("fs");
const path = require("path");
const { randomUUID, randomBytes, createHash } = require("crypto");
const http = require("http");

const PORT = process.env.PORT || 8787;
const PERSIST_PATH = path.join(__dirname, "state.json");

const rooms = new Map();
const socketMeta = new Map(); // ws -> { code, role, clientId }

const phases = ["preparation", "incubation", "illumination", "verification"];

const randomCode = () =>
  Math.random().toString(36).slice(2, 6).toUpperCase();
const randomPin = () =>
  String(Math.floor(Math.random() * 10000)).padStart(4, "0");
const hashPass = (pass, salt) =>
  createHash("sha256").update(pass + salt).digest("hex");

// In-memory attempt tracking for lockouts
const attempts = new Map(); // key -> { fails, lockedUntil }
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

const attemptKey = (kind, code, clientId = "anon") =>
  `${kind}:${code}:${clientId}`;

const isLocked = (key) => {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
    attempts.delete(key);
    return false;
  }
  return false;
};

const registerFail = (key) => {
  const entry = attempts.get(key) || { fails: 0, lockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_FAILS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
  }
  attempts.set(key, entry);
  return entry;
};

const clearFails = (key) => attempts.delete(key);

const makePlayer = (clientId, name, config) => ({
  id: clientId,
  clientId,
  name,
  score: 0,
  correct: 0,
  placements: {},
  hintsLeft: config.hintsPerPlayer,
  boostsLeft: config.boostsPerPlayer,
  timeBonus: 0,
  status: "ready",
});

const emitError = (ws, message) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: "error", message }));
  }
};

const snapshot = (room, includeSecret = false) => ({
  code: room.code,
  status: room.status,
  startAt: room.startAt,
  gameConfig: room.gameConfig,
  players: room.players,
  leaderboard: room.leaderboard || [],
  ...(includeSecret ? { gmToken: room.gmToken, pin: room.pin } : {}),
});

const persistRooms = () => {
  const payload = {
    rooms: Array.from(rooms.values()).map((room) => ({
      code: room.code,
      hostName: room.hostName,
      status: room.status,
      startAt: room.startAt,
      gameConfig: room.gameConfig,
      players: room.players,
      gmToken: room.gmToken,
        pin: room.pin,
        gmSalt: room.gmSalt,
        gmHash: room.gmHash,
        playerSalt: room.playerSalt,
        playerHash: room.playerHash,
      leaderboard: room.leaderboard || [],
    })),
  };
  try {
    fs.writeFileSync(PERSIST_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to persist rooms", err);
  }
};

const loadRooms = () => {
  if (!fs.existsSync(PERSIST_PATH)) return;
  try {
    const raw = fs.readFileSync(PERSIST_PATH, "utf8");
    const data = JSON.parse(raw);
    (data.rooms || []).forEach((r) => {
      rooms.set(r.code, {
        code: r.code,
        hostName: r.hostName,
        status: "lobby", // reset to lobby on restart
        startAt: null,
        gameConfig: r.gameConfig,
        players: (r.players || []).map((p) => ({
          ...p,
          status: "ready",
        })),
        gmToken: r.gmToken || randomUUID(),
        pin: r.pin || randomPin(),
        gmSalt: r.gmSalt,
        gmHash: r.gmHash,
        playerSalt: r.playerSalt,
        playerHash: r.playerHash,
        leaderboard: r.leaderboard || [],
        connections: new Set(),
      });
    });
    console.log(`Loaded ${rooms.size} persisted room(s).`);
  } catch (err) {
    console.error("Failed to load persisted rooms", err);
  }
};

const broadcast = (room, envelope) => {
  room.connections.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  });
};

const findRoomForSocket = (ws) => {
  const meta = socketMeta.get(ws);
  if (!meta) return null;
  return rooms.get(meta.code);
};

const gradePlayer = (room, player) => {
  let correct = 0;
  quotes.forEach((q) => {
    if (player.placements[q.id] === q.phase) correct += 1;
  });
  player.correct = correct;
  const elapsed = room.startAt ? Date.now() - room.startAt : 0;
  const remainingMs =
    room.gameConfig.timeLimitSeconds * 1000 +
    (player.timeBonus || 0) -
    elapsed;
  const remainingScore = Math.max(0, Math.floor(remainingMs / 1000));
  player.score = correct * 10 + remainingScore;
};

const updateLeaderboard = (room) => {
  const current = room.leaderboard || [];
  room.players.forEach((p) => {
    const elapsed = room.startAt ? Date.now() - room.startAt : 0;
    const existing = current.find((e) => e.id === p.id);
    const nextEntry = {
      id: p.id,
      name: p.name,
      score: p.score,
      time: elapsed,
      timestamp: Date.now(),
    };
    if (!existing) {
      current.push(nextEntry);
    } else if (p.score > existing.score || (p.score === existing.score && elapsed < existing.time)) {
      existing.score = p.score;
      existing.time = elapsed;
      existing.timestamp = Date.now();
      existing.name = p.name;
    }
  });
  room.leaderboard = current
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.time - b.time;
    })
    .slice(0, 20);
};

loadRooms();
rooms.forEach((room) => {
  room.players.forEach((p) => gradePlayer(room, p));
  updateLeaderboard(room);
});
persistRooms();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", rooms: rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    const { type, payload } = msg;

    if (type === "host:create") {
      const code = randomCode();
      const gmToken = randomUUID();
      const pin = randomPin();
      const gmSalt = payload.gmPass ? randomBytes(16).toString("hex") : null;
      const gmHash = payload.gmPass ? hashPass(payload.gmPass, gmSalt) : null;
      const playerSalt = payload.playerPass
        ? randomBytes(16).toString("hex")
        : null;
      const playerHash = payload.playerPass
        ? hashPass(payload.playerPass, playerSalt)
        : null;
      const room = {
        code,
        hostName: payload.name || "GM",
        status: "lobby",
        startAt: null,
        gameConfig: payload.config,
        players: [],
        connections: new Set([ws]),
        gmToken,
        pin,
        gmSalt,
        gmHash,
        playerSalt,
        playerHash,
        leaderboard: [],
      };
      rooms.set(code, room);
      socketMeta.set(ws, { code, role: "gm", clientId: "gm" });
      const credPayload = { code, gmToken, pin, room: snapshot(room, true) };
      ws.send(JSON.stringify({ type: "host:created", payload: credPayload }));
      ws.send(JSON.stringify({ type: "room:update", payload: snapshot(room) }));
      persistRooms();
      return;
    }

    if (type === "host:resume") {
      const room = rooms.get(payload.code);
      if (!room || room.gmToken !== payload.gmToken) {
        emitError(ws, "Invalid room code or GM token.");
        return;
      }
      const lockKey = attemptKey("gm", payload.code, "gm");
      if (isLocked(lockKey)) {
        console.warn(`[lockout] gm resume locked code=${payload.code}`);
        emitError(ws, "Too many failed GM attempts. Try again in 60s.");
        return;
      }
      if (room.gmHash && room.gmSalt) {
        const attempt = hashPass(payload.gmPass || "", room.gmSalt);
        if (attempt !== room.gmHash) {
          const fail = registerFail(lockKey);
          const msg =
            fail.lockedUntil && fail.lockedUntil > Date.now()
              ? "GM locked out for 60s due to failed attempts."
              : "GM passcode incorrect.";
          console.warn(`[lockout] gm resume fail code=${payload.code} fails=${fail.fails}`);
          emitError(ws, msg);
          return;
        }
      }
      clearFails(lockKey);
      room.connections.add(ws);
      socketMeta.set(ws, { code: room.code, role: "gm", clientId: "gm" });
      ws.send(
        JSON.stringify({ type: "room:update", payload: snapshot(room, true) })
      );
      return;
    }

    if (type === "host:update-config") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "gm") {
        emitError(ws, "Only GM can update config.");
        return;
      }
      const room = findRoomForSocket(ws);
      if (!room) return;
      if (!payload.config || payload.gmToken !== room.gmToken) {
        emitError(ws, "Invalid GM token for config update.");
        return;
      }
      room.gameConfig = { ...room.gameConfig, ...payload.config };
      broadcast(room, { type: "room:update", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "host:rotate-pin") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "gm") {
        emitError(ws, "Only GM can rotate PIN.");
        return;
      }
      const room = rooms.get(payload.code);
      if (!room || payload.gmToken !== room.gmToken) {
        emitError(ws, "Invalid GM token for PIN rotation.");
        return;
      }
      room.pin = randomPin();
      persistRooms();
      ws.send(JSON.stringify({ type: "host:pin-rotated", payload: { pin: room.pin } }));
      return;
    }

    if (type === "host:start") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "gm") {
        emitError(ws, "Only GM can start the game.");
        return;
      }
      const room = rooms.get(payload.code);
      if (!room) return;
      if (payload.gmToken !== room.gmToken) {
        emitError(ws, "Invalid GM token for start.");
        return;
      }
      room.status = "active";
      room.startAt = Date.now();
      room.players.forEach((p) => {
        p.status = "playing";
        gradePlayer(room, p);
      });
      updateLeaderboard(room);
      broadcast(room, { type: "game:started", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "host:end") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "gm") {
        emitError(ws, "Only GM can end the game.");
        return;
      }
      const room = rooms.get(payload.code);
      if (!room) return;
      if (payload.gmToken !== room.gmToken) {
        emitError(ws, "Invalid GM token for end.");
        return;
      }
      room.status = "ended";
      updateLeaderboard(room);
      broadcast(room, { type: "game:ended", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "player:join") {
      const room = rooms.get(payload.code);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        return;
      }
      const lockKey = attemptKey("player", payload.code, payload.clientId);
      if (isLocked(lockKey)) {
        console.warn(`[lockout] player join locked code=${payload.code} client=${payload.clientId}`);
        emitError(ws, "Too many failed attempts. Try again in 60s.");
        return;
      }
      if (room.pin && payload.pin !== room.pin) {
        const fail = registerFail(lockKey);
        const msg =
          fail.lockedUntil && fail.lockedUntil > Date.now()
            ? "Locked for 60s after bad PIN."
            : "PIN is incorrect.";
        console.warn(`[lockout] pin fail code=${payload.code} client=${payload.clientId} fails=${fail.fails}`);
        emitError(ws, msg);
        return;
      }
      if (room.playerHash && room.playerSalt) {
        const attempt = hashPass(payload.playerPass || "", room.playerSalt);
        if (attempt !== room.playerHash) {
          const fail = registerFail(lockKey);
          const msg =
            fail.lockedUntil && fail.lockedUntil > Date.now()
              ? "Locked for 60s after bad passcode."
              : "Player passcode incorrect.";
          console.warn(`[lockout] pass fail code=${payload.code} client=${payload.clientId} fails=${fail.fails}`);
          emitError(ws, msg);
          return;
        }
      }
      clearFails(lockKey);
      socketMeta.set(ws, {
        code: room.code,
        role: "player",
        clientId: payload.clientId,
      });
      room.connections.add(ws);
      let player = room.players.find((p) => p.id === payload.clientId);
      if (!player) {
        player = makePlayer(payload.clientId, payload.name, room.gameConfig);
        room.players.push(player);
      } else {
        player.name = payload.name;
      }
      gradePlayer(room, player);
      updateLeaderboard(room);
      broadcast(room, { type: "room:update", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "player:update-progress") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "player" || meta.clientId !== payload.clientId) {
        emitError(ws, "Player authentication failed.");
        return;
      }
      const room = findRoomForSocket(ws);
      if (!room) return;
      const player = room.players.find((p) => p.id === payload.clientId);
      if (!player) return;
      player.placements = payload.placements;
      gradePlayer(room, player);
      updateLeaderboard(room);
      broadcast(room, { type: "room:update", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "player:use-hint") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "player" || meta.clientId !== payload.clientId) {
        emitError(ws, "Player authentication failed.");
        return;
      }
      const room = findRoomForSocket(ws);
      if (!room) return;
      const player = room.players.find((p) => p.id === payload.clientId);
      if (!player || player.hintsLeft <= 0 || !room.gameConfig.allowHints)
        return;
      const incorrect = quotes.filter(
        (q) => player.placements[q.id] !== q.phase
      );
      if (incorrect.length === 0) return;
      const hint = incorrect[Math.floor(Math.random() * incorrect.length)];
      player.hintsLeft -= 1;
      ws.send(
        JSON.stringify({
          type: "hint:grant",
          payload: { quoteId: hint.id, phase: hint.phase },
        })
      );
      gradePlayer(room, player);
      updateLeaderboard(room);
      broadcast(room, { type: "room:update", payload: snapshot(room) });
      persistRooms();
      return;
    }

    if (type === "player:use-boost") {
      const meta = socketMeta.get(ws);
      if (!meta || meta.role !== "player" || meta.clientId !== payload.clientId) {
        emitError(ws, "Player authentication failed.");
        return;
      }
      const room = findRoomForSocket(ws);
      if (!room) return;
      const player = room.players.find((p) => p.id === payload.clientId);
      if (!player || player.boostsLeft <= 0 || !room.gameConfig.boostsEnabled)
        return;
      player.boostsLeft -= 1;
      if (payload.type === "add-time") {
        player.timeBonus += 10000;
      } else if (payload.type === "double-points") {
        player.score += 2;
      } else if (payload.type === "reveal") {
        const incorrect = quotes.filter(
          (q) => player.placements[q.id] !== q.phase
        );
        if (incorrect.length > 0) {
          const hint = incorrect[Math.floor(Math.random() * incorrect.length)];
          ws.send(
            JSON.stringify({
              type: "hint:grant",
              payload: { quoteId: hint.id, phase: hint.phase },
            })
          );
        }
      }
      gradePlayer(room, player);
      updateLeaderboard(room);
      broadcast(room, {
        type: "boost:applied",
        payload: { type: payload.type, targetId: player.name },
      });
      broadcast(room, { type: "room:update", payload: snapshot(room) });
      persistRooms();
      return;
    }
  });

  ws.on("close", () => {
    const meta = socketMeta.get(ws);
    if (!meta) return;
    const room = rooms.get(meta.code);
    if (room) {
      room.connections.delete(ws);
    }
    socketMeta.delete(ws);
  });
});

setInterval(() => {
  rooms.forEach((room) => {
    if (room.status !== "active" || !room.startAt) return;
    const maxBonus = Math.max(
      0,
      ...room.players.map((p) => p.timeBonus || 0)
    );
    const deadline =
      room.startAt + room.gameConfig.timeLimitSeconds * 1000 + maxBonus;
    if (Date.now() > deadline) {
      room.status = "ended";
      updateLeaderboard(room);
      broadcast(room, { type: "game:ended", payload: snapshot(room) });
      persistRooms();
    }
  });
}, 1000);

