"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchMineSkinCapes,
  fetchMineSkinMe,
  type MineSkinCape,
  type MineSkinGrants,
} from "@/lib/mineskin";

import { useMineSkinApiKey } from "./use-mineskin-api-key";

type MineSkinState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

const initialCapeState: MineSkinState<MineSkinCape[]> = {
  data: [],
  loading: true,
  error: null,
};

const initialGrantState: MineSkinState<MineSkinGrants | null> = {
  data: null,
  loading: false,
  error: null,
};

export function useMineSkin() {
  const { apiKey, setApiKey, clearApiKey } = useMineSkinApiKey();
  const [capeState, setCapeState] = useState(initialCapeState);
  const [capeRequestId, setCapeRequestId] = useState(0);
  const [grantState, setGrantState] = useState(initialGrantState);
  const [grantRequestId, setGrantRequestId] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    setCapeState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    fetchMineSkinCapes(apiKey)
      .then((capes) => {
        if (isCancelled) return;
        setCapeState({ data: capes, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setCapeState({
          data: [],
          loading: false,
          error:
            error instanceof Error ? error.message : String(error ?? "Unknown error"),
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [apiKey, capeRequestId]);

  useEffect(() => {
    if (!apiKey) {
      setGrantState({ data: null, loading: false, error: null });
      return;
    }

    let isCancelled = false;
    setGrantState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    fetchMineSkinMe(apiKey)
      .then((result) => {
        if (isCancelled) return;
        setGrantState({ data: result.grants ?? null, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setGrantState({
          data: null,
          loading: false,
          error:
            error instanceof Error ? error.message : String(error ?? "Unknown error"),
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [apiKey, grantRequestId]);

  const hasCapesGrant = useMemo(() => {
    if (!grantState.data) {
      return false;
    }

    const capesGrant = (grantState.data as Record<string, unknown>).capes;
    return Boolean(capesGrant);
  }, [grantState.data]);

  const refreshCapes = useCallback(() => {
    setCapeRequestId((value) => value + 1);
  }, []);

  const refreshGrants = useCallback(() => {
    setGrantRequestId((value) => value + 1);
  }, []);

  return {
    apiKey,
    setApiKey,
    clearApiKey,
    capes: capeState.data,
    loadingCapes: capeState.loading,
    capesError: capeState.error,
    refreshCapes,
    grants: grantState.data,
    loadingGrants: grantState.loading,
    grantsError: grantState.error,
    refreshGrants,
    hasCapesGrant,
  };
}

