"use client";

import { usePermissionContext } from "@/src/providers/PermissionProvider";

export function usePermissionState() {
  return usePermissionContext();
}