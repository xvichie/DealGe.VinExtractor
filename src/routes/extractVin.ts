import { Router } from "express";
import { findVinCandidateImages } from "../services/findVinCandidateImages";
import { extractVinFromImages } from "../services/extractVinFromImages";

const router = Router();
/**
 * @swagger
 * /scan-vin-candidates:
 *   post:
 *     summary: Scan images and return indexes likely containing VIN
 *     tags:
 *       - VIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - "https://example.com/car1.jpg"
 *                   - "https://example.com/car2.jpg"
 *     responses:
 *       200:
 *         description: Candidate image indexes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 candidates:
 *                   type: array
 *                   items:
 *                     type: number
 */
router.post("/scan-vin-candidates", async (req, res) => {
  try {
    const { images } = req.body as { images: string[] };

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: "images array required" });
    }

    const candidates = await findVinCandidateImages(images);

    res.json({ candidates });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "VIN candidate scan failed" });
  }
});

/**
 * @swagger
 * /extract-vin:
 *   post:
 *     summary: Extract VIN number from car images
 *     tags:
 *       - VIN
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - "https://example.com/car1.jpg"
 *                   - "https://example.com/car2.jpg"
 *     responses:
 *       200:
 *         description: Extracted VIN
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vin:
 *                   type: string
 *                   example: "JT3AC12R8M1001234"
 */
router.post("/extract-vin", async (req, res) => {
  try {
    const { images } = req.body as { images: string[] };

    if (!images || !Array.isArray(images)) {
      return res.status(400).json({ error: "images array required" });
    }

    const vin = await extractVinFromImages(images);

    if (!vin) {
      return res.json({ vin: null });
    }

    res.json({ vin });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "VIN extraction failed" });
  }
});

export default router;