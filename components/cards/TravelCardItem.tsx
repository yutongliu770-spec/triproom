"use client";

import { StandardPlaceCard } from "@/components/cards/StandardPlaceCard";
import type {
  DestinationNode,
  Material,
  Member,
  MemberSignal,
  PlaceOpinion,
  ReactionType,
  RoomNodeState,
  TravelCard
} from "@/lib/types";

export function TravelCardItem({
  card,
  nodes,
  members,
  currentMember,
  signals,
  opinions,
  materials,
  roomNodeState,
  onReact,
  onComment,
  onExploreAreaFocus
}: {
  card: TravelCard;
  nodes: DestinationNode[];
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  materials: Material[];
  roomNodeState?: RoomNodeState;
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
  onExploreAreaFocus: (nodeId: string) => void;
}) {
  return (
    <StandardPlaceCard
      card={card}
      nodes={nodes}
      members={members}
      currentMember={currentMember}
      signals={signals}
      opinions={opinions}
      materials={materials}
      roomNodeState={roomNodeState}
      onReact={onReact}
      onComment={onComment}
      onExploreAreaFocus={onExploreAreaFocus}
    />
  );
}
