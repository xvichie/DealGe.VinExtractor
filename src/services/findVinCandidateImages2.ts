import axios from "axios";
import sharp from "sharp";
import { Profiler } from "../utils/profiler";
import { getWorker } from "./tesseractWorket";

// -----------------------------
// VIN patterns
// -----------------------------
const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const VIN_CANDIDATE_REGEX = /[A-HJ-NPR-Z0-9]{8,17}/gi;

// -----------------------------
// SETTINGS
// -----------------------------
const CONCURRENCY = 3;
const ROTATIONS = [0, 90]; // fallback rotation
const MAX_REGIONS = 2;

// -----------------------------
// Fetch image
// -----------------------------
async function fetchImage(url: string): Promise<Buffer> {
    const res = await axios.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        timeout: 8000,
    });

    return Buffer.from(res.data);
}

// -----------------------------
// Compress + prepare ONCE
// -----------------------------
async function prepareImage(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen()
        .jpeg({ quality: 60 })
        .toBuffer();
}

// -----------------------------
// Extract regions
// -----------------------------
async function extractRegions(buffer: Buffer): Promise<Buffer[]> {
    const meta = await sharp(buffer).metadata();

    if (!meta.width || !meta.height) return [buffer];

    const { width, height } = meta;

    const regions = [
        null, // full image

        // bottom area (dashboard VIN)
        {
            left: 0,
            top: Math.floor(height * 0.6),
            width,
            height: Math.floor(height * 0.4),
        },
    ];

    const result: Buffer[] = [];

    for (const region of regions.slice(0, MAX_REGIONS)) {
        if (!region) {
            result.push(buffer);
            continue;
        }

        if (region.width < 50 || region.height < 50) {
            result.push(buffer);
            continue;
        }

        const cropped = await sharp(buffer)
            .extract(region)
            .toBuffer();

        result.push(cropped);
    }

    return result;
}

// -----------------------------
// Scoring
// -----------------------------
function scoreText(text: string): number {
    let score = 0;
    console.log(text)

    if (VIN_REGEX.test(text)) return 100;

    const matches = text.match(VIN_CANDIDATE_REGEX) || [];
    score += matches.filter((v) => v.length >= 12).length * 20;

    if (text.toLowerCase().includes("vin")) score += 20;

    return score;
}

// -----------------------------
// OCR
// -----------------------------
async function ocrBuffer(
    worker: Tesseract.Worker,
    base: Buffer
): Promise<{ score: number }> {
    // preprocess ONCE
    const processed = await prepareImage(base);

    for (const angle of ROTATIONS) {
        const rotated =
            angle === 0
                ? processed
                : await sharp(processed).rotate(angle).toBuffer();

        const regions = await extractRegions(rotated);

        for (const region of regions) {
            try {
                const {
                    data: { text },
                } = await worker.recognize(region);

                const score = scoreText(text);

                if (score >= 100) {
                    return { score: 100 };
                }

                if (score > 0) {
                    return { score };
                }
            } catch {
                continue;
            }
        }
    }

    return { score: 0 };
}

// -----------------------------
// Process single image
// -----------------------------
async function processImage(
    worker: Tesseract.Worker,
    url: string,
    index: number
) {
    try {
        const buffer = await fetchImage(url);

        if (buffer.length < 15_000) {
            return { index, score: 0 };
        }

        const result = await ocrBuffer(worker, buffer);

        return { index, score: result.score };
    } catch {
        return { index, score: 0 };
    }
}

// -----------------------------
// MAIN
// -----------------------------
export async function findVinCandidateImages(
    images: string[]
): Promise<number[]> {
    const profiler = new Profiler("VIN Candidate Finder");

    if (!images.length) return [];

    const worker = await profiler.measure("getWorker", () => getWorker());

    const results: { index: number; score: number }[] = [];

    for (let i = 0; i < images.length; i += CONCURRENCY) {
        const chunk = images.slice(i, i + CONCURRENCY);

        const chunkResults = await profiler.measure("processChunk", () =>
            Promise.all(
                chunk.map((img, idx) =>
                    processImage(worker, img, i + idx)
                )
            )
        );

        results.push(...chunkResults.filter((r) => r.score > 0));

        // 🔥 early stop if strong VIN
        if (chunkResults.some((r) => r.score >= 100)) {
            break;
        }
    }

    profiler.end();

    return results
        .sort((a, b) => b.score - a.score)
        .map((r) => r.index);
}