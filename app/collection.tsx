import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { fetchScans, r2PublicUrl, type ScanRecord } from "@/lib/api";

type SeriesGroup = {
  key: string;
  title: string;
  issues: ScanRecord[];
  issueCount: number;
  latest: ScanRecord;
};

function normalizeTitle(value: string | null | undefined) {
  return String(value || "").trim();
}

function buildSeriesGroups(scans: ScanRecord[]): SeriesGroup[] {
  const map = new Map<string, ScanRecord[]>();

  for (const scan of scans) {
    const title = normalizeTitle(scan.title);
    if (!title) continue;

    if (!map.has(title)) {
      map.set(title, []);
    }

    map.get(title)!.push(scan);
  }

  const groups: SeriesGroup[] = Array.from(map.entries()).map(
    ([title, issues]) => {
      const sorted = [...issues].sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      });

      return {
        key: title,
        title,
        issues: sorted,
        issueCount: sorted.length,
        latest: sorted[0],
      };
    }
  );

  groups.sort((a, b) => a.title.localeCompare(b.title));
  return groups;
}

function buildSections(groups: SeriesGroup[]) {
  const byLetter = new Map<string, SeriesGroup[]>();

  for (const group of groups) {
    const letter = group.title.charAt(0).toUpperCase() || "#";
    const bucket = /[A-Z]/.test(letter) ? letter : "#";

    if (!byLetter.has(bucket)) {
      byLetter.set(bucket, []);
    }

    byLetter.get(bucket)!.push(group);
  }

  return Array.from(byLetter.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, items]) => ({
      letter,
      items: items.sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

export default function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scans, setScans] = useState<ScanRecord[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await fetchScans("my-vault");
      setScans(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to load vault:", error);
      setScans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const groups = useMemo(() => buildSeriesGroups(scans), [scans]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return groups;

    return groups.filter((group) => {
      const haystack = [
        group.title,
        ...group.issues.map((issue) => `${issue.title} ${issue.issue}`),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [groups, search]);

  const sections = useMemo(() => buildSections(filteredGroups), [filteredGroups]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.headerBtn} onPress={() => router.replace("/")}>
          <Ionicons name="home-outline" size={20} color="#EAF4FF" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>My Vault</Text>
          <Text style={styles.headerSub}>Series index</Text>
        </View>

        <Pressable
          style={styles.headerBtn}
          onPress={() => router.push("/capture")}
        >
          <Ionicons name="scan-outline" size={20} color="#EAF4FF" />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={22} color="#7C9CB1" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search series or issue"
          placeholderTextColor="#6E8A9B"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4FA8FF" />
          <Text style={styles.centerText}>Loading vault...</Text>
        </View>
      ) : filteredGroups.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="file-tray-outline" size={42} color="#64859A" />
          <Text style={styles.emptyTitle}>
            {search.trim() ? "No matching books" : "Your vault is empty"}
          </Text>
          <Text style={styles.centerText}>
            {search.trim()
              ? "Try a different title or issue number."
              : "Start by scanning your first comic."}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {sections.map((section) => (
            <View key={section.letter} style={styles.section}>
              <Text style={styles.sectionLetter}>{section.letter}</Text>

              {section.items.map((group) => {
                const coverKey =
                  group.latest.frontKey ||
                  (group.latest as any).front_key ||
                  null;

                const coverUrl = coverKey ? r2PublicUrl(coverKey) : null;

                return (
                  <Pressable
                    key={group.key}
                    style={styles.seriesCard}
                    onPress={() =>
                      router.push(`/series/${encodeURIComponent(group.title)}`)
                    }
                  >
                    <View style={styles.seriesLeft}>
                      {coverUrl ? (
                        <Image
                          source={{ uri: coverUrl }}
                          style={styles.coverThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.coverThumb, styles.coverPlaceholder]}>
                          <Ionicons
                            name="image-outline"
                            size={22}
                            color="#6B8AA0"
                          />
                          <Text style={styles.placeholderLabel}>No Cover</Text>
                        </View>
                      )}

                      <View style={styles.seriesTextWrap}>
                        <Text style={styles.seriesTitle} numberOfLines={1}>
                          {group.title}
                        </Text>
                        <Text style={styles.seriesMeta}>
                          {group.issueCount} issue{group.issueCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward-outline"
                      size={24}
                      color="#7FA3B9"
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#071821",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#102733",
    borderWidth: 1,
    borderColor: "#173545",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    color: "#F4FAFF",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSub: {
    color: "#8CAEC2",
    marginTop: 2,
    fontSize: 13,
  },
  searchWrap: {
    marginHorizontal: 20,
    marginBottom: 14,
    minHeight: 56,
    borderRadius: 20,
    backgroundColor: "#102733",
    borderWidth: 1,
    borderColor: "#173545",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: "#F4FAFF",
    fontSize: 16,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  centerText: {
    marginTop: 12,
    color: "#8CAEC2",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyTitle: {
    marginTop: 14,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionLetter: {
    color: "#7FB4FF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  seriesCard: {
    minHeight: 102,
    borderRadius: 24,
    backgroundColor: "#102733",
    borderWidth: 1,
    borderColor: "#173545",
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seriesLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  coverThumb: {
    width: 54,
    height: 74,
    borderRadius: 12,
    backgroundColor: "#08161E",
    marginRight: 14,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  placeholderLabel: {
    color: "#6B8AA0",
    fontSize: 9,
    fontWeight: "700",
  },
  seriesTextWrap: {
    flex: 1,
  },
  seriesTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  seriesMeta: {
    color: "#A6C0D0",
    fontSize: 15,
    marginTop: 6,
  },
});