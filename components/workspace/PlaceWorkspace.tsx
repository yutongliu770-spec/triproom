"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CornerUpLeft,
  ChevronDown,
  ChevronRight,
  MapPin,
  RotateCw,
  Search,
  Send,
  Sparkles
} from "lucide-react";
import { TravelCardBatch } from "@/components/cards/TravelCardBatch";
import { StandardPlaceCard } from "@/components/cards/StandardPlaceCard";
import { PlanPanel } from "@/components/plans/PlanPanel";
import { createTravelCard } from "@/lib/graph/cards";
import type {
  DestinationNode,
  DestinationRelation,
  Material,
  Member,
  MemberPlaceState,
  MemberSignal,
  PlaceOpinion,
  PlanVariant,
  ReactionType,
  RoomNodeState,
  TravelCard
} from "@/lib/types";

export type PlaceWorkspaceMode = "explore" | "discovered" | "planning";
export type PlaceDetailTab = "overview" | "opinions" | "materials";

interface DiscoveredViewState {
  expandedCountryIds: string[];
  expandedCityIds: string[];
}

export function PlaceWorkspace({
  mode,
  selectedNodeId,
  tripId,
  nodes,
  relations,
  activeCards,
  activeCardIndex,
  explorationPathNodeIds,
  searchQuery,
  members,
  currentMember,
  signals,
  materials,
  placeOpinions,
  memberPlaceStates,
  roomNodeStates,
  plans,
  selectedPlanId,
  planningStatus,
  planningError,
  onModeChange,
  onActiveCardIndexChange,
  onSearchQueryChange,
  onExploreSearch,
  onExploreNextCluster,
  onExplorePathBack,
  onExplorePathRandomize,
  onExploreAreaFocus,
  onOpenPlace,
  onClosePlace,
  onReact,
  onComment,
  onExploreSubmit,
  onGeneratePlans,
  onPlanComment,
  onPlanSelect,
  onPlanRevise
}: {
  mode: PlaceWorkspaceMode;
  selectedNodeId?: string;
  tripId: string;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  activeCards: TravelCard[];
  activeCardIndex: number;
  explorationPathNodeIds: string[];
  searchQuery: string;
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  materials: Material[];
  placeOpinions: PlaceOpinion[];
  memberPlaceStates: MemberPlaceState[];
  roomNodeStates: RoomNodeState[];
  plans: PlanVariant[];
  selectedPlanId?: string;
  planningStatus?: "idle" | "generating" | "revising";
  planningError?: string;
  onModeChange: (mode: PlaceWorkspaceMode) => void;
  onActiveCardIndexChange: (index: number) => void;
  onSearchQueryChange: (query: string) => void;
  onExploreSearch: (query: string) => void;
  onExploreNextCluster: () => void;
  onExplorePathBack: () => void;
  onExplorePathRandomize: (levelIndex: number) => void;
  onExploreAreaFocus: (nodeId: string) => void;
  onOpenPlace: (nodeId: string, tab?: PlaceDetailTab) => void;
  onClosePlace: () => void;
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
  onExploreSubmit: (text: string, shareToGroup: boolean) => void;
  onGeneratePlans: () => void;
  onPlanComment: (plan: PlanVariant, text: string) => void;
  onPlanSelect: (planId: string) => void;
  onPlanRevise: (plan: PlanVariant, instruction: string) => void;
}) {
  const selectedNode = selectedNodeId ? nodes.find((node) => node.id === selectedNodeId) : undefined;
  const [discoveredViewState, setDiscoveredViewState] = useState<DiscoveredViewState>({
    expandedCountryIds: ["japan"],
    expandedCityIds: []
  });

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] bg-paper shadow-soft" aria-label="Place Workspace">
      <div className="shrink-0 border-b border-ink/10 bg-white/70 px-3 py-1.5 backdrop-blur md:px-4">
        <div className="flex items-center justify-center">
          <div className="grid grid-cols-3 rounded-full bg-cloud p-0.5 text-xs font-semibold text-ink/60">
            {[
              ["explore", "探索"],
              ["discovered", "沉淀"],
              ["planning", "规划"]
            ].map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`focus-ring rounded-full px-4 py-1.5 ${
                  mode === tab ? "bg-pine text-paper" : "hover:bg-white"
                }`}
                onClick={() => onModeChange(tab as PlaceWorkspaceMode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {selectedNode ? (
          <div className="h-full overflow-y-auto p-4 md:p-5">
            <WorkspacePlaceDetail
              node={selectedNode}
              relations={relations}
              nodes={nodes}
              members={members}
              currentMember={currentMember}
              signals={signals}
              materials={materials}
              opinions={placeOpinions}
              roomNodeState={roomNodeStates.find((state) => state.nodeId === selectedNode.id)}
              onClose={onClosePlace}
              onReact={onReact}
              onComment={onComment}
            />
          </div>
        ) : mode === "explore" ? (
          <ExploreMode
            tripId={tripId}
            activeCards={activeCards}
            activeCardIndex={activeCardIndex}
            explorationPathNodeIds={explorationPathNodeIds}
            searchQuery={searchQuery}
            nodes={nodes}
            members={members}
            currentMember={currentMember}
            signals={signals}
            opinions={placeOpinions}
            materials={materials}
            roomNodeStates={roomNodeStates}
            onReact={onReact}
            onComment={onComment}
            onActiveCardIndexChange={onActiveCardIndexChange}
            onSearchQueryChange={onSearchQueryChange}
            onExploreSearch={onExploreSearch}
            onExploreNextCluster={onExploreNextCluster}
            onExplorePathBack={onExplorePathBack}
            onExplorePathRandomize={onExplorePathRandomize}
            onExploreAreaFocus={onExploreAreaFocus}
            onExploreSubmit={onExploreSubmit}
          />
        ) : mode === "discovered" ? (
          <div className="h-full overflow-y-auto p-4 md:p-5">
            <DiscoveredMode
              nodes={nodes}
              materials={materials}
              signals={signals}
              opinions={placeOpinions}
              memberPlaceStates={memberPlaceStates}
              roomNodeStates={roomNodeStates}
              currentMemberId={currentMember.id}
              viewState={discoveredViewState}
              onViewStateChange={setDiscoveredViewState}
              onOpenPlace={onOpenPlace}
            />
          </div>
        ) : (
          <PlanPanel
            plans={plans}
            selectedPlanId={selectedPlanId}
            status={planningStatus}
            error={planningError}
            onOpenPlace={onOpenPlace}
            onGeneratePlans={onGeneratePlans}
            onPlanComment={onPlanComment}
            onPlanSelect={onPlanSelect}
            onPlanRevise={onPlanRevise}
          />
        )}
      </div>
    </section>
  );
}

