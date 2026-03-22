import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { createScan, recognizeCover, uploadImage } from "@/lib/api";
import { cropComic } from "@/lib/cropComic";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

type RecognitionState = {
  title: string;
  issue: string;
  publisher?: string | null;
  year?: string | number | null;
  variant?: string | null;
  reasoning?: string | null;
  confidence?: number | null;
  keyFacts?: string[];
};

const DEFAULT_GROUP_ID = "my-vault";

const initialRecognition: RecognitionState = {
  title: "",
  issue: "",
  publisher: null,
  year: null,
  variant: null,
  reasoning: null,
  confidence: null,
  keyFacts: [],
};

function safeDecodeURIComponent(value?: string | string[]) {
  if (!value) return "";
  const raw = Array.isArray(value) ? value[0] : value;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function buildStorageKey(kind: "front" | "back", ext = "jpg") {
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `uploads/${stamp}-${rand}-${kind}.${ext}`;
}

function inferExtensionFromUri(uri?: string | null) {
  if (!uri) return "jpg";

  const clean = uri.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "png";
  if (clean.endsWith(".webp")) return "webp";
  return "jpg";
}

function inferMimeType(uri?: string | null) {
  if (!uri) return "image/jpeg";

  const clean = uri.toLowerCase().split("?")[0];
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    frontUri?: string;
    backUri?: string;
  }>();

  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri, setBackUri] = useState<string | null>(null);

  const [recognition, setRecognition] =
    useState<RecognitionState>(initialRecognition);

  const [title, setTitle] = useState("");
  const [issue, setIssue] = useState("");

  const [showReasoning, setShowReasoning] = useState(true);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isPreparingFront, setIsPreparingFront] = useState(false);

  const lastHandledFrontParamRef = useRef<string | null>(null);
  const lastHandledBackParamRef = useRef<string | null>(null);

  const busy = isPreparingFront || isIdentifying || isSaving;

  const identifyFront = useCallback(async (uri: string) => {
    try {
      setIsIdentifying(true);

      const result = await recognizeCover({
        uri,
        mimeType: inferMimeType(uri),
      });

      const nextRecognition: RecognitionState = {
        title: String(result?.title || "").trim(),
        issue: String(result?.issue || "").trim(),
        publisher: result?.publisher ? String(result.publisher) : null,
        year:
          result?.year !== undefined && result?.year !== null
            ? String(result.year)
            : null,
        variant: result?.variant ? String(result.variant) : null,
        reasoning: result?.reasoning ? String(result.reasoning) : null,
        confidence:
          typeof result?.confidence === "number" ? result.confidence : null,
        keyFacts: Array.isArray(result?.keyFacts)
          ? result.keyFacts.map((x: unknown) => String(x))
          : [],
      };

      setRecognition(nextRecognition);
      setTitle(nextRecognition.title || "");
      setIssue(nextRecognition.issue || "");
    } catch (error: any) {
      Alert.alert(
        "AI recognition failed",
        error?.message || "Unable to identify this comic."
      );
      setRecognition(initialRecognition);
    } finally {
      setIsIdentifying(false);
    }
  }, []);

  const prepareFrontImage = useCallback(
    async (uri: string) => {
      try {
        setIsPreparingFront(true);
        setRecognition(initialRecognition);
        setShowReasoning(true);
        setTitle("");
        setIssue("");

        const processedUri = await cropComic(uri);
        setFrontUri(processedUri);

        await identifyFront(processedUri);
      } catch (error: any) {
        Alert.alert(
          "Image processing failed",
          error?.message || "Unable to prepare this front cover."
        );
      } finally {
        setIsPreparingFront(false);
      }
    },
    [identifyFront]
  );

  useEffect(() => {
    const decoded = safeDecodeURIComponent(params.frontUri);
    if (!decoded) return;
    if (lastHandledFrontParamRef.current === decoded) return;

    lastHandledFrontParamRef.current = decoded;
    void prepareFrontImage(decoded);
  }, [params.frontUri, prepareFrontImage]);

  useEffect(() => {
    const decoded = safeDecodeURIComponent(params.backUri);
    if (!decoded) return;
    if (lastHandledBackParamRef.current === decoded) return;

    lastHandledBackParamRef.current = decoded;
    setBackUri(decoded);
  }, [params.backUri]);

  const hasRecognition = useMemo(() => {
    return !!recognition.title || !!recognition.issue;
  }, [recognition]);

  const goCaptureFront = useCallback(() => {
    router.push({
      pathname: "/capture",
      params: { side: "front" },
    });
  }, [router]);

  const goCaptureBack = useCallback(() => {
    router.push({
      pathname: "/capture",
      params: {
        side: "back",
        frontUri: frontUri ? encodeURIComponent(frontUri) : "",
      },
    });
  }, [frontUri, router]);

  const pickFrontFromLibrary = useCallback(async () => {
    try {
      setIsPicking(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo library permission needed",
          "ComicVault needs photo access so you can choose a front cover."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error("No image selected.");
      }

      await prepareFrontImage(asset.uri);
    } catch (error: any) {
      Alert.alert(
        "Library import failed",
        error?.message || "Unable to choose image."
      );
    } finally {
      setIsPicking(false);
    }
  }, [prepareFrontImage]);

  const pickBackFromLibrary = useCallback(async () => {
    try {
      setIsPicking(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo library permission needed",
          "ComicVault needs photo access so you can choose a back cover."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error("No image selected.");
      }

      setBackUri(asset.uri);
    } catch (error: any) {
      Alert.alert(
        "Library import failed",
        error?.message || "Unable to choose image."
      );
    } finally {
      setIsPicking(false);
    }
  }, []);

  const saveScanRecord = useCallback(async () => {
    if (!frontUri) {
      throw new Error("Front cover image is missing.");
    }

    if (!title.trim()) {
      throw new Error("Comic title is missing.");
    }

    if (!issue.trim()) {
      throw new Error("Issue number is missing.");
    }

    const frontExt = inferExtensionFromUri(frontUri);
    const frontKey = buildStorageKey("front", frontExt);

    const frontUpload = await uploadImage({
      key: frontKey,
      uri: frontUri,
      mimeType: inferMimeType(frontUri),
    });

    let backKey: string | null = null;
    let backUrl: string | null = null;

    if (backUri) {
      const backExt = inferExtensionFromUri(backUri);
      backKey = buildStorageKey("back", backExt);

      const backUpload = await uploadImage({
        key: backKey,
        uri: backUri,
        mimeType: inferMimeType(backUri),
      });

      backUrl = (backUpload as any)?.url || null;
    }

    const payload: any = {
      groupId: DEFAULT_GROUP_ID,
      title: title.trim(),
      issue: issue.trim(),
      publisher: recognition.publisher || null,
      year: recognition.year ? String(recognition.year) : null,
      variant: recognition.variant || null,
      frontKey,
      backKey,
      frontUrl: (frontUpload as any)?.url || null,
      backUrl,
      recognitionReasoning: recognition.reasoning || null,
      recognitionConfidence:
        typeof recognition.confidence === "number"
          ? recognition.confidence
          : null,
      keyFacts: recognition.keyFacts || [],
    };

    const created = await createScan(payload);

    const savedId =
      (created as any)?.scan?.id ||
      (created as any)?.id ||
      (created as any)?.data?.id ||
      (created as any)?.scanId ||
      null;

    return {
      savedId,
      created,
    };
  }, [backUri, frontUri, issue, recognition, title]);

  const handleSaveToVault = useCallback(async () => {
    try {
      setIsSaving(true);

      const { savedId, created } = await saveScanRecord();

      if (!savedId) {
        console.log("CreateScan response:", created);
        Alert.alert(
          "Saved to vault",
          "The book was saved, but the API did not return a record id. Refresh the vault and it should appear there."
        );
        router.push("/collection");
        return;
      }

      router.push(`/comic/${savedId}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message || "Unable to save scan.");
    } finally {
      setIsSaving(false);
    }
  }, [router, saveScanRecord]);

  const handleGradeNow = useCallback(async () => {
    try {
      setIsSaving(true);

      const { savedId, created } = await saveScanRecord();

      if (!savedId) {
        console.log("CreateScan response:", created);
        Alert.alert(
          "Saved to vault",
          "The book saved, but the API did not return a record id for grading. Open it from the vault and start grading there."
        );
        router.push("/collection");
        return;
      }

      router.push(`/grade/${savedId}`);
    } catch (error: any) {
      Alert.alert("Save failed", error?.message || "Unable to save scan.");
    } finally {
      setIsSaving(false);
    }
  }, [router, saveScanRecord]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
        >
          <Ionicons name="arrow-back-outline" size={20} color="#EAF4FF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Scan Comic</Text>
          <Text style={styles.headerSub}>
            Identify first, then save to vault or grade now
          </Text>
        </View>

        <Pressable style={styles.iconBtn} onPress={() => router.push("/")}>
          <Ionicons name="home-outline" size={20} color="#EAF4FF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!frontUri ? (
          <View style={styles.captureHero}>
            <Text style={styles.captureKicker}>STEP 1</Text>
            <Text style={styles.captureTitle}>Front Cover</Text>
            <Text style={styles.captureCopy}>
              Use the full-screen camera or load a comic from your library.
            </Text>

            <View style={styles.captureActions}>
              <Pressable
                style={styles.primaryAction}
                onPress={goCaptureFront}
                disabled={isPicking}
              >
                <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>
                  Open Full-Screen Scanner
                </Text>
              </Pressable>

              <Pressable
                style={styles.secondaryAction}
                onPress={pickFrontFromLibrary}
                disabled={isPicking}
              >
                <Ionicons name="images-outline" size={20} color="#DCEAFF" />
                <Text style={styles.secondaryActionText}>
                  Front From Library
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.stepKicker}>STEP 1</Text>
              <Text style={styles.cardTitle}>Front Cover</Text>
              <Text style={styles.cardSub}>
                This preview is now using the processed front image that gets
                sent into recognition and saved to the vault.
              </Text>

              {isPreparingFront ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator size="large" color="#4FA8FF" />
                  <Text style={styles.loadingTitle}>Preparing cover</Text>
                  <Text style={styles.loadingCopy}>
                    Normalizing the capture before ComicVault identifies the
                    book.
                  </Text>
                </View>
              ) : (
                <Image
                  source={{ uri: frontUri }}
                  resizeMode="contain"
                  style={styles.coverPreview}
                />
              )}

              <View style={styles.inlineActions}>
                <Pressable
                  style={styles.inlinePrimary}
                  onPress={goCaptureFront}
                  disabled={busy}
                >
                  <Text style={styles.inlinePrimaryText}>Retake Front</Text>
                </Pressable>

                <Pressable
                  style={styles.inlineSecondary}
                  onPress={pickFrontFromLibrary}
                  disabled={busy || isPicking}
                >
                  <Text style={styles.inlineSecondaryText}>Library</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.stepKicker}>STEP 2</Text>
              <Text style={styles.cardTitle}>AI Result</Text>

              {isIdentifying || isPreparingFront ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator size="large" color="#4FA8FF" />
                  <Text style={styles.loadingTitle}>Determining comic</Text>
                  <Text style={styles.loadingCopy}>
                    Reading the cover, issue number, publisher, and visible
                    cues.
                  </Text>
                </View>
              ) : hasRecognition ? (
                <>
                  <Text style={styles.positiveLine}>
                    AI identified this comic.
                  </Text>

                  <View style={styles.resultPanel}>
                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>TITLE</Text>
                      <Text style={styles.resultValue}>
                        {title || "Not identified"}
                      </Text>
                    </View>

                    <View style={styles.resultDivider} />

                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>ISSUE</Text>
                      <Text style={styles.resultValue}>
                        {issue ? `#${issue}` : "Not identified"}
                      </Text>
                    </View>

                    <View style={styles.resultDivider} />

                    <View style={styles.resultRow}>
                      <Text style={styles.resultLabel}>PUBLISHER</Text>
                      <Text style={styles.resultValue}>
                        {recognition.publisher || "Unknown"}
                      </Text>
                    </View>

                    {!!recognition.year && (
                      <>
                        <View style={styles.resultDivider} />
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>YEAR</Text>
                          <Text style={styles.resultValue}>
                            {String(recognition.year)}
                          </Text>
                        </View>
                      </>
                    )}

                    {typeof recognition.confidence === "number" && (
                      <>
                        <View style={styles.resultDivider} />
                        <View style={styles.resultRow}>
                          <Text style={styles.resultLabel}>CONFIDENCE</Text>
                          <Text style={styles.resultValue}>
                            {recognition.confidence.toFixed(2)}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {!!recognition.reasoning && (
                    <>
                      <Pressable
                        style={styles.reasoningToggle}
                        onPress={() => setShowReasoning((prev) => !prev)}
                      >
                        <Text style={styles.reasoningToggleText}>
                          {showReasoning ? "Hide Details" : "Show Details"}
                        </Text>
                      </Pressable>

                      {showReasoning && (
                        <Text style={styles.reasoningText}>
                          {recognition.reasoning}
                        </Text>
                      )}
                    </>
                  )}
                </>
              ) : (
                <View style={styles.warningPanel}>
                  <Text style={styles.warningText}>
                    AI could not identify this cover yet. You can still enter
                    the details manually below and save the book into your vault.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.stepKicker}>STEP 3</Text>
              <Text style={styles.cardTitle}>Confirm Details</Text>
              <Text style={styles.cardSub}>
                Edit title or issue only if the AI got it wrong.
              </Text>

              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Series title"
                placeholderTextColor="#5F7D90"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Issue #</Text>
              <TextInput
                value={issue}
                onChangeText={setIssue}
                placeholder="Issue number"
                placeholderTextColor="#5F7D90"
                style={styles.input}
              />

              <Text style={styles.collectionText}>Collection: My Vault</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.stepKicker}>OPTIONAL</Text>
              <Text style={styles.cardTitle}>Back Cover</Text>
              <Text style={styles.cardSub}>
                Add the back cover now or skip it and keep moving.
              </Text>

              {backUri ? (
                <>
                  <Image
                    source={{ uri: backUri }}
                    resizeMode="contain"
                    style={styles.backPreview}
                  />

                  <View style={styles.inlineActions}>
                    <Pressable
                      style={styles.inlinePrimary}
                      onPress={goCaptureBack}
                      disabled={busy}
                    >
                      <Text style={styles.inlinePrimaryText}>Retake Back</Text>
                    </Pressable>

                    <Pressable
                      style={styles.inlineSecondary}
                      onPress={pickBackFromLibrary}
                      disabled={busy || isPicking}
                    >
                      <Text style={styles.inlineSecondaryText}>Library</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.captureActions}>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={goCaptureBack}
                    disabled={busy}
                  >
                    <Ionicons name="camera-outline" size={20} color="#DCEAFF" />
                    <Text style={styles.secondaryActionText}>
                      Capture Back Cover
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryAction}
                    onPress={pickBackFromLibrary}
                    disabled={busy || isPicking}
                  >
                    <Ionicons name="images-outline" size={20} color="#DCEAFF" />
                    <Text style={styles.secondaryActionText}>
                      Back From Library
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>

            <Pressable
              style={[
                styles.bottomPrimary,
                busy && styles.bottomPrimaryDisabled,
              ]}
              onPress={handleSaveToVault}
              disabled={busy}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.bottomPrimaryText}>Save to Vault</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.bottomSecondary}
              onPress={handleGradeNow}
              disabled={busy}
            >
              <Text style={styles.bottomSecondaryText}>Save + Grade</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  captureHero: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 20,
    marginTop: 6,
  },
  captureKicker: {
    color: "#7FB4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  captureTitle: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 10,
  },
  captureCopy: {
    color: "#9AB7C9",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
    marginBottom: 20,
  },
  captureActions: {
    gap: 12,
  },
  primaryAction: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
  secondaryAction: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#0B1A22",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: "#DCEAFF",
    fontSize: 16,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 18,
  },
  stepKicker: {
    color: "#7FB4FF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
  },
  cardSub: {
    color: "#9AB7C9",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    marginBottom: 16,
  },
  coverPreview: {
    width: "100%",
    height: 520,
    borderRadius: 18,
    backgroundColor: "#08161E",
  },
  backPreview: {
    width: "100%",
    height: 420,
    borderRadius: 18,
    backgroundColor: "#08161E",
    marginBottom: 14,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  inlinePrimary: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
  },
  inlinePrimaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  inlineSecondary: {
    minWidth: 120,
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#0B1A22",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  inlineSecondaryText: {
    color: "#DCEAFF",
    fontSize: 15,
    fontWeight: "800",
  },
  loadingPanel: {
    minHeight: 180,
    borderRadius: 20,
    backgroundColor: "#0B1A22",
    borderWidth: 1,
    borderColor: "#173545",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 14,
  },
  loadingCopy: {
    color: "#9AB7C9",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  positiveLine: {
    color: "#9BC7FF",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  resultPanel: {
    borderRadius: 20,
    backgroundColor: "#0B1A22",
    borderWidth: 1,
    borderColor: "#173545",
    padding: 16,
  },
  resultRow: {
    gap: 6,
  },
  resultLabel: {
    color: "#7E9AAD",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  resultValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  resultDivider: {
    height: 1,
    backgroundColor: "#173545",
    marginVertical: 14,
  },
  reasoningToggle: {
    marginTop: 16,
    alignSelf: "flex-start",
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#0B1A22",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  reasoningToggleText: {
    color: "#9BC7FF",
    fontSize: 15,
    fontWeight: "800",
  },
  reasoningText: {
    color: "#B7CAD7",
    fontSize: 15,
    lineHeight: 26,
    marginTop: 16,
  },
  warningPanel: {
    borderRadius: 20,
    backgroundColor: "#0B1A22",
    borderWidth: 1,
    borderColor: "#173545",
    padding: 16,
  },
  warningText: {
    color: "#DCEAFF",
    fontSize: 15,
    lineHeight: 24,
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
    marginBottom: 14,
  },
  collectionText: {
    color: "#8CAEC2",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  bottomPrimary: {
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomPrimaryDisabled: {
    opacity: 0.7,
  },
  bottomPrimaryText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  bottomSecondary: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#173545",
    backgroundColor: "#102733",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSecondaryText: {
    color: "#DCEAFF",
    fontSize: 16,
    fontWeight: "800",
  },
});