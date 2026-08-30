import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getMockDemoSeed } from "@/lib/travel/mock-provider";
import { travelDataService } from "@/lib/travel/service";

export async function ensureDemoRoomPersisted(tripId: string) {
  if (tripId !== "demo-japan-7d") return;

  const seed = getMockDemoSeed();
  const [nodes, initialRoomStates] = await Promise.all([
    travelDataService.getAllNodes(),
    Promise.resolve(seed.roomNodeStates)
  ]);

  await prisma.trip.upsert({
    where: { id: seed.trip.id },
    create: {
      id: seed.trip.id,
      name: seed.trip.name,
      inviteCode: seed.trip.inviteCode,
      status: "active",
      roughDestination: seed.trip.roughDestination,
      tripDurationDays: seed.trip.tripDurationDays,
      roughDateText: seed.trip.roughDateText,
      currentFocusNodeId: seed.trip.currentFocusNodeId
    },
    update: {
      name: seed.trip.name,
      inviteCode: seed.trip.inviteCode,
      roughDestination: seed.trip.roughDestination,
      tripDurationDays: seed.trip.tripDurationDays,
      roughDateText: seed.trip.roughDateText,
      currentFocusNodeId: seed.trip.currentFocusNodeId
    }
  });

  for (const member of seed.trip.members) {
    await prisma.member.upsert({
      where: { id: member.id },
      create: {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl
      },
      update: {
        displayName: member.displayName,
        avatarUrl: member.avatarUrl
      }
    });

    await prisma.tripMember.upsert({
      where: {
        tripId_memberId: {
          tripId: seed.trip.id,
          memberId: member.id
        }
      },
      create: {
        tripId: seed.trip.id,
        memberId: member.id,
        role: member.role ?? "member",
        joinStatus: "joined"
      },
      update: {
        role: member.role ?? "member"
      }
    });
  }

  for (const message of seed.messages) {
    await prisma.chatMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        tripId: message.tripId,
        authorType: message.authorType,
        authorMemberId: message.authorMemberId,
        messageType: message.messageType,
        textContent: message.textContent,
        payload: jsonInput(message.payload),
        visibility: message.visibility,
        createdAt: new Date(message.createdAt)
      },
      update: {}
    });
  }

  for (const node of nodes) {
    await prisma.destinationNode.upsert({
      where: { id: node.id },
      create: {
        id: node.id,
        provider: node.provider,
        providerPlaceId: node.providerPlaceId,
        canonicalName: node.canonicalName,
        aliases: jsonRequired(node.aliases),
        nodeType: node.nodeType,
        parentId: node.parentId,
        countryCode: node.countryCode,
        latitude: node.geo?.latitude,
        longitude: node.geo?.longitude,
        shortSummary: node.shortSummary,
        longDescription: node.longDescription,
        highlights: jsonRequired(node.highlights),
        tags: jsonRequired(node.tags),
        suggestedStayText: node.suggestedStayText,
        budgetBand: node.budgetBand,
        heroImageUrl: node.heroImageUrl,
        images: jsonInput(node.images),
        imageAlt: node.imageAlt,
        dataSource: node.dataSource,
        dataFreshness: node.dataFreshness,
        dataAsOf: node.dataAsOf,
        lastSyncedAt: node.lastSyncedAt,
        popularityScore: node.popularityScore,
        socialDiscovery: jsonInput(node.socialDiscovery),
        isSeedData: node.isSeedData
      },
      update: {
        canonicalName: node.canonicalName,
        aliases: jsonInput(node.aliases),
        nodeType: node.nodeType,
        parentId: node.parentId,
        latitude: node.geo?.latitude,
        longitude: node.geo?.longitude,
        shortSummary: node.shortSummary,
        highlights: jsonInput(node.highlights),
        tags: jsonInput(node.tags),
        suggestedStayText: node.suggestedStayText,
        budgetBand: node.budgetBand,
        heroImageUrl: node.heroImageUrl,
        images: jsonInput(node.images),
        imageAlt: node.imageAlt,
        socialDiscovery: jsonInput(node.socialDiscovery)
      }
    });
  }

  for (const state of initialRoomStates) {
    await prisma.roomNodeState.upsert({
      where: {
        tripId_nodeId: {
          tripId: state.tripId,
          nodeId: state.nodeId
        }
      },
      create: {
        tripId: state.tripId,
        nodeId: state.nodeId,
        state: state.state,
        explorationState: state.explorationState,
        engagementScore: state.engagementScore,
        interestScore: state.interestScore,
        disagreementScore: state.disagreementScore,
        mentionCount: state.mentionCount ?? 0,
        interactionCount: state.interactionCount ?? 0,
        source: state.source,
        shownCount: state.shownCount,
        aggregateSignal: jsonInput(state.aggregateSignal)
      },
      update: {}
    });
  }
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function jsonRequired(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
