import type { PrismaClient } from "../../generated/prisma/client";

export async function seedTeams(prisma: PrismaClient): Promise<void> {
  console.log("\n👥 Seeding teams, team roles, and team members...");

  const roles = await prisma.role.findMany({
    select: { id: true, name: true },
  });
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));

  const sampleUsers = [
    {
      email: "aarav.media@nitp.ac.in",
      name: "Aarav Sharma",
      department: "CSE",
      post: "Media Lead",
      personalRoleNames: ["Evaluator"],
    },
    {
      email: "priya.media@nitp.ac.in",
      name: "Priya Verma",
      department: "ECE",
      post: "Content Designer",
      personalRoleNames: [],
    },
    {
      email: "rohan.tech@nitp.ac.in",
      name: "Rohan Singh",
      department: "CSE",
      post: "Full Stack Lead",
      personalRoleNames: ["Admin"],
    },
    {
      email: "ananya.events@nitp.ac.in",
      name: "Ananya Gupta",
      department: "ME",
      post: "Event Coordinator",
      personalRoleNames: ["Interviewer"],
    },
  ];

  const userByEmail = new Map<string, string>();

  for (const u of sampleUsers) {
    let user = await prisma.user.findFirst({
      where: { email: { equals: u.email, mode: "insensitive" } },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: u.email,
          name: u.name,
          emailVerified: true,
          department: u.department,
          post: u.post,
          creationSource: "manual",
        },
      });
    }
    userByEmail.set(u.email, user.id);

    for (const roleName of u.personalRoleNames) {
      const roleId = roleByName.get(roleName);
      if (roleId) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId } },
          create: { userId: user.id, roleId },
          update: {},
        });
      }
    }
  }

  const teamsToSeed = [
    {
      name: "Media & Design Team",
      description: "Handles social media, gallery, notices, and visual branding.",
      type: "OPERATIONAL" as const,
      order: 1,
      teamRoleNames: ["Member", "Editor"].filter((n) => roleByName.has(n)),
      members: [
        { email: "aarav.media@nitp.ac.in", position: "Lead", order: 0 },
        { email: "priya.media@nitp.ac.in", position: "Member", order: 1 },
      ],
    },
    {
      name: "Web & Tech Team",
      description: "Maintains portals, event tech infrastructure, and deployments.",
      type: "OPERATIONAL" as const,
      order: 2,
      teamRoleNames: ["Member", "Moderator"].filter((n) => roleByName.has(n)),
      members: [
        { email: "rohan.tech@nitp.ac.in", position: "Lead", order: 0 },
      ],
    },
    {
      name: "Events & Outreach Team",
      description: "Organizes entrepreneurship talks, hackathons, and induction drives.",
      type: "OPERATIONAL" as const,
      order: 3,
      teamRoleNames: ["Member"].filter((n) => roleByName.has(n)),
      members: [
        { email: "ananya.events@nitp.ac.in", position: "Co-Lead", order: 0 },
      ],
    },
  ];

  // Fallback: if none of the specific role names matched, assign the first non-Super Admin role
  const fallbackRole = roles.find((r) => r.name !== "Super Admin");

  for (const t of teamsToSeed) {
    const team = await prisma.team.upsert({
      where: { name: t.name },
      create: {
        name: t.name,
        description: t.description,
        type: t.type,
        order: t.order,
      },
      update: {
        description: t.description,
        type: t.type,
        order: t.order,
      },
    });

    const roleIds = t.teamRoleNames
      .map((name) => roleByName.get(name))
      .filter((id): id is string => Boolean(id));

    if (roleIds.length === 0 && fallbackRole) {
      roleIds.push(fallbackRole.id);
    }

    for (const roleId of roleIds) {
      await prisma.teamRole.upsert({
        where: { teamId_roleId: { teamId: team.id, roleId } },
        create: { teamId: team.id, roleId },
        update: {},
      });
    }

    for (const m of t.members) {
      const userId = userByEmail.get(m.email);
      if (!userId) continue;
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId } },
        create: {
          teamId: team.id,
          userId,
          position: m.position,
          order: m.order,
        },
        update: {
          position: m.position,
          order: m.order,
        },
      });
    }

    console.log(`   ✓ ${team.name} (${t.members.length} members, ${roleIds.length} team role(s))`);
  }

  console.log("✅ Teams, team roles, and members seeded.");
}
