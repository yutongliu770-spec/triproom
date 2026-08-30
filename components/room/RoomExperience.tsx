"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, UsersRound } from "lucide-react";
import { processTripEvent } from "@/lib/ai/orchestrator";
import {
  createInitialExploreState,
  recommendExploreCards as recommendExploreBatch,
  type ExploreRecommendationAction
} from "@/lib/graph/explore-recommendations";
import { focusNode } from "@/lib/graph/exploration";
import { detectMentionedPlaceIds } from "@/lib/graph/place-state";
import { reactionToSignal, summarizeSignals } from "@/lib/signals/reactions";
import { generateJapanPlanVariants } from "@/lib/plans/generator";
import { extractFirstUrl, isDouyinContent, isXiaohongshuContent } from "@/lib/travel/social-discovery";
import type {
  ChatMessage,
  DemoRoomData,
  Evidence,
  Member,
  MemberConstraint,
  MemberPlaceState,
  MemberExploreState,
  Material,
  MemberPlaceProfile,
  MemberSignal,
  PlaceOpinion,
  PlaceOpinionSourceType,
  PlanVariant,
  ReactionType,
  RoomPlaceProfile,
  RoomNodeState,
  TravelCard
} from "@/lib/types";
import { RoomSidebar } from "@/components/room/RoomSidebar";
import { ChatTimeline } from "@/components/chat/ChatTimeline";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ExplorationPanel } from "@/components/exploration/ExplorationPanel";
import { Avatar } from "@/components/ui/Avatar";
import {
  PlaceWorkspace,
  type PlaceWorkspaceMode
} from "@/components/workspace/PlaceWorkspace";

interface RoomSnapshot {
  messages: ChatMessage[];
  signals: MemberSignal[];
  materials: Material[];
  plans: PlanVariant[];
  evidences?: Evidence[];
  constraints?: MemberConstraint[];
  memberPlaceProfiles?: MemberPlaceProfile[];
  roomPlaceProfiles?: RoomPlaceProfile[];
  roomNodeStates: RoomNodeState[];
  placeOpinions: PlaceOpinion[];
  memberPlaceStates: MemberPlaceState[];
  currentFocusNodeId: string;
  activeCards: TravelCard[];
  activeCardIndex?: number;
  memberExploreStates?: MemberExploreState[];
  activeMemberIds?: string[];
  cardsByNodeId?: Record<string, TravelCard>;
}

interface PreferencePayload {
  evidences?: Evidence[];
  signals?: MemberSignal[];
  constraints?: MemberConstraint[];
  memberPlaceProfiles?: MemberPlaceProfile[];
  roomPlaceProfiles?: RoomPlaceProfile[];
  placeOpinions?: PlaceOpinion[];
  roomNodeStates?: RoomNodeState[];
}

