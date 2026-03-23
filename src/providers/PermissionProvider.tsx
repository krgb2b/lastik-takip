"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentUserPermissions } from "@/src/lib/auth/get-current-user-permissions";
import type { CurrentUserPermissionState } from "@/src/types/auth";

type PermissionContextValue = {
  permissionState: CurrentUserPermissionState;
  isHydrated: boolean;
  isBootstrappingPermissions: boolean;
  isRefreshingPermissions: boolean;
  refreshPermissions: () => Promise<void>;
};

const STORAGE_KEY = "krg_permission_state_v1";

const emptyPermissionState: CurrentUserPermissionState = {
  user: null,
  roles: [],
  permissions: [],
  permissionSet: new Set<string>(),
};

const PermissionContext = createContext<PermissionContextValue>({
  permissionState: emptyPermissionState,
  isHydrated: false,
  isBootstrappingPermissions: true,
  isRefreshingPermissions: false,
  refreshPermissions: async () => {},
});

function serializePermissionState(state: CurrentUserPermissionState) {
  return JSON.stringify({
    user: state.user,
    roles: state.roles,
    permissions: state.permissions,
  });
}

function deserializePermissionState(
  raw: string
): CurrentUserPermissionState | null {
  try {
    type CachedRole = {
      id?: number;
      code: string;
      name?: string;
    };

    type CachedPermission = {
      id?: number;
      code: string;
      name?: string;
      module?: string;
    };

    const parsed = JSON.parse(raw) as {
      user?: CurrentUserPermissionState["user"];
      roles?: unknown;
      permissions?: unknown;
    };

    const roles: CachedRole[] = Array.isArray(parsed.roles)
      ? parsed.roles.filter(
          (r): r is CachedRole =>
            typeof r === "object" &&
            r !== null &&
            "code" in r &&
            typeof (r as { code?: unknown }).code === "string"
        )
      : [];

    const permissions: CachedPermission[] = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter(
          (p): p is CachedPermission =>
            typeof p === "object" &&
            p !== null &&
            "code" in p &&
            typeof (p as { code?: unknown }).code === "string"
        )
      : [];

    return {
      user: parsed.user ?? null,
      roles: roles as unknown as CurrentUserPermissionState["roles"],
      permissions:
        permissions as unknown as CurrentUserPermissionState["permissions"],
      permissionSet: new Set<string>(permissions.map((p) => p.code)),
    };
  } catch {
    return null;
  }
}

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [permissionState, setPermissionState] =
    useState<CurrentUserPermissionState>(emptyPermissionState);

  const [isHydrated, setIsHydrated] = useState(false);
  const [isBootstrappingPermissions, setIsBootstrappingPermissions] =
    useState(true);
  const [isRefreshingPermissions, setIsRefreshingPermissions] = useState(false);

  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  async function refreshPermissions() {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = (async () => {
      try {
        setIsRefreshingPermissions(true);

        const result = await getCurrentUserPermissions();
        setPermissionState(result);

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            STORAGE_KEY,
            serializePermissionState(result)
          );
        }
      } catch (error) {
        console.error("PermissionProvider error:", error);
        setPermissionState(emptyPermissionState);

        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
      } finally {
        setIsRefreshingPermissions(false);
        setIsBootstrappingPermissions(false);
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = run;
    return run;
  }

  useEffect(() => {
    setIsHydrated(true);

    const cached =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(STORAGE_KEY)
        : null;

    if (cached) {
      const parsed = deserializePermissionState(cached);
      if (parsed) {
        setPermissionState(parsed);
        setIsBootstrappingPermissions(false);
      }
    }

    refreshPermissions();
  }, []);

  const value = useMemo(
    () => ({
      permissionState,
      isHydrated,
      isBootstrappingPermissions,
      isRefreshingPermissions,
      refreshPermissions,
    }),
    [
      permissionState,
      isHydrated,
      isBootstrappingPermissions,
      isRefreshingPermissions,
    ]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionContext() {
  return useContext(PermissionContext);
}