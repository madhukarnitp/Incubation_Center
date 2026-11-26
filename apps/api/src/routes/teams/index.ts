import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@repo/database";
import { TeamPermissions } from "@repo/rbac";
import { requireAuth } from "../../middleware/auth";
import { authorize } from "../../middleware/rbac";
import {
  canManageTeamMember,
  getPositionRank,
  hasPermission,
  isSystemPrivileged,
} from "../../middleware/team-rbac";
import { permissionService } from "../../rbac";
import { memberPermissionsRoutes } from "./member-permissions";

const teamMemberInputSchema = z.object({
  userId: z.string().min(1),
  position: z.string().min(1).max(80).trim().default("Member"),
  order: z.coerce.number().int().default(0),
});

const createTeamSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters").max(100).trim(),
  description: z.string().max(500).optional(),
  type: z.enum(["OPERATIONAL", "GLOBAL", "FACULTY"]).default("OPERATIONAL"),
  order: z.coerce.number().int().default(0),
  roleIds: z.array(z.string()).optional(),
  permissionKeys: z.array(z.string()).optional(),
  memberUserIds: z.array(z.string()).optional(),
  members: z.array(teamMemberInputSchema).optional(),
});

const updateTeamSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  description: z.string().max(500).optional().nullable(),
  type: z.enum(["OPERATIONAL", "GLOBAL", "FACULTY"]).optional(),
  order: z.coerce.number().int().optional(),
  roleIds: z.array(z.string()).optional(),
  permissionKeys: z.array(z.string()).optional(),
  memberUserIds: z.array(z.string()).optional(),
  members: z.array(teamMemberInputSchema).optional(),
});

const updateTeamRolesSchema = z.object({
  roleIds: z.array(z.string()),
});

const addMembersSchema = z.object({
  userIds: z.array(z.string()).min(1, "At least one user ID is required"),
  position: z.string().min(1).max(80).trim().default("Member"),
});

const createAndAddMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(120).trim(),
  email: z.string().email("Valid email is required").trim().toLowerCase(),
  phoneNumber: z.string().max(30).optional().nullable(),
  department: z.string().max(150).trim().optional().nullable(),
  post: z.string().max(150).trim().optional().nullable(),
  bio: z.string().max(2000).trim().optional().nullable(),
  linkedin: z.string().max(300).trim().optional().nullable(),
  github: z.string().max(300).trim().optional().nullable(),
  instagram: z.string().max(300).trim().optional().nullable(),
  position: z.string().min(1).max(80).trim().default("Member"),
  roleIds: z.array(z.string()).optional().default([]),
});

const updateMemberRolesSchema = z.object({
  roleIds: z.array(z.string()),
});

const updateMemberPositionSchema = z.object({
  position: z.string().min(1, "Position is required").max(80).trim(),
  order: z.coerce.number().int().optional(),
});

