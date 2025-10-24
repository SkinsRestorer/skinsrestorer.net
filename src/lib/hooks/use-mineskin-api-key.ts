"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "mineskin-api-key";

type Listener = () => void;

const listeners = new Set<Listener>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function readApiKey(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

function writeApiKey(value: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (value && value.length > 0) {
    window.localStorage.setItem(STORAGE_KEY, value);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }

  emitChange();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      emitChange();
    }
  });
}

export function useMineSkinApiKey() {
  const apiKey = useSyncExternalStore(
    subscribe,
    readApiKey,
    () => null,
  );

  const setApiKey = useCallback((value: string) => {
    writeApiKey(value.trim());
  }, []);

  const clearApiKey = useCallback(() => {
    writeApiKey(null);
  }, []);

  return { apiKey, setApiKey, clearApiKey };
}