export function RoomExperience({ initialRoom }: { initialRoom: DemoRoomData }) {
  const [messages, setMessages] = useState(initialRoom.messages);
  const [signals, setSignals] = useState<MemberSignal[]>(initialRoom.signals);
  const [materials, setMaterials] = useState<Material[]>(initialRoom.materials);
  const [plans, setPlans] = useState<PlanVariant[]>(initialRoom.plans);
  const [evidences, setEvidences] = useState<Evidence[]>(initialRoom.evidences ?? []);
  const [constraints, setConstraints] = useState<MemberConstraint[]>(initialRoom.constraints ?? []);
  const [memberPlaceProfiles, setMemberPlaceProfiles] = useState<MemberPlaceProfile[]>(
    initialRoom.memberPlaceProfiles ?? []
  );
  const [roomPlaceProfiles, setRoomPlaceProfiles] = useState<RoomPlaceProfile[]>(
    initialRoom.roomPlaceProfiles ?? []
  );
  const [placeOpinions, setPlaceOpinions] = useState<PlaceOpinion[]>(
    initialRoom.placeOpinions ?? []
  );
  const [memberPlaceStates, setMemberPlaceStates] = useState<MemberPlaceState[]>(
    initialRoom.memberPlaceStates ?? []
  );
  const [roomNodeStates, setRoomNodeStates] = useState<RoomNodeState[]>(
    initialRoom.roomNodeStates
  );
  const [currentFocusNodeId, setCurrentFocusNodeId] = useState(
    initialRoom.trip.currentFocusNodeId ?? "japan"
  );
  const [activeCards, setActiveCards] = useState<TravelCard[]>(initialRoom.initialCards);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [memberExploreStates, setMemberExploreStates] = useState<MemberExploreState[]>(() => [
    {
      ...createInitialExploreState({
        tripId: initialRoom.trip.id,
        memberId: initialRoom.trip.members[0]?.id ?? "",
        cards: initialRoom.initialCards
      }),
      explorationPathNodeIds: ["japan"],
      searchQuery: ""
    }
  ]);
  const [cardsByNodeId, setCardsByNodeId] = useState<Record<string, TravelCard>>(() =>
    cardsToRecord(initialRoom.initialCards)
  );
  const [activeMemberIds, setActiveMemberIds] = useState<string[]>([
    initialRoom.trip.members[0]?.id ?? ""
  ]);
  const [workspaceMode, setWorkspaceMode] = useState<PlaceWorkspaceMode>("explore");
  const [mobilePanel, setMobilePanel] = useState<"group" | "workspace" | "map" | "planning">(
    "workspace"
  );
  const [groupCollapsed, setGroupCollapsed] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentMemberId, setCurrentMemberId] = useState(initialRoom.trip.members[0]?.id ?? "");
  const [discussionPlaceId, setDiscussionPlaceId] = useState<string | undefined>();
  const [summarySent, setSummarySent] = useState(false);
  const syncSourceId = useMemo(() => crypto.randomUUID(), []);
  const applyingRemoteSnapshot = useRef(false);

  const nodes = useMemo(() => initialRoom.nodes, [initialRoom.nodes]);
  const relations = useMemo(() => initialRoom.relations, [initialRoom.relations]);
  const currentMember =
    initialRoom.trip.members.find(
      (member) => member.id === currentMemberId && activeMemberIds.includes(member.id)
    ) ??
    initialRoom.trip.members.find((member) => activeMemberIds.includes(member.id)) ??
    initialRoom.trip.members[0];
  const activeMembers = initialRoom.trip.members.filter((member) =>
    activeMemberIds.includes(member.id)
  );
  const roomTrip = {
    ...initialRoom.trip,
    members: activeMembers,
    currentFocusNodeId
  };
  const currentExploreState =
    memberExploreStates.find((state) => state.memberId === currentMember.id) ??
    {
      ...createInitialExploreState({
        tripId: initialRoom.trip.id,
        memberId: currentMember.id,
        cards: activeCards
      }),
      explorationPathNodeIds: ["japan"],
      searchQuery: ""
    };
  const activeExplorePlaceId = activeCards[activeCardIndex]?.nodeId;
  const activeMapPlaceId = selectedPlaceId ?? activeExplorePlaceId;
  const currentExplorationPathNodeIds =
    currentExploreState.explorationPathNodeIds?.filter((nodeId) =>
      nodes.some((node) => node.id === nodeId)
    ) ??
    pathNodeIdsForNode(
      activeExplorePlaceId ??
        currentExploreState.currentScopeNodeId ??
        currentExploreState.currentClusterNodeId ??
        "japan",
      nodes
    );

  useEffect(() => {
    const stored = window.localStorage.getItem(roomStorageKey(initialRoom.trip.id));
    if (!stored) return;

    try {
      applySnapshot(JSON.parse(stored) as RoomSnapshot);
    } catch {
      window.localStorage.removeItem(roomStorageKey(initialRoom.trip.id));
    }
    // Loading persisted room state should only happen on first mount for this room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.trip.id]);

  useEffect(() => {
    void refreshPreferenceState();
    // Backend preference data is authoritative; load it after any local demo snapshot is restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.trip.id]);

  useEffect(() => {
    const snapshot: RoomSnapshot = {
      messages,
      signals,
      materials,
      plans,
      evidences,
      constraints,
      memberPlaceProfiles,
      roomPlaceProfiles,
      roomNodeStates,
      placeOpinions,
      memberPlaceStates,
      currentFocusNodeId,
      activeCards,
      activeCardIndex,
      memberExploreStates,
      activeMemberIds,
      cardsByNodeId
    };

    window.localStorage.setItem(roomStorageKey(initialRoom.trip.id), JSON.stringify(snapshot));

    if (applyingRemoteSnapshot.current || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(roomStorageKey(initialRoom.trip.id));
    channel.postMessage({ sourceId: syncSourceId, snapshot });
    channel.close();
  }, [
    activeCards,
    activeCardIndex,
    currentFocusNodeId,
    initialRoom.trip.id,
    materials,
    evidences,
    constraints,
    memberPlaceProfiles,
    roomPlaceProfiles,
    memberPlaceStates,
    memberExploreStates,
    messages,
    placeOpinions,
    plans,
    roomNodeStates,
    signals,
    activeMemberIds,
    cardsByNodeId,
    syncSourceId
  ]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(roomStorageKey(initialRoom.trip.id));
    channel.onmessage = (event: MessageEvent<{ sourceId: string; snapshot: RoomSnapshot }>) => {
      if (!event.data || event.data.sourceId === syncSourceId) return;
      applySnapshot(event.data.snapshot);
    };

    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.trip.id, syncSourceId]);

  useEffect(() => {
    setActiveCardIndex((current) => Math.min(current, Math.max(0, activeCards.length - 1)));
  }, [activeCards.length]);

  function applySnapshot(snapshot: RoomSnapshot) {
    applyingRemoteSnapshot.current = true;
    setMessages(snapshot.messages);
    setSignals(snapshot.signals);
    setMaterials(snapshot.materials);
    setPlans(snapshot.plans);
    setEvidences(snapshot.evidences ?? []);
    setConstraints(snapshot.constraints ?? []);
    setMemberPlaceProfiles(snapshot.memberPlaceProfiles ?? []);
    setRoomPlaceProfiles(snapshot.roomPlaceProfiles ?? []);
    setRoomNodeStates(snapshot.roomNodeStates);
    setPlaceOpinions(snapshot.placeOpinions ?? []);
    setMemberPlaceStates(snapshot.memberPlaceStates ?? []);
    setCurrentFocusNodeId(snapshot.currentFocusNodeId);
    setActiveCards(snapshot.activeCards);
    setActiveCardIndex(
      Math.min(snapshot.activeCardIndex ?? 0, Math.max(0, snapshot.activeCards.length - 1))
    );
    setMemberExploreStates(snapshot.memberExploreStates ?? []);
    setCardsByNodeId(snapshot.cardsByNodeId ?? cardsToRecord(snapshot.activeCards));
    setActiveMemberIds(snapshot.activeMemberIds?.filter(Boolean).length ? snapshot.activeMemberIds : [
      initialRoom.trip.members[0]?.id ?? ""
    ]);
    window.setTimeout(() => {
      applyingRemoteSnapshot.current = false;
    }, 0);
  }

  function applyPreferenceState(preferences?: PreferencePayload) {
    if (!preferences) return;
    if (preferences.evidences) setEvidences(preferences.evidences);
    if (preferences.signals) setSignals(preferences.signals);
    if (preferences.constraints) setConstraints(preferences.constraints);
    if (preferences.memberPlaceProfiles) setMemberPlaceProfiles(preferences.memberPlaceProfiles);
    if (preferences.roomPlaceProfiles) setRoomPlaceProfiles(preferences.roomPlaceProfiles);
    if (preferences.placeOpinions) setPlaceOpinions(preferences.placeOpinions);
    if (preferences.roomNodeStates?.length) setRoomNodeStates(preferences.roomNodeStates);
  }

  async function refreshPreferenceState() {
    try {
      const response = await fetch(`/api/trips/${initialRoom.trip.id}/preferences`);
      if (!response.ok) return;
      applyPreferenceState((await response.json()) as PreferencePayload);
    } catch {
      // Keep the local demo usable when PostgreSQL is not running.
    }
  }

  async function postTripEvent(path: string, body: Record<string, unknown>) {
    try {
      const response = await fetch(`/api/trips/${initialRoom.trip.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { preferences?: PreferencePayload };
      applyPreferenceState(payload.preferences);
    } catch {
      // The optimistic room UI remains intact if the derived backend update fails.
    }
  }

  async function handleSend(
    text: string,
    visibility: "group" | "ai_only",
    messageType: "user_text" | "user_voice" = "user_text"
  ) {
    const userMessage: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      tripId: initialRoom.trip.id,
      authorType: "member",
      authorMemberId: currentMember.id,
      messageType,
      textContent: text,
      visibility,
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, userMessage]);
    void postTripEvent("messages", {
      id: userMessage.id,
      memberId: currentMember.id,
      text,
      visibility,
      messageType,
      createdAt: userMessage.createdAt
    });
    if (extractFirstUrl(text)) {
      saveSharedMaterial(text, "url", userMessage);
      if (visibility === "group") {
        capturePlaceOpinionsFromText(
          text,
          userMessage,
          messageType === "user_voice" ? "voice_comment" : "group_chat"
        );
      }
      return;
    }

    if (visibility === "group") {
      markMentionedPlaces(text, userMessage.createdAt);
      capturePlaceOpinionsFromText(
        text,
        userMessage,
        messageType === "user_voice" ? "voice_comment" : "group_chat"
      );
    }

    if (visibility === "ai_only") {
      return;
    }

    setIsProcessing(true);
    const result = await processTripEvent({ tripId: initialRoom.trip.id, text });

    if (result.decision.focusNodeId) {
      setCurrentFocusNodeId(result.decision.focusNodeId);
      setRoomNodeStates((current) =>
        focusNode(initialRoom.trip.id, result.decision.focusNodeId!, nodes, current)
      );
    }

    if (result.generation.cardBatch?.length) {
      setActiveCards(result.generation.cardBatch);
      setActiveCardIndex(0);
      rememberExploreCards(result.generation.cardBatch, result.decision.focusNodeId);
      rememberCards(result.generation.cardBatch);
      setRoomNodeStates((current) =>
        markCardsShown(initialRoom.trip.id, result.generation.cardBatch ?? [], nodes, current)
      );
      addAiMessage(result.generation.messageText, {
        cardNodeIds: result.generation.cardBatch.map((card) => card.nodeId)
      });
      saveCardsAsMaterials(result.generation.cardBatch);
      setWorkspaceMode("explore");
    } else if (result.generation.plans?.length) {
      setPlans(result.generation.plans);
      addAiMessage(result.generation.messageText, {
        planIds: result.generation.plans.map((plan) => plan.id)
      });
      setWorkspaceMode("planning");
    } else if (result.generation.messageText) {
      addAiMessage(result.generation.messageText, { responseType: result.decision.mode });
    }

    setIsProcessing(false);
    setDiscussionPlaceId(undefined);
  }

  function addAiMessage(textContent?: string, payload?: Record<string, unknown>) {
    const aiMessage: ChatMessage = {
      id: `msg-${crypto.randomUUID()}`,
      tripId: initialRoom.trip.id,
      authorType: "ai",
      messageType: payload?.planIds ? "plan_proposal" : "ai_card_batch",
      textContent,
      payload,
      visibility: "group",
      createdAt: new Date().toISOString()
    };

    setMessages((current) => [...current, aiMessage]);
  }

  function saveCardsAsMaterials(cards: TravelCard[]) {
    setMaterials((current) => {
      const existing = new Set(current.map((material) => material.primaryNodeId));
      const next = cards
        .filter((card) => !existing.has(card.nodeId))
        .map<Material>((card) => ({
          id: `mat-${card.nodeId}`,
          tripId: initialRoom.trip.id,
          createdByType: "ai",
          materialType: "card",
          sourceType: "ai_recommendation",
          sourceProvider: "seed",
          title: card.title,
          summary: card.shortSummary,
          status: "seen",
          primaryNodeId: card.nodeId,
          extractionStatus: "success",
          extractionConfidence: 1,
          createdAt: new Date().toISOString()
        }));

      return [...current, ...next];
    });
  }

  function saveSharedMaterial(
    rawValue: string,
    materialType: "url" | "screenshot" | "image" | "text",
    sourceMessage?: ChatMessage
  ) {
    const isUrl = materialType === "url";
    const sourceUrl = isUrl ? extractFirstUrl(rawValue) : undefined;
    const isXiaohongshu = isXiaohongshuContent(rawValue);
    const isDouyin = isDouyinContent(rawValue);
    const resolvedNodeId = detectMentionedPlaceIds(rawValue, nodes)[0];
    const resolvedNode = resolvedNodeId ? nodes.find((node) => node.id === resolvedNodeId) : undefined;
    const material: Material = {
      id: `mat-share-${crypto.randomUUID()}`,
      tripId: initialRoom.trip.id,
      createdByType: "member",
      createdByMemberId: currentMember.id,
      materialType,
      sourceType: isXiaohongshu || isDouyin ? "social_media" : isUrl ? "external_link" : "upload",
      sourceProvider: isXiaohongshu
        ? "xiaohongshu"
        : isDouyin
          ? "douyin"
          : isUrl
            ? "user_link"
            : "user_upload",
      sourceUrl,
      rawText: isUrl && rawValue.trim() === sourceUrl ? undefined : rawValue,
      attachmentUrl: materialType === "screenshot" ? "/mock/kamakura-screenshot.png" : undefined,
      title: isXiaohongshu
        ? isUrl
          ? "成员分享的小红书链接"
          : "成员分享的小红书截图"
        : isDouyin
          ? "成员分享的抖音链接"
          : isUrl
            ? "成员分享的外部链接"
            : "成员上传的截图",
      summary: resolvedNode
        ? isXiaohongshu
          ? `用户分享的小红书内容：可能提到${resolvedNode.canonicalName}，已关联同一个 Place，等待成员确认。`
          : isDouyin
            ? `用户分享的抖音内容：可能提到${resolvedNode.canonicalName}，已关联同一个 Place，等待成员确认。`
          : `Mock 识别：可能提到${resolvedNode.canonicalName}，已关联同一个 Place，等待成员确认。`
        : isUrl
          ? "这个链接已保存。当前 MVP 不读取受限社交平台内容，可以上传截图继续提取地点。"
          : "截图已保存，Mock Vision 会尝试提取地点和体验信息。",
      status: resolvedNode ? "seen" : "unresolved",
      primaryNodeId: resolvedNodeId,
      extractionStatus: resolvedNode ? "partial" : "failed",
      extractionConfidence: resolvedNode ? 0.72 : 0.2,
      createdAt: new Date().toISOString()
    };

    const eventText = isUrl
      ? isXiaohongshu
        ? "小红书链接已保存到素材池；TripRoom 不抓取受限内容，只保留用户主动分享的来源。"
        : isDouyin
          ? "抖音链接已保存到素材池；TripRoom 只展示成员真实分享的抖音 URL，不伪造自动搜索结果。"
          : "链接已保存到素材池；当前 MVP 不伪装读取受限页面，可以上传截图继续提取。"
      : isXiaohongshu
        ? "小红书截图已保存到素材池；这是成员主动带入的素材。"
        : "截图已保存到素材池；Mock Vision 识别到可能与镰仓相关。";

    setMaterials((current) => [material, ...current]);
    setMessages((current) => [
      ...current,
      {
        id: `msg-${crypto.randomUUID()}`,
        tripId: initialRoom.trip.id,
        authorType: "system",
        messageType: "material_saved_event",
        textContent: `${currentMember.displayName} ${eventText}`,
        visibility: "group",
        payload: {
          materialId: material.id,
          primaryNodeId: material.primaryNodeId,
          sourceMessageId: sourceMessage?.id
        },
        createdAt: new Date().toISOString()
      }
    ]);
    if (resolvedNodeId) {
      markMentionedPlaces(rawValue, material.createdAt);
      markPlaceUnreadForOthers(resolvedNodeId, currentMember.id, material.createdAt);
    }
    void postTripEvent("materials", {
      ...material,
      textForAnalysis: rawValue
    });
  }

  function handleReaction(card: TravelCard, reaction: ReactionType) {
    const signal = reactionToSignal({
      tripId: initialRoom.trip.id,
      memberId: currentMember.id,
      targetType: "node",
      targetId: card.nodeId,
      reaction
    });

    const nextSignals = upsertLatestMemberSignal(signals, signal);
    setSignals(nextSignals);
    setMemberPlaceStates((current) =>
      updateMemberPlaceActivity({
        states: current,
        tripId: initialRoom.trip.id,
        nodeId: card.nodeId,
        authorMemberId: currentMember.id,
        activeMemberIds,
        createdAt: signal.createdAt,
        reaction
      })
    );
    setRoomNodeStates((current) => updateNodeAggregate(current, card.nodeId, nextSignals));
    setMessages((current) => [
      ...current,
      {
        id: `msg-${crypto.randomUUID()}`,
        tripId: initialRoom.trip.id,
        authorType: "system",
        messageType: "reaction_event",
        textContent: `${currentMember.displayName} 对「${card.title}」表达了 ${reactionLabel(reaction)}`,
        visibility: "group",
        payload: { cardId: card.id, nodeId: card.nodeId, reaction },
        createdAt: new Date().toISOString()
      }
    ]);
    void postTripEvent(`nodes/${card.nodeId}/reactions`, {
      memberId: currentMember.id,
      reaction,
      placeTitle: card.title,
      visibility: "group"
    });

    if (!summarySent && nextSignals.length >= 3) {
      setSummarySent(true);
      addAiMessage(
        "我先轻量总结一下：东京是当前最稳定的共同方向；镰仓、箱根这类东京周边有人感兴趣，但主要要确认是否愿意花半天到一天；如果 USJ 继续是强兴趣，就会进入东京+大阪的路线取舍。",
        { summaryType: "shared_interest" }
      );
    }
  }

  function handleCardComment(
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source: "text" | "voice" = "text"
  ) {
    const signal = reactionToSignal({
      tripId: initialRoom.trip.id,
      memberId: currentMember.id,
      targetType: "node",
      targetId: card.nodeId,
      reaction: inferReaction(text),
      reason: text,
      visibility
    });
    const nextSignals = upsertLatestMemberSignal(signals, signal);
    setSignals(nextSignals);
    const createdAt = signal.createdAt;
    const opinion = createPlaceOpinion({
      nodeId: card.nodeId,
      memberId: currentMember.id,
      sourceType: source === "voice" ? "voice_comment" : "card_comment",
      sourceMessageId: undefined,
      content: text,
      reaction: inferReaction(text),
      visibility,
      createdAt,
      tripId: initialRoom.trip.id
    });
    setPlaceOpinions((current) => upsertPlaceOpinion(current, opinion));
    setMemberPlaceStates((current) =>
      updateMemberPlaceActivity({
        states: current,
        tripId: initialRoom.trip.id,
        nodeId: card.nodeId,
        authorMemberId: currentMember.id,
        activeMemberIds,
        createdAt,
        reaction: opinion.reaction
      })
    );
    setRoomNodeStates((current) => updateNodeAggregate(current, card.nodeId, nextSignals));

    if (visibility === "group") {
      setMessages((current) => [
        ...current,
        {
          id: `msg-${crypto.randomUUID()}`,
          tripId: initialRoom.trip.id,
          authorType: "member",
          authorMemberId: currentMember.id,
          messageType: source === "voice" ? "user_voice" : "user_text",
          textContent: `「${card.title}」${text}`,
          visibility,
          payload: { cardId: card.id, nodeId: card.nodeId },
          createdAt: new Date().toISOString()
        }
      ]);
    }
    void postTripEvent(`nodes/${card.nodeId}/comments`, {
      memberId: currentMember.id,
      text,
      visibility,
      source
    });
  }

  function handleGeneratePlans() {
    const nextPlans = generateJapanPlanVariants({
      tripId: initialRoom.trip.id,
      totalDays: initialRoom.trip.tripDurationDays,
      basedOnSignalIds: signals.map((signal) => signal.id)
    });
    setPlans(nextPlans);
    setWorkspaceMode("planning");
    addAiMessage("我先把现在的方向整理成两版结构方案。重点看每版得到什么、放弃什么。", {
      planIds: nextPlans.map((plan) => plan.id)
    });
  }

  function handlePlanComment(plan: PlanVariant, text: string) {
    const signal = reactionToSignal({
      tripId: initialRoom.trip.id,
      memberId: currentMember.id,
      targetType: "plan",
      targetId: plan.id,
      reaction: inferReaction(text),
      reason: text
    });
    setSignals((current) => [...current, signal]);
    setMessages((current) => [
      ...current,
      {
        id: `msg-${crypto.randomUUID()}`,
        tripId: initialRoom.trip.id,
        authorType: "member",
        authorMemberId: currentMember.id,
        messageType: "user_text",
        textContent: `对方案「${plan.title}」：${text}`,
        visibility: "group",
        payload: { planId: plan.id },
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function handleRevisePlan(plan: PlanVariant) {
    const revisedPlans = generateJapanPlanVariants({
      tripId: initialRoom.trip.id,
      totalDays: initialRoom.trip.tripDurationDays,
      basedOnSignalIds: signals.map((signal) => signal.id),
      parentPlanId: plan.id
    });

    setPlans((current) => [
      ...current.map((item) => ({ ...item, status: "superseded" as const })),
      ...revisedPlans
    ]);
    setWorkspaceMode("planning");
    addAiMessage(
      `我根据刚才的结构级反馈生成了新版方案。新版会明确标出与「${plan.title}」相比保留和压缩了什么。`,
      { planIds: revisedPlans.map((item) => item.id) }
    );
  }

  function handleMemberChange(member: Member) {
    setCurrentMemberId(member.id);
  }

  function handleAddDemoMember() {
    const nextMember = initialRoom.trip.members.find((member) => !activeMemberIds.includes(member.id));
    if (!nextMember) return;

    setActiveMemberIds((current) => [...current, nextMember.id]);
    setCurrentMemberId(nextMember.id);
    setMessages((current) => [
      ...current,
      {
        id: `msg-${crypto.randomUUID()}`,
        tripId: initialRoom.trip.id,
        authorType: "system",
        messageType: "system_event",
        textContent: `${nextMember.displayName} 已加入这个 TripRoom。原有聊天、素材和偏好都已保留。`,
        visibility: "group",
        createdAt: new Date().toISOString()
      }
    ]);
  }

  function rememberCards(cards: TravelCard[]) {
    setCardsByNodeId((current) => ({
      ...current,
      ...cardsToRecord(cards)
    }));
  }

  function markMentionedPlaces(text: string, createdAt: string) {
    const mentionedNodeIds = detectMentionedPlaceIds(text, nodes);
    if (mentionedNodeIds.length === 0) return;

    setRoomNodeStates((current) =>
      updateMentionedNodeStates(initialRoom.trip.id, mentionedNodeIds, nodes, current, createdAt)
    );
  }

  function capturePlaceOpinionsFromText(
    text: string,
    message: ChatMessage,
    sourceType: PlaceOpinionSourceType
  ) {
    const mentionedNodeIds = detectMentionedPlaceIds(text, nodes);
    if (mentionedNodeIds.length === 0 || !message.authorMemberId) return;

    const createdAt = message.createdAt;
    const reaction = inferReaction(text);
    const nextOpinions = mentionedNodeIds.map((nodeId) =>
      createPlaceOpinion({
        tripId: initialRoom.trip.id,
        nodeId,
        memberId: message.authorMemberId!,
        sourceType,
        sourceMessageId: message.id,
        content: text,
        reaction,
        visibility: message.visibility,
        createdAt
      })
    );
    const nextSignals = mentionedNodeIds.reduce(
      (current, nodeId) =>
        upsertLatestMemberSignal(
          current,
          {
            ...reactionToSignal({
              tripId: initialRoom.trip.id,
              memberId: message.authorMemberId!,
              targetType: "node",
              targetId: nodeId,
              reaction,
              reason: text,
              visibility: message.visibility
            }),
            sourceMessageId: message.id
          }
        ),
      signals
    );

    setPlaceOpinions((current) =>
      nextOpinions.reduce((next, opinion) => upsertPlaceOpinion(next, opinion), current)
    );
    setSignals(nextSignals);
    setRoomNodeStates((current) =>
      mentionedNodeIds.reduce(
        (nextStates, nodeId) => updateNodeAggregate(nextStates, nodeId, nextSignals),
        current
      )
    );
    setMemberPlaceStates((current) =>
      mentionedNodeIds.reduce(
        (nextStates, nodeId) =>
          updateMemberPlaceActivity({
            states: nextStates,
            tripId: initialRoom.trip.id,
            nodeId,
            authorMemberId: message.authorMemberId!,
            activeMemberIds,
            createdAt,
            reaction
          }),
        current
      )
    );
  }

  function handleExploreSubmit(text: string, shareToGroup: boolean) {
    const createdAt = new Date().toISOString();
    const mentionedNodeIds = detectMentionedPlaceIds(text, nodes);

    if (extractFirstUrl(text)) {
      saveSharedMaterial(text, "url");
    }
    void postTripEvent("exploration/inputs", {
      memberId: currentMember.id,
      text,
      visibility: shareToGroup ? "group" : "ai_only"
    });

    if (mentionedNodeIds.length > 0) {
      const virtualMessage: ChatMessage = {
        id: `msg-explore-${crypto.randomUUID()}`,
        tripId: initialRoom.trip.id,
        authorType: "member",
        authorMemberId: currentMember.id,
        messageType: "user_text",
        textContent: text,
        visibility: shareToGroup ? "group" : "ai_only",
        createdAt
      };
      capturePlaceOpinionsFromText(text, virtualMessage, "explore_comment");
      markMentionedPlaces(text, createdAt);
    }

    applyExploreRecommendation({ type: "bias", text });

    if (shareToGroup) {
      setMessages((current) => [
        ...current,
        {
          id: `msg-${crypto.randomUUID()}`,
          tripId: initialRoom.trip.id,
          authorType: "member",
          authorMemberId: currentMember.id,
          messageType: "user_text",
          textContent: text,
          visibility: "group",
          createdAt
        }
      ]);
    }
  }

  function openPlaceInWorkspace(nodeId: string) {
    setSelectedPlaceId(nodeId);
    setWorkspaceMode("discovered");
    setMemberPlaceStates((current) =>
      markPlaceRead(current, initialRoom.trip.id, currentMember.id, nodeId, new Date().toISOString())
    );
  }

  function applyExploreRecommendation(
    action: ExploreRecommendationAction,
    options?: { explorationPathNodeIds?: string[] }
  ) {
    const result = recommendExploreBatch({
      tripId: initialRoom.trip.id,
      memberId: currentMember.id,
      nodes,
      relations,
      signals,
      roomNodeStates,
      previousState: currentExploreState,
      action
    });

    if (result.cards.length === 0) return;

    const pathTargetNodeId =
      options?.explorationPathNodeIds?.at(-1) ??
      (action.type === "search" && result.directPlaceNodeId
        ? result.directPlaceNodeId
        : action.type === "search" && result.focusNodeId
          ? result.focusNodeId
          : action.type === "focus_node"
            ? action.nodeId
            : action.type === "next_cluster"
              ? result.focusNodeId ?? result.state.currentClusterNodeId ?? "japan"
              : action.type === "clear_scope" || action.type === "initial"
                ? "japan"
                : currentExploreState.explorationPathNodeIds?.at(-1) ?? "japan");
    const nextExploreState: MemberExploreState = {
      ...result.state,
      explorationPathNodeIds:
        options?.explorationPathNodeIds ?? pathNodeIdsForNode(pathTargetNodeId, nodes),
      searchQuery: action.type === "search" ? action.query : currentExploreState.searchQuery ?? ""
    };

    setSelectedPlaceId(undefined);
    setWorkspaceMode("explore");
    setActiveCards(result.cards);
    setActiveCardIndex(0);
    setCurrentFocusNodeId(result.focusNodeId ?? result.state.currentClusterNodeId ?? "japan");
    setMemberExploreStates((current) => upsertMemberExploreState(current, nextExploreState));
    rememberCards(result.cards);
    setRoomNodeStates((current) => markCardsShown(initialRoom.trip.id, result.cards, nodes, current));
    saveCardsAsMaterials(result.cards);
  }

  function handleExploreSearchQueryChange(searchQuery: string) {
    setMemberExploreStates((current) => {
      const existing =
        current.find((state) => state.memberId === currentMember.id) ?? currentExploreState;
      return upsertMemberExploreState(current, {
        ...existing,
        searchQuery,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function handleActiveCardIndexChange(index: number) {
    const nextIndex = Math.max(0, Math.min(activeCards.length - 1, index));
    setActiveCardIndex(nextIndex);

    setMemberExploreStates((current) => {
      const existing =
        current.find((state) => state.memberId === currentMember.id) ?? currentExploreState;
      return upsertMemberExploreState(current, {
        ...existing,
        currentCardIndex: nextIndex,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function handleExplorePathBack() {
    if (currentExplorationPathNodeIds.length <= 1) return;
    const nextPath = currentExplorationPathNodeIds.slice(0, -1);
    const targetNodeId = nextPath.at(-1) ?? "japan";
    applyExploreRecommendation({ type: "focus_node", nodeId: targetNodeId }, {
      explorationPathNodeIds: nextPath
    });
  }

  function handleExplorePathRandomize(levelIndex: number) {
    const nextPath = randomizeExplorationPath({
      pathNodeIds: currentExplorationPathNodeIds,
      levelIndex,
      nodes,
      relations
    });
    const targetNodeId = nextPath.at(-1);
    if (!targetNodeId || arraysEqual(nextPath, currentExplorationPathNodeIds)) return;

    applyExploreRecommendation({ type: "focus_node", nodeId: targetNodeId }, {
      explorationPathNodeIds: nextPath
    });
  }

  function rememberExploreCards(cards: TravelCard[], scopeNodeId?: string) {
    setMemberExploreStates((current) => {
      const existing =
        current.find((state) => state.memberId === currentMember.id) ?? currentExploreState;
      const nextState: MemberExploreState = {
        ...existing,
        currentClusterNodeId: scopeNodeId ?? existing.currentClusterNodeId,
        explorationPathNodeIds: scopeNodeId
          ? pathNodeIdsForExploreScope(scopeNodeId, nodes)
          : existing.explorationPathNodeIds ?? ["japan"],
        seenPlaceIds: mergeUnique([...existing.seenPlaceIds, ...cards.map((card) => card.nodeId)]).slice(-80),
        currentCardIndex: 0,
        updatedAt: new Date().toISOString()
      };
      return upsertMemberExploreState(current, nextState);
    });
  }

  function markPlaceUnreadForOthers(nodeId: string, authorMemberId: string, createdAt: string) {
    setMemberPlaceStates((current) =>
      updateMemberPlaceActivity({
        states: current,
        tripId: initialRoom.trip.id,
        nodeId,
        authorMemberId,
        activeMemberIds,
        createdAt
      })
    );
  }

  const totalUnreadCount = memberPlaceStates
    .filter((state) => state.memberId === currentMember.id)
    .reduce((total, state) => total + state.unreadCount, 0);

  return (
    <main className="h-[100dvh] overflow-hidden bg-paper px-3 py-3 md:px-4 md:py-4">
      <div className="mx-auto flex h-full max-w-[1680px] flex-col gap-3">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 rounded-[24px] bg-white px-4 shadow-soft">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/40">
              TripRoom MVP
            </div>
            <h1 className="truncate text-lg font-semibold text-ink">{roomTrip.name}</h1>
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-ink/55 md:flex">
            <UsersRound size={16} aria-hidden="true" />
            <span>{roomTrip.members.length > 1 ? "Group Room" : "Solo Room"}</span>
            <span className="rounded-full bg-cloud px-2 py-1">{currentMember.displayName}</span>
          </div>
        </header>

        <nav className="grid h-11 shrink-0 grid-cols-4 gap-2 lg:hidden" aria-label="移动端主视图">
          {[
            ["group", "讨论"],
            ["workspace", "探索"],
            ["map", "地图"],
            ["planning", "规划"]
          ].map(([panel, label]) => (
            <button
              key={panel}
              type="button"
              className={`focus-ring rounded-full text-sm font-semibold ${
                mobilePanel === panel ? "bg-pine text-paper" : "bg-white text-ink/65"
              }`}
              onClick={() => {
                setMobilePanel(panel as typeof mobilePanel);
                if (panel === "planning") {
                  setSelectedPlaceId(undefined);
                  setWorkspaceMode("planning");
                }
                if (panel === "workspace" && workspaceMode === "planning") {
                  setWorkspaceMode("explore");
                }
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        <div
          className={`grid min-h-0 flex-1 gap-4 ${
            groupCollapsed
              ? "lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(280px,28%)_minmax(0,1fr)_minmax(0,1fr)]"
          }`}
        >
          <aside
            className={`h-full min-h-0 overflow-hidden rounded-[28px] bg-white shadow-soft lg:flex ${
              mobilePanel === "group" ? "flex" : "hidden"
            } ${groupCollapsed ? "lg:w-[72px]" : ""}`}
            aria-label="Group"
          >
            <div
              className={`h-full w-full flex-col items-center gap-4 px-2 py-4 ${
                groupCollapsed ? "hidden lg:flex" : "hidden"
              }`}
              aria-label="已收起的 Group"
            >
              <button
                type="button"
                className="focus-ring grid size-10 place-items-center rounded-full bg-cloud text-ink"
                aria-label="展开 Group"
                onClick={() => setGroupCollapsed(false)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <div className="relative">
                <Avatar member={currentMember} />
                {totalUnreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                    {totalUnreadCount}
                  </span>
                )}
              </div>
              <MessageCircle size={18} className="text-ink/50" aria-hidden="true" />
            </div>

            <div className={`min-h-0 w-full flex-col ${groupCollapsed ? "hidden" : "flex"}`}>
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-ink/10 px-4">
                <div className="text-sm font-semibold text-ink">Group</div>
                <button
                  type="button"
                  className="focus-ring hidden size-8 place-items-center rounded-full bg-cloud text-ink lg:grid"
                  aria-label="收起 Group"
                  onClick={() => setGroupCollapsed(true)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="max-h-[34%] shrink-0 overflow-y-auto border-b border-ink/10">
                <RoomSidebar
                  trip={roomTrip}
                  nodes={nodes}
                  roomNodeStates={roomNodeStates}
                  currentMemberId={currentMember.id}
                  onMemberChange={handleMemberChange}
                  onAddDemoMember={handleAddDemoMember}
                  canAddDemoMember={activeMemberIds.length < initialRoom.trip.members.length}
                />
              </div>
              <ChatTimeline
                trip={roomTrip}
                messages={messages}
                nodes={nodes}
                cardsByNodeId={cardsByNodeId}
                plans={plans}
                signals={signals}
                onOpenPlace={(nodeId) => openPlaceInWorkspace(nodeId)}
                onOpenPlanning={() => {
                  setSelectedPlaceId(undefined);
                  setWorkspaceMode("planning");
                  setMobilePanel("planning");
                }}
              />
              <ChatComposer
                onSend={handleSend}
                onShareScreenshot={() =>
                  saveSharedMaterial("小红书截图：镰仓高校前、海边电车、江之岛散步", "screenshot")
                }
                discussionPlaceName={
                  discussionPlaceId
                    ? nodes.find((node) => node.id === discussionPlaceId)?.canonicalName
                    : undefined
                }
                onClearDiscussionPlace={() => setDiscussionPlaceId(undefined)}
                isProcessing={isProcessing}
              />
            </div>
          </aside>

          <div
            className={`h-full min-h-0 lg:block ${
              mobilePanel === "workspace" || mobilePanel === "planning" ? "block" : "hidden"
            }`}
          >
            <PlaceWorkspace
              mode={workspaceMode}
              selectedNodeId={selectedPlaceId}
              tripId={initialRoom.trip.id}
              nodes={nodes}
              relations={relations}
              activeCards={activeCards}
              activeCardIndex={activeCardIndex}
              explorationPathNodeIds={currentExplorationPathNodeIds}
              searchQuery={currentExploreState.searchQuery ?? ""}
              members={roomTrip.members}
              currentMember={currentMember}
              signals={signals}
              materials={materials}
              placeOpinions={placeOpinions}
              memberPlaceStates={memberPlaceStates}
              roomNodeStates={roomNodeStates}
              plans={plans}
              onModeChange={(mode) => {
                setWorkspaceMode(mode);
                setSelectedPlaceId(undefined);
                setMobilePanel(mode === "planning" ? "planning" : "workspace");
              }}
              onActiveCardIndexChange={handleActiveCardIndexChange}
              onSearchQueryChange={handleExploreSearchQueryChange}
              onExploreSearch={(query) => {
                void postTripEvent("exploration/search", {
                  memberId: currentMember.id,
                  query,
                  visibility: "ai_only"
                });
                applyExploreRecommendation({ type: "search", query });
              }}
              onExploreNextCluster={() => applyExploreRecommendation({ type: "next_cluster" })}
              onExplorePathBack={handleExplorePathBack}
              onExplorePathRandomize={handleExplorePathRandomize}
              onExploreAreaFocus={(nodeId) => applyExploreRecommendation({ type: "focus_node", nodeId })}
              onOpenPlace={openPlaceInWorkspace}
              onClosePlace={() => setSelectedPlaceId(undefined)}
              onReact={handleReaction}
              onComment={handleCardComment}
              onExploreSubmit={handleExploreSubmit}
              onGeneratePlans={handleGeneratePlans}
              onPlanComment={handlePlanComment}
              onPlanRevise={handleRevisePlan}
            />
          </div>

          <aside
            className={`h-full min-h-0 overflow-hidden rounded-[28px] bg-white shadow-soft lg:block ${
              mobilePanel === "map" ? "block" : "hidden"
            }`}
            aria-label="Exploration Map"
          >
            <ExplorationPanel
              tripId={initialRoom.trip.id}
              focusNodeId={currentFocusNodeId}
              nodes={nodes}
              relations={relations}
              states={roomNodeStates}
              signals={signals}
              materials={materials}
              messages={messages}
              currentMemberId={currentMember.id}
              memberPlaceStates={memberPlaceStates}
              activePlaceId={activeMapPlaceId}
              onOpenPlace={openPlaceInWorkspace}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function pathNodeIdsForNode(nodeId: string, nodes: DemoRoomData["nodes"]) {
  const path: string[] = [];
  let current = nodes.find((node) => node.id === nodeId);

  while (current) {
    path.unshift(current.id);
    current = current.parentId ? nodes.find((node) => node.id === current?.parentId) : undefined;
  }

  return path.length ? path : ["japan"];
}

function pathNodeIdsForExploreScope(nodeId: string, nodes: DemoRoomData["nodes"]) {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node) return ["japan"];
  if (isConcreteExploreNode(node)) return pathNodeIdsForNode(node.id, nodes);

  return pathNodeIdsForNode(node.id, nodes);
}

function randomizeExplorationPath({
  pathNodeIds,
  levelIndex,
  nodes,
  relations
}: {
  pathNodeIds: string[];
  levelIndex: number;
  nodes: DemoRoomData["nodes"];
  relations: DemoRoomData["relations"];
}) {
  const currentNode = nodes.find((node) => node.id === pathNodeIds[levelIndex]);
  if (!currentNode || currentNode.nodeType === "country") return pathNodeIds;

  const siblings = nodes.filter(
    (node) =>
      node.id !== currentNode.id &&
      node.parentId === currentNode.parentId &&
      sameExploreLevel(node, currentNode) &&
      hasRecommendableContent(node, nodes, relations)
  );
  const nextNode = pickRandomItem(siblings);
  if (!nextNode) return pathNodeIds;

  const shouldKeepChildDepth = levelIndex < pathNodeIds.length - 1;
  if (shouldKeepChildDepth && !isConcreteExploreNode(nextNode)) {
    const child = pickRandomItem(concreteDescendantsForRoom(nextNode.id, nodes, relations));
    if (child) return pathNodeIdsForNode(child.id, nodes);
  }

  return pathNodeIdsForNode(nextNode.id, nodes);
}

function sameExploreLevel(
  node: DemoRoomData["nodes"][number],
  currentNode: DemoRoomData["nodes"][number]
) {
  if (isClusterNode(node) && isClusterNode(currentNode)) return true;
  if (isConcreteExploreNode(node) && isConcreteExploreNode(currentNode)) return true;
  return node.nodeType === currentNode.nodeType;
}

function hasRecommendableContent(
  node: DemoRoomData["nodes"][number],
  nodes: DemoRoomData["nodes"],
  relations: DemoRoomData["relations"]
) {
  return isConcreteExploreNode(node) || concreteDescendantsForRoom(node.id, nodes, relations).length > 0;
}

function concreteDescendantsForRoom(
  nodeId: string,
  nodes: DemoRoomData["nodes"],
  relations: DemoRoomData["relations"],
  seen = new Set<string>()
): DemoRoomData["nodes"] {
  const relationChildren = relations
    .filter((relation) => relation.fromNodeId === nodeId && relation.relationType === "contains")
    .map((relation) => relation.toNodeId);
  const childIds = mergeUnique([
    ...relationChildren,
    ...nodes.filter((node) => node.parentId === nodeId).map((node) => node.id)
  ]);
  const result: DemoRoomData["nodes"] = [];

  for (const childId of childIds) {
    if (seen.has(childId)) continue;
    const child = nodes.find((node) => node.id === childId);
    if (!child) continue;
    seen.add(child.id);
    if (isConcreteExploreNode(child)) result.push(child);
    result.push(...concreteDescendantsForRoom(child.id, nodes, relations, seen));
  }

  return result;
}

function isClusterNode(node: DemoRoomData["nodes"][number]) {
  return node.nodeType === "city" || node.nodeType === "region";
}

function isConcreteExploreNode(node: DemoRoomData["nodes"][number]) {
  if (["district", "area", "attraction", "poi", "activity"].includes(node.nodeType)) return true;
  return (
    node.nodeType === "region" &&
    node.id !== "japan" &&
    node.tags.some((tag) =>
      ["day_trip", "onsen", "mountain", "lake", "sea", "island", "nature"].includes(tag)
    )
  );
}

function pickRandomItem<T>(items: T[]) {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function cardsToRecord(cards: TravelCard[]) {
  return Object.fromEntries(cards.map((card) => [card.nodeId, card]));
}

function roomStorageKey(tripId: string) {
  return `triproom:v5:${tripId}`;
}

function reactionLabel(reaction: ReactionType) {
  const labels: Record<ReactionType, string> = {
    want_to_go: "想去",
    neutral: "一般",
    not_interested: "不太想",
    want_to_know: "想了解",
    must_go: "必去",
    concern: "有顾虑"
  };
  return labels[reaction];
}

function inferReaction(text: string): ReactionType {
  if (/必去|非常|很想|一定/.test(text)) return "must_go";
  if (/不想|不去|算了|太累|太远/.test(text)) return "not_interested";
  if (/担心|顾虑|害怕|太赶/.test(text)) return "concern";
  return "want_to_go";
}

function markCardsShown(
  tripId: string,
  cards: TravelCard[],
  nodes: DemoRoomData["nodes"],
  currentStates: RoomNodeState[]
) {
  const shownNodeIds = new Set(cards.map((card) => card.nodeId));
  const stateByNode = new Map(currentStates.map((state) => [state.nodeId, state]));

  return nodes.map((node) => {
    const existing = stateByNode.get(node.id);
    if (!shownNodeIds.has(node.id)) {
      return (
        existing ?? {
          tripId,
          nodeId: node.id,
          state: "undiscovered" as const,
          explorationState: "seed" as const,
          mentionCount: 0,
          interactionCount: 0,
          shownCount: 0
        }
      );
    }

    const existingState = existing?.state;
    return {
      tripId,
      nodeId: node.id,
      state:
        existingState && ["focused", "opened", "pinned", "selected"].includes(existingState)
          ? existingState
          : ("shown" as const),
      explorationState: existing?.explorationState ?? "discovered",
      engagementScore: Math.max(existing?.engagementScore ?? 0, 0.8),
      interestScore: existing?.interestScore ?? 0,
      disagreementScore: existing?.disagreementScore ?? 0,
      firstDiscoveredAt: existing?.firstDiscoveredAt ?? new Date().toISOString(),
      lastInteractedAt: new Date().toISOString(),
      mentionCount: existing?.mentionCount ?? 0,
      interactionCount: (existing?.interactionCount ?? 0) + 1,
      source: existing?.source ?? "seed",
      shownCount: (existing?.shownCount ?? 0) + 1,
      lastShownAt: new Date().toISOString(),
      aggregateSignal: existing?.aggregateSignal
    };
  });
}

function updateNodeAggregate(
  currentStates: RoomNodeState[],
  nodeId: string,
  signals: MemberSignal[]
) {
  const summary = summarizeSignals(signals, nodeId);

  return currentStates.map((state) =>
    state.nodeId === nodeId
      ? {
          ...state,
          explorationState: summary.positiveMembers >= 2 ? ("candidate" as const) : ("engaged" as const),
          engagementScore: clampScore((state.engagementScore ?? 0) + 2 + summary.comments),
          interestScore: clampScore(summary.positiveMembers * 2.8 - summary.negativeMembers * 2.2),
          disagreementScore: summary.hasDivergence
            ? clampScore(4 + summary.positiveMembers + summary.negativeMembers)
            : 0,
          lastInteractedAt: new Date().toISOString(),
          interactionCount: (state.interactionCount ?? 0) + 1,
          source: "card" as const,
          aggregateSignal: {
            positiveMembers: summary.positiveMembers,
            negativeMembers: summary.negativeMembers,
            interestedMembers: summary.positiveMembers,
            comments: summary.comments
          }
        }
      : state
  );
}

function updateMentionedNodeStates(
  tripId: string,
  nodeIds: string[],
  nodes: DemoRoomData["nodes"],
  currentStates: RoomNodeState[],
  createdAt: string
) {
  const mentionedNodeIds = new Set(nodeIds);
  const currentByNodeId = new Map(currentStates.map((state) => [state.nodeId, state]));

  return nodes.map((node) => {
    const existing = currentByNodeId.get(node.id);
    if (!mentionedNodeIds.has(node.id)) {
      return (
        existing ?? {
          tripId,
          nodeId: node.id,
          state: "undiscovered" as const,
          explorationState: "seed" as const,
          shownCount: 0,
          mentionCount: 0,
          interactionCount: 0
        }
      );
    }

    return {
      tripId,
      nodeId: node.id,
      state:
        existing?.state && ["shown", "opened", "focused", "pinned", "selected"].includes(existing.state)
          ? existing.state
          : ("shown" as const),
      explorationState: "engaged" as const,
      engagementScore: clampScore((existing?.engagementScore ?? 0) + 2),
      interestScore: existing?.interestScore ?? 0,
      disagreementScore: existing?.disagreementScore ?? 0,
      firstDiscoveredAt: existing?.firstDiscoveredAt ?? createdAt,
      lastInteractedAt: createdAt,
      mentionCount: (existing?.mentionCount ?? 0) + 1,
      interactionCount: (existing?.interactionCount ?? 0) + 1,
      source: "conversation" as const,
      shownCount: existing?.shownCount ?? 0,
      lastShownAt: existing?.lastShownAt,
      aggregateSignal: existing?.aggregateSignal
    };
  });
}

function upsertLatestMemberSignal(signals: MemberSignal[], nextSignal: MemberSignal) {
  return [
    ...signals.filter(
      (signal) =>
        !(
          signal.memberId === nextSignal.memberId &&
          signal.targetType === nextSignal.targetType &&
          signal.targetId === nextSignal.targetId &&
          signal.visibility === nextSignal.visibility
        )
    ),
    nextSignal
  ];
}

function createPlaceOpinion(input: {
  tripId: string;
  nodeId: string;
  memberId: string;
  sourceType: PlaceOpinionSourceType;
  sourceMessageId?: string;
  content: string;
  reaction: ReactionType;
  visibility: "group" | "ai_only";
  createdAt: string;
}): PlaceOpinion {
  return {
    id: `op-${input.sourceMessageId ?? crypto.randomUUID()}-${input.nodeId}`,
    tripId: input.tripId,
    nodeId: input.nodeId,
    memberId: input.memberId,
    sourceType: input.sourceType,
    sourceMessageId: input.sourceMessageId,
    content: input.content,
    reaction: input.reaction,
    visibility: input.visibility,
    signalType: signalTypeForReaction(input.reaction),
    createdAt: input.createdAt
  };
}

function upsertPlaceOpinion(opinions: PlaceOpinion[], nextOpinion: PlaceOpinion) {
  return [...opinions.filter((opinion) => opinion.id !== nextOpinion.id), nextOpinion];
}

function updateMemberPlaceActivity(input: {
  states: MemberPlaceState[];
  tripId: string;
  nodeId: string;
  authorMemberId: string;
  activeMemberIds: string[];
  createdAt: string;
  reaction?: ReactionType;
}) {
  const activeMembers = new Set(input.activeMemberIds);
  const existingByKey = new Map(
    input.states.map((state) => [`${state.memberId}:${state.nodeId}`, state])
  );

  for (const memberId of activeMembers) {
    const key = `${memberId}:${input.nodeId}`;
    const existing = existingByKey.get(key);

    existingByKey.set(key, {
      tripId: input.tripId,
      memberId,
      nodeId: input.nodeId,
      reaction: memberId === input.authorMemberId ? input.reaction ?? existing?.reaction : existing?.reaction,
      unreadCount:
        memberId === input.authorMemberId ? 0 : (existing?.unreadCount ?? 0) + 1,
      lastReadAt: memberId === input.authorMemberId ? input.createdAt : existing?.lastReadAt,
      lastActivityAt: input.createdAt
    });
  }

  return Array.from(existingByKey.values());
}

function markPlaceRead(
  states: MemberPlaceState[],
  tripId: string,
  memberId: string,
  nodeId: string,
  readAt: string
) {
  const found = states.some((state) => state.memberId === memberId && state.nodeId === nodeId);
  if (!found) {
    return [
      ...states,
      {
        tripId,
        memberId,
        nodeId,
        unreadCount: 0,
        lastReadAt: readAt,
        lastActivityAt: readAt
      }
    ];
  }

  return states.map((state) =>
    state.memberId === memberId && state.nodeId === nodeId
      ? {
          ...state,
          unreadCount: 0,
          lastReadAt: readAt
        }
      : state
  );
}

function signalTypeForReaction(reaction: ReactionType): MemberSignal["signalType"] {
  if (reaction === "want_to_know") return "want_to_know";
  if (reaction === "neutral") return "neutral";
  if (reaction === "not_interested") return "negative";
  if (reaction === "must_go") return "must_go";
  if (reaction === "concern") return "concern";
  return "positive";
}

function upsertMemberExploreState(
  states: MemberExploreState[],
  nextState: MemberExploreState
) {
  return [
    ...states.filter((state) => state.memberId !== nextState.memberId),
    nextState
  ];
}

function mergeUnique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}
