"use client";

import { can, canAny, canAll } from "@/src/lib/auth/permissions";
import type { CurrentUserPermissionState } from "@/src/types/auth";

export default function PermissionBlock({
  state,
  permission,
  anyPermissions,
  allPermissions,
  children,
}: {
  state: CurrentUserPermissionState;
  permission?: string;
  anyPermissions?: string[];
  allPermissions?: string[];
  children: React.ReactNode;
}) {
  let allowed = true;

  if (permission) {
    allowed = can(state, permission);
  }

  if (anyPermissions && anyPermissions.length > 0) {
    allowed = canAny(state, anyPermissions);
  }

  if (allPermissions && allPermissions.length > 0) {
    allowed = canAll(state, allPermissions);
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}