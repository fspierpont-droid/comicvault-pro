// lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ComicItem = {
  id: string;
  title: string;
  publisher?: string;
  year?: string;
  imageUri: string;
  createdAt: number;
};

const KEY = "comicvault:collection:v1";

export async function getCollection(): Promise<ComicItem[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ComicItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveCollection(items: ComicItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function addToCollection(item: ComicItem): Promise<ComicItem[]> {
  const current = await getCollection();
  const next = [item, ...current];
  await saveCollection(next);
  return next;
}

export async function clearCollection(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}