export const teamsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // Nested routes for per-member CRUD permissions
  app.register(memberPermissionsRoutes, { prefix: "/:teamId/member-permissions" });

  // 0. GET /api/teams/overview - Organization-wide team overview stats
  app.get("/overview", async (request, reply) => {
    const actor = (request as any).user;
    const privileged = await isSystemPrivileged(actor.id);

    const [teams, memberships] = await Promise.all([
      prisma.team.findMany({
        select: { id: true, _count: { select: { members: true } } },
      }),
      prisma.teamMember.findMany({
        select: { userId: true, position: true, teamId: true },
      }),
    ]);

    const visibleMemberships = privileged
      ? memberships
      : memberships.filter((m) =>
          memberships.some((own) => own.userId === actor.id && own.teamId === m.teamId),
        );

    const totalLeads = visibleMemberships.filter((m) => getPositionRank(m.position) === 3).length;
    const totalCoLeads = visibleMemberships.filter((m) => getPositionRank(m.position) === 2).length;
    const uniqueMembers = new Set(visibleMemberships.map((m) => m.userId)).size;

    return reply.send({
      totalTeams: teams.length,
      activeTeams: teams.filter((t) => t._count.members > 0).length,
      totalMembers: uniqueMembers,
      totalLeads,
      totalCoLeads,
    });
  });

  // 1. GET /api/teams - List teams (all for privileged/team:read:any, own team for Leads/Co-Leads)
  app.get(
    "/",
    async (request, reply) => {
      const actor = (request as any).user;
      const [privileged, canReadAllTeams] = await Promise.all([
        isSystemPrivileged(actor.id),
        hasPermission(actor.id, "team", "read"),
      ]);

      const teams = await prisma.team.findMany({
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: {
          members: {
            orderBy: [{ order: "asc" }, { user: { name: "asc" } }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                  image: true,
                  department: true,
                  post: true,
                  bio: true,
                  linkedin: true,
                  github: true,
                  instagram: true,
                  banned: true,
                  roles: {
                    select: {
                      role: {
                        select: { id: true, name: true },
                      },
                    },
                  },
                },
              },
              memberPermissions: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isSystem: true,
                },
              },
            },
          },
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              members: true,
              applications: true,
            },
          },
        },
      });

      const formatted = teams
        .filter(
          (team) =>
            privileged ||
            canReadAllTeams ||
            team.members.some(
              (m) => m.userId === actor.id && getPositionRank(m.position) >= 2,
            ),
        )
        .map((team) => {
          const leadMember = team.members.find((m) => getPositionRank(m.position) === 3);
          const coLeadMember = team.members.find((m) => getPositionRank(m.position) === 2);
          return {
            id: team.id,
            name: team.name,
            description: team.description,
            type: team.type,
            order: team.order,
            createdAt: team.createdAt,
            updatedAt: team.updatedAt,
            memberCount: team._count.members,
            applicationCount: team._count.applications,
            leadName: leadMember?.user?.name || null,
            coLeadName: coLeadMember?.user?.name || null,
            members: team.members.map((m) => ({
              ...m.user,
              position: m.position,
              memberOrder: m.order,
              roles: m.user.roles.map((r) => r.role.name),
              roleIds: m.user.roles.map((r) => r.role.id),
              personalRoles: m.user.roles.map((r) => r.role),
              teamRoles: team.roles.map((tr) => tr.role),
              memberPermissions: m.memberPermissions,
            })),
            roles: team.roles.map((tr) => tr.role),
            permissions: team.permissions.map((tp) => ({
              id: tp.permission.id,
              resource: tp.permission.resource,
              action: tp.permission.action,
              scope: tp.permission.scope,
              key: `${tp.permission.resource}:${tp.permission.action}:${tp.permission.scope.toLowerCase()}`,
            })),
          };
        });

      return reply.send({ teams: formatted });
    },
  );

  // 2. GET /api/teams/:id - Single team details (own team for Leads/Co-Leads, any for privileged/team:read:any)
  app.get(
    "/:id",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;
      const [privileged, canReadAllTeams] = await Promise.all([
        isSystemPrivileged(actor.id),
        hasPermission(actor.id, "team", "read"),
      ]);

      if (!privileged && !canReadAllTeams) {
        const membership = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: id, userId: actor.id } },
        });
        if (!membership || getPositionRank(membership.position) < 2) {
          return reply.status(403).send({
            error: "Forbidden: Only team Leads, Co-Leads, or authorized admins can access this team.",
          });
        }
      }

      const team = await prisma.team.findUnique({
        where: { id },
        include: {
          members: {
            orderBy: [{ order: "asc" }, { user: { name: "asc" } }],
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phoneNumber: true,
                  image: true,
                  department: true,
                  post: true,
                  bio: true,
                  linkedin: true,
                  github: true,
                  instagram: true,
                  banned: true,
                  roles: {
                    select: {
                      role: {
                        select: { id: true, name: true },
                      },
                    },
                  },
                },
              },
              memberPermissions: true,
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  isSystem: true,
                },
              },
            },
          },
          permissions: {
            include: {
              permission: true,
            },
          },
          interviewRounds: {
            include: {
              evaluationParameters: true,
            },
          },
        },
      });

      if (!team) {
        return reply.status(404).send({ error: "Team not found" });
      }

      return reply.send({
        team: {
          id: team.id,
          name: team.name,
          description: team.description,
          type: team.type,
          order: team.order,
          createdAt: team.createdAt,
          updatedAt: team.updatedAt,
          members: team.members.map((m) => ({
            ...m.user,
            position: m.position,
            memberOrder: m.order,
            roles: m.user.roles.map((r) => r.role.name),
            roleIds: m.user.roles.map((r) => r.role.id),
            personalRoles: m.user.roles.map((r) => r.role),
            teamRoles: team.roles.map((tr) => tr.role),
            memberPermissions: m.memberPermissions,
          })),
          roles: team.roles.map((tr) => tr.role),
          permissions: team.permissions.map((tp) => ({
            id: tp.permission.id,
            resource: tp.permission.resource,
            action: tp.permission.action,
            scope: tp.permission.scope,
            key: `${tp.permission.resource}:${tp.permission.action}:${tp.permission.scope.toLowerCase()}`,
          })),
          interviewRounds: team.interviewRounds,
        },
      });
    },
  );

  // 2b. GET /api/teams/:id/available-users - Minimal user list for Leads/Co-Leads adding members
  app.get(
    "/:id/available-users",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;
      const [privileged, canAssignTeams] = await Promise.all([
        isSystemPrivileged(actor.id),
        hasPermission(actor.id, "team", "assign"),
      ]);

      if (!privileged && !canAssignTeams) {
        const membership = await prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: id, userId: actor.id } },
        });
        if (!membership || getPositionRank(membership.position) < 2) {
          return reply.status(403).send({ error: "Forbidden" });
        }
      }

      const users = await prisma.user.findMany({
        where: { banned: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          teamMemberships: {
            select: {
              team: { select: { id: true, name: true } },
            },
          },
        },
      });

      return reply.send({
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          team: u.teamMemberships[0]?.team || null,
        })),
      });
    },
  );

  // 3. POST /api/teams - Create a new team with permissions and members + positions
  app.post(
    "/",
    {
      preHandler: [authorize({ permission: TeamPermissions.CREATE_ANY })],
    },
    async (request, reply) => {
      const parsed = createTeamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const {
        name,
        description,
        type,
        order,
        roleIds,
        permissionKeys,
        memberUserIds,
        members,
      } = parsed.data;
      const actor = (request as any).user;

      if (roleIds && roleIds.length > 0) {
        const actorAuth = await permissionService.getAuthorizationContext(actor.id);
        if (!actorAuth.isSuperAdmin) {
          const superAdminRole = await prisma.role.findUnique({
            where: { name: "Super Admin" },
          });
          if (superAdminRole && roleIds.includes(superAdminRole.id)) {
            return reply.status(403).send({
              error: "Only Super Admins can assign the Super Admin role to a team.",
            });
          }
        }
      }

      const existing = await prisma.team.findUnique({ where: { name } });
      if (existing) {
        return reply.status(409).send({ error: `A team named "${name}" already exists.` });
      }

      const team = await prisma.team.create({
        data: {
          name,
          description: description || null,
          type,
          order,
        },
      });

      // Assign Team Roles (shared by all team members)
      if (roleIds && roleIds.length > 0) {
        const validRoles = await prisma.role.findMany({
          where: { id: { in: roleIds } },
          select: { id: true },
        });
        if (validRoles.length > 0) {
          await prisma.teamRole.createMany({
            data: validRoles.map((r) => ({ teamId: team.id, roleId: r.id })),
            skipDuplicates: true,
          });
        }
      }

      // Assign Permissions
      if (permissionKeys && permissionKeys.length > 0) {
        for (const key of permissionKeys) {
          const [resource, action, scope] = key.split(":");
          if (!resource || !action || !scope) continue;

          const normalizedScope = scope.toLowerCase() as "own" | "any";
          const dbPerm = await prisma.permission.findFirst({
            where: {
              resource,
              action,
              scope: normalizedScope,
            },
          });

          if (dbPerm) {
            await prisma.teamPermission.upsert({
              where: {
                teamId_permissionId: {
                  teamId: team.id,
                  permissionId: dbPerm.id,
                },
              },
              create: {
                teamId: team.id,
                permissionId: dbPerm.id,
              },
              update: {},
            });
          }
        }
      }

      // Assign Members (structured members take precedence over legacy memberUserIds)
      const memberEntries =
        members && members.length > 0
          ? members
          : (memberUserIds || []).map((userId, idx) => ({
              userId,
              position: "Member",
              order: idx,
            }));

      for (const entry of memberEntries) {
        await prisma.teamMember.deleteMany({
          where: { userId: entry.userId, teamId: { not: team.id } },
        });
        await prisma.teamMember.upsert({
          where: {
            teamId_userId: {
              teamId: team.id,
              userId: entry.userId,
            },
          },
          create: {
            teamId: team.id,
            userId: entry.userId,
            position: entry.position || "Member",
            order: entry.order ?? 0,
          },
          update: {
            position: entry.position || "Member",
            order: entry.order ?? 0,
          },
        });
      }

      await prisma.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: `Created new team: "${team.name}" (${team.type})`,
          category: "Teams",
          type: "user-action",
          status: "Completed",
          details: {
            teamId: team.id,
            teamName: team.name,
            teamType: team.type,
            assignedPermissions: permissionKeys || [],
            assignedMemberCount: memberEntries.length,
          },
        },
      });

      return reply.status(201).send({ success: true, team });
    },
  );

  // 4. PUT /api/teams/:id - Update team details, permissions, and members + positions
  app.put(
    "/:id",
    {
      preHandler: [authorize({ permission: TeamPermissions.UPDATE_ANY })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateTeamSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const existing = await prisma.team.findUnique({
        where: { id },
        include: { members: true },
      });
      if (!existing) {
        return reply.status(404).send({ error: "Team not found" });
      }

      const {
        name,
        description,
        type,
        order,
        roleIds,
        permissionKeys,
        memberUserIds,
        members,
      } = parsed.data;
      const actor = (request as any).user;

      if (roleIds && roleIds.length > 0) {
        const actorAuth = await permissionService.getAuthorizationContext(actor.id);
        if (!actorAuth.isSuperAdmin) {
          const superAdminRole = await prisma.role.findUnique({
            where: { name: "Super Admin" },
          });
          if (superAdminRole && roleIds.includes(superAdminRole.id)) {
            return reply.status(403).send({
              error: "Only Super Admins can assign the Super Admin role to a team.",
            });
          }
        }
      }

      if (name && name !== existing.name) {
        const nameConflict = await prisma.team.findUnique({ where: { name } });
        if (nameConflict) {
          return reply.status(409).send({ error: `A team named "${name}" already exists.` });
        }
      }

      const updated = await prisma.team.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(order !== undefined ? { order } : {}),
        },
      });

      // Update Team Roles if provided
      if (roleIds !== undefined) {
        await prisma.teamRole.deleteMany({ where: { teamId: id } });
        if (roleIds.length > 0) {
          const validRoles = await prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true },
          });
          if (validRoles.length > 0) {
            await prisma.teamRole.createMany({
              data: validRoles.map((r) => ({ teamId: id, roleId: r.id })),
              skipDuplicates: true,
            });
          }
        }
      }

      // Update Permissions if provided
      if (permissionKeys !== undefined) {
        await prisma.teamPermission.deleteMany({ where: { teamId: id } });

        for (const key of permissionKeys) {
          const [resource, action, scope] = key.split(":");
          if (!resource || !action || !scope) continue;

          const normalizedScope = scope.toLowerCase() as "own" | "any";
          const dbPerm = await prisma.permission.findFirst({
            where: {
              resource,
              action,
              scope: normalizedScope,
            },
          });

          if (dbPerm) {
            await prisma.teamPermission.create({
              data: {
                teamId: id,
                permissionId: dbPerm.id,
              },
            });
          }
        }
      }

      // Update Members if provided
      if (members !== undefined || memberUserIds !== undefined) {
        const existingPositionMap = new Map(
          existing.members.map((m) => [m.userId, { position: m.position, order: m.order }]),
        );

        const nextMembers =
          members !== undefined
            ? members
            : (memberUserIds || []).map((userId, idx) => ({
                userId,
                position: existingPositionMap.get(userId)?.position || "Member",
                order: existingPositionMap.get(userId)?.order ?? idx,
              }));

        await prisma.teamMember.deleteMany({ where: { teamId: id } });

        for (const entry of nextMembers) {
          await prisma.teamMember.deleteMany({
            where: { userId: entry.userId, teamId: { not: id } },
          });
          await prisma.teamMember.create({
            data: {
              teamId: id,
              userId: entry.userId,
              position: entry.position || "Member",
              order: entry.order ?? 0,
            },
          });
        }
      }

      await prisma.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: `Updated team configuration: "${updated.name}"`,
          category: "Teams",
          type: "user-action",
          status: "Completed",
          details: {
            teamId: id,
            teamName: updated.name,
            updatedPermissions: permissionKeys,
            memberCount: members?.length ?? memberUserIds?.length,
          },
        },
      });

      return reply.send({ success: true, team: updated });
    },
  );

  // 4b. PUT /api/teams/:id/roles - Assign/replace roles for the whole team
  app.put(
    "/:id/roles",
    {
      preHandler: [authorize({ permission: TeamPermissions.UPDATE_ANY })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;
      const parsed = updateTeamRolesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const team = await prisma.team.findUnique({ where: { id } });
      if (!team) {
        return reply.status(404).send({ error: "Team not found" });
      }

      const actorAuth = await permissionService.getAuthorizationContext(actor.id);
      if (!actorAuth.isSuperAdmin) {
        const superAdminRole = await prisma.role.findUnique({
          where: { name: "Super Admin" },
        });
        if (superAdminRole) {
          const currentlyHasSuperAdmin = await prisma.teamRole.findUnique({
            where: { teamId_roleId: { teamId: id, roleId: superAdminRole.id } },
          });
          const wantsSuperAdmin = parsed.data.roleIds.includes(superAdminRole.id);
          if (Boolean(currentlyHasSuperAdmin) !== wantsSuperAdmin) {
            return reply.status(403).send({
              error: "Only Super Admins can assign or remove the Super Admin role on a team.",
            });
          }
        }
      }

      const validRoles = await prisma.role.findMany({
        where: { id: { in: parsed.data.roleIds } },
        select: { id: true, name: true, description: true, isSystem: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.teamRole.deleteMany({ where: { teamId: id } });
        if (validRoles.length > 0) {
          await tx.teamRole.createMany({
            data: validRoles.map((r) => ({ teamId: id, roleId: r.id })),
            skipDuplicates: true,
          });
        }

        await tx.systemActivityLog.create({
          data: {
            userId: actor.id,
            userName: actor.name || actor.email || "Administrator",
            userRole: actor.role || "Admin",
            action: `Updated team roles for "${team.name}": ${validRoles.map((r) => r.name).join(", ") || "None"}`,
            category: "Teams",
            type: "user-action",
            status: "Completed",
            details: {
              teamId: id,
              roleIds: validRoles.map((r) => r.id),
              roleNames: validRoles.map((r) => r.name),
            },
          },
        });
      });

      return reply.send({
        success: true,
        roles: validRoles,
        message: "Team roles updated.",
      });
    },
  );

  // 5. DELETE /api/teams/:id - Delete a team
  app.delete(
    "/:id",
    {
      preHandler: [authorize({ permission: TeamPermissions.DELETE_ANY })],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;

      const team = await prisma.team.findUnique({
        where: { id },
        include: { _count: { select: { applications: true } } },
      });

      if (!team) {
        return reply.status(404).send({ error: "Team not found" });
      }

      if (team._count.applications > 0) {
        return reply.status(400).send({
          error: `Cannot delete team "${team.name}" because it has ${team._count.applications} linked induction applications. Reassign or resolve applications first.`,
        });
      }

      await prisma.team.delete({ where: { id } });

      await prisma.systemActivityLog.create({
        data: {
          userId: actor.id,
          userName: actor.name || actor.email || "Administrator",
          userRole: actor.role || "Admin",
          action: `Deleted team: "${team.name}"`,
          category: "Teams",
          type: "user-action",
          status: "Completed",
        },
      });

      return reply.send({ success: true, message: `Team "${team.name}" deleted successfully.` });
    },
  );

  // 6. POST /api/teams/:id/members - Add user(s) to team with optional position
  app.post(
    "/:id/members",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;
      const parsed = addMembersSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const team = await prisma.team.findUnique({ where: { id } });
      if (!team) {
        return reply.status(404).send({ error: "Team not found" });
      }

      for (const userId of parsed.data.userIds) {
        const check = await canManageTeamMember(actor.id, userId, id);
        if (!check.allowed) {
          return reply.status(403).send({ error: check.reason || "Forbidden" });
        }
      }

      await prisma.$transaction(async (tx) => {
        for (const userId of parsed.data.userIds) {
          await tx.teamMember.deleteMany({
            where: { userId, teamId: { not: id } },
          });
          await tx.teamMember.upsert({
            where: {
              teamId_userId: {
                teamId: id,
                userId,
              },
            },
            create: {
              teamId: id,
              userId,
              position: parsed.data.position,
            },
            update: {
              position: parsed.data.position,
            },
          });
        }

        await tx.systemActivityLog.create({
          data: {
            userId: actor.id,
            userName: actor.name || actor.email || "Administrator",
            userRole: actor.role || "Admin",
            action: `Added ${parsed.data.userIds.length} member(s) to "${team.name}" as ${parsed.data.position}`,
            category: "Teams",
            type: "user-action",
            status: "Completed",
            details: {
              teamId: id,
              userIds: parsed.data.userIds,
              position: parsed.data.position,
            },
          },
        });
      });

      return reply.send({ success: true, message: "Members assigned to team." });
    },
  );

  // 6b. POST /api/teams/:id/members/new - Create/upsert User with full profile + email and add to team with position & individual roles
  app.post(
    "/:id/members/new",
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = (request as any).user;
      const parsed = createAndAddMemberSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const team = await prisma.team.findUnique({ where: { id } });
      if (!team) {
        return reply.status(404).send({ error: "Team not found" });
      }

      const [actorPrivileged, actorAuth] = await Promise.all([
        isSystemPrivileged(actor.id),
        permissionService.getAuthorizationContext(actor.id),
      ]);

      if (!actorPrivileged && !actorAuth.isSuperAdmin) {
        const hasTeamAssign = actorAuth.permissions.some(
          (p) =>
            p.key === "team:assign:any" ||
            p.key === "team:update:any" ||
            p.key === "user:create:any",
        );
        if (!hasTeamAssign) {
          const actorMembership = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId: id, userId: actor.id } },
          });
          if (!actorMembership || getPositionRank(actorMembership.position) < 2) {
            return reply.status(403).send({
              error: "Forbidden: Only Super Admin, Developer, or Team Leads/Co-Leads can create and add members.",
            });
          }
        }
      }

      const data = parsed.data;

      if (data.roleIds.length > 0 && !actorAuth.isSuperAdmin) {
        const superAdminRole = await prisma.role.findUnique({
          where: { name: "Super Admin" },
        });
        if (superAdminRole && data.roleIds.includes(superAdminRole.id)) {
          return reply.status(403).send({
            error: "Only Super Admins can assign the Super Admin role.",
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        let user = await tx.user.findFirst({
          where: { email: { equals: data.email, mode: "insensitive" } },
        });

        let createdNewUser = false;
        if (!user) {
          createdNewUser = true;
          user = await tx.user.create({
            data: {
              id: crypto.randomUUID(),
              name: data.name,
              email: data.email,
              emailVerified: true,
              phoneNumber: data.phoneNumber || null,
              department: data.department || null,
              post: data.post || null,
              bio: data.bio || null,
              linkedin: data.linkedin || null,
              github: data.github || null,
              instagram: data.instagram || null,
              creationSource: "manual",
            },
          });
        } else {
          user = await tx.user.update({
            where: { id: user.id },
            data: {
              ...(data.name ? { name: data.name } : {}),
              ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber || null } : {}),
              ...(data.department !== undefined ? { department: data.department || null } : {}),
              ...(data.post !== undefined ? { post: data.post || null } : {}),
              ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
              ...(data.linkedin !== undefined ? { linkedin: data.linkedin || null } : {}),
              ...(data.github !== undefined ? { github: data.github || null } : {}),
              ...(data.instagram !== undefined ? { instagram: data.instagram || null } : {}),
            },
          });
        }

        await tx.teamMember.deleteMany({
          where: { userId: user.id, teamId: { not: id } },
        });
        await tx.teamMember.upsert({
          where: { teamId_userId: { teamId: id, userId: user.id } },
          create: {
            teamId: id,
            userId: user.id,
            position: data.position,
          },
          update: {
            position: data.position,
          },
        });

        if (data.roleIds.length > 0) {
          const validRoles = await tx.role.findMany({
            where: { id: { in: data.roleIds } },
            select: { id: true },
          });
          if (validRoles.length > 0) {
            await tx.userRole.createMany({
              data: validRoles.map((r) => ({ userId: user.id, roleId: r.id })),
              skipDuplicates: true,
            });
          }
        }

        await tx.systemActivityLog.create({
          data: {
            userId: actor.id,
            userName: actor.name || actor.email || "Administrator",
            userRole: actor.role || "Admin",
            action: `${createdNewUser ? "Created user & added" : "Updated user & added"} ${user.name || user.email} to "${team.name}" as ${data.position}`,
            category: "Teams",
            type: "user-action",
            status: "Completed",
            details: {
              teamId: id,
              targetUserId: user.id,
              email: user.email,
              position: data.position,
              roleIds: data.roleIds,
            },
          },
        });

        return { user, createdNewUser };
      });

      return reply.status(201).send({
        success: true,
        user: result.user,
        createdNewUser: result.createdNewUser,
        message: `${result.user.name || result.user.email} added to ${team.name}.`,
      });
    },
  );

  // 6c. PUT /api/teams/:id/members/:userId/roles - Update individual roles for a team member
  app.put(
    "/:id/members/:userId/roles",
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const actor = (request as any).user;
      const parsed = updateMemberRolesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const check = await canManageTeamMember(actor.id, userId, id);
      if (!check.allowed) {
        return reply.status(403).send({ error: check.reason || "Forbidden" });
      }

      const actorAuth = await permissionService.getAuthorizationContext(actor.id);
      if (!actorAuth.isSuperAdmin) {
        const superAdminRole = await prisma.role.findUnique({
          where: { name: "Super Admin" },
        });
        if (superAdminRole) {
          const currentlyHasSuperAdmin = await prisma.userRole.findUnique({
            where: { userId_roleId: { userId, roleId: superAdminRole.id } },
          });
          const wantsSuperAdmin = parsed.data.roleIds.includes(superAdminRole.id);
          if (Boolean(currentlyHasSuperAdmin) !== wantsSuperAdmin) {
            return reply.status(403).send({
              error: "Only Super Admins can assign or remove the Super Admin role.",
            });
          }
        }
      }

      const validRoles = await prisma.role.findMany({
        where: { id: { in: parsed.data.roleIds } },
        select: { id: true, name: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.userRole.deleteMany({ where: { userId } });
        if (validRoles.length > 0) {
          await tx.userRole.createMany({
            data: validRoles.map((r) => ({ userId, roleId: r.id })),
            skipDuplicates: true,
          });
        }
      });

      return reply.send({
        success: true,
        roles: validRoles,
        message: "Member roles updated.",
      });
    },
  );

  // 7. PATCH /api/teams/:id/members/:userId - Manually change a member's position inside the team
  app.patch(
    "/:id/members/:userId",
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const actor = (request as any).user;
      const parsed = updateMemberPositionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const check = await canManageTeamMember(actor.id, userId, id);
      if (!check.allowed) {
        return reply.status(403).send({ error: check.reason || "Forbidden" });
      }

      const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId } },
      });

      if (!membership) {
        return reply.status(404).send({ error: "Team membership not found" });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const res = await tx.teamMember.update({
          where: { teamId_userId: { teamId: id, userId } },
          data: {
            position: parsed.data.position,
            ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            team: { select: { id: true, name: true } },
          },
        });

        await tx.systemActivityLog.create({
          data: {
            userId: actor.id,
            userName: actor.name || actor.email || "Administrator",
            userRole: actor.role || "Admin",
            action: `Changed ${res.user.name || res.user.email}'s position in "${res.team.name}" from ${membership.position} to ${res.position}`,
            category: "Teams",
            type: "user-action",
            status: "Completed",
            details: {
              teamId: id,
              targetUserId: userId,
              previousState: { position: membership.position },
              newState: { position: res.position },
            },
          },
        });

        return res;
      });

      return reply.send({
        success: true,
        member: {
          ...updated.user,
          position: updated.position,
          order: updated.order,
          teamName: updated.team.name,
        },
      });
    },
  );

  // 8. DELETE /api/teams/:id/members/:userId - Remove user from team (never deletes global User)
  app.delete(
    "/:id/members/:userId",
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const actor = (request as any).user;

      const check = await canManageTeamMember(actor.id, userId, id);
      if (!check.allowed) {
        return reply.status(403).send({ error: check.reason || "Forbidden" });
      }

      const existing = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId } },
        include: {
          user: { select: { name: true, email: true } },
          team: { select: { name: true } },
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.teamMember.deleteMany({
          where: {
            teamId: id,
            userId,
          },
        });

        await tx.permissionDelegation.updateMany({
          where: { teamId: id, toUserId: userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        await tx.systemActivityLog.create({
          data: {
            userId: actor.id,
            userName: actor.name || actor.email || "Administrator",
            userRole: actor.role || "Admin",
            action: `Removed ${existing?.user?.name || existing?.user?.email || userId} from "${existing?.team?.name || id}"`,
            category: "Teams",
            type: "user-action",
            status: "Completed",
            details: {
              teamId: id,
              targetUserId: userId,
              previousState: { position: existing?.position },
            },
          },
        });
      });

      return reply.send({ success: true, message: "Member removed from team." });
    },
  );

  // 9. GET /api/teams/:id/activity - Team-scoped activity logs
  app.get("/:id/activity", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = (request as any).user;

    const privileged = await isSystemPrivileged(actor.id);
    if (!privileged) {
      const membership = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: actor.id } },
      });
      if (!membership) {
        return reply.status(403).send({ error: "Forbidden: Not a member of this team." });
      }
    }

    const logs = await prisma.systemActivityLog.findMany({
      where: {
        details: {
          path: ["teamId"],
          equals: id,
        },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    });

    return reply.send({ logs });
  });
};
