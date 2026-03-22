import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#071821" },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="capture" />
        <Stack.Screen name="collection" />
        <Stack.Screen name="comic/[scanId]" />
        <Stack.Screen name="series/[seriesId]" />
        <Stack.Screen name="grade/[scanId]" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}