import { prisma } from "@repo/database";
import { permissionService } from "../rbac";

export type CrudAction = "view" | "read" | "create" | "update" | "delete" | string;

export interface CrudFlags {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canDelegate?: boolean;
  exceptionalActions?: string[];
}

export const RESOURCE_MODULES = [
  { id: "cms_gallery", label: "Gallery", exceptional: [] as string[] },
  { id: "cms_notices", label: "Notices", exceptional: ["publish"] },
  { id: "cms_incubations", label: "Incubation", exceptional: ["approve"] },
  { id: "cms_events", label: "Events", exceptional: ["check_in"] },
  { id: "cms_talks", label: "Entrepreneurship Talks", exceptional: [] as string[] },
  { id: "cms_faqs", label: "FAQs", exceptional: [] as string[] },
  { id: "cms_queries", label: "Inquiries", exceptional: [] as string[] },
  { id: "cms_team", label: "Public Team", exceptional: [] as string[] },
  { id: "induction", label: "Induction & Evaluation", exceptional: ["approve"] },
  { id: "documents", label: "Documents", exceptional: [] as string[] },
] as const;

const PRIVILEGED_SYSTEM_ROLES = new Set(["super admin", "super_admin", "developer"]);

const LEAD_POSITIONS = new Set([
  "lead",
  "club secretary",
  "professor-in-charge",
]);

const CO_LEAD_POSITIONS = new Set([
  "co-lead",
  "joint secretary",
  "coordinator",
  "co-coordinator",
  "faculty advisor",
]);

export function getPositionRank(position?: string | null): number {
  const norm = (position || "member").trim().toLowerCase();
  if (LEAD_POSITIONS.has(norm)) return 3;
  if (CO_LEAD_POSITIONS.has(norm)) return 2;
  return 1;
}

export async function hasSystemRole(userId: string, roleNames: string[]): Promise<boolean> {
  const normalizedTargets = new Set(roleNames.map((r) => r.trim().toLowerCase()));
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { name: true } } },
  });
  return userRoles.some((ur) => normalizedTargets.has(ur.role.name.trim().toLowerCase()));
}

export async function isSystemPrivileged(userId: string): Promise<boolean> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { select: { name: true } } },
  });
  return userRoles.some((ur) => PRIVILEGED_SYSTEM_ROLES.has(ur.role.name.trim().toLowerCase()));
}

