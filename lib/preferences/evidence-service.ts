import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { detectMentionedPlaceIds } from "@/lib/graph/place-state";
import { signalTypeForReaction } from "@/lib/preferences/reaction";
import { preferenceAnalysisService } from "@/lib/preferences/preference-analysis-service";
import { travelDataService } from "@/lib/travel/service";
import type {
  EvidenceType,
  Material,
  PlaceOpinionSourceType,
  ReactionType
} from "@/lib/types";

export class EvidenceService {
  async recordChatMessage(input: {
    id?: string;
    tripId: string;
    memberId: string;
    text: string;
    visibility: "group" | "ai_only";
    messageType?: "user_text" | "user_voice";
    createdAt?: string;
  }) {
    const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
    const messageId = input.id ?? `msg-${randomUUID()}`;
    const message = await prisma.chatMessage.upsert({
      where: { id: messageId },
      create: {
        id: messageId,
        tripId: input.tripId,
        authorType: "member",
        authorMemberId: input.memberId,
        messageType: input.messageType ?? "user_text",
        textContent: input.text,
        visibility: input.visibility,
        createdAt
      },
      update: {
        textContent: input.text,
        visibility: input.visibility
      }
    });

    const evidenceType: EvidenceType = input.messageType === "user_voice" ? "voice_comment" : "chat_message";
    return this.createEvidenceForTextTargets({
      tripId: input.tripId,
      memberId: input.memberId,
      text: input.text,
      visibility: input.visibility,
      evidenceType,
      sourceEntityType: "chat_message",
      sourceEntityId: message.id,
      sourceMessageId: message.id,
      occurredAt: createdAt,
      rawPayload: { messageType: input.messageType ?? "user_text" }
    });
  }

  async recordReaction(input: {
    tripId: string;
    memberId: string;
    nodeId: string;
    reaction: ReactionType;
    placeTitle?: string;
    visibility?: "group" | "ai_only";
  }) {
    const node = await prisma.destinationNode.findUnique({ where: { id: input.nodeId } });
    const message = await prisma.chatMessage.create({
      data: {
        id: `msg-${randomUUID()}`,
        tripId: input.tripId,
        authorType: "system",
        messageType: "reaction_event",
        textContent: `成员对「${input.placeTitle ?? node?.canonicalName ?? input.nodeId}」表达了 ${input.reaction}`,
        payload: jsonInput({ nodeId: input.nodeId, reaction: input.reaction }),
        visibility: input.visibility ?? "group"
      }
    });

    return this.createAndProcessEvidence({
      id: `ev-${message.id}-${input.nodeId}`,
      tripId: input.tripId,
      memberId: input.memberId,
      targetType: "node",
      targetId: input.nodeId,
      evidenceType: "reaction",
      sourceEntityType: "chat_message",
      sourceEntityId: message.id,
      sourceMessageId: message.id,
      rawTextSnapshot: message.textContent,
      rawPayload: { reaction: input.reaction },
      visibility: input.visibility ?? "group",
      occurredAt: message.createdAt
    });
  }

  async recordPlaceComment(input: {
    tripId: string;
    memberId: string;
    nodeId: string;
    text: string;
    sourceType: PlaceOpinionSourceType;
    visibility: "group" | "ai_only";
    sourceMessageId?: string;
  }) {
    const reaction = inferReaction(input.text);
    const opinion = await prisma.placeOpinion.create({
      data: {
        id: `op-${randomUUID()}`,
        tripId: input.tripId,
        nodeId: input.nodeId,
        memberId: input.memberId,
        sourceType: input.sourceType,
        sourceMessageId: input.sourceMessageId,
        content: input.text,
        reaction,
        visibility: input.visibility,
        signalType: signalTypeForReaction(reaction)
      }
    });
    const evidence = await this.createAndProcessEvidence({
      id: `ev-${opinion.id}-${input.nodeId}`,
      tripId: input.tripId,
      memberId: input.memberId,
      targetType: "node",
      targetId: input.nodeId,
      evidenceType: input.sourceType === "voice_comment" ? "voice_comment" : "place_comment",
      sourceEntityType: "place_opinion",
      sourceEntityId: opinion.id,
      sourcePlaceOpinionId: opinion.id,
      rawTextSnapshot: input.text,
      rawPayload: { reaction, sourceType: input.sourceType },
      visibility: input.visibility,
      occurredAt: opinion.createdAt
    });

    await prisma.placeOpinion.update({
      where: { id: opinion.id },
      data: { sourceEvidenceId: evidence.id }
    });

    return evidence;
  }

