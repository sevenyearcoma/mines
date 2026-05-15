"use client";

import { useMascotPose } from "./MascotRail";
import type { MascotPose } from "./MinosMascot";

export function MascotScene({
  pose,
  caption,
}: {
  pose: MascotPose;
  caption: string | null;
}) {
  useMascotPose(pose, caption);
  return null;
}
