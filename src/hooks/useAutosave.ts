import { useEffect, useRef } from "react";

export function useAutosave(
  saveStatus: string,
  save: () => Promise<void>,
  delayMs = 650,
) {
  const saveRef = useRef(save);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (saveStatus !== "dirty") return;
    const timeout = setTimeout(() => void saveRef.current(), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, saveStatus]);
}
