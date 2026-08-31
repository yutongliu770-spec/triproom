import { NextRequest, NextResponse } from "next/server";
import { processTripEvent } from "@/lib/ai/orchestrator";
import { getDemoRoom } from "@/lib/demo/room";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import { evidenceService } from "@/lib/preferences/evidence-service";
import { constraintService } from "@/lib/preferences/constraint-service";
import { preferenceReducer } from "@/lib/preferences/preference-reducer";
import { getPreferenceState } from "@/lib/preferences/state";
import { travelPlanningService } from "@/lib/plans/service";
import { reactionToSignal } from "@/lib/signals/reactions";
import type { Material, ReactionType } from "@/lib/types";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{
    tripId: string;
    path?: string[];
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { tripId, path = [] } = await context.params;
  const room = await getDemoRoom(tripId);
  const route = path.join("/");

  if (!route) return NextResponse.json(room);
  if (route === "messages") return NextResponse.json({ messages: room.messages });
  if (route === "materials") return NextResponse.json({ materials: room.materials });
  if (route === "preferences") {
    try {
      await ensureDemoRoomPersisted(tripId);
      return NextResponse.json(await getPreferenceState(tripId));
    } catch (error) {
      return NextResponse.json(
        { error: "Preference backend unavailable", detail: errorMessage(error) },
        { status: 503 }
      );
    }
  }
  if (route === "exploration") {
    return NextResponse.json({
      nodes: room.nodes,
      relations: room.relations,
      roomNodeStates: room.roomNodeStates
    });
  }
  if (route === "plans") {
    try {
      await ensureDemoRoomPersisted(tripId);
      return NextResponse.json({ plans: await travelPlanningService.listPlans(tripId) });
    } catch {
      return NextResponse.json({ plans: room.plans });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { tripId, path = [] } = await context.params;
  const route = path.join("/");
  const body = await safeJson(request);
  const room = await getDemoRoom(tripId);
  await ensureDemoRoomPersisted(tripId);

  if (route === "join") {
    return NextResponse.json({ trip: room.trip, member: room.trip.members[1] ?? room.trip.members[0] });
  }

  if (route === "messages") {
    const text = typeof body.text === "string" ? body.text : "";
    const memberId = typeof body.memberId === "string" ? body.memberId : room.trip.members[0].id;
    await evidenceService.recordChatMessage({
      id: typeof body.id === "string" ? body.id : undefined,
      tripId,
      memberId,
      text,
      visibility: body.visibility === "ai_only" ? "ai_only" : "group",
      messageType: body.messageType === "user_voice" ? "user_voice" : "user_text",
      createdAt: typeof body.createdAt === "string" ? body.createdAt : undefined
    });
    const ai = await processTripEvent({ tripId, text });
    return NextResponse.json({ accepted: true, ai, preferences: await getPreferenceState(tripId) });
  }

  if (route.endsWith("/reactions")) {
    const nodeId = path[path.length - 2] ?? "unknown";
    await evidenceService.recordReaction({
      tripId,
      memberId: typeof body.memberId === "string" ? body.memberId : room.trip.members[0].id,
      nodeId,
      reaction: isReactionType(body.reaction) ? body.reaction : "want_to_go",
      placeTitle: typeof body.placeTitle === "string" ? body.placeTitle : undefined,
      visibility: body.visibility === "ai_only" ? "ai_only" : "group"
    });
    const signal = reactionToSignal({
      tripId,
      memberId: typeof body.memberId === "string" ? body.memberId : room.trip.members[0].id,
      targetType: "node",
      targetId: nodeId,
      reaction: body.reaction ?? "want_to_go"
    });
    return NextResponse.json({ signal, preferences: await getPreferenceState(tripId) });
  }

  if (route.endsWith("/comments")) {
    const nodeId = path[path.length - 2] ?? "unknown";
    await evidenceService.recordPlaceComment({
      tripId,
      memberId: typeof body.memberId === "string" ? body.memberId : room.trip.members[0].id,
      nodeId,
      text: typeof body.text === "string" ? body.text : "",
      sourceType: body.source === "voice" ? "voice_comment" : "card_comment",
      visibility: body.visibility === "ai_only" ? "ai_only" : "group"
    });
    return NextResponse.json({
      accepted: true,
      visibility: body.visibility ?? "group",
      text: body.text ?? "",
      preferences: await getPreferenceState(tripId)
    });
  }

  if (route === "materials") {
    const material = materialFromBody(body, tripId);
    await evidenceService.recordMaterial({
      material,
      textForAnalysis:
        typeof body.textForAnalysis === "string"
          ? body.textForAnalysis
          : material.rawText ?? material.summary
    });
    return NextResponse.json({ accepted: true, material, preferences: await getPreferenceState(tripId) });
  }

  if (route === "attachments") {
    return NextResponse.json({
      material: {
        title: "成员上传的截图",
        extractionStatus: "partial",
        summary: "Mock Vision：可能提到镰仓高校前，已进入素材池。"
      }
    });
  }

  if (route === "voice/transcribe") {
    return NextResponse.json({
      text: "海边和电车我挺喜欢，不过如果专门花一天过去感觉有点久。",
      confidence: 0.92,
      sourceType: "mock"
    });
  }

  if (route === "exploration/focus") {
    return NextResponse.json({ focusNodeId: body.nodeId ?? "tokyo" });
  }

  if (route === "exploration/inputs" || route === "exploration/search") {
    await evidenceService.recordSearchInput({
      tripId,
      memberId: typeof body.memberId === "string" ? body.memberId : room.trip.members[0].id,
      text: typeof body.text === "string" ? body.text : typeof body.query === "string" ? body.query : "",
      visibility: body.visibility === "group" ? "group" : "ai_only"
    });
    return NextResponse.json({ accepted: true, preferences: await getPreferenceState(tripId) });
  }

  if (route === "constraints") {
    const constraint = await constraintService.createExplicitConstraint({
      tripId,
      memberId: typeof body.memberId === "string" ? body.memberId : undefined,
      targetType: isConstraintTargetType(body.targetType) ? body.targetType : "trip",
      targetId: typeof body.targetId === "string" ? body.targetId : tripId,
      constraintType: typeof body.constraintType === "string" ? body.constraintType : "other",
      severity: isConstraintSeverity(body.severity) ? body.severity : "strong",
      polarity: isPolarity(body.polarity) ? body.polarity : undefined,
      summary: typeof body.summary === "string" ? body.summary : "用户显式约束",
      conditionText: typeof body.conditionText === "string" ? body.conditionText : undefined,
      structuredValue:
        body.structuredValue && typeof body.structuredValue === "object" ? body.structuredValue : undefined
    });

    if (constraint.memberId && constraint.targetType === "node" && constraint.targetId) {
      await preferenceReducer.updateMemberPlaceProfile({
        tripId,
        memberId: constraint.memberId,
        nodeId: constraint.targetId
      });
    }

    return NextResponse.json({ accepted: true, constraint, preferences: await getPreferenceState(tripId) });
  }

  if (route === "plans/generate") {
    try {
      return NextResponse.json(await travelPlanningService.generatePlans({
        tripId,
        memberId: typeof body.memberId === "string" ? body.memberId : undefined
      }));
    } catch (error) {
      return NextResponse.json(
        { error: "Plan generation failed", detail: errorMessage(error) },
        { status: 500 }
      );
    }
  }

  if (route.endsWith("/revise")) {
    try {
      return NextResponse.json(await travelPlanningService.revisePlan({
        tripId,
        planId: path[path.length - 2],
        memberId: typeof body.memberId === "string" ? body.memberId : undefined,
        instruction:
          typeof body.instruction === "string" && body.instruction.trim()
            ? body.instruction.trim()
            : "第二天太满了，轻松一点"
      }));
    } catch (error) {
      return NextResponse.json(
        { error: "Plan revision failed", detail: errorMessage(error) },
        { status: 500 }
      );
    }
  }

  if (route === "ai/process-event") {
    return NextResponse.json(await processTripEvent({ tripId, text: body.text }));
  }

  if (route === "preferences/retry") {
    await evidenceService.retryFailedEvidence({
      tripId,
      evidenceId: typeof body.evidenceId === "string" ? body.evidenceId : undefined
    });
    return NextResponse.json({ accepted: true, preferences: await getPreferenceState(tripId) });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const body = await safeJson(request);

  if (path.join("/").startsWith("materials/")) {
    return NextResponse.json({ accepted: true, materialId: path[1], patch: body });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

async function safeJson(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isReactionType(value: unknown): value is ReactionType {
  return (
    value === "want_to_go" ||
    value === "neutral" ||
    value === "not_interested" ||
    value === "want_to_know" ||
    value === "must_go" ||
    value === "concern"
  );
}

function isConstraintTargetType(value: unknown): value is "trip" | "node" | "material" | "plan" {
  return value === "trip" || value === "node" || value === "material" || value === "plan";
}

function isConstraintSeverity(value: unknown): value is "soft" | "strong" | "hard" {
  return value === "soft" || value === "strong" || value === "hard";
}

function isPolarity(value: unknown): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function materialFromBody(body: Record<string, unknown>, tripId: string): Material {
  const now = new Date().toISOString();
  return {
    id: typeof body.id === "string" ? body.id : `mat-${crypto.randomUUID()}`,
    tripId,
    createdByType: body.createdByType === "ai" || body.createdByType === "system" ? body.createdByType : "member",
    createdByMemberId: typeof body.createdByMemberId === "string" ? body.createdByMemberId : undefined,
    materialType:
      body.materialType === "screenshot" ||
      body.materialType === "image" ||
      body.materialType === "text" ||
      body.materialType === "hotel" ||
      body.materialType === "restaurant"
        ? body.materialType
        : "url",
    sourceType:
      body.sourceType === "social_media" ||
      body.sourceType === "external_link" ||
      body.sourceType === "upload" ||
      body.sourceType === "ai_recommendation" ||
      body.sourceType === "ai_seed" ||
      body.sourceType === "external_search"
        ? body.sourceType
        : "user_share",
    sourceProvider: typeof body.sourceProvider === "string" ? body.sourceProvider : undefined,
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : undefined,
    rawText: typeof body.rawText === "string" ? body.rawText : undefined,
    attachmentUrl: typeof body.attachmentUrl === "string" ? body.attachmentUrl : undefined,
    title: typeof body.title === "string" ? body.title : "成员分享的素材",
    summary: typeof body.summary === "string" ? body.summary : undefined,
    status:
      body.status === "seen" ||
      body.status === "interested" ||
      body.status === "controversial" ||
      body.status === "selected" ||
      body.status === "dropped" ||
      body.status === "unresolved"
        ? body.status
        : "seen",
    primaryNodeId: typeof body.primaryNodeId === "string" ? body.primaryNodeId : undefined,
    extractionStatus:
      body.extractionStatus === "success" ||
      body.extractionStatus === "partial" ||
      body.extractionStatus === "failed"
        ? body.extractionStatus
        : "pending",
    extractionConfidence: typeof body.extractionConfidence === "number" ? body.extractionConfidence : 0,
    createdAt: typeof body.createdAt === "string" ? body.createdAt : now
  };
}