export async function hasPermission(
  userId: string,
  resource: string,
  action: CrudAction,
): Promise<boolean> {
  if (await isSystemPrivileged(userId)) return true;

  const auth = await permissionService.getAuthorizationContext(userId);
  if (auth.isSuperAdmin) return true;

  const normalizedAction = action === "view" ? "read" : action;
  const userPermKeys = new Set(auth.permissions.map((p) => p.key));

  if (
    userPermKeys.has(`${resource}:${normalizedAction}:any`) ||
    userPermKeys.has(`${resource}:manage:any`)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a user has a specific CRUD (or exceptional) permission within a given team.
 */
export async function hasTeamPermission(
  userId: string,
  teamId: string,
  resource: string,
  action: CrudAction,
): Promise<boolean> {
  if (await isSystemPrivileged(userId)) return true;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) return false;

  const now = new Date();
  const rank = getPositionRank(membership.position);

  // Leads automatically inherit full CRUD for resources assigned to their Team
  if (rank >= 3) {
    const teamPerms = await prisma.teamPermission.findMany({
      where: { teamId },
      include: { permission: true },
    });
    const normAction = action === "view" ? "read" : action;
    const teamHasResource = teamPerms.some(
      (tp) =>
        tp.permission.resource === resource &&
        (tp.permission.action === "manage" || tp.permission.action === normAction),
    );
    if (teamHasResource) return true;
  }

  // Check direct TeamMemberPermission (non-expired)
  const direct = await prisma.teamMemberPermission.findUnique({
    where: { teamId_userId_resource: { teamId, userId, resource } },
  });

  if (direct && (!direct.expiresAt || direct.expiresAt > now)) {
    if (matchesCrudFlag(direct, action)) return true;
  }

  // Check active PermissionDelegation (non-revoked, non-expired)
  const delegations = await prisma.permissionDelegation.findMany({
    where: {
      teamId,
      toUserId: userId,
      resource,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  return delegations.some((d) => matchesCrudFlag(d, action));
}

/**
 * Checks if user has permission on `resource` + `action` via ANY of their teams.
 */
export async function hasAnyTeamPermission(
  userId: string,
  resource: string,
  action: CrudAction,
): Promise<boolean> {
  if (await isSystemPrivileged(userId)) return true;

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  for (const m of memberships) {
    if (await hasTeamPermission(userId, m.teamId, resource, action)) {
      return true;
    }
  }
  return false;
}

function matchesCrudFlag(
  record: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    exceptionalActions?: string[];
  },
  action: CrudAction,
): boolean {
  const norm = action.toLowerCase();
  if (norm === "view" || norm === "read") return record.canView;
  if (norm === "create") return record.canCreate;
  if (norm === "update") return record.canUpdate;
  if (norm === "delete") return record.canDelete;
  return Array.isArray(record.exceptionalActions) && record.exceptionalActions.includes(norm);
}

/**
 * Checks if `actorId` can manage `targetUserId` (membership / position) in `teamId`.
 */
export async function canManageTeamMember(
  actorId: string,
  targetUserId: string,
  teamId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isSystemPrivileged(actorId)) {
    return { allowed: true };
  }

  if (await isSystemPrivileged(targetUserId)) {
    return { allowed: false, reason: "Cannot modify Super Admin or Developer privileges." };
  }

  const actorMembership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: actorId } },
  });
  if (!actorMembership) {
    return { allowed: false, reason: "You are not a member of this team." };
  }

  const actorRank = getPositionRank(actorMembership.position);
  if (actorRank < 2) {
    return { allowed: false, reason: "Only Leads or authorized Co-Leads can manage team members." };
  }

  const targetMembership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUserId } },
  });
  const targetRank = targetMembership ? getPositionRank(targetMembership.position) : 1;

  // Co-Lead cannot modify Lead or another Co-Lead
  if (actorRank === 2 && targetRank >= 2) {
    return { allowed: false, reason: "Co-Leads cannot modify Lead or Co-Lead members." };
  }

  // Co-Lead needs explicit delegation authority on at least one resource to manage members
  if (actorRank === 2) {
    const now = new Date();
    const hasDelegationAuth = await prisma.teamMemberPermission.findFirst({
      where: {
        teamId,
        userId: actorId,
        canDelegate: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const hasActiveDelegation = await prisma.permissionDelegation.findFirst({
      where: {
        teamId,
        toUserId: actorId,
        canDelegate: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (!hasDelegationAuth && !hasActiveDelegation) {
      return {
        allowed: false,
        reason: "Co-Lead requires explicit delegation authority from Lead to manage members.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks whether `actorId` can assign or delegate `requested` CRUD operations
 * for `resource` to `targetUserId` within `teamId`.
 * Enforces all 10 mandatory security rules.
 */
export async function canDelegatePermission(
  actorId: string,
  teamId: string,
  resource: string,
  requested: CrudFlags,
  targetUserId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  // Rule 6: Users cannot grant permissions to themselves (except privileged system roles)
  const actorPrivileged = await isSystemPrivileged(actorId);
  if (actorPrivileged) {
    return { allowed: true };
  }

  if (actorId === targetUserId) {
    return { allowed: false, reason: "Users cannot grant or delegate permissions to themselves." };
  }

  // Rule: Ordinary team admins cannot modify Super Admin or Developer
  if (await isSystemPrivileged(targetUserId)) {
    return { allowed: false, reason: "Cannot modify Super Admin or Developer privileges." };
  }

  // Rule 4: Must belong to the same team
  const [actorMembership, targetMembership] = await Promise.all([
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: actorId } } }),
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: targetUserId } } }),
  ]);

  if (!actorMembership) {
    return { allowed: false, reason: "Forbidden: You are not a member of this team." };
  }
  if (!targetMembership) {
    return { allowed: false, reason: "Target user is not a member of this team." };
  }

  const actorRank = getPositionRank(actorMembership.position);
  const targetRank = getPositionRank(targetMembership.position);

  if (actorRank < 2) {
    return { allowed: false, reason: "Members cannot assign or delegate permissions." };
  }

  // Rule 3: Co-Lead cannot modify Lead (or equal rank) permissions
  if (actorRank <= targetRank) {
    return {
      allowed: false,
      reason: "Cannot modify permissions of a member with equal or higher team position.",
    };
  }

  // Rule 2: Co-Lead must have explicit delegation authority on this resource
  if (actorRank === 2) {
    const now = new Date();
    const direct = await prisma.teamMemberPermission.findUnique({
      where: { teamId_userId_resource: { teamId, userId: actorId, resource } },
    });
    const delegated = await prisma.permissionDelegation.findFirst({
      where: {
        teamId,
        toUserId: actorId,
        resource,
        canDelegate: true,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    const hasAuthority =
      (direct && direct.canDelegate && (!direct.expiresAt || direct.expiresAt > now)) ||
      Boolean(delegated);

    if (!hasAuthority) {
      return {
        allowed: false,
        reason: `Co-Lead does not have delegation authority for "${resource}".`,
      };
    }
  }

  // Rule 1 & Rule 8: Actor must possess every operation being granted
  const opsToCheck: Array<{ flag: boolean | undefined; action: string }> = [
    { flag: requested.canView, action: "view" },
    { flag: requested.canCreate, action: "create" },
    { flag: requested.canUpdate, action: "update" },
    { flag: requested.canDelete, action: "delete" },
  ];

  for (const op of opsToCheck) {
    if (op.flag) {
      const possesses = await hasTeamPermission(actorId, teamId, resource, op.action);
      if (!possesses) {
        return {
          allowed: false,
          reason: `Cannot grant "${resource}.${op.action}" because you do not possess this permission.`,
        };
      }
    }
  }

  for (const exc of requested.exceptionalActions || []) {
    const possesses = await hasTeamPermission(actorId, teamId, resource, exc);
    if (!possesses) {
      return {
        allowed: false,
        reason: `Cannot grant exceptional permission "${resource}.${exc}" because you do not possess it.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Checks whether `actorId` can revoke permissions from `targetUserId` in `teamId`.
 */
export async function canRevokePermission(
  actorId: string,
  teamId: string,
  targetUserId: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (await isSystemPrivileged(actorId)) {
    return { allowed: true };
  }

  if (actorId === targetUserId) {
    return { allowed: false, reason: "Users cannot revoke their own permissions." };
  }

  if (await isSystemPrivileged(targetUserId)) {
    return { allowed: false, reason: "Cannot revoke Super Admin or Developer privileges." };
  }

  const [actorMembership, targetMembership] = await Promise.all([
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: actorId } } }),
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: targetUserId } } }),
  ]);

  if (!actorMembership) {
    return { allowed: false, reason: "Forbidden: You are not a member of this team." };
  }

  const actorRank = getPositionRank(actorMembership.position);
  const targetRank = targetMembership ? getPositionRank(targetMembership.position) : 1;

  if (actorRank < 2 || actorRank <= targetRank) {
    return {
      allowed: false,
      reason: "Insufficient team rank to revoke permissions for this member.",
    };
  }

  return { allowed: true };
}

/**
 * Computes effective per-resource CRUD permissions for a user in a team,
 * clearly identifying the source of each permission:
 * - "System Role"
 * - "Team Position"
 * - "Direct Assignment"
 * - "Delegation"
 */
export async function getEffectiveMemberPermissions(userId: string, teamId: string) {
  const now = new Date();
  const [privileged, membership, teamPerms, directPerms, delegations] = await Promise.all([
    isSystemPrivileged(userId),
    prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } }),
    prisma.teamPermission.findMany({
      where: { teamId },
      include: { permission: true },
    }),
    prisma.teamMemberPermission.findMany({
      where: {
        teamId,
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    prisma.permissionDelegation.findMany({
      where: {
        teamId,
        toUserId: userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        fromUser: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const rank = membership ? getPositionRank(membership.position) : 0;

  return RESOURCE_MODULES.map((mod) => {
    const direct = directPerms.find((p) => p.resource === mod.id);
    const activeDelegations = delegations.filter((d) => d.resource === mod.id);
    const teamHasModule =
      rank >= 3 && teamPerms.some((tp) => tp.permission.resource === mod.id);

    const canView =
      privileged ||
      teamHasModule ||
      Boolean(direct?.canView) ||
      activeDelegations.some((d) => d.canView);
    const canCreate =
      privileged ||
      teamHasModule ||
      Boolean(direct?.canCreate) ||
      activeDelegations.some((d) => d.canCreate);
    const canUpdate =
      privileged ||
      teamHasModule ||
      Boolean(direct?.canUpdate) ||
      activeDelegations.some((d) => d.canUpdate);
    const canDelete =
      privileged ||
      teamHasModule ||
      Boolean(direct?.canDelete) ||
      activeDelegations.some((d) => d.canDelete);
    const canDelegate =
      privileged ||
      rank >= 3 ||
      Boolean(direct?.canDelegate) ||
      activeDelegations.some((d) => d.canDelegate);

    const exceptionalSet = new Set<string>(direct?.exceptionalActions || []);
    for (const d of activeDelegations) {
      (d.exceptionalActions || []).forEach((a) => exceptionalSet.add(a));
    }

    const sources: string[] = [];
    if (privileged) sources.push("System Role");
    if (teamHasModule) sources.push("Team Position");
    if (direct && (direct.canView || direct.canCreate || direct.canUpdate || direct.canDelete || direct.canDelegate)) {
      sources.push(direct.source === "DELEGATION" ? "Delegation" : "Direct Assignment");
    }
    if (activeDelegations.length > 0 && !sources.includes("Delegation")) {
      sources.push("Delegation");
    }

    return {
      resource: mod.id,
      label: mod.label,
      availableExceptional: mod.exceptional,
      canView,
      canCreate,
      canUpdate,
      canDelete,
      canDelegate,
      exceptionalActions: Array.from(exceptionalSet),
      expiresAt: direct?.expiresAt || activeDelegations[0]?.expiresAt || null,
      sources,
      delegatedBy: activeDelegations[0]?.fromUser || null,
    };
  });
}