function ExploreMode({
  activeCards,
  activeCardIndex,
  explorationPathNodeIds,
  searchQuery,
  nodes,
  members,
  currentMember,
  signals,
  opinions,
  materials,
  roomNodeStates,
  onReact,
  onComment,
  onActiveCardIndexChange,
  onSearchQueryChange,
  onExploreSearch,
  onExploreNextCluster,
  onExplorePathBack,
  onExplorePathRandomize,
  onExploreAreaFocus,
  onExploreSubmit
}: {
  tripId: string;
  activeCards: TravelCard[];
  activeCardIndex: number;
  explorationPathNodeIds: string[];
  searchQuery: string;
  nodes: DestinationNode[];
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  materials: Material[];
  roomNodeStates: RoomNodeState[];
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
  onActiveCardIndexChange: (index: number) => void;
  onSearchQueryChange: (query: string) => void;
  onExploreSearch: (query: string) => void;
  onExploreNextCluster: () => void;
  onExplorePathBack: () => void;
  onExplorePathRandomize: (levelIndex: number) => void;
  onExploreAreaFocus: (nodeId: string) => void;
  onExploreSubmit: (text: string, shareToGroup: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [shareToGroup, setShareToGroup] = useState(false);
  const pathNodes = explorationPathNodeIds
    .map((nodeId) => nodes.find((node) => node.id === nodeId))
    .filter((node): node is DestinationNode => Boolean(node));
  const isDirectionExhausted = activeCards.length > 0 && activeCardIndex >= activeCards.length - 1;

  function submit() {
    const value = text.trim();
    if (!value) return;
    onExploreSubmit(value, shareToGroup);
    setText("");
    setShareToGroup(false);
  }

  function submitSearch() {
    const value = searchQuery.trim();
    if (!value) return;
    onExploreSearch(value);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col p-2.5 pb-2 md:p-3 md:pb-2">
        <div className="mb-2 shrink-0 space-y-1.5">
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="搜索城市、景点或想看的体验..."
              className="focus-ring h-9 min-w-0 flex-1 rounded-full border border-ink/10 bg-white px-3 text-xs text-ink placeholder:text-ink/35"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) submitSearch();
              }}
            />
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-coral px-3 text-xs font-semibold text-white"
              onClick={submitSearch}
            >
              <Search size={14} aria-hidden="true" />
              搜索
            </button>
          </div>
          <div className="flex min-h-8 items-center gap-2 rounded-2xl bg-white/75 px-2 py-1 text-xs text-ink/55">
            <span className="shrink-0 font-semibold text-ink/45">正在探索：</span>
            <ExploreBreadcrumb
              pathNodes={pathNodes}
              onBack={onExplorePathBack}
              onRandomize={onExplorePathRandomize}
            />
            <button
              type="button"
              className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-full bg-cloud text-ink/60"
              aria-label="换个地方"
              title="换个地方"
              onClick={onExploreNextCluster}
            >
              <RotateCw size={14} aria-hidden="true" />
            </button>
          </div>
          {isDirectionExhausted && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-sun/15 px-2 py-1.5 text-[11px] font-medium text-ink/60">
              <span className="mr-auto">这个方向目前已经探索得差不多了</span>
              <button
                type="button"
                className="focus-ring rounded-full bg-white px-2 py-1 font-semibold"
                onClick={onExploreNextCluster}
              >
                换个地方
              </button>
              <button
                type="button"
                className="focus-ring rounded-full bg-white px-2 py-1 font-semibold disabled:opacity-40"
                disabled={pathNodes.length <= 1}
                onClick={onExplorePathBack}
              >
                回到上一级
              </button>
            </div>
          )}
        </div>
        <TravelCardBatch
          cards={activeCards}
          activeIndex={activeCardIndex}
          nodes={nodes}
          members={members}
          currentMember={currentMember}
          signals={signals}
          opinions={opinions}
          materials={materials}
          roomNodeStates={roomNodeStates}
          onReact={onReact}
          onComment={onComment}
          onActiveIndexChange={onActiveCardIndexChange}
          onExploreAreaFocus={onExploreAreaFocus}
        />
      </section>

      <section
        className="shrink-0 border-t border-ink/10 bg-white px-3 py-1.5 md:px-4"
        aria-label="AI Exploration Input"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          <Sparkles size={15} className="shrink-0 text-coral" aria-hidden="true" />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="比如：想多看自然风景，少一点主题乐园"
            className="focus-ring h-8 min-w-0 flex-1 rounded-full border border-ink/10 bg-paper px-3 text-xs text-ink placeholder:text-ink/35"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) submit();
            }}
          />
          <button
            type="button"
            className="focus-ring grid size-8 place-items-center rounded-full bg-pine text-paper"
            aria-label="提交探索方向"
            onClick={submit}
          >
            <Send size={14} aria-hidden="true" />
          </button>
        </div>
        <label className="mt-1 flex items-center gap-2 text-[11px] text-ink/55">
          <input
            type="checkbox"
            checked={shareToGroup}
            onChange={(event) => setShareToGroup(event.target.checked)}
          />
          分享到群聊
        </label>
      </section>
    </div>
  );
}

