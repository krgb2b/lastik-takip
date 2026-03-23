export type CurrentAppUser = {
  id: number;
  authUserId: string | null;
  fullName: string;
  email: string | null;
  isActive: boolean;
};

export type CurrentUserPermissionState = {
  user: CurrentAppUser | null;
  roles: string[];
  permissions: string[];
  permissionSet: Set<string>;
};