import { Router, Response } from "express";
import { z } from "zod";
import { Puzzle } from "../models/Puzzle.js";
import { UserProgress } from "../models/UserProgress.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Validation schema for progress update
const updateProgressSchema = z.object({
  placedPieceIds: z.array(z.string()),
});

/**
 * GET /progress
 * Get all progress for the current user
 */
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const progressRecords = await UserProgress.find({ userId })
      .populate("puzzleId", "title levelOrder gridRows gridCols")
      .lean();

    res.json({ progress: progressRecords });
  } catch (error) {
    console.error("Get all progress error:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

/**
 * GET /progress/:puzzleId
 * Get progress for a specific puzzle
 */
router.get(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      const progress = await UserProgress.findOne({ userId, puzzleId }).lean();

      if (!progress) {
        res.json({
          progress: null,
          message: "No progress found for this puzzle",
        });
        return;
      }

      res.json({ progress });
    } catch (error) {
      console.error("Get progress error:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  },
);

/**
 * PUT /progress/:puzzleId
 * Save or update progress for a puzzle
 */
router.put(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      const validation = updateProgressSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { placedPieceIds } = validation.data;

      // Verify the puzzle exists
      const puzzle = await Puzzle.findById(puzzleId).lean();

      if (!puzzle) {
        res.status(404).json({ error: "Puzzle not found" });
        return;
      }

      // Calculate total pieces
      const totalPieces = puzzle.gridRows * puzzle.gridCols;

      // Check if puzzle is completed
      const isCompleted = placedPieceIds.length >= totalPieces;

      // Upsert progress
      const progress = await UserProgress.findOneAndUpdate(
        { userId, puzzleId },
        {
          $set: {
            placedPieceIds,
            isCompleted,
            completedAt: isCompleted ? new Date() : null,
          },
        },
        { upsert: true, new: true },
      );

      res.json({
        message: isCompleted ? "Puzzle completed!" : "Progress saved",
        progress: {
          placedPieceIds: progress.placedPieceIds,
          isCompleted: progress.isCompleted,
          completedAt: progress.completedAt,
        },
      });
    } catch (error) {
      console.error("Update progress error:", error);
      res.status(500).json({ error: "Failed to save progress" });
    }
  },
);

/**
 * DELETE /progress/:puzzleId
 * Reset progress for a puzzle
 */
router.delete(
  "/:puzzleId",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.userId;
      const { puzzleId } = req.params;

      await UserProgress.findOneAndDelete({ userId, puzzleId });

      res.json({ message: "Progress reset successfully" });
    } catch (error) {
      console.error("Reset progress error:", error);
      res.status(500).json({ error: "Failed to reset progress" });
    }
  },
);

export const progressRouter = router;
