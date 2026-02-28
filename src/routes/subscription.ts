import { Router, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

const syncSchema = z.object({
  revenuecatId: z.string().min(1),
  isPro: z.boolean(),
});

/**
 * POST /subscription/sync
 * Sync subscription state from RevenueCat to the backend.
 * Called after purchase, restore, or app launch.
 */
router.post(
  "/sync",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const validation = syncSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { revenuecatId, isPro } = validation.data;
      const userId = req.userId;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          revenuecatId,
          subscriptionTier: isPro ? "pro" : "free",
        },
        { new: true },
      );

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        message: "Subscription synced",
        subscriptionTier: user.subscriptionTier,
      });
    } catch (error) {
      console.error("Subscription sync error:", error);
      res.status(500).json({ error: "Failed to sync subscription" });
    }
  },
);

/**
 * GET /subscription/status
 * Get the current user's subscription status from the database.
 */
router.get(
  "/status",
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.userId).lean();

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        subscriptionTier: user.subscriptionTier || "free",
      });
    } catch (error) {
      console.error("Subscription status error:", error);
      res.status(500).json({ error: "Failed to get subscription status" });
    }
  },
);

export const subscriptionRouter = router;
