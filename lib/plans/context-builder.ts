import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import {
  serializeConstraint,
  serializeEvidence,
  serializeMemberPlaceProfile,
  serializeRoomPlaceProfile,
  serializeSignal
} from "@/lib/preferences/serializers";
import { travelDataService } from "@/lib/travel/service";
import type {
  DestinationNode,
  DestinationRelation,
  Evidence,
  Member,
  MemberConstraint,
  MemberPlaceProfile,
  MemberSignal,
  RoomPlaceProfile,
  Trip
} from "@/lib/types";

export interface PlanningContext {
  snapshotId: string;
  trip: Trip;
  members: Member[];
  destinationNodes: DestinationNode[];
  destinationRelations: DestinationRelation[];
  roomPlaceProfiles: RoomPlaceProfile[];
  memberPlaceProfiles: MemberPlaceProfile[];
  constraints: MemberConstraint[];
  keyEvidence: Evidence[];
  keySignals: MemberSignal[];
}

export class PlanningContextBuilder {
  async build(input: {
    tripId: string;
    createdByMemberId?: string;
    triggerType: "manual_generate" | "plan_revision";
  }): Promise<PlanningContext> {
    await ensureDemoRoomPersisted(input.tripId);

    const [
      tripRecord,
      allNodes,
      allRelations,
      roomProfiles,
      memberProfiles,
      constraints,
      signals
    ] = await Promise.all([
      prisma.trip.findUnique({
        where: { id: input.tripId },
        include: { memberships: { include: { member: true } } }
      }),
      travelDataService.getAllNodes(),
      travelDataService.getAllRelations(),
      prisma.roomPlaceProfile.findMany({
        where: { tripId: input.tripId },
        orderBy: [{ teamInterestScore: "desc" }, { engagementScore: "desc" }]
      }),
      prisma.memberPlaceProfile.findMany({
        where: { tripId: input.tripId },
        orderBy: [{ interestScore: "desc" }, { updatedAt: "desc" }]
      }),
      prisma.memberConstraint.findMany({
        where: { tripId: input.tripId, status: "active" },
        orderBy: [{ severity: "desc" }, { createdAt: "asc" }]
      }),
      prisma.memberSignal.findMany({
        where: { tripId: input.tripId, invalidatedAt: null },
        orderBy: [{ intensity: "desc" }, { createdAt: "desc" }],
        take: 80
      })
    ]);

    if (!tripRecord) {
      throw new Error(`Trip not found: ${input.tripId}`);
    }

    const serializedRoomProfiles = roomProfiles.map(serializeRoomPlaceProfile);
    const serializedMemberProfiles = memberProfiles.map(serializeMemberPlaceProfile);
    const serializedConstraints = constraints.map(serializeConstraint);
    const serializedSignals = signals.map(serializeSignal);
    const keyEvidenceIds = uniqueStrings([
      ...serializedRoomProfiles.flatMap((profile) => profile.sourceEvidenceIds),
      ...serializedMemberProfiles.flatMap((profile) => profile.sourceEvidenceIds),
      ...serializedConstraints.flatMap((constraint) => constraint.evidenceIds ?? []),
      ...serializedSignals.map((signal) => signal.evidenceId)
    ]).slice(0, 80);
    const evidenceRecords = keyEvidenceIds.length
      ? await prisma.evidence.findMany({
          where: { tripId: input.tripId, id: { in: keyEvidenceIds }, deletedAt: null },
          orderBy: { createdAt: "asc" }
        })
      : [];

    const candidateNodeIds = buildCandidateNodeIds({
      roomProfiles: serializedRoomProfiles,
      memberProfiles: serializedMemberProfiles,
      constraints: serializedConstraints,
      allNodes
    });
    const destinationNodes = allNodes.filter((node) => candidateNodeIds.has(node.id));
    const destinationRelations = allRelations.filter(
      (relation) => candidateNodeIds.has(relation.fromNodeId) && candidateNodeIds.has(relation.toNodeId)
    );
    const members = tripRecord.memberships.map(({ member, role }) => ({
      id: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl ?? undefined,
      role: role as Member["role"]
    }));
    const trip: Trip = {
      id: tripRecord.id,
      name: tripRecord.name,
      inviteCode: tripRecord.inviteCode,
      roughDestination: tripRecord.roughDestination ?? undefined,
      tripDurationDays: tripRecord.tripDurationDays ?? undefined,
      roughDateText: tripRecord.roughDateText ?? undefined,
      currentFocusNodeId: tripRecord.currentFocusNodeId ?? undefined,
      members
    };
    const keyEvidence = evidenceRecords.map(serializeEvidence);
    const snapshotId = `pcs-${randomUUID()}`;

    await prisma.planningContextSnapshot.create({
      data: {
        id: snapshotId,
        tripId: input.tripId,
        createdByMemberId: input.createdByMemberId,
        triggerType: input.triggerType,
        tripSnapshot: jsonInput(trip),
        membersSnapshot: jsonInput(members),
        destinationNodesSnapshot: jsonInput(destinationNodes),
        destinationRelationsSnapshot: jsonInput(destinationRelations),
        roomPlaceProfilesSnapshot: jsonInput(serializedRoomProfiles),
        memberPlaceProfilesSnapshot: jsonInput(serializedMemberProfiles),
        constraintsSnapshot: jsonInput(serializedConstraints),
        keyEvidenceRefs: jsonInput(keyEvidence),
        keySignalRefs: jsonInput(serializedSignals.slice(0, 60)),
        providerContextSnapshot: jsonInput({
          travelProvider: "mock_seed",
          budgetAndTransit: "reference_estimate_only"
        })
      }
    });

    return {
      snapshotId,
      trip,
      members,
      destinationNodes,
      destinationRelations,
      roomPlaceProfiles: serializedRoomProfiles,
      memberPlaceProfiles: serializedMemberProfiles,
      constraints: serializedConstraints,
      keyEvidence,
      keySignals: serializedSignals
    };
  }
}

export const planningContextBuilder = new PlanningContextBuilder();

function buildCandidateNodeIds(input: {
  roomProfiles: RoomPlaceProfile[];
  memberProfiles: MemberPlaceProfile[];
  constraints: MemberConstraint[];
  allNodes: DestinationNode[];
}) {
  const ids = new Set<string>(["japan", "tokyo", "osaka", "kyoto", "hakone", "fuji-kawaguchiko"]);

  for (const profile of input.roomProfiles.slice(0, 14)) ids.add(profile.nodeId);
  for (const profile of input.memberProfiles.slice(0, 18)) ids.add(profile.nodeId);
  for (const constraint of input.constraints) {
    if (constraint.targetType === "node" && constraint.targetId) ids.add(constraint.targetId);
  }

  for (const id of Array.from(ids)) {
    let node = input.allNodes.find((item) => item.id === id);
    while (node?.parentId) {
      ids.add(node.parentId);
      node = input.allNodes.find((item) => item.id === node?.parentId);
    }
  }

  for (const node of input.allNodes) {
    if (node.parentId && ids.has(node.parentId)) ids.add(node.id);
  }

  return ids;
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
