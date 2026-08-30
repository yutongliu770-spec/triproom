import { getMockDemoSeed } from "@/lib/travel/mock-provider";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import { getPersistedRoomActivity } from "@/lib/preferences/state";
import { travelDataService } from "@/lib/travel/service";
import type { DemoRoomData } from "@/lib/types";

export async function getDemoRoom(): Promise<DemoRoomData> {
  const seed = getMockDemoSeed();
  const [nodes, relations, initialCards] = await Promise.all([
    travelDataService.getAllNodes(),
    travelDataService.getAllRelations(),
    travelDataService.getCardsForNodes(seed.initialCardIds)
  ]);
  const persisted = await getPersistedDemoActivity(seed.trip.id);

  return {
    trip: seed.trip,
    nodes,
    relations,
    messages: persisted?.messages.length ? persisted.messages : seed.messages,
    materials: persisted?.materials ?? seed.materials,
    signals: persisted?.signals ?? seed.signals,
    plans: seed.plans,
    roomNodeStates: persisted?.roomNodeStates.length ? persisted.roomNodeStates : seed.roomNodeStates,
    placeOpinions: persisted?.placeOpinions,
    evidences: persisted?.evidences,
    constraints: persisted?.constraints,
    memberPlaceProfiles: persisted?.memberPlaceProfiles,
    roomPlaceProfiles: persisted?.roomPlaceProfiles,
    initialCards
  };
}

export async function getDemoTrip() {
  const room = await getDemoRoom();
  return room.trip;
}

async function getPersistedDemoActivity(tripId: string) {
  try {
    await ensureDemoRoomPersisted(tripId);
    return await getPersistedRoomActivity(tripId);
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("TripRoom database is unavailable; falling back to seed demo state.", error);
    }
    return undefined;
  }
}
