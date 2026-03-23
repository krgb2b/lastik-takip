import type { CurrentUserPermissionState } from "@/src/types/auth";

export function can(
  state: CurrentUserPermissionState,
  permissionCode: string
): boolean {
  return state.permissionSet.has(permissionCode);
}

export function canAny(
  state: CurrentUserPermissionState,
  permissionCodes: string[]
): boolean {
  return permissionCodes.some((code) => state.permissionSet.has(code));
}

export function canAll(
  state: CurrentUserPermissionState,
  permissionCodes: string[]
): boolean {
  return permissionCodes.every((code) => state.permissionSet.has(code));
}

export function hasRole(
  state: CurrentUserPermissionState,
  roleCode: string
): boolean {
  return state.roles.includes(roleCode);
}

export function canViewModule(
  state: CurrentUserPermissionState,
  moduleName: string
): boolean {
  return state.permissionSet.has(`${moduleName}.view`);
}