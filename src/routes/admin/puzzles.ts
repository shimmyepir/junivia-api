import { Router, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { Puzzle } from "../../models/Puzzle.js";
import { PuzzleGroup } from "../../models/PuzzleGroup.js";
import { UserProgress } from "../../models/UserProgress.js";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
import {
  uploadImage,
  uploadAudio,
  deleteImage,
} from "../../services/s3.service.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit (audiobooks can be large)
  },
  fileFilter: (_req, file, cb) => {
    const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const audioTypes = [
      "audio/mpeg",
      "audio/mp4",
      "audio/wav",
      "audio/ogg",
      "audio/x-m4a",
      "audio/m4a",
      "audio/aac",
    ];
    const allowedTypes = [...imageTypes, ...audioTypes];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only JPEG, PNG, WebP images and MP3, M4A, WAV, OGG audio are allowed.",
        ),
      );
    }
  },
});

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "sectionImages", maxCount: 25 },
  { name: "audiobook", maxCount: 1 },
]);

// Apply auth middleware to all routes
router.use(authenticate);
router.use(requireAdmin);

// Validation schemas
const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;

const createPuzzleSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  gridRows: z.coerce.number().min(2).max(20),
  gridCols: z.coerce.number().min(2).max(20),
  isActive: z.coerce.boolean().optional().default(true),
  category: z.enum(["audiobook", "music"]).optional().default("audiobook"),
  aspectRatio: z.enum(ASPECT_RATIOS).optional().default("1:1"),
  audioTitle: z.string().max(120).optional().or(z.literal("")),
  spotifyPlaylistUrl: z.string().url().optional().or(z.literal("")),
  splitCount: z.coerce.number().min(1).max(5).optional().default(1),
});

const updatePuzzleSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  gridRows: z.coerce.number().min(2).max(20).optional(),
  gridCols: z.coerce.number().min(2).max(20).optional(),
  isActive: z.coerce.boolean().optional(),
  category: z.enum(["audiobook", "music"]).optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  audioTitle: z.string().max(120).optional().or(z.literal("")),
  spotifyPlaylistUrl: z.string().url().optional().or(z.literal("")),
});

/**
 * GET /admin/puzzles
 * List all puzzles (admin view)
 */
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const puzzles = await Puzzle.find().sort({ levelOrder: 1 }).lean();

    // Series puzzles share audio + spotify with their parent group. Merge
    // those fields into each section so the admin grouped view can show
    // accurate "has audio" / "has spotify" badges without an extra fetch.
    const groupIds = [
      ...new Set(
        puzzles
          .filter((p) => p.puzzleGroupId)
          .map((p) => p.puzzleGroupId!.toString()),
      ),
    ];
    const groups = groupIds.length
      ? await PuzzleGroup.find({ _id: { $in: groupIds } }).lean()
      : [];
    const groupMap = new Map(groups.map((g) => [g._id.toString(), g]));

    const merged = puzzles.map((p) => {
      if (!p.puzzleGroupId) return p;
      const g = groupMap.get(p.puzzleGroupId.toString());
      if (!g) return p;
      return {
        ...p,
        audiobookUrl: p.audiobookUrl || g.audiobookUrl,
        audioTitle: p.audioTitle || g.audioTitle,
        spotifyPlaylistUrl: p.spotifyPlaylistUrl || g.spotifyPlaylistUrl,
      };
    });

    res.json({ puzzles: merged });
  } catch (error) {
    console.error("List puzzles error:", error);
    res.status(500).json({ error: "Failed to fetch puzzles" });
  }
});

/**
 * GET /admin/puzzles/:id
 * Get a single puzzle by ID
 */
router.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const puzzle = await Puzzle.findById(req.params.id).lean();

    if (!puzzle) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    // Series puzzles share audio + spotify with their group. Merge the
    // group's values into the response so the admin edit form prefills
    // correctly regardless of which section is being edited.
    let merged: typeof puzzle = puzzle;
    if (puzzle.puzzleGroupId) {
      const group = await PuzzleGroup.findById(puzzle.puzzleGroupId).lean();
      if (group) {
        merged = {
          ...puzzle,
          audiobookUrl: puzzle.audiobookUrl || group.audiobookUrl,
          audioTitle: puzzle.audioTitle || group.audioTitle,
          spotifyPlaylistUrl:
            puzzle.spotifyPlaylistUrl || group.spotifyPlaylistUrl,
        };
      }
    }

    res.json({ puzzle: merged });
  } catch (error) {
    console.error("Get puzzle error:", error);
    res.status(500).json({ error: "Failed to fetch puzzle" });
  }
});

