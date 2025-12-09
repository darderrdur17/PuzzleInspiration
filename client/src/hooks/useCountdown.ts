import { useEffect, useState } from "react";

export const useCountdown = (endAt: number | null) => {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endAt) {
      const raf = requestAnimationFrame(() => setRemaining(0));
      return () => cancelAnimationFrame(raf);
    }

    const tick = () => {
      setRemaining(Math.max(0, endAt - Date.now()));
    };

    tick();
    const interval = setInterval(() => {
      tick();
    }, 500);

    return () => clearInterval(interval);
  }, [endAt]);

  return remaining;
};

