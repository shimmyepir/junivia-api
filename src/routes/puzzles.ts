import { Router, Response } from "express";
import { Puzzle } from "../models/Puzzle.js";
import { UserProgress } from "../models/UserProgress.js";
import { User } from "../models/User.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

/**
 * GET /puzzles
 * List all active puzzles for the user with their progress status
 */
router.get("/", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    // Fetch all active puzzles
    const puzzles = await Puzzle.find({ isActive: true })
      .sort({ levelOrder: 1 })
      .lean();

    // Fetch user's progress for all puzzles
    const progressRecords = await UserProgress.find({ userId }).lean();

    // Create a map of puzzle progress
    const progressMap = new Map(
      progressRecords.map((p) => [p.puzzleId.toString(), p]),
    );

    // Determine which levels are unlocked
    // Level 1 is always unlocked
    // Other levels are unlocked if the previous level is completed
    const completedLevels = new Set(
      progressRecords
        .filter((p) => p.isCompleted)
        .map((p) => {
          const puzzle = puzzles.find(
            (pz) => pz._id.toString() === p.puzzleId.toString(),
          );
          return puzzle?.levelOrder;
        })
        .filter(Boolean),
    );

    // Build response with unlock status
    const puzzlesWithStatus = puzzles.map((puzzle) => {
      const progress = progressMap.get(puzzle._id.toString());

      // Level 1 is always unlocked, others need previous level completed
      const isUnlocked =
        puzzle.levelOrder === 1 || completedLevels.has(puzzle.levelOrder - 1);

      return {
        id: puzzle._id,
        title: puzzle.title,
        imageUrl: puzzle.imageUrl,
        gridRows: puzzle.gridRows,
        gridCols: puzzle.gridCols,
        levelOrder: puzzle.levelOrder,
        spotifyPlaylistUrl: puzzle.spotifyPlaylistUrl || null,
        audiobookUrl: puzzle.audiobookUrl || null,
        isUnlocked,
        isCompleted: progress?.isCompleted ?? false,
        progress: progress
          ? {
              placedPieceIds: progress.placedPieceIds,
              completedAt: progress.completedAt,
            }
          : null,
      };
    });

    res.json({ puzzles: puzzlesWithStatus });
  } catch (error) {
    console.error("List puzzles error:", error);
    res.status(500).json({ error: "Failed to fetch puzzles" });
  }
});

/**
 * GET /puzzles/:id
 * Get a single puzzle by ID with user's progress
 */
router.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const puzzleId = req.params.id;

    // Fetch the puzzle
    const puzzle = await Puzzle.findOne({
      _id: puzzleId,
      isActive: true,
    }).lean();

    if (!puzzle) {
      res.status(404).json({ error: "Puzzle not found" });
      return;
    }

    // Check if user can access this puzzle (level unlocked)
    if (puzzle.levelOrder > 1) {
      const previousPuzzle = await Puzzle.findOne({
        levelOrder: puzzle.levelOrder - 1,
        isActive: true,
      }).lean();

      if (previousPuzzle) {
        const previousProgress = await UserProgress.findOne({
          userId,
          puzzleId: previousPuzzle._id,
          isCompleted: true,
        }).lean();

        if (!previousProgress) {
          res.status(403).json({
            error: "Level locked",
            message: "Complete the previous level to unlock this one",
          });
          return;
        }
      }
    }

    // Fetch user's progress
    const progress = await UserProgress.findOne({
      userId,
      puzzleId: puzzle._id,
    }).lean();

    // Daily limit check for free users
    const user = await User.findById(userId).lean();
    const subscriptionTier = user?.subscriptionTier || "free";

    if (subscriptionTier === "free") {
      // Check if user already has progress on this puzzle (allow continuing)
      const hasExistingProgress =
        progress && progress.placedPieceIds.length > 0;

      if (!hasExistingProgress) {
        // Check how many NEW puzzles the user started today
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const puzzlesStartedToday = await UserProgress.countDocuments({
          userId,
          createdAt: { $gte: startOfDay },
        });

        if (puzzlesStartedToday >= 1) {
          res.status(403).json({
            error: "daily_limit",
            message:
              "Free users can only play 1 puzzle per day. Upgrade to Pro for unlimited puzzles!",
          });
          return;
        }
      }
    }

    res.json({
      puzzle: {
        id: puzzle._id,
        title: puzzle.title,
        imageUrl: puzzle.imageUrl,
        gridRows: puzzle.gridRows,
        gridCols: puzzle.gridCols,
        levelOrder: puzzle.levelOrder,
        spotifyPlaylistUrl: puzzle.spotifyPlaylistUrl || null,
        audiobookUrl: puzzle.audiobookUrl || null,
      },
      progress: progress
        ? {
            placedPieceIds: progress.placedPieceIds,
            isCompleted: progress.isCompleted,
            completedAt: progress.completedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Get puzzle error:", error);
    res.status(500).json({ error: "Failed to fetch puzzle" });
  }
});

export const puzzlesRouter = router;
