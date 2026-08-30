import { prisma } from "@/lib/db/client";
import type { ChatMessage, Material } from "@/lib/types";
import {
  serializeConstraint,
  serializeEvidence,
  serializeMemberPlaceProfile,
  serializePlaceOpinion,
  serializeRoomNodeState,
  serializeRoomPlaceProfile,
  serializeSignal
} from "@/lib/preferences/serializers";

export async function getPreferenceState(tripId: string) {
  const [
    evidences,
    signals,
    constraints,
    memberPlaceProfiles,
    roomPlaceProfiles,
    placeOpinions,
    roomNodeStates
  ] = await Promise.all([
    prisma.evidence.findMany({
      where: { tripId, deletedAt: null },
      orderBy: { createdAt: "asc" }
    }),
    prisma.memberSignal.findMany({
      where: { tripId, invalidatedAt: null },
      orderBy: { createdAt: "asc" }
    }),
    prisma.memberConstraint.findMany({
      where: { tripId, status: "active" },
      orderBy: { createdAt: "asc" }
    }),
    prisma.memberPlaceProfile.findMany({
      where: { tripId },
      orderBy: { updatedAt: "asc" }
    }),
    prisma.roomPlaceProfile.findMany({
      where: { tripId },
      orderBy: { updatedAt: "asc" }
    }),
    prisma.placeOpinion.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" }
    }),
    prisma.roomNodeState.findMany({
      where: { tripId },
      orderBy: { nodeId: "asc" }
    })
  ]);

  return {
    evidences: evidences.map(serializeEvidence),
    signals: signals.map(serializeSignal),
    constraints: constraints.map(serializeConstraint),
    memberPlaceProfiles: memberPlaceProfiles.map(serializeMemberPlaceProfile),
    roomPlaceProfiles: roomPlaceProfiles.map(serializeRoomPlaceProfile),
    placeOpinions: placeOpinions.map(serializePlaceOpinion),
    roomNodeStates: roomNodeStates.map(serializeRoomNodeState)
  };
}

export async function getPersistedRoomActivity(tripId: string) {
  const [messages, materials, preferenceState] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { tripId },
      orderBy: { createdAt: "asc" }
    }),
    prisma.material.findMany({
      where: { tripId },
      orderBy: { createdAt: "desc" }
    }),
    getPreferenceState(tripId)
  ]);

  return {
    messages: messages.map<ChatMessage>((message) => ({
      id: message.id,
      tripId: message.tripId,
      authorType: message.authorType as ChatMessage["authorType"],
      authorMemberId: message.authorMemberId ?? undefined,
      messageType: message.messageType as ChatMessage["messageType"],
      textContent: message.textContent ?? undefined,
      payload:
        message.payload && typeof message.payload === "object" && !Array.isArray(message.payload)
          ? (message.payload as Record<string, unknown>)
          : undefined,
      visibility: message.visibility as ChatMessage["visibility"],
      createdAt: message.createdAt.toISOString()
    })),
    materials: materials.map<Material>((material) => ({
      id: material.id,
      tripId: material.tripId,
      createdByType: material.createdByType as Material["createdByType"],
      createdByMemberId: material.createdByMemberId ?? undefined,
      materialType: material.materialType as Material["materialType"],
      sourceType: material.sourceType as Material["sourceType"],
      sourceProvider: material.sourceProvider ?? undefined,
      sourceUrl: material.sourceUrl ?? undefined,
      rawText: material.rawText ?? undefined,
      attachmentUrl: material.attachmentUrl ?? undefined,
      title: material.title,
      summary: material.summary ?? undefined,
      status: material.status as Material["status"],
      primaryNodeId: material.primaryNodeId ?? undefined,
      extractionStatus: material.extractionStatus as Material["extractionStatus"],
      extractionConfidence: material.extractionConfidence,
      createdAt: material.createdAt.toISOString()
    })),
    ...preferenceState
  };
}
