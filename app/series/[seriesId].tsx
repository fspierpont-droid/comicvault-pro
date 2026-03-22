import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { fetchScans, r2PublicUrl } from "@/lib/api";

type ScanRecord = {
  id: string;
  group_id?: string;
  groupId?: string;
  title?: string;
  issue?: string | number;
  publisher?: string | null;
  year?: string | number | null;
  variant?: string | null;
  front_key?: string | null;
  frontKey?: string | null;
  back_key?: string | null;
  backKey?: string | null;
  recognition_reasoning?: string | null;
  recognitionReasoning?: string | null;
  recognition_confidence?: number | null;
  recognitionConfidence?: number | null;
  key_facts?: string | string[] | null;
  keyFacts?: string[] | null;
  created_at?: string;
  createdAt?: string;
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  imageUrl?: string | null;
  front_url?: string | null;
  frontUrl?: string | null;
};

const DEFAULT_GROUP_ID = "my-vault";

function toDisplayIssue(issue: string | number | null | undefined) {
  const value = String(issue ?? "").trim();
  if (!value) return "—";
  return value.startsWith("#") ? value : `#${value}`;
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getTitle(scan: ScanRecord) {
  return String(scan.title ?? "").trim();
}

function getImageUrl(scan: ScanRecord) {
  const direct =
    scan.frontImageUrl ||
    scan.front_url ||
    scan.frontUrl ||
    scan.imageUrl ||
    null;

  if (direct) return direct;

  const key = scan.front_key || scan.frontKey || null;
  if (!key) return null;

  return r2PublicUrl(key);
}

function extractSeriesMatch(scans: ScanRecord[], rawSeriesId: string) {
  const decoded = safeDecode(rawSeriesId);
  const normalizedTarget = normalizeText(decoded);
  const slugTarget = slugify(decoded);

  const matched = scans.filter((scan) => {
    const title = getTitle(scan);
    if (!title) return false;

    const normalizedTitle = normalizeText(title);
    const slugTitle = slugify(title);

    return (
      title === decoded ||
      normalizedTitle === normalizedTarget ||
      slugTitle === slugTarget
    );
  });

  if (matched.length > 0) {
    return matched;
  }

  return [];
}

function sortIssues(scans: ScanRecord[]) {
  return [...scans].sort((a, b) => {
    const aIssueRaw = String(a.issue ?? "").replace("#", "").trim();
    const bIssueRaw = String(b.issue ?? "").replace("#", "").trim();

    const aNum = Number(aIssueRaw);
    const bNum = Number(bIssueRaw);

    const aIsNum = !Number.isNaN(aNum);
    const bIsNum = !Number.isNaN(bNum);

    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;

    return aIssueRaw.localeCompare(bIssueRaw);
  });
}

export default function SeriesDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seriesId?: string }>();

  const rawSeriesId = typeof params.seriesId === "string" ? params.seriesId : "";

  const [allScans, setAllScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSeries = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const result = await fetchScans(DEFAULT_GROUP_ID);

      const scans: ScanRecord[] = Array.isArray(result)
        ? result
        : Array.isArray((result as any)?.scans)
        ? (result as any).scans
        : Array.isArray((result as any)?.items)
        ? (result as any).items
        : Array.isArray((result as any)?.data)
        ? (result as any).data
        : [];

      setAllScans(scans);
    } catch (err: any) {
      setError(err?.message || "Unable to load this series.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSeries();
    }, [loadSeries])
  );

  const matchedSeriesScans = useMemo(() => {
    if (!rawSeriesId) return [];
    return sortIssues(extractSeriesMatch(allScans, rawSeriesId));
  }, [allScans, rawSeriesId]);

  const resolvedSeriesTitle = useMemo(() => {
    if (matchedSeriesScans.length > 0) {
      return getTitle(matchedSeriesScans[0]);
    }
    return safeDecode(rawSeriesId || "Series");
  }, [matchedSeriesScans, rawSeriesId]);

  const renderIssueCard = ({ item }: { item: ScanRecord }) => {
    const imageUrl = getImageUrl(item);
    const publisher = item.publisher ? String(item.publisher) : "";
    const year =
      item.year !== null && item.year !== undefined && String(item.year).trim()
        ? String(item.year).trim()
        : "";

    const metaLine =
      publisher && year
        ? `${publisher} • ${year}`
        : publisher
        ? publisher
        : year
        ? year
        : "Saved in vault";

    return (
      <Pressable
        style={styles.issueCard}
        onPress={() => router.push(`/comic/${item.id}`)}
      >
        <View style={styles.issueCoverWrap}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              resizeMode="cover"
              style={styles.issueCover}
            />
          ) : (
            <View style={styles.issueCoverPlaceholder}>
              <Ionicons name="image-outline" size={28} color="#7A97AA" />
              <Text style={styles.issueCoverPlaceholderText}>No Cover</Text>
            </View>
          )}
        </View>

        <View style={styles.issueBody}>
          <Text style={styles.issueNumber}>{toDisplayIssue(item.issue)}</Text>
          <Text style={styles.issueMeta}>{metaLine}</Text>

          {!!item.variant && (
            <Text style={styles.issueVariant} numberOfLines={1}>
              {String(item.variant)}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={22} color="#7FA5C2" />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={20} color="#EAF4FF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {resolvedSeriesTitle || "Series"}
          </Text>
          <Text style={styles.headerSub}>
            {matchedSeriesScans.length === 1
              ? "1 issue"
              : `${matchedSeriesScans.length} issues`}
          </Text>
        </View>

        <Pressable style={styles.iconBtn} onPress={() => router.push("/")}>
          <Ionicons name="home-outline" size={20} color="#EAF4FF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#4FA8FF" />
          <Text style={styles.stateTitle}>Loading series</Text>
          <Text style={styles.stateCopy}>
            Pulling this title from your vault.
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Load failed</Text>
          <Text style={styles.stateCopy}>{error}</Text>

          <Pressable style={styles.retryBtn} onPress={() => void loadSeries()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </Pressable>
        </View>
      ) : matchedSeriesScans.length === 0 ? (
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Series not found</Text>
          <Text style={styles.stateCopy}>
            This series could not be loaded from your vault.
          </Text>

          <Pressable
            style={styles.retryBtn}
            onPress={() => router.push("/collection")}
          >
            <Text style={styles.retryBtnText}>Back to Vault</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={matchedSeriesScans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderIssueCard}
          ListHeaderComponent={
            <View style={styles.heroCard}>
              <Text style={styles.heroKicker}>SERIES</Text>
              <Text style={styles.heroTitle}>{resolvedSeriesTitle}</Text>
              <Text style={styles.heroCopy}>
                All saved issues for this run. Tap any issue to open comic
                details.
              </Text>
            </View>
          }
        />
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
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#102733",
    borderWidth: 1,
    borderColor: "#173545",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: "#F4FAFF",
    fontSize: 24,
    fontWeight: "900",
  },
  headerSub: {
    color: "#8CAEC2",
    fontSize: 13,
    marginTop: 2,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  stateTitle: {
    color: "#F4FAFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center",
  },
  stateCopy: {
    color: "#8CAEC2",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10,
  },
  retryBtn: {
    marginTop: 20,
    minHeight: 54,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 18,
    marginTop: 6,
    marginBottom: 6,
  },
  heroKicker: {
    color: "#7FB4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  heroCopy: {
    color: "#9AB7C9",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
  },
  issueCard: {
    backgroundColor: "#102733",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  issueCoverWrap: {
    width: 68,
    height: 92,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#08161E",
  },
  issueCover: {
    width: "100%",
    height: "100%",
  },
  issueCoverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  issueCoverPlaceholderText: {
    color: "#7A97AA",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 6,
  },
  issueBody: {
    flex: 1,
    gap: 5,
  },
  issueNumber: {
    color: "#F4FAFF",
    fontSize: 22,
    fontWeight: "900",
  },
  issueMeta: {
    color: "#8CAEC2",
    fontSize: 14,
    lineHeight: 20,
  },
  issueVariant: {
    color: "#9BC7FF",
    fontSize: 13,
    fontWeight: "700",
  },
});