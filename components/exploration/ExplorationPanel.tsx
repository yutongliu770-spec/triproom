"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject, WheelEvent as ReactWheelEvent } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  GitBranch,
  Heart,
  Layers3,
  LocateFixed,
  MapPin,
  MapPinned,
  Minus,
  Plus
} from "lucide-react";
import type {
  ChatMessage,
  DestinationNode,
  DestinationRelation,
  Material,
  MemberPlaceState,
  MemberSignal,
  RoomNodeState
} from "@/lib/types";
import {
  computePlaceExplorationStates,
  findUnresolvedPlaceMentions,
  type PlaceExplorationState
} from "@/lib/graph/place-state";
import {
  computeFeaturedPlaceStats,
  focusZoomForNode,
  getMapPlacesForContext,
  resolveMapContext,
  semanticLevelForZoom,
  semanticZoomLabel,
  type GeoPoint,
  type MapSemanticLevel
} from "@/lib/graph/map-context";

export function ExplorationPanel({
  focusNodeId,
  nodes,
  relations,
  states,
  signals,
  materials,
  messages,
  currentMemberId,
  memberPlaceStates,
  activePlaceId,
  onOpenPlace
}: {
  tripId: string;
  focusNodeId: string;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  states: RoomNodeState[];
  signals: MemberSignal[];
  materials: Material[];
  messages: ChatMessage[];
  currentMemberId: string;
  memberPlaceStates: MemberPlaceState[];
  activePlaceId?: string;
  onOpenPlace: (nodeId: string, tab?: "overview" | "opinions" | "materials") => void;
}) {
  const [mapCenter, setMapCenter] = useState<GeoPoint>(JAPAN_CENTER);
  const [mapZoom, setMapZoom] = useState(INITIAL_MAP_ZOOM);
  const focusNode = nodes.find((node) => node.id === focusNodeId);
  const placeStates = useMemo(
    () =>
      computePlaceExplorationStates({
        nodes,
        relations,
        roomNodeStates: states,
        signals,
        messages,
        materials
      }),
    [materials, messages, nodes, relations, signals, states]
  );
  const semanticLevel = semanticLevelForZoom(mapZoom);
  const currentContext = useMemo(
    () => resolveMapContext({ center: mapCenter, zoom: mapZoom, nodes, relations }),
    [mapCenter, mapZoom, nodes, relations]
  );
  const visiblePlaces = useMemo(
    () => getMapPlacesForContext({ context: currentContext, nodes, relations }),
    [currentContext, nodes, relations]
  );
  const unresolvedMentions = findUnresolvedPlaceMentions(messages, nodes);
  const activePlace = activePlaceId ? nodes.find((node) => node.id === activePlaceId) : undefined;
  const mapPlaces = mergeMapPlaces(visiblePlaces, activePlace).filter((node) => Boolean(node.geo));

  useEffect(() => {
    const node = nodes.find((item) => item.id === focusNodeId);
    if (node?.geo) focusMapOnNode(node);
    // Focus changes should reposition the map, but only when the shared room focus changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId]);

  function focusMapOnNode(node: DestinationNode) {
    if (!node.geo) return;
    setMapCenter({ latitude: node.geo.latitude, longitude: node.geo.longitude });
    setMapZoom(focusZoomForNode(node));
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <GitBranch size={17} aria-hidden="true" />
          Exploration Map
        </div>
        <div className="rounded-full bg-cloud px-3 py-1.5 text-[11px] font-semibold text-ink/60">
          Zoom {mapZoom} · {semanticZoomLabel(semanticLevel)}
        </div>
      </div>

      <section className="mt-4 rounded-2xl bg-cloud px-3 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/45">
          当前您在看
        </div>
        <nav className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="当前地理上下文">
          {currentContext.breadcrumb.map((node, index) => (
            <span key={node.id} className="inline-flex items-center gap-1.5">
              {index > 0 && <span className="text-xs text-ink/35">&gt;</span>}
              <button
                type="button"
                className="focus-ring rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink/70"
                onClick={() => focusMapOnNode(node)}
              >
                {node.canonicalName}
              </button>
            </span>
          ))}
        </nav>
      </section>

      {focusNode && (
        <section className="mt-5 rounded-2xl bg-pine p-4 text-paper">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPinned size={16} aria-hidden="true" />
            当前焦点
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{focusNode.canonicalName}</h2>
          <p className="mt-2 text-sm leading-6 text-paper/75">{focusNode.shortSummary}</p>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-[24px] border border-ink/10 bg-paper">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <div className="flex flex-1 items-center gap-2 px-4 pt-4">
            <Layers3 size={16} aria-hidden="true" />
            语义缩放 · {semanticZoomLabel(semanticLevel)}
          </div>
        </div>
        <GeoMap
          center={mapCenter}
          zoom={mapZoom}
          semanticLevel={semanticLevel}
          places={mapPlaces}
          allNodes={nodes}
          relations={relations}
          states={placeStates}
          currentMemberId={currentMemberId}
          memberPlaceStates={memberPlaceStates}
          activePlaceId={activePlaceId}
          onViewChange={(nextView) => {
            setMapCenter(nextView.center);
            setMapZoom(nextView.zoom);
          }}
          onPlaceClick={(node) => {
            onOpenPlace(node.id);
          }}
          onUnreadClick={(node) => {
            onOpenPlace(node.id, "opinions");
          }}
        />
      </section>

      {unresolvedMentions.length > 0 && (
        <section className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <AlertTriangle size={16} className="text-sun" aria-hidden="true" />
            新发现地点 · 尚未定位
          </div>
          <div className="mt-3 space-y-2">
            {unresolvedMentions.map((mention) => (
              <div key={mention.id} className="rounded-2xl bg-cloud p-3 text-xs leading-5 text-ink/65">
                <span className="font-semibold text-ink">{mention.name}</span> · {mention.reason}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GeoMap({
  center,
  zoom,
  semanticLevel,
  places,
  allNodes,
  relations,
  states,
  currentMemberId,
  memberPlaceStates,
  activePlaceId,
  onViewChange,
  onPlaceClick,
  onUnreadClick
}: {
  center: GeoPoint;
  zoom: number;
  semanticLevel: MapSemanticLevel;
  places: DestinationNode[];
  allNodes: DestinationNode[];
  relations: DestinationRelation[];
  states: Map<string, PlaceExplorationState>;
  currentMemberId: string;
  memberPlaceStates: MemberPlaceState[];
  activePlaceId?: string;
  onViewChange: (view: { center: GeoPoint; zoom: number }) => void;
  onPlaceClick: (node: DestinationNode) => void;
  onUnreadClick: (node: DestinationNode) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{
    pointerId: number;
    startPoint: { x: number; y: number };
    startCenter: GeoPoint;
  } | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
    midpoint: { x: number; y: number };
  } | null>(null);
  const lastFocusedActivePlaceRef = useRef<string | undefined>(undefined);
  const size = useElementSize(mapRef);
  const tiles = useMemo(() => visibleTiles(center, zoom, size), [center, size, zoom]);
  const centerPoint = project(center, zoom);
  const compactCardIds = useMemo(
    () => {
      const ids = selectCompactCardPlaceIds({
          places,
          states,
          center,
          zoom,
          size,
          semanticLevel,
          limit: size.width < 430 ? 2 : isWideSemanticLevel(semanticLevel) ? 5 : 4
        });
      if (activePlaceId) ids.unshift(activePlaceId);
      return new Set(ids);
    },
    [activePlaceId, center, places, semanticLevel, size, states, zoom]
  );

  useEffect(() => {
    if (!activePlaceId || lastFocusedActivePlaceRef.current === activePlaceId) return;
    const activeNode = allNodes.find((node) => node.id === activePlaceId);
    if (!activeNode?.geo || size.width <= 0 || size.height <= 0) return;

    lastFocusedActivePlaceRef.current = activePlaceId;
    if (isGeoPointInViewport(activeNode.geo, center, zoom, size)) return;

    smoothViewChange({
      from: { center, zoom },
      to: {
        center: activeNode.geo,
        zoom: exploreZoomForActivePlace(activeNode, zoom)
      },
      onViewChange
    });
  }, [activePlaceId, allNodes, center, onViewChange, size, zoom]);

  function setZoomAt(nextZoom: number, anchor: { x: number; y: number }) {
    const clampedZoom = clampZoom(nextZoom);
    if (clampedZoom === zoom) return;
    onViewChange({
      center: centerForZoomAt(center, zoom, clampedZoom, anchor, size),
      zoom: clampedZoom
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const anchor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setZoomAt(zoom + (event.deltaY > 0 ? -1 : 1), anchor);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isInteractiveMapTarget(event.target)) return;

    const point = pointFromPointerEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        pointerId: event.pointerId,
        startPoint: point,
        startCenter: center
      };
      pinchRef.current = null;
      return;
    }

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        startDistance: distanceBetween(first, second),
        startZoom: zoom,
        midpoint: midpointBetween(first, second)
      };
      dragRef.current = null;
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, pointFromPointerEvent(event));

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = distanceBetween(first, second);
      const zoomDelta = distance > pinchRef.current.startDistance * 1.18 ? 1 : distance < pinchRef.current.startDistance * 0.82 ? -1 : 0;
      if (zoomDelta !== 0) {
        setZoomAt(pinchRef.current.startZoom + zoomDelta, pinchRef.current.midpoint);
      }
      return;
    }

    if (dragRef.current?.pointerId !== event.pointerId) return;
    const currentPoint = pointFromPointerEvent(event);
    const startCenterPoint = project(dragRef.current.startCenter, zoom);
    onViewChange({
      center: unproject(
        {
          x: startCenterPoint.x - (currentPoint.x - dragRef.current.startPoint.x),
          y: startCenterPoint.y - (currentPoint.y - dragRef.current.startPoint.y)
        },
        zoom
      ),
      zoom
    });
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  return (
    <div
      ref={mapRef}
      className="relative h-[360px] max-h-[56vh] min-h-[320px] w-full touch-none overflow-hidden bg-skywash md:h-[420px]"
      aria-label="真实地理探索地图"
      role="region"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {tiles.map((tile) => (
        <div
          key={`${zoom}-${tile.x}-${tile.y}`}
          className="absolute size-[256px] bg-cover bg-center"
          style={{
            left: tile.left,
            top: tile.top,
            backgroundImage: `url("https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png")`
          }}
          aria-hidden="true"
        />
      ))}

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.04),rgba(23,33,31,0.08))]" />

      {places.map((node) => {
        if (!node.geo) return null;
        const state = states.get(node.id);
        const isActive = node.id === activePlaceId;
        const visual = pinVisual(state, isActive);
        const unreadCount = unreadCountForPlace(memberPlaceStates, currentMemberId, node.id);
        const point = project({ latitude: node.geo.latitude, longitude: node.geo.longitude }, zoom);
        const left = point.x - centerPoint.x + size.width / 2;
        const top = point.y - centerPoint.y + size.height / 2;

        if (compactCardIds.has(node.id)) {
          return (
            <MapPlaceOverlay
              key={node.id}
              node={node}
              state={state}
              visual={visual}
              left={left}
              top={top}
              semanticLevel={semanticLevel}
              stats={computeFeaturedPlaceStats({
                node,
                nodes: allNodes,
                relations,
                states
              })}
              unreadCount={unreadCount}
              isActive={isActive}
              onPlaceClick={onPlaceClick}
              onUnreadClick={onUnreadClick}
            />
          );
        }

        return (
          <div
            key={node.id}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-left"
            style={{ left, top }}
          >
            <button
              type="button"
              aria-label={`查看 ${node.canonicalName} 的探索状态`}
              className={`focus-ring pointer-events-auto relative grid place-items-center rounded-full shadow-[0_10px_24px_rgba(23,33,31,0.18)] ${visual.pinSize} ${visual.pinClassName} ${isActive ? "ring-4 ring-coral/30" : ""}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onPlaceClick(node);
              }}
            >
              {visual.hasDisagreement && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-sun text-[10px] font-bold text-ink">
                  !
                </span>
              )}
              {unreadCount > 0 && (
                <span className="absolute -left-1 -top-1 grid min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
              <MapPin size={visual.iconSize} aria-hidden="true" />
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                className="focus-ring pointer-events-auto mt-1 rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(23,33,31,0.12)]"
                aria-label={`查看 ${node.canonicalName} 未读动态`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onUnreadClick(node);
                }}
              >
                {unreadCount} 新
              </button>
            )}
            <span className="pointer-events-none mt-1 block rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-ink shadow-[0_8px_18px_rgba(23,33,31,0.12)]">
              {node.canonicalName}
            </span>
          </div>
        );
      })}

      <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-ink/55">
        OpenStreetMap
      </div>
      <div className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-ink/55">
        真实经纬度 · Zoom {zoom}
      </div>
      <div className="absolute bottom-2 right-2 grid gap-1.5">
        <button
          type="button"
          className="focus-ring grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow-[0_8px_18px_rgba(23,33,31,0.12)]"
          aria-label="放大地图"
          onClick={() => setZoomAt(zoom + 1, { x: size.width / 2, y: size.height / 2 })}
        >
          <Plus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="focus-ring grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow-[0_8px_18px_rgba(23,33,31,0.12)]"
          aria-label="缩小地图"
          onClick={() => setZoomAt(zoom - 1, { x: size.width / 2, y: size.height / 2 })}
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="focus-ring grid size-8 place-items-center rounded-full bg-white/95 text-ink shadow-[0_8px_18px_rgba(23,33,31,0.12)]"
          aria-label="回到日本视图"
          onClick={() => onViewChange({ center: JAPAN_CENTER, zoom: INITIAL_MAP_ZOOM })}
        >
          <LocateFixed size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function MapPlaceOverlay({
  node,
  state,
  visual,
  left,
  top,
  semanticLevel,
  stats,
  unreadCount,
  isActive,
  onPlaceClick,
  onUnreadClick
}: {
  node: DestinationNode;
  state?: PlaceExplorationState;
  visual: ReturnType<typeof pinVisual>;
  left: number;
  top: number;
  semanticLevel: MapSemanticLevel;
  stats: ReturnType<typeof computeFeaturedPlaceStats>;
  unreadCount: number;
  isActive: boolean;
  onPlaceClick: (node: DestinationNode) => void;
  onUnreadClick: (node: DestinationNode) => void;
}) {
  const image = node.images?.[0] ?? (node.heroImageUrl ? { url: node.heroImageUrl, alt: node.imageAlt } : undefined);
  const xiaohongshu = node.socialDiscovery?.xiaohongshu;

  return (
    <div
      role="group"
      aria-current={isActive ? "true" : undefined}
      aria-label={`地图地点卡片 ${node.canonicalName}`}
      className={`absolute flex -translate-x-1/2 -translate-y-full flex-col items-center ${isActive ? "z-20" : "z-10"}`}
      style={{ left, top }}
    >
      {isActive && (
        <span className="pointer-events-none absolute -bottom-2 left-1/2 size-16 -translate-x-1/2 rounded-full bg-coral/20 blur-sm" />
      )}
      {xiaohongshu && (
        <a
          href={xiaohongshu.searchUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`去小红书查看${node.canonicalName}攻略`}
          className="focus-ring absolute right-1 top-1 z-[2] grid size-5 place-items-center rounded-full bg-[#ff2442] text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(23,33,31,0.14)]"
          title="小红书攻略"
          onPointerDown={(event) => event.stopPropagation()}
        >
          红
        </a>
      )}
      <button
        type="button"
        aria-label={`查看 ${node.canonicalName} 的探索状态`}
        className={`focus-ring relative min-h-[88px] w-28 overflow-hidden rounded-2xl border p-2 text-left shadow-[0_12px_28px_rgba(23,33,31,0.18)] backdrop-blur sm:w-32 ${visual.className} ${isActive ? "ring-4 ring-coral/30" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onPlaceClick(node);
        }}
      >
        {image && (
          <span className="absolute inset-0" aria-hidden="true">
            <Image src={image.url} alt="" fill sizes="140px" className="scale-110 object-cover opacity-55 blur-[1.5px]" />
          </span>
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-white/96 via-white/78 to-white/38" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 z-[1] rounded-full bg-coral px-1.5 py-0.5 text-[9px] font-bold text-white">
            {unreadCount} 新
          </span>
        )}
        <span className="relative z-[1] block max-w-[5.8rem] truncate text-xs font-semibold text-ink sm:max-w-[6.8rem]">
          {node.canonicalName}
        </span>
        {isWideSemanticLevel(semanticLevel) ? (
          <span className="relative z-[1] mt-1 block text-[10px] font-medium leading-4 text-ink/60">
            重点地点 {stats.totalFeaturedPlaces}
            <br />
            已探索 {stats.exploredPlacesCount}
          </span>
        ) : semanticLevel === "attraction" || semanticLevel === "poi" ? (
          <span className="relative z-[1] mt-1 flex items-center gap-1 text-[10px] font-medium text-ink/65">
            <Heart size={12} className="text-coral" aria-hidden="true" />
            {compactInterestLabel(state)}
          </span>
        ) : (
          <>
            <span className="relative z-[1] mt-1 flex items-center gap-1 text-[10px] font-medium text-ink/65">
              <Heart size={12} className="text-coral" aria-hidden="true" />
              {interestLabel(state)}
            </span>
            <span className="relative z-[1] mt-0.5 block truncate text-[9px] font-medium text-ink/45">
              {engagementLabel(state)}
            </span>
          </>
        )}
      </button>
      {unreadCount > 0 && (
        <button
          type="button"
          className="focus-ring mt-1 rounded-full bg-coral px-2 py-1 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(23,33,31,0.12)]"
          aria-label={`查看 ${node.canonicalName} 未读动态`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onUnreadClick(node);
          }}
        >
          查看新动态
        </button>
      )}
      <span className="h-2 w-px bg-ink/30" aria-hidden="true" />
      <span className={`relative grid place-items-center rounded-full shadow-[0_10px_24px_rgba(23,33,31,0.18)] ${visual.pinSize} ${visual.pinClassName}`}>
        {visual.hasDisagreement && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-sun text-[10px] font-bold text-ink">
            !
          </span>
        )}
        <MapPin size={visual.iconSize} aria-hidden="true" />
      </span>
    </div>
  );
}

function pinVisual(state?: PlaceExplorationState, isActive = false) {
  const interest = state?.interestScore ?? 0;
  const engagement = state?.engagementScore ?? 0;
  const hasDisagreement = (state?.disagreementScore ?? 0) >= 4;

  return {
    className:
      isActive
        ? "border-coral/70 bg-white"
        : interest >= 7
        ? "border-coral/45 bg-coral/10"
        : interest >= 3
          ? "border-sun/50 bg-sun/15"
          : engagement > 0
            ? "border-ink/10 bg-white"
            : "border-ink/5 bg-white/55 opacity-60",
    pinClassName:
      isActive
        ? "bg-coral text-white"
        : interest >= 7
        ? "bg-coral text-white"
        : interest >= 3
          ? "bg-sun text-ink"
          : engagement > 0
            ? "bg-pine text-paper"
            : "bg-mist text-ink/45",
    pinSize: isActive ? "size-11" : engagement >= 7 ? "size-10" : engagement >= 3 ? "size-9" : "size-8",
    iconSize: isActive ? 19 : engagement >= 7 ? 18 : 15,
    hasDisagreement
  };
}

function selectCompactCardPlaceIds({
  places,
  states,
  center,
  zoom,
  size,
  semanticLevel,
  limit
}: {
  places: DestinationNode[];
  states: Map<string, PlaceExplorationState>;
  center: GeoPoint;
  zoom: number;
  size: MapSize;
  semanticLevel: MapSemanticLevel;
  limit: number;
}) {
  const centerPoint = project(center, zoom);
  const accepted: Array<{ id: string; left: number; top: number }> = [];
  const minDistance = isWideSemanticLevel(semanticLevel) ? 190 : 128;

  const ranked = places
    .map((place) => {
      const state = states.get(place.id);
      const geo = place.geo;
      const point = geo ? project({ latitude: geo.latitude, longitude: geo.longitude }, zoom) : undefined;
      return {
        id: place.id,
        left: point ? point.x - centerPoint.x + size.width / 2 : 0,
        top: point ? point.y - centerPoint.y + size.height / 2 : 0,
        score: compactCardScore(place, state, semanticLevel)
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (accepted.length >= limit) break;
    const overlaps = accepted.some(
      (acceptedItem) =>
        Math.hypot(acceptedItem.left - item.left, acceptedItem.top - item.top) < minDistance
    );
    if (!overlaps) accepted.push(item);
  }

  return accepted.map((item) => item.id);
}

function compactCardScore(
  place: DestinationNode,
  state: PlaceExplorationState | undefined,
  semanticLevel: MapSemanticLevel
) {
  if (isWideSemanticLevel(semanticLevel) && ["city", "region"].includes(place.nodeType)) return 4;
  if (!state) return 0;

  const stateBoost =
    state.roomState === "selected"
      ? 8
      : state.roomState === "focused"
        ? 4
        : state.explorationState === "candidate"
          ? 5
          : state.explorationState === "engaged"
            ? 3
            : 0;

  const signalBoost = (state.interestScore ?? 0) * 1.8 + (state.engagementScore ?? 0);
  const disagreementBoost = (state.disagreementScore ?? 0) >= 4 ? 2 : 0;
  const score = stateBoost + signalBoost + disagreementBoost;

  return score >= 2 ? score : 0;
}

function compactInterestLabel(state?: PlaceExplorationState) {
  if ((state?.interestScore ?? 0) >= 3) return "有兴趣";
  if ((state?.engagementScore ?? 0) > 0) return "讨论中";
  return "待看";
}

function isWideSemanticLevel(level: MapSemanticLevel) {
  return level === "country" || level === "region";
}

function interestLabel(state?: PlaceExplorationState) {
  const interest = state?.interestScore ?? 0;
  const positiveMembers = state?.aggregateSignal?.positiveMembers ?? 0;

  if (interest >= 7) return positiveMembers ? `高兴趣 · ${positiveMembers} 人积极` : "高兴趣";
  if (interest >= 3) return positiveMembers ? `${positiveMembers} 人感兴趣` : "有兴趣";
  if ((state?.engagementScore ?? 0) > 0) return "正在讨论";
  return "待表态";
}

function engagementLabel(state?: PlaceExplorationState) {
  const engagement = state?.engagementScore ?? 0;
  const comments = state?.aggregateSignal?.comments ?? 0;
  const mentions = state?.mentionCount ?? 0;

  if ((state?.disagreementScore ?? 0) >= 4) return "讨论较多 · 有分歧";
  if (comments > 0) return `${comments} 条观点`;
  if (mentions > 0) return `${mentions} 次提到`;
  if (engagement > 0) return "有讨论热度";
  return "Seed Place";
}

interface MapSize {
  width: number;
  height: number;
}

const MIN_MAP_ZOOM = 4;
const MAX_MAP_ZOOM = 14;
const INITIAL_MAP_ZOOM = 4;
const TILE_SIZE = 256;
const DEFAULT_MAP_SIZE: MapSize = { width: 360, height: 360 };
const JAPAN_CENTER: GeoPoint = { latitude: 36.2048, longitude: 138.2529 };

function useElementSize(ref: RefObject<HTMLElement | null>): MapSize {
  const [size, setSize] = useState(DEFAULT_MAP_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(280, entry.contentRect.width),
        height: Math.max(280, entry.contentRect.height)
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function visibleTiles(center: GeoPoint, zoom: number, size: MapSize) {
  const centerPoint = project(center, zoom);
  const minTileX = Math.floor((centerPoint.x - size.width / 2) / TILE_SIZE);
  const maxTileX = Math.floor((centerPoint.x + size.width / 2) / TILE_SIZE);
  const minTileY = Math.floor((centerPoint.y - size.height / 2) / TILE_SIZE);
  const maxTileY = Math.floor((centerPoint.y + size.height / 2) / TILE_SIZE);
  const maxTileIndex = 2 ** zoom - 1;
  const tiles: Array<{ x: number; y: number; left: number; top: number }> = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      if (y < 0 || y > maxTileIndex) continue;
      const wrappedX = ((x % (maxTileIndex + 1)) + maxTileIndex + 1) % (maxTileIndex + 1);
      tiles.push({
        x: wrappedX,
        y,
        left: x * TILE_SIZE - centerPoint.x + size.width / 2,
        top: y * TILE_SIZE - centerPoint.y + size.height / 2
      });
    }
  }

  return tiles;
}

function project(point: GeoPoint, zoom: number) {
  const sinLatitude = Math.sin((point.latitude * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;

  return {
    x: ((point.longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) *
      scale
  };
}

function unproject(point: { x: number; y: number }, zoom: number): GeoPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (point.x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * point.y) / scale;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return {
    latitude: clamp(latitude, -85.0511, 85.0511),
    longitude: ((((longitude + 180) % 360) + 360) % 360) - 180
  };
}

function centerForZoomAt(
  center: GeoPoint,
  currentZoom: number,
  nextZoom: number,
  anchor: { x: number; y: number },
  size: MapSize
) {
  const currentCenterPoint = project(center, currentZoom);
  const anchorWorldPoint = {
    x: currentCenterPoint.x + anchor.x - size.width / 2,
    y: currentCenterPoint.y + anchor.y - size.height / 2
  };
  const anchorGeo = unproject(anchorWorldPoint, currentZoom);
  const nextAnchorPoint = project(anchorGeo, nextZoom);

  return unproject(
    {
      x: nextAnchorPoint.x - anchor.x + size.width / 2,
      y: nextAnchorPoint.y - anchor.y + size.height / 2
    },
    nextZoom
  );
}

function clampZoom(zoom: number) {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointFromPointerEvent(event: ReactPointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpointBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function isInteractiveMapTarget(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest("button, a"));
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

function mergeMapPlaces(places: DestinationNode[], activePlace?: DestinationNode) {
  if (!activePlace) return places;
  if (places.some((place) => place.id === activePlace.id)) return places;
  return [...places, activePlace];
}

function isGeoPointInViewport(
  point: GeoPoint,
  center: GeoPoint,
  zoom: number,
  size: MapSize
) {
  const projectedPoint = project(point, zoom);
  const projectedCenter = project(center, zoom);
  const left = projectedPoint.x - projectedCenter.x + size.width / 2;
  const top = projectedPoint.y - projectedCenter.y + size.height / 2;
  const padding = Math.min(72, Math.max(32, size.width * 0.12));

  return (
    left >= padding &&
    left <= size.width - padding &&
    top >= padding &&
    top <= size.height - padding
  );
}

function exploreZoomForActivePlace(node: DestinationNode, currentZoom: number) {
  const targetZoom = node.nodeType === "city" || node.nodeType === "region" ? 6 : 8;
  return Math.max(4, Math.min(9, Math.max(targetZoom, Math.min(currentZoom, 9))));
}

function smoothViewChange(input: {
  from: { center: GeoPoint; zoom: number };
  to: { center: GeoPoint; zoom: number };
  onViewChange: (view: { center: GeoPoint; zoom: number }) => void;
}) {
  const steps = typeof window === "undefined" ? 1 : 4;

  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    const view = {
      center: {
        latitude: lerp(input.from.center.latitude, input.to.center.latitude, progress),
        longitude: lerp(input.from.center.longitude, input.to.center.longitude, progress)
      },
      zoom: Math.round(lerp(input.from.zoom, input.to.zoom, progress))
    };

    if (steps === 1) {
      input.onViewChange(view);
    } else {
      window.setTimeout(() => input.onViewChange(view), step * 45);
    }
  }
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
