import { prisma } from "@/lib/db/client";
import { resetDemoSeeds } from "@/lib/preferences/demo-persistence";

async function main() {
  const logger = (message: string) => console.log(`${new Date().toISOString()} ${message}`);
  logger("Resetting TripRoom demo data.");
  await resetDemoSeeds({ logger });
  logger("Quick Demo and Fresh Demo have been restored to their fixed seed states.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
