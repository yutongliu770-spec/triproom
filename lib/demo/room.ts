import { getMockDemoSeed } from "@/lib/travel/mock-provider";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import { getPersistedRoomActivity } from "@/lib/preferences/state";
import { travelDataService } from "@/lib/travel/service";
import type { DemoRoomData } from "@/lib/types";

export async function getDemoRoom(tripId?: string): Promise<DemoRoomData> {
  const seed = getMockDemoSeed(tripId);
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
    plans: persisted?.plans ?? seed.plans,
    roomNodeStates: persisted?.roomNodeStates.length ? persisted.roomNodeStates : seed.roomNodeStates,
    placeOpinions: persisted?.placeOpinions ?? seed.placeOpinions,
    evidences: persisted?.evidences ?? seed.evidences,
    constraints: persisted?.constraints ?? seed.constraints,
    memberPlaceProfiles: persisted?.memberPlaceProfiles ?? seed.memberPlaceProfiles,
    roomPlaceProfiles: persisted?.roomPlaceProfiles ?? seed.roomPlaceProfiles,
    initialCards,
    initialActiveMemberIds: seed.initialActiveMemberIds,
    persistenceMode: persisted ? "database" : "seed_fallback"
  };
}

export async function getDemoTrip(tripId?: string) {
  const room = await getDemoRoom(tripId);
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
