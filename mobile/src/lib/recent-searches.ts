import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persisted recent-search history. We use AsyncStorage instead of MMKV to
 * avoid the native-module overhead — recent searches are tiny strings hit
 * once per session, not hot-path data.
 *
 * The list is capped at MAX_ITEMS so it can't bloat indefinitely. Newest
 * first; duplicates de-duped (so re-searching a term promotes it to the top
 * rather than adding a second copy).
 */
const KEY = "salepage:recent-searches";
const MAX_ITEMS = 8;

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export async function pushRecentSearch(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return;
  try {
    const existing = await getRecentSearches();
    const next = [trimmed, ...existing.filter((q) => q !== trimmed)].slice(
      0,
      MAX_ITEMS,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Best-effort — never block the search itself on storage errors.
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