function ExploreBreadcrumb({
  pathNodes,
  onBack,
  onRandomize
}: {
  pathNodes: DestinationNode[];
  onBack: () => void;
  onRandomize: (levelIndex: number) => void;
}) {
  if (pathNodes.length === 0) {
    return <span className="truncate font-semibold text-ink">日本</span>;
  }

  return (
    <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" aria-label="正在探索路径">
      <div className="flex w-max items-center gap-1">
        {pathNodes.map((node, index) => {
          const isLast = index === pathNodes.length - 1;
          return (
            <span key={node.id} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-ink/25">/</span>}
              <span className="inline-flex items-center rounded-full bg-cloud px-2 py-1 font-semibold text-ink/70">
                {node.canonicalName}
                {node.nodeType !== "country" && (
                  <button
                    type="button"
                    className="focus-ring ml-1 grid size-5 place-items-center rounded-full text-ink/45 hover:bg-white"
                    aria-label={`随机切换${node.canonicalName}`}
                    title="随机切换同级目的地"
                    onClick={() => onRandomize(index)}
                  >
                    <RotateCw size={12} aria-hidden="true" />
                  </button>
                )}
                {isLast && pathNodes.length > 1 && (
                  <button
                    type="button"
                    className="focus-ring ml-0.5 grid size-5 place-items-center rounded-full text-ink/45 hover:bg-white"
                    aria-label={`移除${node.canonicalName}`}
                    title="回到上一级"
                    onClick={onBack}
                  >
                    <CornerUpLeft size={12} aria-hidden="true" />
                  </button>
                )}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DiscoveredMode({
  nodes,
  materials,
  signals,
  opinions,
  memberPlaceStates,
  roomNodeStates,
  currentMemberId,
  viewState,
  onViewStateChange,
  onOpenPlace
}: {
  nodes: DestinationNode[];
  materials: Material[];
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  memberPlaceStates: MemberPlaceState[];
  roomNodeStates: RoomNodeState[];
  currentMemberId: string;
  viewState: DiscoveredViewState;
  onViewStateChange: (state: DiscoveredViewState) => void;
  onOpenPlace: (nodeId: string, tab?: PlaceDetailTab) => void;
}) {
  const hierarchy = useMemo(
    () =>
      buildDiscoveredHierarchy({
        nodes,
        materials,
        signals,
        opinions,
        memberPlaceStates,
        roomNodeStates,
        currentMemberId
      }),
    [currentMemberId, materials, memberPlaceStates, nodes, opinions, roomNodeStates, signals]
  );

  function toggleCountry(countryId: string) {
    const expanded = new Set(viewState.expandedCountryIds);
    if (expanded.has(countryId)) expanded.delete(countryId);
    else expanded.add(countryId);
    onViewStateChange({ ...viewState, expandedCountryIds: Array.from(expanded) });
  }

  function toggleCity(cityId: string) {
    const expanded = new Set(viewState.expandedCityIds);
    if (expanded.has(cityId)) expanded.delete(cityId);
    else expanded.add(cityId);
    onViewStateChange({ ...viewState, expandedCityIds: Array.from(expanded) });
  }

  return (
    <div className="space-y-4" aria-label="层级旅行收藏">
      {hierarchy.countries.map((country) => {
        const countryOpen = viewState.expandedCountryIds.includes(country.node.id);

        return (
          <section key={country.node.id} className="rounded-[22px] border border-ink/10 bg-white p-2.5">
            <button
              type="button"
              className="focus-ring flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left"
              aria-expanded={countryOpen}
              onClick={() => toggleCountry(country.node.id)}
            >
              {countryOpen ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronRight size={17} aria-hidden="true" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold text-ink">{country.node.canonicalName}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-ink/50">
                  <span>{country.interestLabel}</span>
                  <span className={country.unreadCount > 0 ? "text-coral" : ""}>
                    {country.unreadCount > 0 ? "有新动态" : "暂无新动态"}
                  </span>
                </div>
              </div>
            </button>

            {countryOpen && (
              <div className="mt-3 space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]" aria-label={`${country.node.canonicalName}城市收藏`}>
                  {country.cities.map((city) => {
                    const cityOpen = viewState.expandedCityIds.includes(city.node.id);
                    const cityImage =
                      city.node.images?.[0] ??
                      (city.node.heroImageUrl
                        ? { url: city.node.heroImageUrl, alt: city.node.imageAlt }
                        : undefined);
                    return (
                      <button
                        key={city.node.id}
                        type="button"
                        className={`focus-ring relative min-h-20 min-w-[128px] overflow-hidden rounded-2xl border bg-ink p-2.5 text-left shadow-[0_8px_18px_rgba(23,33,31,0.08)] ${
                          cityOpen ? "border-coral/70 ring-2 ring-coral/20" : "border-ink/10"
                        }`}
                        aria-expanded={cityOpen}
                        onClick={() => toggleCity(city.node.id)}
                      >
                        {cityImage && (
                          <Image
                            src={cityImage.url}
                            alt=""
                            fill
                            sizes="140px"
                            className="scale-110 object-cover opacity-62 blur-[1.5px]"
                            aria-hidden="true"
                          />
                        )}
                        <span className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/48 to-ink/10" aria-hidden="true" />
                        <div className="relative z-[1] flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-semibold text-white">{city.node.canonicalName}</h3>
                          {cityOpen ? <ChevronDown size={15} className="shrink-0 text-white" aria-hidden="true" /> : <ChevronRight size={15} className="shrink-0 text-white" aria-hidden="true" />}
                        </div>
                        <div className="relative z-[1] mt-1.5 text-[11px] font-medium leading-4 text-white/72">
                          <span>探索度</span>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/24">
                            <div
                              className="h-full rounded-full bg-coral"
                              style={{ width: `${city.explorationProgress}%` }}
                            />
                          </div>
                          <div className="mt-1 truncate">
                            {city.interestLabel}
                            {city.unreadCount > 0 ? ` · ${city.unreadCount} 新` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {country.cities
                  .filter((city) => viewState.expandedCityIds.includes(city.node.id))
                  .map((city) => (
                    <div key={`${city.node.id}-places`} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <MapPin size={15} className="text-coral" aria-hidden="true" />
                        {city.node.canonicalName}
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
                        {city.places.map((place) => (
                          <PlaceMiniCard
                            key={place.node.id}
                            item={place}
                            onOpen={() => onOpenPlace(place.node.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WorkspacePlaceDetail({
  node,
  nodes,
  relations,
  members,
  currentMember,
  signals,
  materials,
  opinions,
  roomNodeState,
  onClose,
  onReact,
  onComment
}: {
  node: DestinationNode;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  members: Member[];
  currentMember: Member;
  signals: MemberSignal[];
  materials: Material[];
  opinions: PlaceOpinion[];
  roomNodeState?: RoomNodeState;
  onClose: () => void;
  onReact: (card: TravelCard, reaction: ReactionType) => void;
  onComment: (
    card: TravelCard,
    text: string,
    visibility: "group" | "ai_only",
    source?: "text" | "voice"
  ) => void;
}) {
  const card = createTravelCard(node, relations);

  return (
    <div className="flex h-full min-h-[620px] flex-col gap-3">
      <div className="flex shrink-0 items-center gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink/40">Place Detail</div>
          <h2 className="truncate text-xl font-semibold text-ink">{node.canonicalName}</h2>
        </div>
        <button
          type="button"
          className="focus-ring ml-auto rounded-full bg-cloud px-3 py-2 text-xs font-semibold text-ink/60"
          onClick={onClose}
        >
          返回工作区
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <StandardPlaceCard
          card={card}
          nodes={nodes}
          members={members}
          currentMember={currentMember}
          signals={signals}
          opinions={opinions}
          materials={materials}
          roomNodeState={roomNodeState}
          variant="detail"
          onReact={onReact}
          onComment={onComment}
        />
      </div>
    </div>
  );
}

interface CollectionPlace {
  node: DestinationNode;
  interestLabel: string;
  unreadCount: number;
}

interface CollectionCity {
  node: DestinationNode;
  places: CollectionPlace[];
  placeCount: number;
  discoveredCount: number;
  unreadCount: number;
  interestLabel: string;
  explorationProgress: number;
}

interface CollectionCountry {
  node: DestinationNode;
  cities: CollectionCity[];
  discoveredCount: number;
  unreadCount: number;
  interestLabel: string;
}

const CITY_COLLECTION_PRIORITY = [
  "tokyo",
  "kyoto",
  "osaka",
  "fuji-kawaguchiko",
  "hokkaido",
  "okinawa"
];

function buildDiscoveredHierarchy(input: {
  nodes: DestinationNode[];
  materials: Material[];
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  memberPlaceStates: MemberPlaceState[];
  roomNodeStates: RoomNodeState[];
  currentMemberId: string;
}): { countries: CollectionCountry[] } {
  const discoveredIds = collectDiscoveredIds(input);
  const stateById = new Map(input.roomNodeStates.map((state) => [state.nodeId, state]));
  const countries = input.nodes
    .filter((node) => node.nodeType === "country")
    .map<CollectionCountry>((country) => {
      const cities = input.nodes
        .filter((node) => isCollectionCity(node, country.id))
        .map<CollectionCity>((city) => {
          const places = descendantPlaces(city.id, input.nodes)
            .filter((place) => discoveredIds.has(place.id) || isSeedCollectiblePlace(place))
            .slice(0, 10)
            .map<CollectionPlace>((place) => ({
              node: place,
              interestLabel: interestLabel(stateById.get(place.id)),
              unreadCount: unreadCountForPlace(input.memberPlaceStates, input.currentMemberId, place.id)
            }));
          const placeIds = places.map((place) => place.node.id);
          const discoveredCount = placeIds.filter((id) => discoveredIds.has(id)).length;

          return {
            node: city,
            places,
            placeCount: places.length,
            discoveredCount,
            unreadCount: placeIds.reduce(
              (sum, id) => sum + unreadCountForPlace(input.memberPlaceStates, input.currentMemberId, id),
              0
            ),
            interestLabel: interestLabelForNodes([city.id, ...placeIds], stateById),
            explorationProgress: cityExplorationProgress({
              places: places.map((place) => place.node),
              materials: input.materials,
              signals: input.signals,
              opinions: input.opinions,
              stateById
            })
          };
        })
        .filter((city) => city.places.length > 0)
        .sort((a, b) => cityPriority(a.node.id) - cityPriority(b.node.id));
      const countryPlaceIds = cities.flatMap((city) => city.places.map((place) => place.node.id));

      return {
        node: country,
        cities,
        discoveredCount: countryPlaceIds.filter((id) => discoveredIds.has(id)).length,
        unreadCount: countryPlaceIds.reduce(
          (sum, id) => sum + unreadCountForPlace(input.memberPlaceStates, input.currentMemberId, id),
          0
        ),
        interestLabel: interestLabelForNodes([country.id, ...countryPlaceIds], stateById)
      };
    })
    .filter((country) => country.cities.length > 0);

  return { countries };
}

function PlaceMiniCard({ item, onOpen }: { item: CollectionPlace; onOpen: () => void }) {
  const image = item.node.images?.[0] ?? (item.node.heroImageUrl ? { url: item.node.heroImageUrl, alt: item.node.imageAlt } : undefined);

  return (
    <button
      type="button"
      className="focus-ring relative min-h-[118px] overflow-hidden rounded-2xl border border-ink/10 bg-ink text-left shadow-[0_8px_18px_rgba(23,33,31,0.08)]"
      onClick={onOpen}
    >
      {image && (
        <Image
          src={image.url}
          alt=""
          fill
          sizes="140px"
          className="scale-110 object-cover opacity-65 blur-[1.5px]"
          aria-hidden="true"
        />
      )}
      <span className="absolute inset-0 bg-gradient-to-t from-ink/88 via-ink/42 to-ink/8" aria-hidden="true" />
      {item.unreadCount > 0 && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white">
          {item.unreadCount} 新
        </span>
      )}
      <div className="relative z-[1] flex min-h-[118px] flex-col justify-end p-2.5">
        <h4 className="truncate text-sm font-semibold text-white">{item.node.canonicalName}</h4>
        <p className="mt-1 line-clamp-1 text-[11px] font-medium text-white/76">
          {item.node.highlights.slice(0, 2).join(" · ")}
        </p>
        <div className="mt-1.5 inline-flex w-fit rounded-full bg-white/18 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
          {item.interestLabel}
        </div>
      </div>
    </button>
  );
}

function collectDiscoveredIds(input: {
  materials: Material[];
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  roomNodeStates: RoomNodeState[];
}) {
  const ids = new Set<string>();
  for (const state of input.roomNodeStates) {
    if (state.state !== "undiscovered" || state.explorationState !== "seed") ids.add(state.nodeId);
  }
  for (const signal of input.signals) {
    if (signal.targetType === "node") ids.add(signal.targetId);
  }
  for (const material of input.materials) {
    if (material.primaryNodeId) ids.add(material.primaryNodeId);
  }
  for (const opinion of input.opinions) ids.add(opinion.nodeId);
  return ids;
}

function descendantPlaces(rootNodeId: string, nodes: DestinationNode[], seen = new Set<string>()) {
  const children = nodes.filter((node) => node.parentId === rootNodeId);
  const result: DestinationNode[] = [];

  for (const child of children) {
    if (seen.has(child.id)) continue;
    seen.add(child.id);
    if (isCollectiblePlace(child)) result.push(child);
    result.push(...descendantPlaces(child.id, nodes, seen));
  }

  return result;
}

function isCollectionCity(node: DestinationNode, countryId: string) {
  return (
    node.parentId === countryId &&
    (node.nodeType === "city" || node.nodeType === "region") &&
    CITY_COLLECTION_PRIORITY.includes(node.id)
  );
}

function isCollectiblePlace(node: DestinationNode) {
  if (node.nodeType === "country" || node.nodeType === "city") return false;
  return !(node.nodeType === "region" && node.parentId === "japan");
}

function isSeedCollectiblePlace(node: DestinationNode) {
  return isCollectiblePlace(node) && Boolean(node.isSeedData);
}

function cityPriority(cityId: string) {
  const index = CITY_COLLECTION_PRIORITY.indexOf(cityId);
  return index >= 0 ? index : CITY_COLLECTION_PRIORITY.length;
}

function unreadCountForPlace(
  memberPlaceStates: MemberPlaceState[],
  memberId: string,
  nodeId: string
) {
  return (
    memberPlaceStates.find(
      (state) => state.memberId === memberId && state.nodeId === nodeId
    )?.unreadCount ?? 0
  );
}

function interestLabelForNodes(nodeIds: string[], stateById: Map<string, RoomNodeState>) {
  const maxInterest = Math.max(
    0,
    ...nodeIds.map((nodeId) => stateById.get(nodeId)?.interestScore ?? 0)
  );
  if (maxInterest >= 7) return "高兴趣";
  if (maxInterest >= 3) return "有兴趣";
  return "待表态";
}

function interestLabel(state?: RoomNodeState) {
  const interest = state?.interestScore ?? 0;
  if (interest >= 7) return "高兴趣";
  if (interest >= 3) return "有兴趣";
  return "待表态";
}

function cityExplorationProgress(input: {
  places: DestinationNode[];
  materials: Material[];
  signals: MemberSignal[];
  opinions: PlaceOpinion[];
  stateById: Map<string, RoomNodeState>;
}) {
  if (input.places.length === 0) return 8;

  const interactedMembers = new Set<string>();
  const coveredTypes = new Set<string>();
  let score = 8;

  for (const place of input.places) {
    const state = input.stateById.get(place.id);
    const placeSignals = input.signals.filter(
      (signal) => signal.targetType === "node" && signal.targetId === place.id
    );
    const placeOpinions = input.opinions.filter((opinion) => opinion.nodeId === place.id);
    const placeMaterials = input.materials.filter((material) => material.primaryNodeId === place.id);

    if ((state?.shownCount ?? 0) > 0) score += 3;
    if (state?.state === "opened" || state?.state === "focused" || state?.state === "selected") score += 6;
    if (placeSignals.length > 0) score += 7;
    if (placeOpinions.length > 0) score += 10;
    if (placeMaterials.length > 0) score += 10;

    for (const signal of placeSignals) interactedMembers.add(signal.memberId);
    for (const opinion of placeOpinions) interactedMembers.add(opinion.memberId);
    if ((state?.shownCount ?? 0) > 0 || placeSignals.length || placeOpinions.length || placeMaterials.length) {
      coveredTypes.add(place.tags[0] ?? place.nodeType);
    }
  }

  score += Math.max(0, interactedMembers.size - 1) * 8;
  score += Math.min(18, coveredTypes.size * 5);

  return Math.max(8, Math.min(96, Math.round(score)));
}