/**
 * POST /admin/puzzles
 * Create a new puzzle with image upload
 */
router.post(
  "/",
  uploadFields,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const files = req.files as {
        [fieldname: string]: Express.Multer.File[];
      };
      const imageFile = files?.image?.[0];
      const audiobookFile = files?.audiobook?.[0];

      if (!imageFile) {
        res.status(400).json({ error: "Image is required" });
        return;
      }

      const validation = createPuzzleSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const {
        title,
        gridRows,
        gridCols,
        isActive,
        category,
        aspectRatio,
        audioTitle,
        spotifyPlaylistUrl,
        splitCount,
      } = validation.data;

      // Parse section position arrays (sent as JSON strings from FormData)
      const sectionRows: number[] = req.body.sectionRows
        ? JSON.parse(req.body.sectionRows)
        : [];
      const sectionCols: number[] = req.body.sectionCols
        ? JSON.parse(req.body.sectionCols)
        : [];

      const sectionImages = files?.sectionImages || [];

      if (splitCount > 1) {
        // --- Multi-level puzzle creation ---
        const totalSections = splitCount * splitCount;

        if (sectionImages.length !== totalSections) {
          res.status(400).json({
            error: `Expected ${totalSections} section images, got ${sectionImages.length}`,
          });
          return;
        }

        // Find the next available levelOrder range
        const maxLevel = await Puzzle.findOne()
          .sort({ levelOrder: -1 })
          .select("levelOrder")
          .lean();
        const startingLevel = (maxLevel?.levelOrder ?? 0) + 1;

        // Upload original image to S3
        const originalUpload = await uploadImage(imageFile);

        // Upload audiobook if provided
        let audiobookData: { url: string; key: string } | null = null;
        if (audiobookFile) {
          audiobookData = await uploadAudio(audiobookFile);
        }

        // Create PuzzleGroup — audio + spotify live on the group so every
        // section in the series shares them.
        const group = new PuzzleGroup({
          title,
          originalImageUrl: originalUpload.url,
          originalImageKey: originalUpload.key,
          splitCount,
          gridRows,
          gridCols,
          isActive,
          category,
          aspectRatio,
          spotifyPlaylistUrl: spotifyPlaylistUrl || undefined,
          audiobookUrl: audiobookData?.url,
          audiobookKey: audiobookData?.key,
          audioTitle: audioTitle || undefined,
        });
        await group.save();

        // Upload each section image and create puzzles
        const puzzleDocs = [];
        for (let i = 0; i < sectionImages.length; i++) {
          const sectionUpload = await uploadImage(sectionImages[i]!);
          const row = sectionRows[i] ?? 0;
          const col = sectionCols[i] ?? 0;
          const sectionNumber = row * splitCount + col + 1;

          puzzleDocs.push({
            title: `${title} (${sectionNumber}/${totalSections})`,
            imageUrl: sectionUpload.url,
            imageKey: sectionUpload.key,
            gridRows,
            gridCols,
            levelOrder: startingLevel + i,
            isActive,
            category,
            aspectRatio,
            // Series-level audio + spotify are read from the group at fetch
            // time. Leaving them off the section keeps the data normalized.
            puzzleGroupId: group._id,
            sectionRow: row,
            sectionCol: col,
            sectionTotal: splitCount,
          });
        }

        const createdPuzzles = await Puzzle.insertMany(puzzleDocs);

        res.status(201).json({
          message: `Multi-level puzzle created: ${totalSections} sections`,
          group,
          puzzles: createdPuzzles,
        });
      } else {
        // --- Single puzzle creation (existing behavior) ---

        // Auto-assign next levelOrder (max + 1)
        const maxLevel = await Puzzle.findOne()
          .sort({ levelOrder: -1 })
          .select("levelOrder")
          .lean();
        const levelOrder = (maxLevel?.levelOrder ?? 0) + 1;

        // Upload image to S3
        const { url, key } = await uploadImage(imageFile);

        // Create puzzle
        const puzzle = new Puzzle({
          title,
          imageUrl: url,
          imageKey: key,
          gridRows,
          gridCols,
          levelOrder,
          isActive,
          category,
          aspectRatio,
          spotifyPlaylistUrl: spotifyPlaylistUrl || undefined,
          audioTitle: audioTitle || undefined,
        });

        // Upload audiobook if provided
        if (audiobookFile) {
          const audioResult = await uploadAudio(audiobookFile);
          puzzle.audiobookUrl = audioResult.url;
          puzzle.audiobookKey = audioResult.key;
        }

        await puzzle.save();

        res.status(201).json({
          message: "Puzzle created successfully",
          puzzle,
        });
      }
    } catch (error) {
      console.error("Create puzzle error:", error);
      res.status(500).json({ error: "Failed to create puzzle" });
    }
  },
);

