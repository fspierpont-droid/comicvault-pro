import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteScan,
  fetchScanById,
  r2PublicUrl,
  type ScanRecord,
} from "@/lib/api";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

function labelFromGrade(grade?: string | null) {
  if (!grade) return "Unrated";

  const n = Number(grade);
  if (Number.isNaN(n)) return "Estimated grade";

  if (n >= 9.8) return "Near Mint/Mint";
  if (n >= 9.2) return "Near Mint-";
  if (n >= 8.0) return "Very Fine";
  if (n >= 6.0) return "Fine";
  if (n >= 4.0) return "Very Good";
  if (n >= 2.0) return "Good";
  return "Fair / Poor";
}

function formatCreatedAt(value?: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function ComicDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [showBackCover, setShowBackCover] = useState(false);

  const load = useCallback(async () => {
    try {
      if (!scanId) {
        setScan(null);
        return;
      }

      const record = await fetchScanById(scanId);
      setScan(record);
    } catch (error: any) {
      Alert.alert(
        "Load failed",
        error?.message || "Unable to load this comic record."
      );
      setScan(null);
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const frontUrl = useMemo(() => {
    if (!scan?.frontKey) return null;
    return r2PublicUrl(scan.frontKey);
  }, [scan?.frontKey]);

  const backUrl = useMemo(() => {
    if (!scan?.backKey) return null;
    return r2PublicUrl(scan.backKey);
  }, [scan?.backKey]);

  const gradeValue = scan?.grade?.mostLikely || null;
  const gradeLabel = scan?.grade?.label || labelFromGrade(gradeValue);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/collection");
  }, [router]);

  const openGrade = useCallback(() => {
    if (!scan?.id) return;

    router.push(`/grade/${scan.id}`);
  }, [router, scan]);

  const handleDelete = useCallback(() => {
    if (!scan?.id) return;

    Alert.alert(
      "Delete this book?",
      `${scan.title} #${scan.issue} will be permanently removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteScan(scan.id);
              router.replace("/collection");
            } catch (error: any) {
              Alert.alert(
                "Delete failed",
                error?.message || "Unable to delete."
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [scan, router]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.headerBtn} onPress={handleBack}>
          <Ionicons name="arrow-back-outline" size={20} color="#EAF4FF" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Comic Details</Text>
          <Text style={styles.headerSub}>Collector dossier</Text>
        </View>

        <Pressable style={styles.headerBtn} onPress={() => router.push("/")}>
          <Ionicons name="home-outline" size={20} color="#EAF4FF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#4FA8FF" />
          <Text style={styles.loaderText}>Loading comic...</Text>
        </View>
      ) : !scan ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Comic not found</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.coverCard}>
            {showBackCover && backUrl ? (
              <Image source={{ uri: backUrl }} style={styles.cover} />
            ) : frontUrl ? (
              <Image source={{ uri: frontUrl }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Ionicons name="image-outline" size={40} color="#5F7D90" />
                <Text style={styles.placeholderText}>No Cover</Text>
              </View>
            )}

            <View style={styles.toggleRow}>
              <Pressable onPress={() => setShowBackCover(false)}>
                <Text style={styles.toggle}>Front</Text>
              </Pressable>
              <Pressable
                disabled={!backUrl}
                onPress={() => backUrl && setShowBackCover(true)}
              >
                <Text style={styles.toggle}>Back</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{scan.title}</Text>
            <Text style={styles.issue}>#{scan.issue}</Text>
            <Text style={styles.meta}>
              Added {formatCreatedAt(scan.createdAt)}
            </Text>
          </View>

          <View style={styles.gradeCard}>
            <Text style={styles.gradeValue}>{gradeValue || "-"}</Text>
            <Text style={styles.gradeLabel}>{gradeLabel}</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={openGrade}>
            <Text style={styles.primaryBtnText}>Grade This Book</Text>
          </Pressable>

          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#071821" },

  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  headerBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#102733",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitleWrap: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  headerSub: { color: "#8CAEC2", fontSize: 13 },

  loaderWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  loaderText: { color: "#9AB7C9" },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#fff", fontSize: 20 },

  content: { padding: 20, gap: 16 },

  coverCard: { backgroundColor: "#102733", padding: 16, borderRadius: 20 },
  cover: { width: "100%", height: 420, borderRadius: 16 },
  coverPlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#5F7D90" },

  toggleRow: { flexDirection: "row", gap: 12, marginTop: 10 },
  toggle: { color: "#7FB4FF" },

  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  issue: { color: "#9BC7FF", fontSize: 20 },
  meta: { color: "#8CAEC2", marginTop: 6 },

  gradeCard: {
    backgroundColor: "#102733",
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
  },
  gradeValue: { color: "#fff", fontSize: 48, fontWeight: "900" },
  gradeLabel: { color: "#DCEAFF" },

  primaryBtn: {
    backgroundColor: "#1E66F5",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  deleteBtn: {
    backgroundColor: "#A62C2C",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  deleteBtnText: { color: "#fff", fontWeight: "900" },
});