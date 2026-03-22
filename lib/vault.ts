// lib/vault.ts

import { r2PublicUrl, ScanRecord } from "./api";

export type SeriesIssueItem = {
  id: string;
  title: string;
  issue: string;
  issueSort: number;
  coverUrl: string | null;
  createdAt: string | null;
  publisher?: string | null;
  year?: string | number | null;
  variant?: string | null;
  estimatedValue?: number | null;
  keyFacts?: string[];
};

export type SeriesGroup = {
  id: string;
  title: string;
  sortTitle: string;
  count: number;
  coverUrl: string | null;
  issues: SeriesIssueItem[];
};

function normalizeTitle(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^the\s+/i, "")
    .toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseIssueSort(issue: string) {
  const raw = (issue || "").trim();

  const match = raw.match(/^(\d+)([A-Za-z\-\.]*)/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  const base = Number(match[1]);
  const suffix = match[2] || "";

  if (!suffix) return base * 100;

  const suffixWeight =
    suffix
      .toUpperCase()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) % 99;

  return base * 100 + suffixWeight;
}

export function buildSeriesGroups(scans: ScanRecord[]): SeriesGroup[] {
  const map = new Map<string, SeriesGroup>();

  for (const scan of scans) {
    const title = (scan.title || "Untitled").trim();
    const key = normalizeTitle(title);

    if (!map.has(key)) {
      map.set(key, {
        id: slugify(title),
        title,
        sortTitle: key,
        count: 0,
        coverUrl: null,
        issues: [],
      });
    }

    const group = map.get(key)!;
    const coverUrl = r2PublicUrl(scan.frontKey || null);

    group.issues.push({
      id: scan.id,
      title: scan.title,
      issue: scan.issue || "?",
      issueSort: parseIssueSort(scan.issue || ""),
      coverUrl,
      createdAt: scan.createdAt || null,
      publisher: scan.publisher || null,
      year: scan.year || null,
      variant: scan.variant || null,
      estimatedValue: scan.estimatedValue ?? null,
      keyFacts: scan.keyFacts || [],
    });

    group.count += 1;

    if (!group.coverUrl && coverUrl) {
      group.coverUrl = coverUrl;
    }
  }

  const groups = Array.from(map.values())
    .map((group) => ({
      ...group,
      issues: group.issues.sort((a, b) => a.issueSort - b.issueSort),
    }))
    .sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));

  return groups;
}

export function buildAlphabetSections(groups: SeriesGroup[]) {
  const sectionMap = new Map<string, SeriesGroup[]>();

  for (const group of groups) {
    const first = group.title.charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";

    if (!sectionMap.has(letter)) {
      sectionMap.set(letter, []);
    }

    sectionMap.get(letter)!.push(group);
  }

  return Array.from(sectionMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({
      title,
      data,
    }));
}

export function searchSeries(groups: SeriesGroup[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return groups;

  return groups.filter((group) => {
    if (group.title.toLowerCase().includes(q)) return true;
    return group.issues.some((issue) => issue.issue.toLowerCase().includes(q));
  });
}