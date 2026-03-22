package com.comicvault.detector

import android.util.Log
import com.mrousavy.camera.core.FrameInvalidError
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class ComicRectDetectorFrameProcessorPlugin : FrameProcessorPlugin() {

  override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
    try {
      val width = frame.image.width.toDouble()
      val height = frame.image.height.toDouble()

      val boxWidth = width * 0.7
      val boxHeight = height * 0.85
      val left = (width - boxWidth) / 2.0
      val top = (height - boxHeight) / 2.0

      val coverage = (boxWidth * boxHeight) / (width * height)

      return mapOf(
        "detected" to true,
        "confidence" to 0.99,
        "coverage" to coverage,
        "angle" to 0.0,
        "boundingBox" to mapOf(
          "x" to left,
          "y" to top,
          "width" to boxWidth,
          "height" to boxHeight
        ),
        "corners" to listOf(
          mapOf("x" to left, "y" to top),
          mapOf("x" to left + boxWidth, "y" to top),
          mapOf("x" to left + boxWidth, "y" to top + boxHeight),
          mapOf("x" to left, "y" to top + boxHeight)
        ),
        "message" to "FORCED_DEBUG_BOX"
      )
    } catch (e: FrameInvalidError) {
      Log.e("ComicRectPlugin", "Frame invalid", e)
      return null
    } catch (e: Throwable) {
      Log.e("ComicRectPlugin", "Crash", e)
      return null
    }
  }

  companion object {
    init {
      FrameProcessorPluginRegistry.addFrameProcessorPlugin("detectComicRect") {
        ComicRectDetectorFrameProcessorPlugin()
      }
    }
  }
}