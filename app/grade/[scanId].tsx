import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchScanById, r2PublicUrl, type ScanRecord } from "@/lib/api";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

function getGradeLabel(value: string) {
  const n = Number(value);

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

export default function GradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();

  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [grade, setGrade] = useState("9.0");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    try {
      if (!scanId) {
        setScan(null);
        return;
      }

      const record = await fetchScanById(scanId);
      setScan(record);

      if (record?.grade?.mostLikely) {
        setGrade(String(record.grade.mostLikely));
      }

      if (record?.grade?.notes?.length) {
        setNotes(record.grade.notes.join(", "));
      }
    } catch (error: any) {
      Alert.alert(
        "Load failed",
        error?.message || "Unable to load this grading record."
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

  const coverUrl = useMemo(() => {
    if (!scan?.frontKey) return null;
    return r2PublicUrl(scan.frontKey);
  }, [scan?.frontKey]);

  const gradeLabel = useMemo(() => getGradeLabel(grade), [grade]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (scan?.id) {
      router.replace(`/comic/${scan.id}`);
      return;
    }

    router.replace("/collection");
  }, [router, scan]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.headerBtn} onPress={handleBack}>
          <Ionicons name="arrow-back-outline" size={20} color="#EAF4FF" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Grade Review</Text>
          <Text style={styles.headerSub}>Review scan and prep for vault</Text>
        </View>

        <Pressable style={styles.headerBtn} onPress={() => router.push("/")}>
          <Ionicons name="home-outline" size={20} color="#EAF4FF" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#4FA8FF" />
          <Text style={styles.loaderText}>Loading grade review...</Text>
        </View>
      ) : !scan ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Scan not found</Text>
          <Text style={styles.emptyText}>
            This grading record could not be loaded.
          </Text>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.replace("/collection")}
          >
            <Text style={styles.secondaryBtnText}>Open Collection</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.coverCard}>
            {coverUrl ? (
              <Image
                source={{ uri: coverUrl }}
                resizeMode="contain"
                style={styles.cover}
              />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Ionicons name="image-outline" size={36} color="#5F7D90" />
                <Text style={styles.placeholderText}>No Cover Image</Text>
              </View>
            )}

            <View style={styles.bookMeta}>
              <Text style={styles.title}>{scan.title}</Text>
              <Text style={styles.issue}>#{scan.issue}</Text>
              <Text style={styles.meta}>
                Added {formatCreatedAt(scan.createdAt)} • My Vault
              </Text>
            </View>
          </View>

          <View style={styles.gradeCard}>
            <Text style={styles.kicker}>CURRENT GRADE</Text>
            <Text style={styles.gradeValue}>{grade}</Text>
            <Text style={styles.gradeLabel}>{gradeLabel}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Set Grade</Text>
            <Text style={styles.sectionText}>
              Start with your current estimate. Later this will be replaced with
              the full grading engine and saved to the backend.
            </Text>

            <Text style={styles.inputLabel}>Grade</Text>
            <TextInput
              value={grade}
              onChangeText={setGrade}
              keyboardType="decimal-pad"
              placeholder="9.0"
              placeholderTextColor="#5F7D90"
              style={styles.input}
            />

            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Spine ticks, corner wear, gloss, color breaks..."
              placeholderTextColor="#5F7D90"
              style={[styles.input, styles.notesInput]}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>What comes next</Text>
            <Text style={styles.bullet}>• Save grade to this comic record</Text>
            <Text style={styles.bullet}>• Defect checklist by category</Text>
            <Text style={styles.bullet}>• AI-assisted grading workflow</Text>
            <Text style={styles.bullet}>• Market value and comps</Text>
          </View>

          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              Alert.alert(
                "Not wired yet",
                "The grade screen is working. Saving grade data is the next backend step."
              )
            }
          >
            <Text style={styles.primaryBtnText}>Save Grade</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push(`/comic/${scan.id}`)}
          >
            <Text style={styles.secondaryBtnText}>Back to Comic</Text>
          </Pressable>
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
    paddingBottom: 10,
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
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loaderText: {
    color: "#9AB7C9",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    gap: 14,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
  },
  emptyText: {
    color: "#8CAEC2",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
  },
  coverCard: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    overflow: "hidden",
  },
  cover: {
    width: "100%",
    aspectRatio: 0.68,
    backgroundColor: "#08161E",
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  placeholderText: {
    color: "#5F7D90",
    fontSize: 13,
    fontWeight: "700",
  },
  bookMeta: {
    padding: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  issue: {
    color: "#DCEAFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  meta: {
    color: "#8CAEC2",
    fontSize: 14,
    marginTop: 8,
  },
  gradeCard: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    paddingVertical: 20,
    alignItems: "center",
  },
  kicker: {
    color: "#7FB4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  gradeValue: {
    color: "#FFFFFF",
    fontSize: 56,
    fontWeight: "900",
    marginTop: 8,
  },
  gradeLabel: {
    color: "#DCEAFF",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  formCard: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 18,
  },
  infoCard: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 18,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionText: {
    color: "#9AB7C9",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  inputLabel: {
    color: "#DCEAFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#08161E",
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 120,
    paddingTop: 14,
    fontSize: 16,
    fontWeight: "500",
  },
  bullet: {
    color: "#DCEAFF",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 4,
  },
  primaryBtn: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  secondaryBtn: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#102733",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#DCEAFF",
    fontSize: 16,
    fontWeight: "800",
  },
});