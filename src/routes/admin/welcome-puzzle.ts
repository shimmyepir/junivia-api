import { Router, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { WelcomePuzzle } from "../../models/WelcomePuzzle.js";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
import {
  uploadImage,
  uploadAudio,
  deleteImage,
} from "../../services/s3.service.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/ogg",
      "audio/x-m4a",
      "audio/m4a",
      "audio/aac",
    ].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "audiobook", maxCount: 1 },
]);

router.use(authenticate);
router.use(requireAdmin);

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  audioTitle: z.string().max(120).optional().or(z.literal("")),
});

/**
 * GET /admin/welcome-puzzle
 * Fetch the singleton (or null if not configured).
 */
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const puzzle = await WelcomePuzzle.findOne().lean();
    res.json({ welcomePuzzle: puzzle || null });
  } catch (error) {
    console.error("Get welcome puzzle error:", error);
    res.status(500).json({ error: "Failed to fetch welcome puzzle" });
  }
});

/**
 * PUT /admin/welcome-puzzle
 * Upsert the singleton. The first time, an image upload is required;
 * subsequent saves can update any combination of fields.
 */
router.put(
  "/",
  uploadFields,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const updates = validation.data;
      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      const imageFile = files?.image?.[0];
      const audiobookFile = files?.audiobook?.[0];

      let puzzle = await WelcomePuzzle.findOne();
      const isNew = !puzzle;

      if (isNew && !imageFile) {
        res
          .status(400)
          .json({ error: "Image is required when creating the welcome puzzle" });
        return;
      }

      if (!puzzle) {
        // Will be created with the image upload below.
        puzzle = new WelcomePuzzle({
          title: updates.title || "Welcome Puzzle",
          imageUrl: "",
          imageKey: "",
        });
      }

      if (imageFile) {
        if (puzzle.imageKey) {
          await deleteImage(puzzle.imageKey).catch(() => {});
        }
        const { url, key } = await uploadImage(imageFile);
        puzzle.imageUrl = url;
        puzzle.imageKey = key;
      }

      if (audiobookFile) {
        if (puzzle.audiobookKey) {
          await deleteImage(puzzle.audiobookKey).catch(() => {});
        }
        const { url, key } = await uploadAudio(audiobookFile);
        puzzle.audiobookUrl = url;
        puzzle.audiobookKey = key;
      }

      if (updates.title !== undefined) puzzle.title = updates.title;
      if (updates.audioTitle !== undefined) {
        puzzle.audioTitle = updates.audioTitle || undefined;
      }

      await puzzle.save();
      res.json({ message: "Welcome puzzle saved", welcomePuzzle: puzzle });
    } catch (error) {
      console.error("Update welcome puzzle error:", error);
      res.status(500).json({ error: "Failed to save welcome puzzle" });
    }
  },
);

export const adminWelcomePuzzleRouter = router;
