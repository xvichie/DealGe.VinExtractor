import Tesseract from "tesseract.js";
import axios from "axios";
import sharp from "sharp";

// VIN pattern
const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const VIN_CANDIDATE_REGEX = /[A-HJ-NPR-Z0-9]{8,17}/gi;

async function fetchImageAsBuffer(url: string): Promise<Buffer> {
  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 10000,
  });

  return Buffer.from(response.data);
}

async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width: 2000, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();
}

async function generateRotations(buffer: Buffer): Promise<Buffer[]> {
  const angles = [0, 90, 180, 270];

  return Promise.all(
    angles.map((angle) => sharp(buffer).rotate(angle).toBuffer())
  );
}

function scoreOcrText(text: string): number {
  let score = 0;

  if (VIN_REGEX.test(text)) score += 100;

  const partialMatches = text.match(VIN_CANDIDATE_REGEX) || [];
  score += partialMatches.filter(v => v.length >= 12).length * 20;

  const keywords = ["vin", "vehicle", "identification", "number", "wmi"];
  for (const keyword of keywords) {
    if (text.toLowerCase().includes(keyword)) score += 20;
  }

  return score;
}

async function extractRegionsFromBuffer(buffer: Buffer): Promise<Buffer[]> {
  const metadata = await sharp(buffer).metadata();

  const width = metadata.width!;
  const height = metadata.height!;

  const regions = [
    null,

    // bottom areas
    {
      left: 0,
      top: Math.floor(height * 0.55),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.45),
    },
    {
      left: Math.floor(width * 0.2),
      top: Math.floor(height * 0.6),
      width: Math.floor(width * 0.6),
      height: Math.floor(height * 0.4),
    },

    // center
    {
      left: Math.floor(width * 0.1),
      top: Math.floor(height * 0.35),
      width: Math.floor(width * 0.8),
      height: Math.floor(height * 0.4),
    },

    // top
    {
      left: Math.floor(width * 0.2),
      top: Math.floor(height * 0.1),
      width: Math.floor(width * 0.6),
      height: Math.floor(height * 0.3),
    },
  ];

  return Promise.all(
    regions.map((region) => {
      const pipeline = sharp(buffer);

      if (region) {
        // skip invalid tiny crops
        if (region.width < 50 || region.height < 50) {
          return buffer;
        }
        pipeline.extract(region);
      }

      return pipeline
        .resize({ width: 2000, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    })
  );
}

async function ocrImage(
  worker: Tesseract.Worker,
  buffer: Buffer
): Promise<string> {

  const rotations = await generateRotations(buffer);
  const texts: string[] = [];

  for (const rotated of rotations) {

    // 🔥 IMPORTANT: preprocess AFTER rotation
    const processed = await preprocessImage(rotated);

    const regions = await extractRegionsFromBuffer(processed);

    for (const region of regions) {
      const { data } = await worker.recognize(region);

      const text = data.text;
      texts.push(text);

      // early exit
      if (VIN_REGEX.test(text)) {
        return text;
      }
    }
  }

  return texts.join("\n");
}

export async function findVinCandidateImages(
  images: string[]
): Promise<number[]> {

  if (!images.length) return [];

  const worker = await Tesseract.createWorker("eng");

  await worker.setParameters({
    tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
  });

  const results: { index: number; score: number }[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const raw = await fetchImageAsBuffer(images[i]);

      const text = await ocrImage(worker, raw);

      const score = scoreOcrText(text);

      if (score > 0) {
        results.push({ index: i, score });
      }

      // 🔥 stop early if strong VIN found
      if (score >= 100) {
        break;
      }

    } catch (err) {
      console.log("OCR error on image", i);
    }
  }

  await worker.terminate();

  return results
    .sort((a, b) => b.score - a.score)
    .map(r => r.index);
}