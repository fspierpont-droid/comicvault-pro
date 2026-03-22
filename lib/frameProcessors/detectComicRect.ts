import { type Frame } from "react-native-vision-camera";

export type ComicCorner = {
  x: number;
  y: number;
};

export type ComicRectResult = {
  detected: boolean;
  confidence: number;
  coverage: number;
  angle: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  corners: ComicCorner[];
  message?: string;
};

type DetectComicRectOptions = {
  minCoverage?: number;
  maxTiltDegrees?: number;
  requirePortrait?: boolean;
};

export function detectComicRect(
  frame: Frame,
  _options: DetectComicRectOptions = {}
): ComicRectResult {
  "worklet";

  const width = frame.width;
  const height = frame.height;

  const boxWidth = width * 0.7;
  const boxHeight = height * 0.85;
  const left = (width - boxWidth) / 2;
  const top = (height - boxHeight) / 2;

  return {
    detected: true,
    confidence: 0.99,
    coverage: (boxWidth * boxHeight) / (width * height),
    angle: 0,
    boundingBox: {
      x: left,
      y: top,
      width: boxWidth,
      height: boxHeight,
    },
    corners: [
      { x: left, y: top },
      { x: left + boxWidth, y: top },
      { x: left + boxWidth, y: top + boxHeight },
      { x: left, y: top + boxHeight },
    ],
    message: "TS_FORCED_DEBUG_BOX",
  };
}