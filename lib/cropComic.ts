import * as ImageManipulator from "expo-image-manipulator";

/**
 * Conservative crop for comic recognition.
 * Keeps most of the frame while trimming some outer noise.
 * We do NOT crop aggressively because that can cut off logos,
 * issue numbers, and corner boxes that the recognizer needs.
 */
export async function cropComic(uri: string) {
  try {
    const image = await ImageManipulator.manipulateAsync(uri, [], {
      base64: false,
    });

    const width = image.width;
    const height = image.height;

    if (!width || !height) {
      return uri;
    }

    // Keep 92% of the image centered.
    // This is intentionally conservative so AI recognition
    // still sees title, issue number, publisher marks, etc.
    const cropWidth = Math.round(width * 0.92);
    const cropHeight = Math.round(height * 0.92);

    const originX = Math.max(0, Math.round((width - cropWidth) / 2));
    const originY = Math.max(0, Math.round((height - cropHeight) / 2));

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
          },
        },
      ],
      {
        compress: 0.95,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri || uri;
  } catch (e) {
    console.error("Crop failed:", e);
    return uri;
  }
}