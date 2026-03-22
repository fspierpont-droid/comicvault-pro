import React from "react";
import { View, Text, StyleSheet, Image, Pressable } from "react-native";

type ComicCardProps = {
  title: string;
  issue: string;
  subtitle?: string;
  gradeText?: string | null;
  valueText?: string | null;
  keyInfo?: string | null;
  coverUrl?: string | null;
  onPress?: () => void;
};

export default function ComicCard({
  title,
  issue,
  subtitle,
  gradeText,
  valueText,
  keyInfo,
  coverUrl,
  onPress,
}: ComicCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.coverWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={styles.coverFallback}>
            <Text style={styles.coverFallbackText}>No Cover</Text>
          </View>
        )}

        {gradeText ? (
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeBadgeText}>{gradeText}</Text>
          </View>
        ) : null}

        {keyInfo ? (
          <View style={styles.keyBadge}>
            <Text style={styles.keyBadgeText}>KEY</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.meta}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.issue} numberOfLines={1}>
          #{issue}
        </Text>

        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}

        {keyInfo ? (
          <Text style={styles.keyInfo} numberOfLines={1}>
            {keyInfo}
          </Text>
        ) : null}

        {valueText ? <Text style={styles.value}>{valueText}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#0b1b26",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#173142",
  },
  coverWrap: {
    position: "relative",
    backgroundColor: "#07141c",
  },
  cover: {
    width: "100%",
    aspectRatio: 0.7,
    backgroundColor: "#000000",
  },
  coverFallback: {
    width: "100%",
    aspectRatio: 0.7,
    backgroundColor: "#091720",
    alignItems: "center",
    justifyContent: "center",
  },
  coverFallbackText: {
    color: "#8ea5b8",
    fontWeight: "700",
    fontSize: 12,
  },
  gradeBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "#2563eb",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  gradeBadgeText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 13,
  },
  keyBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
  },
  keyBadgeText: {
    color: "#0b1b26",
    fontWeight: "900",
    fontSize: 10,
    letterSpacing: 0.4,
  },
  meta: {
    padding: 10,
  },
  title: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 17,
  },
  issue: {
    color: "#dbe8f4",
    fontWeight: "800",
    fontSize: 15,
    marginTop: 2,
  },
  subtitle: {
    color: "#8ea5b8",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  keyInfo: {
    color: "#fcd34d",
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  value: {
    color: "#10b981",
    fontWeight: "800",
    fontSize: 13,
    marginTop: 8,
  },
});