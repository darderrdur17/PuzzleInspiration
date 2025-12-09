import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./services/socket', () => ({
  createSocketClient: () => ({
    socket: { close: vi.fn() } as unknown as WebSocket,
    send: vi.fn(),
  }),
}));

describe('App smoke test', () => {
  it('shows the role chooser', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /enter as game master/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /enter as player/i })
    ).toBeInTheDocument();
  });
});

