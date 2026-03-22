import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Item = {
  label: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ITEMS: Item[] = [
  { label: "Home", route: "/", icon: "home-outline" },
  { label: "Vault", route: "/collection", icon: "albums-outline" },
  { label: "Scan", route: "/scan", icon: "scan-outline" },
];

function isActive(pathname: string, route: string) {
  if (route === "/") return pathname === "/";
  if (route === "/scan") {
    return (
      pathname === "/scan" ||
      pathname === "/capture" ||
      pathname.startsWith("/capture/")
    );
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.route);

        return (
          <Pressable
            key={item.route}
            onPress={() => router.replace(item.route as any)}
            style={[styles.item, active && styles.itemActive]}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? "#FFFFFF" : "#7FA8C1"}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: "#0A1D27",
    borderTopWidth: 1,
    borderTopColor: "#173545",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  item: {
    flex: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 4,
  },
  itemActive: {
    backgroundColor: "#1E66F5",
  },
  label: {
    color: "#7FA8C1",
    fontSize: 12,
    fontWeight: "700",
  },
  labelActive: {
    color: "#FFFFFF",
  },
});