import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from "react-native-vision-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type StageSize = {
  width: number;
  height: number;
};

type OverlayBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const GUIDE_ASPECT_RATIO = 3 / 4;

function safeDecodeURIComponent(value?: string | string[]) {
  if (!value) return "";
  const raw = Array.isArray(value) ? value[0] : value;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    side?: string;
    frontUri?: string;
  }>();

  const side = params.side === "back" ? "back" : "front";
  const existingFrontUri = safeDecodeURIComponent(params.frontUri);

  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");

  const [stageSize, setStageSize] = useState<StageSize>({ width: 0, height: 0 });
  const [capturing, setCapturing] = useState(false);
  const [picking, setPicking] = useState(false);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize({ width, height });
  }, []);

  const overlayBox = useMemo<OverlayBox | null>(() => {
    if (!stageSize.width || !stageSize.height) return null;

    const padding = 24;
    const maxWidth = stageSize.width - padding * 2;
    const maxHeight = stageSize.height - padding * 2;

    let width = maxWidth;
    let height = width / GUIDE_ASPECT_RATIO;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * GUIDE_ASPECT_RATIO;
    }

    return {
      left: (stageSize.width - width) / 2,
      top: (stageSize.height - height) / 2,
      width,
      height,
    };
  }, [stageSize]);

  const navigateToScan = useCallback(
    (front?: string, back?: string) => {
      router.replace({
        pathname: "/scan",
        params: {
          frontUri: front ? encodeURIComponent(front) : "",
          backUri: back ? encodeURIComponent(back) : "",
        },
      });
    },
    [router]
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      setPicking(true);

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission needed",
          "Allow photo access so you can choose a comic image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        throw new Error("No image selected.");
      }

      if (side === "front") {
        navigateToScan(uri);
      } else {
        navigateToScan(existingFrontUri, uri);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to open library.");
    } finally {
      setPicking(false);
    }
  }, [existingFrontUri, navigateToScan, side]);

  const takePhoto = useCallback(async () => {
    try {
      if (!cameraRef.current) {
        throw new Error("Camera not ready.");
      }

      setCapturing(true);

      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: false,
        flash: "off",
      });

      const uri = photo.path.startsWith("file://")
        ? photo.path
        : `file://${photo.path}`;

      if (side === "front") {
        navigateToScan(uri);
      } else {
        navigateToScan(existingFrontUri, uri);
      }
    } catch (e: any) {
      Alert.alert("Capture failed", e?.message || "Unable to capture photo.");
    } finally {
      setCapturing(false);
    }
  }, [existingFrontUri, navigateToScan, side]);

  if (!hasPermission) {
    return (
      <View style={styles.permissionSafe}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionCopy}>
            ComicVault needs camera access so you can capture comic covers.
          </Text>

          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Enable Camera</Text>
          </Pressable>

          <Pressable
            style={styles.permissionGhost}
            onPress={() => router.replace("/scan")}
          >
            <Text style={styles.permissionGhostText}>Back to Scan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.loadingSafe}>
        <ActivityIndicator size="large" color="#4FA8FF" />
        <Text style={styles.loadingText}>Loading camera…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.topBtn} onPress={() => router.replace("/scan")}>
          <Text style={styles.topBtnText}>Cancel</Text>
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.title}>
            {side === "front" ? "Scan Front Cover" : "Scan Back Cover"}
          </Text>
          <Text style={styles.subtitle}>
            Center the comic inside the guide box, then tap capture.
          </Text>
        </View>

        <Pressable
          style={styles.topBtnSecondary}
          onPress={() => router.push("/collection")}
        >
          <Text style={styles.topBtnSecondaryText}>Vault</Text>
        </Pressable>
      </View>

      <View style={styles.stageWrap}>
        <View style={styles.stage} onLayout={handleStageLayout}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />

          {overlayBox ? (
            <View
              pointerEvents="none"
              style={[
                styles.detectBox,
                {
                  left: overlayBox.left,
                  top: overlayBox.top,
                  width: overlayBox.width,
                  height: overlayBox.height,
                },
              ]}
            />
          ) : null}
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable
          onPress={pickFromLibrary}
          style={styles.sideBtn}
          disabled={picking || capturing}
        >
          <Text style={styles.sideText}>
            {picking ? "Loading..." : "Library"}
          </Text>
        </Pressable>

        <Pressable
          onPress={takePhoto}
          style={[styles.captureBtn, capturing && styles.captureBtnDisabled]}
          disabled={capturing || picking}
        >
          <Text style={styles.captureText}>
            {capturing ? "..." : "Capture"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/scan")}
          style={styles.sideBtn}
          disabled={capturing || picking}
        >
          <Text style={styles.sideText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#04141D",
  },
  topBar: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#04141D",
  },
  topBtn: {
    minWidth: 96,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#9E2424",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  topBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  topBtnSecondary: {
    minWidth: 96,
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: "#0C1530",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  topBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#E6EEF8",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  stageWrap: {
    flex: 1,
    backgroundColor: "#000000",
  },
  stage: {
    flex: 1,
    backgroundColor: "#000000",
    position: "relative",
    overflow: "hidden",
  },
  detectBox: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 18,
    borderColor: "#2E6CF6",
    zIndex: 5,
  },
  controls: {
    backgroundColor: "#04141D",
    paddingTop: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sideBtn: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#0F2233",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sideText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  captureBtn: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#2E6CF6",
    alignItems: "center",
    justifyContent: "center",
  },
  captureBtnDisabled: {
    opacity: 0.6,
  },
  captureText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  loadingSafe: {
    flex: 1,
    backgroundColor: "#071821",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: "#DCEAFF",
    fontSize: 15,
    fontWeight: "700",
  },
  permissionSafe: {
    flex: 1,
    backgroundColor: "#071821",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  permissionCard: {
    width: "100%",
    backgroundColor: "#102733",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#173545",
    padding: 24,
  },
  permissionTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
  },
  permissionCopy: {
    color: "#9AB7C9",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 22,
  },
  permissionBtn: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#1E66F5",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  permissionGhost: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  permissionGhostText: {
    color: "#DCEAFF",
    fontSize: 15,
    fontWeight: "800",
  },
});