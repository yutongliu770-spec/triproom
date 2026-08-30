import { prisma } from "@/lib/db/client";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";

async function main() {
  console.log("Persisting TripRoom demo base data into PostgreSQL.");
  await ensureDemoRoomPersisted("demo-japan-7d");
  console.log("Demo Trip, members, destination nodes, messages, and room node states are ready.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
