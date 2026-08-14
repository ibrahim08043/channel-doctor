import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@clerk/clerk-react";
import {
  useGetSettings,
  useUpdateSettings,
} from "@workspace/api-client-react";
import {
  mergeSettings,
  SETTINGS_DEFAULTS,
  type SettingsPatch,
  type UserSettings,
} from "@/lib/settings";

interface SettingsContextValue {
  settings: UserSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  /** Persist a partial patch to the database, optimistically updating local state. */
  saveSettings: (patch: SettingsPatch) => Promise<UserSettings>;
  /** Re-fetch settings from the server. */
  refresh: () => Promise<unknown>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Global settings store. Loads `/api/settings` once on mount (when signed in),
 * merges the response over the defaults so every field is always present, and
 * exposes an optimistic `saveSettings` used by the Settings page and anywhere
 * else that needs to read/write preferences (e.g. SocialAnalyzer).
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const enabled = !!isSignedIn;

  const getQuery = useGetSettings({ query: { enabled } as any });
  const update = useUpdateSettings();

  const [optimistic, setOptimistic] = useState<Partial<UserSettings> | null>(null);

  const refresh = useCallback(() => getQuery.refetch(), [getQuery]);

  const settings = useMemo(() => {
    const server = getQuery.data as unknown as Partial<UserSettings> | undefined;
    // Optimistic overrides take precedence over server data.
    return mergeSettings({ ...server, ...optimistic });
  }, [getQuery.data, optimistic]);

  const saveSettings = useCallback(
    async (patch: SettingsPatch): Promise<UserSettings> => {
      // Optimistically apply the patch so toggles feel instant.
      setOptimistic((prev) => deepMergePartial(prev, patch));
      try {
        const result = (await update.mutateAsync({ data: patch as any })) as unknown as UserSettings;
        setOptimistic(null);
        return result;
      } catch (err) {
        // On failure, drop the optimistic patch and let server data restore.
        setOptimistic(null);
        await getQuery.refetch().catch(() => {});
        throw err;
      }
    },
    [update, getQuery],
  );

  const value: SettingsContextValue = {
    settings,
    isLoading: enabled && getQuery.isLoading,
    isSaving: update.isPending,
    error: (getQuery.error ?? null) as Error | null,
    saveSettings,
    refresh,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** Deep-ish merge of two partial settings objects (one level per group). */
function deepMergePartial<T>(base: T | null, patch: SettingsPatch): T {
  const out: Record<string, unknown> = { ...((base as Record<string, unknown>) ?? {}) };
  for (const group of ["ai", "alerts", "notifications", "profile"] as const) {
    const patchGroup = patch[group];
    if (!patchGroup) continue;
    out[group] = {
      ...((out[group] as Record<string, unknown>) ?? {}),
      ...patchGroup,
    };
  }
  return out as T;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within <SettingsProvider>");
  }
  return ctx;
}

/** Convenience accessor for the AI prefs block with guaranteed defaults. */
export function useAiSettings() {
  const { settings } = useSettings();
  return { ...SETTINGS_DEFAULTS.ai, ...settings.ai };
}