  async recordMaterial(input: {
    material: Material;
    textForAnalysis?: string;
  }) {
    const material = await prisma.material.upsert({
      where: { id: input.material.id },
      create: {
        id: input.material.id,
        tripId: input.material.tripId,
        createdByType: input.material.createdByType,
        createdByMemberId: input.material.createdByMemberId,
        materialType: input.material.materialType,
        sourceType: input.material.sourceType,
        sourceProvider: input.material.sourceProvider,
        sourceUrl: input.material.sourceUrl,
        rawText: input.material.rawText,
        attachmentUrl: input.material.attachmentUrl,
        title: input.material.title,
        summary: input.material.summary,
        status: input.material.status,
        primaryNodeId: input.material.primaryNodeId,
        extractionStatus: input.material.extractionStatus,
        extractionConfidence: input.material.extractionConfidence,
        createdAt: new Date(input.material.createdAt)
      },
      update: {
        sourceUrl: input.material.sourceUrl,
        rawText: input.material.rawText,
        summary: input.material.summary,
        status: input.material.status,
        primaryNodeId: input.material.primaryNodeId,
        extractionStatus: input.material.extractionStatus,
        extractionConfidence: input.material.extractionConfidence
      }
    });

    const targetType = material.primaryNodeId ? "node" : "material";
    const targetId = material.primaryNodeId ?? material.id;
    return this.createAndProcessEvidence({
      id: `ev-${material.id}-${targetId}`,
      tripId: material.tripId,
      memberId: material.createdByMemberId,
      targetType,
      targetId,
      evidenceType: material.materialType === "screenshot" || material.materialType === "image" ? "upload" : "material",
      sourceEntityType: "material",
      sourceEntityId: material.id,
      sourceMaterialId: material.id,
      rawTextSnapshot: input.textForAnalysis ?? material.rawText ?? material.summary,
      rawPayload: {
        materialType: material.materialType,
        sourceProvider: material.sourceProvider,
        sourceUrl: material.sourceUrl
      },
      visibility: "group",
      occurredAt: material.createdAt
    });
  }

  async recordSearchInput(input: {
    tripId: string;
    memberId: string;
    text: string;
    visibility: "group" | "ai_only";
  }) {
    return this.createEvidenceForTextTargets({
      tripId: input.tripId,
      memberId: input.memberId,
      text: input.text,
      visibility: input.visibility,
      evidenceType: "search",
      sourceEntityType: "search_input",
      sourceEntityId: `search-${randomUUID()}`,
      occurredAt: new Date(),
      rawPayload: { query: input.text }
    });
  }

  async retryFailedEvidence(input: { tripId: string; evidenceId?: string }) {
    return preferenceAnalysisService.retryFailedEvidence(input);
  }

  private async createEvidenceForTextTargets(input: {
    tripId: string;
    memberId: string;
    text: string;
    visibility: "group" | "ai_only";
    evidenceType: EvidenceType;
    sourceEntityType: string;
    sourceEntityId: string;
    sourceMessageId?: string;
    occurredAt: Date;
    rawPayload?: Record<string, unknown>;
  }) {
    const nodes = await travelDataService.getAllNodes();
    const mentionedNodeIds = detectMentionedPlaceIds(input.text, nodes);
    const targetNodeIds = mentionedNodeIds.length ? mentionedNodeIds : [undefined];

    const evidences = [];
    for (const nodeId of targetNodeIds) {
      evidences.push(
        await this.createAndProcessEvidence({
          id: `ev-${input.sourceEntityId}-${nodeId ?? "trip"}`,
          tripId: input.tripId,
          memberId: input.memberId,
          targetType: nodeId ? "node" : "trip",
          targetId: nodeId ?? input.tripId,
          evidenceType: input.evidenceType,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          sourceMessageId: input.sourceMessageId,
          rawTextSnapshot: input.text,
          rawPayload: input.rawPayload,
          visibility: input.visibility,
          occurredAt: input.occurredAt
        })
      );
    }

    return evidences;
  }

  private async createAndProcessEvidence(input: {
    id: string;
    tripId: string;
    memberId?: string | null;
    targetType: string;
    targetId?: string;
    evidenceType: EvidenceType;
    sourceEntityType: string;
    sourceEntityId?: string;
    sourceMessageId?: string;
    sourceMaterialId?: string;
    sourcePlaceOpinionId?: string;
    rawTextSnapshot?: string | null;
    rawPayload?: Record<string, unknown>;
    visibility: "group" | "ai_only";
    occurredAt: Date;
  }) {
    const evidence = await prisma.evidence.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        tripId: input.tripId,
        memberId: input.memberId ?? undefined,
        targetType: input.targetType,
        targetId: input.targetId,
        evidenceType: input.evidenceType,
        sourceEntityType: input.sourceEntityType,
        sourceEntityId: input.sourceEntityId,
        sourceMessageId: input.sourceMessageId,
        sourceMaterialId: input.sourceMaterialId,
        sourcePlaceOpinionId: input.sourcePlaceOpinionId,
        rawTextSnapshot: input.rawTextSnapshot,
        rawPayload: jsonInput(input.rawPayload),
        visibility: input.visibility,
        occurredAt: input.occurredAt,
        analysisStatus: "pending"
      },
      update: {
        rawTextSnapshot: input.rawTextSnapshot,
        rawPayload: jsonInput(input.rawPayload),
        visibility: input.visibility,
        analysisStatus: "pending",
        analysisError: null,
        deletedAt: null
      }
    });

    try {
      await preferenceAnalysisService.processEvidence(evidence.id);
    } catch {
      return prisma.evidence.findUniqueOrThrow({ where: { id: evidence.id } });
    }

    return prisma.evidence.findUniqueOrThrow({ where: { id: evidence.id } });
  }
}

export const evidenceService = new EvidenceService();

export function inferReaction(text: string): ReactionType {
  if (/必去|非常|很想|一定/.test(text)) return "must_go";
  if (/不去|不想去|坚决不|避开/.test(text)) return "not_interested";
  if (/担心|顾虑|害怕|太赶|不值|太远|太久|太累|不想专门/.test(text)) return "concern";
  if (/一般|还行|都可以/.test(text)) return "neutral";
  return "want_to_go";
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
