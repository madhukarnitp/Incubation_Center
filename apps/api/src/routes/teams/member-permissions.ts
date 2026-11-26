import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@repo/database";
import { requireAuth } from "../../middleware/auth";
import {
  canDelegatePermission,
  canRevokePermission,
  getEffectiveMemberPermissions,
  isSystemPrivileged,
  getPositionRank,
} from "../../middleware/team-rbac";

const permissionEntrySchema = z.object({
  resource: z.string().min(1).max(80),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canDelegate: z.boolean().default(false),
  exceptionalActions: z.array(z.string()).optional().default([]),
  expiresAt: z.string().datetime().nullable().optional(),
});

const assignPermissionsSchema = z.object({
  permissions: z.array(permissionEntrySchema).min(1),
});

const delegatePermissionSchema = z.object({
  resource: z.string().min(1).max(80),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canDelegate: z.boolean().default(false),
  exceptionalActions: z.array(z.string()).optional().default([]),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const memberPermissionsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // GET /api/teams/:teamId/member-permissions/:userId
  app.get("/:userId", async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const actor = (request as any).user;

    const actorPrivileged = await isSystemPrivileged(actor.id);
    if (!actorPrivileged && actor.id !== userId) {
      const actorMembership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: actor.id } },
      });
      if (!actorMembership || getPositionRank(actorMembership.position) < 2) {
        return reply.status(403).send({
          error: "Forbidden: Only Super Admin, Developer, Lead, or Co-Lead can view member permissions.",
        });
      }
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        team: { select: { id: true, name: true } },
      },
    });

    if (!membership) {
      return reply.status(404).send({ error: "Member not found in this team." });
    }

    const permissions = await getEffectiveMemberPermissions(userId, teamId);
    return reply.send({
      team: membership.team,
      member: {
        ...membership.user,
        position: membership.position,
      },
      permissions,
    });
  });

  // PUT /api/teams/:teamId/member-permissions/:userId
  app.put("/:userId", async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const actor = (request as any).user;

    const parsed = assignPermissionsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // Validate authorization for EVERY requested resource before mutating anything
    for (const entry of parsed.data.permissions) {
      const check = await canDelegatePermission(
        actor.id,
        teamId,
        entry.resource,
        {
          canView: entry.canView,
          canCreate: entry.canCreate,
          canUpdate: entry.canUpdate,
          canDelete: entry.canDelete,
          canDelegate: entry.canDelegate,
          exceptionalActions: entry.exceptionalActions,
        },
        userId,
      );
      if (!check.allowed) {
        return reply.status(403).send({ error: check.reason || "Forbidden" });
      }
    }

    const previousState = await prisma.teamMemberPermission.findMany({
      where: { teamId, userId },
    });

    const result = await prisma.$transaction(async (tx) => {
      const updatedRecords = [];
      for (const entry of parsed.data.permissions) {
        const hasAny =
          entry.canView ||
          entry.canCreate ||
          entry.canUpdate ||
          entry.canDelete ||
          entry.canDelegate ||
          (entry.exceptionalActions && entry.exceptionalActions.length > 0);

        if (!hasAny) {
          await tx.teamMemberPermission.deleteMany({
            where: { teamId, userId, resource: entry.resource },
          });
          continue;
        }

        const upserted = await tx.teamMemberPermission.upsert({
          where: {
            teamId_userId_resource: {
              teamId,
              userId,
              resource: entry.resource,
            },
          },
          create: {
            teamId,
            userId,
            resource: entry.resource,
            canView: entry.canView,
            canCreate: entry.canCreate,
            canUpdate: entry.canUpdate,
            canDelete: entry.canDelete,
            canDelegate: entry.canDelegate,
            exceptionalActions: entry.exceptionalActions || [],
            source: "DIRECT",
            grantedById: actor.id,
            expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
          },
          update: {
            canView: entry.canView,
            canCreate: entry.canCreate,
            canUpdate: entry.canUpdate,
            canDelete: entry.canDelete,
            canDelegate: entry.canDelegate,
            exceptionalActions: entry.exceptionalActions || [],
            source: "DIRECT",
            grantedById: actor.id,
            grantedAt: new Date(),
            expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
          },
        });
        updatedRecords.push(upserted);
      }

      await tx.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: "Permission granted/updated for team member",
          category: "Permissions",
          type: "user-action",
          status: "Completed",
          details: {
            teamId,
            targetUserId: userId,
            previousState,
            newState: updatedRecords,
          },
        },
      });

      return updatedRecords;
    });

    const effective = await getEffectiveMemberPermissions(userId, teamId);
    return reply.send({
      success: true,
      message: "Member permissions updated successfully.",
      updatedCount: result.length,
      permissions: effective,
    });
  });

  // POST /api/teams/:teamId/member-permissions/:userId/delegate
  app.post("/:userId/delegate", async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const actor = (request as any).user;

    const parsed = delegatePermissionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const check = await canDelegatePermission(
      actor.id,
      teamId,
      parsed.data.resource,
      {
        canView: parsed.data.canView,
        canCreate: parsed.data.canCreate,
        canUpdate: parsed.data.canUpdate,
        canDelete: parsed.data.canDelete,
        canDelegate: parsed.data.canDelegate,
        exceptionalActions: parsed.data.exceptionalActions,
      },
      userId,
    );

    if (!check.allowed) {
      return reply.status(403).send({ error: check.reason || "Forbidden" });
    }

    const expiresAtDate = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

    const delegation = await prisma.$transaction(async (tx) => {
      const created = await tx.permissionDelegation.create({
        data: {
          teamId,
          fromUserId: actor.id,
          toUserId: userId,
          resource: parsed.data.resource,
          canView: parsed.data.canView,
          canCreate: parsed.data.canCreate,
          canUpdate: parsed.data.canUpdate,
          canDelete: parsed.data.canDelete,
          canDelegate: parsed.data.canDelegate,
          exceptionalActions: parsed.data.exceptionalActions || [],
          expiresAt: expiresAtDate,
        },
      });

      await tx.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: `Delegated ${parsed.data.resource} permissions to team member`,
          category: "Permissions",
          type: "user-action",
          status: "Completed",
          details: {
            teamId,
            targetUserId: userId,
            resource: parsed.data.resource,
            newState: created,
            expiresAt: expiresAtDate,
          },
        },
      });

      return created;
    });

    const effective = await getEffectiveMemberPermissions(userId, teamId);
    return reply.status(201).send({
      success: true,
      delegation,
      permissions: effective,
    });
  });

  // DELETE /api/teams/:teamId/member-permissions/:userId (Revoke all permissions)
  app.delete("/:userId", async (request, reply) => {
    const { teamId, userId } = request.params as { teamId: string; userId: string };
    const actor = (request as any).user;

    const check = await canRevokePermission(actor.id, teamId, userId);
    if (!check.allowed) {
      return reply.status(403).send({ error: check.reason || "Forbidden" });
    }

    const previousState = await prisma.teamMemberPermission.findMany({
      where: { teamId, userId },
    });

    await prisma.$transaction(async (tx) => {
      await tx.teamMemberPermission.deleteMany({
        where: { teamId, userId },
      });

      await tx.permissionDelegation.updateMany({
        where: { teamId, toUserId: userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: "Revoked all team member permissions",
          category: "Permissions",
          type: "user-action",
          status: "Completed",
          details: {
            teamId,
            targetUserId: userId,
            previousState,
            newState: [],
          },
        },
      });
    });

    return reply.send({
      success: true,
      message: "All team permissions revoked immediately.",
    });
  });
};
