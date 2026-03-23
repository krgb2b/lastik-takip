"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AccessDenied from "@/src/components/AccessDenied";
import { can } from "@/src/lib/auth/permissions";
import { AUTH_MODE } from "@/src/lib/auth/auth-config";
import { usePermissionState } from "@/src/hooks/usePermissionState";

export default function PermissionGuard({
  permission,
  children,
  title,
  description,
}: {
  permission: string;
  children: React.ReactNode;
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const {
    permissionState,
    isHydrated,
    isBootstrappingPermissions,
    isRefreshingPermissions,
  } = usePermissionState();

  const [redirectingToLogin, setRedirectingToLogin] = useState(false);

  const hasPermission = useMemo(() => {
    return can(permissionState, permission);
  }, [permissionState, permission]);

  useEffect(() => {
    if (!isHydrated || isBootstrappingPermissions) return;

    if (
      AUTH_MODE === "supabase_auth" &&
      !permissionState.user &&
      pathname !== "/login"
    ) {
      setRedirectingToLogin(true);
      router.replace("/login");
      return;
    }

    setRedirectingToLogin(false);
  }, [
    isHydrated,
    isBootstrappingPermissions,
    permissionState.user,
    pathname,
    router,
  ]);

  if (!isHydrated || isBootstrappingPermissions || isRefreshingPermissions) {
    return null;
  }

  if (redirectingToLogin) {
    return null;
  }

  if (AUTH_MODE === "supabase_auth" && !permissionState.user) {
    return null;
  }

  if (!hasPermission) {
    return <AccessDenied title={title} description={description} />;
  }

  return <>{children}</>;
}