// Names and colours for the performance screens
import type { GoalStatus, ReviewStatus } from "@/lib/types";

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" }> = {
  pending_self: { label: "Self review", tone: "warning" },
  pending_manager: { label: "Manager review", tone: "info" },
  pending_hr: { label: "With HR", tone: "info" },
  finalized: { label: "Final", tone: "success" },
  acknowledged: { label: "Acknowledged", tone: "success" },
};

export const STEPS: { key: ReviewStatus; label: string }[] = [
  { key: "pending_self", label: "Self" },
  { key: "pending_manager", label: "Manager" },
  { key: "pending_hr", label: "HR" },
  { key: "finalized", label: "Final" },
  { key: "acknowledged", label: "Acknowledged" },
];

export const GOAL_STATUS: Record<GoalStatus, { label: string; tone: "success" | "warning" | "danger" | "info" }> = {
  on_track: { label: "On track", tone: "info" },
  at_risk: { label: "At risk", tone: "warning" },
  off_track: { label: "Off track", tone: "danger" },
  done: { label: "Done", tone: "success" },
};

export const RATING_LABELS = ["", "Needs improvement", "Below expectations", "Meets expectations", "Exceeds expectations", "Outstanding"];