/**
 * PUT /admin/puzzles/:id
 * Update a puzzle (optionally with new image)
 */
router.put(
  "/:id",
  uploadFields,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const puzzle = await Puzzle.findById(req.params.id);

      if (!puzzle) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }

      const validation = updatePuzzleSchema.safeParse(req.body);

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

      // If new image provided, upload and delete old one
      if (imageFile) {
        const { url, key } = await uploadImage(imageFile);
        await deleteImage(puzzle.imageKey);
        puzzle.imageUrl = url;
        puzzle.imageKey = key;
      }

      // Audio + audioTitle + spotify for series puzzles live on the group,
      // so updates from an admin editing one section apply to the whole series.
      const group = puzzle.puzzleGroupId
        ? await PuzzleGroup.findById(puzzle.puzzleGroupId)
        : null;
      const audioOwner = group ?? puzzle;

      if (audiobookFile) {
        if (audioOwner.audiobookKey) {
          await deleteImage(audioOwner.audiobookKey);
        }
        const audioResult = await uploadAudio(audiobookFile);
        audioOwner.audiobookUrl = audioResult.url;
        audioOwner.audiobookKey = audioResult.key;
      }
      if (updates.audioTitle !== undefined) {
        audioOwner.audioTitle = updates.audioTitle || undefined;
      }
      if (updates.spotifyPlaylistUrl !== undefined) {
        audioOwner.spotifyPlaylistUrl = updates.spotifyPlaylistUrl || undefined;
      }
      if (group) await group.save();

      // Apply other updates
      if (updates.title !== undefined) puzzle.title = updates.title;
      if (updates.gridRows !== undefined) puzzle.gridRows = updates.gridRows;
      if (updates.gridCols !== undefined) puzzle.gridCols = updates.gridCols;
      if (updates.isActive !== undefined) puzzle.isActive = updates.isActive;
      if (updates.category !== undefined) puzzle.category = updates.category;
      if (updates.aspectRatio !== undefined)
        puzzle.aspectRatio = updates.aspectRatio;

      await puzzle.save();

      res.json({
        message: "Puzzle updated successfully",
        puzzle,
      });
    } catch (error) {
      console.error("Update puzzle error:", error);
      res.status(500).json({ error: "Failed to update puzzle" });
    }
  },
);

/**
 * DELETE /admin/puzzles/:id
 * Delete a puzzle and its image
 */
router.delete(
  "/:id",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const puzzle = await Puzzle.findById(req.params.id);

      if (!puzzle) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }

      if (puzzle.puzzleGroupId) {
        // Grouped puzzle: delete entire group
        const groupPuzzles = await Puzzle.find({
          puzzleGroupId: puzzle.puzzleGroupId,
        });

        // Delete all section images from S3
        for (const p of groupPuzzles) {
          await deleteImage(p.imageKey);
          await UserProgress.deleteMany({ puzzleId: p._id });
        }

        // Delete the group's original image and audiobook
        const group = await PuzzleGroup.findById(puzzle.puzzleGroupId);
        if (group) {
          await deleteImage(group.originalImageKey);
          if (group.audiobookKey) {
            await deleteImage(group.audiobookKey);
          }
          await group.deleteOne();
        }

        // Delete all puzzles in the group
        await Puzzle.deleteMany({ puzzleGroupId: puzzle.puzzleGroupId });

        res.json({
          message: `Puzzle group deleted: ${groupPuzzles.length} sections removed`,
        });
      } else {
        // Standalone puzzle: existing behavior
        await deleteImage(puzzle.imageKey);

        if (puzzle.audiobookKey) {
          await deleteImage(puzzle.audiobookKey);
        }

        await UserProgress.deleteMany({ puzzleId: puzzle._id });
        await puzzle.deleteOne();

        res.json({ message: "Puzzle deleted successfully" });
      }
    } catch (error) {
      console.error("Delete puzzle error:", error);
      res.status(500).json({ error: "Failed to delete puzzle" });
    }
  },
);

/**
 * POST /admin/puzzles/reorder
 * Reorder puzzles by updating their levelOrder
 */
