"use client";

import { useMascotPose } from "@/components/mascot/MascotRail";
import type { MascotPose } from "@/components/mascot/MinosMascot";

export function ProfileMascotPose({
  pose,
  caption,
}: {
  pose: MascotPose;
  caption: string;
}) {
  useMascotPose(pose, caption);
  return null;
}
