"use client";

import { createWorker } from "tesseract.js";
import { fieldsFromOcrText, type PassportOcrResult } from "./fieldsFromText";

/** Downscale large phone photos so browser OCR finishes quickly. */
async function downscaleForOcr(file: File, maxEdge = 1600): Promise<Blob> {
  if (typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 0.95) {
      bitmap.close();
      return file;
    }
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85)
    );
    return blob || file;
  } catch {
    return file;
  }
}

/** Runs Tesseract in the browser (avoids Vercel serverless 504 timeouts). */
export async function extractPassportFieldsInBrowser(file: File): Promise<PassportOcrResult> {
  const image = await downscaleForOcr(file);
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(image);
    const text = result.data.text || "";
    const confidence = (result.data.confidence ?? 0) / 100;
    return fieldsFromOcrText(text, Math.max(0.5, confidence));
  } finally {
    await worker.terminate();
  }
}
