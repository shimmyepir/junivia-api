import mongoose, { Document, Schema } from "mongoose";

/**
 * Singleton: the welcome puzzle shown during onboarding. There should
 * never be more than one document in this collection; the admin updates
 * the same doc each time.
 */
export interface IWelcomePuzzle extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  imageUrl: string;
  imageKey: string;
  audiobookUrl?: string;
  audiobookKey?: string;
  audioTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}

const welcomePuzzleSchema = new Schema<IWelcomePuzzle>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      default: "Welcome Puzzle",
    },
    imageUrl: { type: String, required: true },
    imageKey: { type: String, required: true },
    audiobookUrl: { type: String },
    audiobookKey: { type: String },
    audioTitle: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: true },
);

export const WelcomePuzzle = mongoose.model<IWelcomePuzzle>(
  "WelcomePuzzle",
  welcomePuzzleSchema,
);