router.post(
  "/reorder",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const schema = z.object({
        puzzleOrders: z.array(
          z.object({
            id: z.string(),
            levelOrder: z.number().min(1),
          }),
        ),
      });

      const validation = schema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { puzzleOrders } = validation.data;

      // Update each puzzle's levelOrder
      await Promise.all(
        puzzleOrders.map(({ id, levelOrder }) =>
          Puzzle.findByIdAndUpdate(id, { levelOrder }),
        ),
      );

      res.json({ message: "Puzzles reordered successfully" });
    } catch (error) {
      console.error("Reorder puzzles error:", error);
      res.status(500).json({ error: "Failed to reorder puzzles" });
    }
  },
);

// ─── Group / Series endpoints ───────────────────────────────

const updateGroupSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  category: z.enum(["audiobook", "music"]).optional(),
  aspectRatio: z.enum(ASPECT_RATIOS).optional(),
  audioTitle: z.string().max(120).optional().or(z.literal("")),
  spotifyPlaylistUrl: z.string().url().optional().or(z.literal("")),
});

/**
 * GET /admin/puzzles/groups/:groupId
 * Fetch a puzzle group with its sections
 */
router.get(
  "/groups/:groupId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await PuzzleGroup.findById(req.params.groupId).lean();
      if (!group) {
        res.status(404).json({ error: "Series not found" });
        return;
      }
      const sections = await Puzzle.find({ puzzleGroupId: group._id })
        .sort({ levelOrder: 1 })
        .lean();
      res.json({ group, sections });
    } catch (error) {
      console.error("Get group error:", error);
      res.status(500).json({ error: "Failed to fetch series" });
    }
  },
);

/**
 * PUT /admin/puzzles/groups/:groupId
 * Update group-level fields. Title / category / isActive cascade to every
 * section so the series stays consistent.
 */
router.put(
  "/groups/:groupId",
  upload.fields([{ name: "audiobook", maxCount: 1 }]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const group = await PuzzleGroup.findById(req.params.groupId);
      if (!group) {
        res.status(404).json({ error: "Series not found" });
        return;
      }

      const validation = updateGroupSchema.safeParse(req.body);
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
      const audiobookFile = files?.audiobook?.[0];

      if (audiobookFile) {
        if (group.audiobookKey) {
          await deleteImage(group.audiobookKey);
        }
        const audioResult = await uploadAudio(audiobookFile);
        group.audiobookUrl = audioResult.url;
        group.audiobookKey = audioResult.key;
      }

      if (updates.audioTitle !== undefined) {
        group.audioTitle = updates.audioTitle || undefined;
      }
      if (updates.spotifyPlaylistUrl !== undefined) {
        group.spotifyPlaylistUrl = updates.spotifyPlaylistUrl || undefined;
      }
      if (updates.title !== undefined) group.title = updates.title;
      if (updates.category !== undefined) group.category = updates.category;
      if (updates.isActive !== undefined) group.isActive = updates.isActive;
      if (updates.aspectRatio !== undefined)
        group.aspectRatio = updates.aspectRatio;

      await group.save();

      // Cascade title / category / isActive / aspectRatio to every section so
      // the user-facing list reflects the group state without an extra join.
      const sectionUpdates: Record<string, unknown> = {};
      if (updates.category !== undefined)
        sectionUpdates.category = updates.category;
      if (updates.isActive !== undefined)
        sectionUpdates.isActive = updates.isActive;
      if (updates.aspectRatio !== undefined)
        sectionUpdates.aspectRatio = updates.aspectRatio;

      if (Object.keys(sectionUpdates).length > 0) {
        await Puzzle.updateMany(
          { puzzleGroupId: group._id },
          { $set: sectionUpdates },
        );
      }

      // Section titles are kept as "Group Title (N/total)" so renaming the
      // group rewrites every section title too.
      if (updates.title !== undefined) {
        const sections = await Puzzle.find({ puzzleGroupId: group._id });
        await Promise.all(
          sections.map((s) => {
            const match = s.title.match(/\((\d+)\/(\d+)\)\s*$/);
            const suffix = match ? ` ${match[0]}` : "";
            s.title = `${group.title}${suffix}`;
            return s.save();
          }),
        );
      }

      res.json({ message: "Series updated successfully", group });
    } catch (error) {
      console.error("Update group error:", error);
      res.status(500).json({ error: "Failed to update series" });
    }
  },
);

export const adminPuzzlesRouter = router;
