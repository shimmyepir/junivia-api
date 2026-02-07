import { Router, Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import {
  generateToken,
  authenticate,
  AuthRequest,
} from "../middleware/auth.js";
import { env } from "../config/env.js";

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

/**
 * POST /auth/register
 * Create a new user account
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = validation.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // Create new user
    const user = new User({
      email,
      passwordHash: password, // Will be hashed by pre-save hook
      role: "user",
    });

    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * POST /auth/login
 * Authenticate user and return JWT
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = validation.data;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({ error: "Account is not activated" });
      return;
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const token = generateToken(user);

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      res.json({
        user: {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
          isActive: req.user.isActive,
          createdAt: req.user.createdAt,
        },
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user info" });
    }
  },
);

/**
 * POST /auth/admin/register
 * Create a new admin account (inactive by default, must be activated by another admin)
 */
router.post(
  "/admin/register",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const validation = registerSchema.safeParse(req.body);

      if (!validation.success) {
        res.status(400).json({
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        });
        return;
      }

      const { email, password } = validation.data;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const user = new User({
        email,
        passwordHash: password,
        role: "admin",
        isActive: false,
      });

      await user.save();

      res.status(201).json({
        message: "Admin account created. Awaiting activation.",
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (error) {
      console.error("Admin registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  },
);

/**
 * PATCH /auth/admin/:id/activate
 * Activate or deactivate an admin account (requires active admin)
 */
router.put(
  "/admin/:id/activate",
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.user || req.user.role !== "admin" || !req.user.isActive) {
        res.status(403).json({ error: "Active admin access required" });
        return;
      }

      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        res.status(400).json({ error: "isActive (boolean) is required" });
        return;
      }

      const targetUser = await User.findById(id);
      if (!targetUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (targetUser._id.toString() === req.user._id.toString()) {
        res.status(400).json({ error: "Cannot change your own active status" });
        return;
      }

      targetUser.isActive = isActive;
      await targetUser.save();

      res.json({
        message: `Account ${isActive ? "activated" : "deactivated"} successfully`,
        user: {
          id: targetUser._id,
          email: targetUser.email,
          role: targetUser.role,
          isActive: targetUser.isActive,
        },
      });
    } catch (error) {
      console.error("Activation error:", error);
      res.status(500).json({ error: "Failed to update account status" });
    }
  },
);

/**
 * Creates a default admin on first startup if no admin exists
 */
export const initializeAdmin = async (): Promise<void> => {
  const adminExists = await User.findOne({ role: "admin" });
  if (!adminExists) {
    const admin = new User({
      email: "admin@junuvia.com",
      passwordHash: "admin123456",
      role: "admin",
      isActive: true,
    });
    await admin.save();
    console.log("Default admin created: admin@junuvia.com / admin123456");
  }
};

export const authRouter = router;
