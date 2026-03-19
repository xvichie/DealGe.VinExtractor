import OpenAI from "openai";
import { isValidVin, isValidVinChecksum } from "../utils/vinValidator";
import { findVinCandidateImages } from "./findVinCandidateImages2";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export async function extractVinFromImages(
    images: string[]
): Promise<string | null> {

    if (!images.length) return null;

    // 🔥 STEP 1 — get OCR-based candidates
    const candidates = await findVinCandidateImages(images);

    if (!candidates.length) return null;

    console.log("OCR candidates:", candidates);

    // 🔥 STEP 2 — try top 3 candidates only
    const topCandidates = candidates.slice(0, 3);

    for (const index of topCandidates) {
        const vin = await gptExtractVin(images[index]);

        if (vin && isValidVin(vin) && isValidVinChecksum(vin)) {
            console.log("VIN FOUND:", vin, "from image", index);
            return vin;
        }
    }

    return null;
}

async function gptExtractVin(imageUrl: string): Promise<string | null> {
    try {
        const response = await openai.responses.create({
            model: "gpt-4o",
            max_output_tokens: 30,
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `
Extract the VIN number from this image.

Rules:
- VIN is exactly 17 characters
- Allowed: A-H J-N P R-Z and digits
- If no VIN is visible return NONE

Return ONLY the VIN or NONE.
`,
                        },
                        {
                            type: "input_image",
                            image_url: imageUrl,
                            detail: "auto",
                        },
                    ],
                },
            ],
        });

        const text = response.output_text?.trim();
        console.log("checkin on image", imageUrl)
        console.log(response.output_text)

        if (!text || text === "NONE") return null;

        // 🔥 normalize (VERY important)
        const vin = text.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();

        return vin;

    } catch (err) {
        console.error("VIN extraction error:", err);
        return null;
    }
}