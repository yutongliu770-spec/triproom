import { prisma } from "@/lib/db/client";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import { getKnownDemoTripIds } from "@/lib/travel/mock-provider";

async function main() {
  console.log("Persisting TripRoom demo base data into PostgreSQL.");
  for (const tripId of getKnownDemoTripIds()) {
    await ensureDemoRoomPersisted(tripId);
  }
  console.log("Fresh and Quick Demo trips, members, destination nodes, messages, and room node states are ready.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
