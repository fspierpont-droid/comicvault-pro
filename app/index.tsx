import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { fetchScans, r2PublicUrl, type ScanRecord } from "@/lib/api";

function CoverThumb({
  frontKey,
  style,
}: {
  frontKey?: string | null;
  style?: any;
}) {
  const uri = frontKey ? r2PublicUrl(frontKey) : null;

  if (!uri) {
    return (
      <View style={[styles.coverFallback, style]}>
        <Ionicons name="image-outline" size={34} color="#6F8A9C" />
        <Text style={styles.coverFallbackText}>No Cover</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={[styles.coverImage, style]}
    />
  );
}

function isKeyIssue(scan: ScanRecord) {
  const title = `${scan.title || ""}`.toLowerCase();
  const issue = `${scan.issue || ""}`.trim();
  const facts = (scan.keyFacts || []).join(" ").toLowerCase();
  const reasoning = `${scan.recognitionReasoning || ""}`.toLowerCase();

  if (facts.includes("key") || reasoning.includes("key issue")) return true;
  if (scan.estimatedValue && scan.estimatedValue >= 100) return true;

  const keyIssueNumbers = new Set(["1", "0", "100", "300"]);
  if (keyIssueNumbers.has(issue)) return true;

  if (
    title.includes("amazing fantasy") ||
    title.includes("hulk") ||
    title.includes("spider-man") ||
    title.includes("x-men") ||
    title.includes("fantastic four") ||
    title.includes("iron man") ||
    title.includes("avengers") ||
    title.includes("batman")
  ) {
    if (keyIssueNumbers.has(issue)) return true;
  }

  return false;
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "$—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function hasGrade(scan: ScanRecord) {
  return !!scan.grade?.mostLikely || !!scan.grade?.label;
}

function gradeDisplay(scan: ScanRecord) {
  return scan.grade?.mostLikely || scan.grade?.label || "Not graded yet";
}

export default function IndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      try {
        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);

        setLoadError(null);

        const rows = await fetchScans("my-vault");

        const sorted = [...rows].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        setScans(sorted);
      } catch (error: any) {
        setLoadError(error?.message || "Unable to load dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard("initial");
    }, [loadDashboard])
  );

  const totalBooks = scans.length;

  const totalSeries = useMemo(() => {
    const set = new Set(
      scans
        .map((scan) => `${scan.title || ""}`.trim().toLowerCase())
        .filter(Boolean)
    );

    return set.size;
  }, [scans]);

  const keyIssues = useMemo(() => {
    return scans.filter(isKeyIssue);
  }, [scans]);

  const totalEstimatedValue = useMemo(() => {
    return scans.reduce((sum, scan) => {
      const value =
        typeof scan.estimatedValue === "number" &&
        Number.isFinite(scan.estimatedValue)
          ? scan.estimatedValue
          : 0;

      return sum + value;
    }, 0);
  }, [scans]);

  const recentScans = useMemo(() => scans.slice(0, 6), [scans]);

  const gradedBooks = useMemo(() => {
    return scans.filter(hasGrade).length;
  }, [scans]);

  const missingCovers = useMemo(() => {
    return scans.filter((scan) => !scan.frontKey).length;
  }, [scans]);

  const ungradedBooks = useMemo(() => {
    return scans.filter((scan) => !hasGrade(scan)).length;
  }, [scans]);

  const readyForMarketSync = useMemo(() => {
    return scans.filter(
      (scan) => !!scan.frontKey && !!scan.title && !!scan.issue
    ).length;
  }, [scans]);

  const gradeTarget = useMemo(() => {
    const firstUngraded = scans.find((scan) => !hasGrade(scan) && !!scan.id);
    if (firstUngraded?.id) return `/grade/${firstUngraded.id}`;

    const firstSaved = scans.find((scan) => !!scan.id);
    if (firstSaved?.id) return `/comic/${firstSaved.id}`;

    return "/capture";
  }, [scans]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard("refresh")}
            tintColor="#7FB4FF"
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>ComicVault</Text>
            <Text style={styles.headerSub}>Collector command center</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => router.push("/capture")}
            >
              <Ionicons name="scan-outline" size={22} color="#EAF4FF" />
            </Pressable>

            <Pressable
              style={styles.headerIconBtn}
              onPress={() => router.push("/collection")}
            >
              <Ionicons name="briefcase-outline" size={22} color="#EAF4FF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.valueCard}>
          <Text style={styles.sectionKicker}>COLLECTION VALUE</Text>
          <Text style={styles.valueAmount}>
            {formatMoney(totalEstimatedValue)}
          </Text>
          <Text style={styles.valueSub}>
            {totalEstimatedValue > 0
              ? "Based on books with saved estimates"
              : "Market pricing comes next"}
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{totalBooks}</Text>
              <Text style={styles.metricLabel}>Books</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{totalSeries}</Text>
              <Text style={styles.metricLabel}>Series</Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{keyIssues.length}</Text>
              <Text style={styles.metricLabel}>Keys</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            style={styles.primaryTile}
            onPress={() => router.push("/capture")}
          >
            <Ionicons name="scan-outline" size={24} color="#FFFFFF" />
            <Text style={styles.primaryTileTitle}>Scan Comic</Text>
            <Text style={styles.primaryTileCopy}>
              Identify a book and move it into the vault fast
            </Text>
          </Pressable>

          <View style={styles.sideTiles}>
            <Pressable
              style={styles.secondaryTile}
              onPress={() => router.push("/collection")}
            >
              <Ionicons name="briefcase-outline" size={22} color="#B9D7FF" />
              <Text style={styles.secondaryTileTitle}>Open Vault</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryTile}
              onPress={() => router.push(gradeTarget as any)}
            >
              <Ionicons name="sparkles-outline" size={22} color="#B9D7FF" />
              <Text style={styles.secondaryTileTitle}>Grade Book</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Needs attention</Text>
          <Pressable onPress={() => router.push("/collection")}>
            <Text style={styles.sectionLink}>Open Vault</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ungraded books</Text>
            <Text style={styles.infoValue}>{ungradedBooks}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Missing front covers</Text>
            <Text style={styles.infoValue}>{missingCovers}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ready for market sync</Text>
            <Text style={styles.infoValue}>{readyForMarketSync}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Key issues in your vault</Text>
          <Pressable onPress={() => router.push("/collection")}>
            <Text style={styles.sectionLink}>Open Vault</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.placeholderCard}>
            <ActivityIndicator size="large" color="#4FA8FF" />
            <Text style={styles.placeholderText}>Loading dashboard...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.placeholderCard}>
            <Text style={styles.errorText}>{loadError}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => void loadDashboard("initial")}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : keyIssues.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No key issues detected yet. Scan more books and ComicVault will
              surface them here.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {keyIssues.slice(0, 8).map((scan) => (
              <Pressable
                key={scan.id}
                style={styles.scanCard}
                onPress={() => router.push(`/comic/${scan.id}`)}
              >
                <CoverThumb frontKey={scan.frontKey} style={styles.scanCover} />
                <Text style={styles.scanCardTitle} numberOfLines={2}>
                  {scan.title} #{scan.issue}
                </Text>
                <Text style={styles.scanCardSub} numberOfLines={1}>
                  {scan.publisher || "Unknown publisher"}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent scans</Text>
          <Pressable onPress={() => router.push("/collection")}>
            <Text style={styles.sectionLink}>Open Vault</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.placeholderCard}>
            <ActivityIndicator size="large" color="#4FA8FF" />
            <Text style={styles.placeholderText}>Loading recent scans...</Text>
          </View>
        ) : recentScans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Your vault is empty. Start by scanning your first book.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {recentScans.map((scan) => (
              <Pressable
                key={scan.id}
                style={styles.scanCard}
                onPress={() => router.push(`/comic/${scan.id}`)}
              >
                <CoverThumb frontKey={scan.frontKey} style={styles.scanCover} />
                <Text style={styles.scanCardTitle} numberOfLines={2}>
                  {scan.title} #{scan.issue}
                </Text>
                <Text style={styles.scanCardSub} numberOfLines={1}>
                  {gradeDisplay(scan)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Text style={styles.sectionTitle}>Collection breakdown</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Series tracked</Text>
            <Text style={styles.infoValue}>{totalSeries}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Books scanned</Text>
            <Text style={styles.infoValue}>{totalBooks}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Key issues found</Text>
            <Text style={styles.infoValue}>{keyIssues.length}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Books with saved grade</Text>
            <Text style={styles.infoValue}>{gradedBooks}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#041821",
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  headerTextWrap: {
    flex: 1,
    paddingTop: 2,
  },
  headerTitle: {
    color: "#F4FAFF",
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  headerSub: {
    color: "#86A8BC",
    fontSize: 15,
    marginTop: 4,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerIconBtn: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#0B2230",
    borderWidth: 1,
    borderColor: "#16384B",
    alignItems: "center",
    justifyContent: "center",
  },
  valueCard: {
    backgroundColor: "#102A39",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#173B4C",
    padding: 20,
  },
  sectionKicker: {
    color: "#7FB4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  valueAmount: {
    color: "#FFFFFF",
    fontSize: 62,
    fontWeight: "900",
    marginTop: 12,
    lineHeight: 66,
  },
  valueSub: {
    color: "#91AFC0",
    fontSize: 15,
    marginTop: 6,
    marginBottom: 18,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "#0B2230",
    borderRadius: 22,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#B1C8D8",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 16,
  },
  primaryTile: {
    flex: 1.55,
    minHeight: 220,
    backgroundColor: "#2D69F0",
    borderRadius: 28,
    padding: 22,
    justifyContent: "space-between",
  },
  primaryTileTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 14,
  },
  primaryTileCopy: {
    color: "#EAF2FF",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 240,
  },
  sideTiles: {
    flex: 1,
    gap: 16,
  },
  secondaryTile: {
    flex: 1,
    minHeight: 102,
    backgroundColor: "#0D2432",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#17384A",
    padding: 18,
    justifyContent: "space-between",
  },
  secondaryTileTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: "#F4FAFF",
    fontSize: 26,
    fontWeight: "900",
  },
  sectionLink: {
    color: "#7FB4FF",
    fontSize: 14,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#102A39",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173B4C",
    padding: 18,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 34,
  },
  infoLabel: {
    flex: 1,
    color: "#A9C0CF",
    fontSize: 15,
    lineHeight: 22,
  },
  infoValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "#183B4C",
    marginVertical: 12,
  },
  horizontalList: {
    gap: 14,
    paddingRight: 20,
  },
  scanCard: {
    width: 184,
    backgroundColor: "#102A39",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173B4C",
    padding: 14,
  },
  scanCover: {
    width: "100%",
    height: 248,
    borderRadius: 18,
    marginBottom: 12,
  },
  coverImage: {
    backgroundColor: "#08161E",
  },
  coverFallback: {
    backgroundColor: "#08161E",
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallbackText: {
    color: "#718B9E",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10,
  },
  scanCardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  scanCardSub: {
    color: "#93B0C2",
    fontSize: 13,
    marginTop: 6,
  },
  placeholderCard: {
    minHeight: 160,
    backgroundColor: "#102A39",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173B4C",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  placeholderText: {
    color: "#DCEAFF",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 12,
  },
  errorText: {
    color: "#FFD0D0",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#1E66F5",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#102A39",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173B4C",
    padding: 22,
  },
  emptyText: {
    color: "#9DB8C8",
    fontSize: 15,
    lineHeight: 25,
  },
});