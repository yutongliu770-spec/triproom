import { Link2, Sparkles } from "lucide-react";
import type { DestinationNode, Material, MemberSignal } from "@/lib/types";
import { computeMaterialStatus } from "@/lib/materials/status";

const groupLabels = {
  interested: "很想去",
  seen: "值得继续看看",
  controversial: "有分歧",
  selected: "已进入方案",
  dropped: "暂时放下",
  unresolved: "待识别"
};

export function MaterialPool({
  materials,
  nodes,
  signals
}: {
  materials: Material[];
  nodes: DestinationNode[];
  signals: MemberSignal[];
}) {
  if (materials.length === 0) {
    return <EmptyPanel text="AI 推荐和成员分享会自动进入这里，但不会被自动视为喜欢。" />;
  }

  const enriched = materials.map((material) => ({
    ...material,
    status:
      computeMaterialStatus(publicSignals(signals), material.id, material.primaryNodeId) === "seen"
        ? material.status
        : computeMaterialStatus(publicSignals(signals), material.id, material.primaryNodeId)
  }));

  return (
    <div className="h-[calc(100vh-96px)] overflow-y-auto p-5">
      <div className="space-y-5">
        {Object.entries(groupLabels).map(([status, label]) => {
          const group = enriched.filter((material) => material.status === status);
          if (group.length === 0) return null;

          return (
            <section key={status}>
              <h2 className="mb-3 text-sm font-semibold text-ink">{label}</h2>
              <div className="space-y-3">
                {group.map((material) => {
                  const node = nodes.find((item) => item.id === material.primaryNodeId);
                  const feedback = materialFeedback(publicSignals(signals), material.id, material.primaryNodeId);
                  return (
                    <article
                      key={material.id}
                      className="rounded-2xl border border-ink/10 bg-paper p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-cloud text-ink/70">
                          {material.sourceType === "ai_recommendation" ? (
                            <Sparkles size={16} aria-hidden="true" />
                          ) : (
                            <Link2 size={16} aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-ink">{material.title}</h3>
                          <p className="mt-1 text-xs leading-5 text-ink/60">
                            {material.summary ?? "已保存，等待进一步识别。"}
                          </p>
                          <p className="mt-2 text-xs text-ink/45">
                            来源：{sourceLabel(material.sourceType)}
                            {material.sourceProvider ? ` · ${providerLabel(material.sourceProvider)}` : ""}
                            {node ? ` · 关联 ${node.canonicalName}` : ""}
                            {feedback ? ` · ${feedback}` : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="p-6 text-sm leading-6 text-ink/55">{text}</div>;
}

function sourceLabel(sourceType: Material["sourceType"]) {
  if (sourceType === "ai_recommendation") return "AI 推荐";
  if (sourceType === "ai_seed") return "AI Seed";
  if (sourceType === "external_link") return "外部链接";
  if (sourceType === "upload") return "成员上传";
  if (sourceType === "external_search") return "外部搜索";
  if (sourceType === "social_media") return "社交媒体";
  return "成员分享";
}

function providerLabel(sourceProvider: NonNullable<Material["sourceProvider"]>) {
  if (sourceProvider === "seed") return "Seed";
  if (sourceProvider === "mock") return "Mock";
  if (sourceProvider === "user_upload") return "用户上传";
  if (sourceProvider === "user_link") return "用户链接";
  if (sourceProvider === "google_places") return "Google Places";
  if (sourceProvider === "mapbox") return "Mapbox";
  if (sourceProvider === "osm") return "OSM";
  if (sourceProvider === "xiaohongshu") return "小红书";
  if (sourceProvider === "external_search") return "外部搜索";
  if (sourceProvider === "social_media") return "社交内容";
  return sourceProvider;
}

function publicSignals(signals: MemberSignal[]) {
  return signals.filter((signal) => signal.visibility === "group");
}

function materialFeedback(signals: MemberSignal[], materialId: string, primaryNodeId?: string) {
  const related = signals.filter(
    (signal) =>
      (signal.targetType === "material" && signal.targetId === materialId) ||
      (Boolean(primaryNodeId) &&
        signal.targetType === "node" &&
        signal.targetId === primaryNodeId)
  );
  if (related.length === 0) return "";

  const positiveMembers = new Set(
    related
      .filter((signal) => signal.polarity > 0 || signal.signalType === "must_go")
      .map((signal) => signal.memberId)
  );
  const negativeMembers = new Set(
    related
      .filter((signal) => signal.polarity < 0 || signal.signalType === "hard_reject")
      .map((signal) => signal.memberId)
  );

  const parts = [];
  if (positiveMembers.size > 0) parts.push(`${positiveMembers.size} 人感兴趣`);
  if (negativeMembers.size > 0) parts.push(`${negativeMembers.size} 人有顾虑`);

  return parts.join(" · ");
}
