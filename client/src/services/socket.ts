import type { SocketCommand, SocketEnvelope } from "../types";

type SocketHandlers = {
  onMessage: (payload: SocketEnvelope) => void;
  onError?: (message: string) => void;
  onClose?: () => void;
  onOpen?: () => void;
};

export const createSocketClient = (handlers: SocketHandlers) => {
  const url = import.meta.env.VITE_WS_URL || "ws://localhost:8787";
  const ws = new WebSocket(url);

  ws.addEventListener("open", () => {
    handlers.onOpen?.();
  });

  ws.addEventListener("message", (event) => {
    try {
      const data: SocketEnvelope = JSON.parse(event.data);
      handlers.onMessage(data);
    } catch {
      handlers.onError?.("Failed to parse message from server.");
    }
  });

  ws.addEventListener("error", () => {
    handlers.onError?.("Lost connection to server.");
  });

  ws.addEventListener("close", () => {
    handlers.onClose?.();
  });

  const send = (command: SocketCommand) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(command));
    }
  };

  return {
    socket: ws,
    send,
  };
};

