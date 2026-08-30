import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { constraintService } from "@/lib/preferences/constraint-service";
import { modelProvider } from "@/lib/preferences/model-provider";
import { preferenceReducer } from "@/lib/preferences/preference-reducer";

export class PreferenceAnalysisService {
  async processEvidence(evidenceId: string) {
    const evidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        analysisStatus: "processing",
        analysisError: null
      }
    });

    try {
      const runId = `run-${randomUUID()}`;
      const analysis = await modelProvider.analyzeEvidence(evidence);

      await prisma.memberSignal.updateMany({
        where: {
          evidenceId: evidence.id,
          invalidatedAt: null
        },
        data: {
          invalidatedAt: new Date()
        }
      });

      const createdSignals = await Promise.all(
        analysis.signals.map((signal) =>
          prisma.memberSignal.create({
            data: {
              id: `sig-${randomUUID()}`,
              tripId: evidence.tripId,
              memberId: evidence.memberId ?? "",
              evidenceId: evidence.id,
              targetType: signal.targetType,
              targetId: signal.targetId,
              signalType: signal.signalType,
              polarity: signal.polarity,
              intensity: signal.intensity,
              reason: signal.reason,
              aspect: signal.aspect,
              intent: signal.intent,
              conditionText: signal.conditionText,
              constraintCandidate: signal.constraintCandidate ?? false,
              extractedAttributes: jsonInput(signal.extractedAttributes),
              sourceMessageId: evidence.sourceMessageId,
              sourceMaterialId: evidence.sourceMaterialId,
              sourcePlaceOpinionId: evidence.sourcePlaceOpinionId,
              visibility: evidence.visibility,
              scope: "trip",
              createdBy: evidence.evidenceType === "reaction" ? "user_action" : "ai",
              modelName: modelProvider.name,
              modelVersion: modelProvider.version,
              extractionRunId: runId,
              confidence: signal.signalType === "positive" && signal.aspect !== "overall" ? 0.82 : 0.9
            }
          })
        )
      );

      await constraintService.createDerivedConstraints({
        tripId: evidence.tripId,
        memberId: evidence.memberId,
        evidenceId: evidence.id,
        signalIds: createdSignals.map((signal) => signal.id),
        modelName: modelProvider.name,
        modelVersion: modelProvider.version,
        constraints: analysis.constraints
      });

      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          analysisStatus: "completed",
          analysisError: null
        }
      });

      const affectedMemberPlaces = new Set(
        createdSignals
          .filter((signal) => signal.targetType === "node" && signal.memberId)
          .map((signal) => `${signal.memberId}:${signal.targetId}`)
      );

      for (const key of affectedMemberPlaces) {
        const [memberId, nodeId] = key.split(":");
        await preferenceReducer.updateMemberPlaceProfile({
          tripId: evidence.tripId,
          memberId,
          nodeId
        });
      }

      return createdSignals;
    } catch (error) {
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          analysisStatus: "failed",
          analysisError: error instanceof Error ? error.message : "Unknown analysis error"
        }
      });
      throw error;
    }
  }

  async retryFailedEvidence(input: { tripId: string; evidenceId?: string }) {
    const evidences = await prisma.evidence.findMany({
      where: {
        tripId: input.tripId,
        id: input.evidenceId,
        analysisStatus: "failed",
        deletedAt: null
      },
      orderBy: { createdAt: "asc" }
    });

    const results = [];
    for (const evidence of evidences) {
      results.push(await this.processEvidence(evidence.id));
    }
    return results.flat();
  }
}

export const preferenceAnalysisService = new PreferenceAnalysisService();

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
