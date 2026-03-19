// services/tesseractWorker.ts

import Tesseract from "tesseract.js";

let worker: Tesseract.Worker | null = null;

export async function getWorker(): Promise<Tesseract.Worker> {
  if (!worker) {
    worker = await Tesseract.createWorker("eng");

    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
    });

    console.log("✅ Tesseract worker initialized");
  }

  return worker;
}