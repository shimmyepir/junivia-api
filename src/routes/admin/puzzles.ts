import { Router, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { Puzzle } from "../../models/Puzzle.js";
import { UserProgress } from "../../models/UserProgress.js";
import { authenticate, AuthRequest } from "../../middleware/auth.js";
import { requireAdmin } from "../../middleware/admin.js";
import { uploadImage, deleteImage } from "../../services/s3.service.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed."));
    }
  },
});

// Apply auth middleware to all routes
router.use(authenticate);
router.use(requireAdmin);

// Validation schemas
const createPuzzleSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  gridRows: z.coerce.number().min(2).max(20),
  gridCols: z.coerce.number().min(2).max(20),
  levelOrder: z.coerce.number().min(1),
  isActive: z.coerce.boolean().optional().default(true),
});

const updatePuzzleSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  gridRows: z.coerce.number().min(2).max(20).optional(),
  gridCols: z.coerce.number().min(2).max(20).optional(),
  levelOrder: z.coerce.number().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
});

/**
 * GET /admin/puzzles
 * List all puzzles (admin view)
 */
router.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const puzzles = await Puzzle.find().sort({ levelOrder: 1 }).lean();

    res.json({ puzzles });
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

    res.json({ puzzle });
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
  upload.single("image"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
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

      const { title, gridRows, gridCols, levelOrder, isActive } =
        validation.data;

      // Check if levelOrder is unique
      const existingLevel = await Puzzle.findOne({ levelOrder });
      if (existingLevel) {
        res.status(409).json({ error: `Level ${levelOrder} already exists` });
        return;
      }

      // Upload image to S3
      const { url, key } = await uploadImage(req.file);

      // Create puzzle
      const puzzle = new Puzzle({
        title,
        imageUrl: url,
        imageKey: key,
        gridRows,
        gridCols,
        levelOrder,
        isActive,
      });

      await puzzle.save();

      res.status(201).json({
        message: "Puzzle created successfully",
        puzzle,
      });
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
  upload.single("image"),
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

      // Check if levelOrder is being changed and is unique
      if (updates.levelOrder && updates.levelOrder !== puzzle.levelOrder) {
        const existingLevel = await Puzzle.findOne({
          levelOrder: updates.levelOrder,
          _id: { $ne: puzzle._id },
        });
        if (existingLevel) {
          res
            .status(409)
            .json({ error: `Level ${updates.levelOrder} already exists` });
          return;
        }
      }

      // If new image provided, upload and delete old one
      if (req.file) {
        const { url, key } = await uploadImage(req.file);

        // Delete old image from S3
        await deleteImage(puzzle.imageKey);

        puzzle.imageUrl = url;
        puzzle.imageKey = key;
      }

      // Apply other updates
      if (updates.title !== undefined) puzzle.title = updates.title;
      if (updates.gridRows !== undefined) puzzle.gridRows = updates.gridRows;
      if (updates.gridCols !== undefined) puzzle.gridCols = updates.gridCols;
      if (updates.levelOrder !== undefined)
        puzzle.levelOrder = updates.levelOrder;
      if (updates.isActive !== undefined) puzzle.isActive = updates.isActive;

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

      // Delete image from S3
      await deleteImage(puzzle.imageKey);

      // Delete all user progress for this puzzle
      await UserProgress.deleteMany({ puzzleId: puzzle._id });

      // Delete puzzle
      await puzzle.deleteOne();

      res.json({ message: "Puzzle deleted successfully" });
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

export const adminPuzzlesRouter = router;
