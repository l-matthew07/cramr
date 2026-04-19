import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const devUserId = process.env.DEV_USER_ID;

  // Dev user (matches DEV_USER_ID if set)
  const user = await prisma.user.upsert({
    where: { email: process.env.DEV_USER_EMAIL ?? "dev@cramr.local" },
    update: {},
    create: {
      ...(devUserId ? { id: devUserId } : {}),
      email: process.env.DEV_USER_EMAIL ?? "dev@cramr.local",
      displayName: "Dev User",
      timezone: "America/Los_Angeles",
    },
  });
  console.log(`user: ${user.id} (${user.email})`);

  // Demo group so there's something to look at in dev.
  const group = await prisma.group.upsert({
    where: { inviteCode: "DEMO1234" },
    update: {},
    create: {
      name: "Study Squad",
      inviteCode: "DEMO1234",
      createdBy: user.id,
    },
  });
  await prisma.groupMembership.upsert({
    where: { userId_groupId: { userId: user.id, groupId: group.id } },
    update: {},
    create: { userId: user.id, groupId: group.id, role: "owner" },
  });

  console.log(`group: ${group.name} — invite code ${group.inviteCode}`);
  console.log("Done. Create courses via the app UI.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
