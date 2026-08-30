import type { DestinationNode, SocialDiscoveryMetadata } from "@/lib/types";

export const XIAOHONGSHU_SEARCH_BASE_URL = "https://www.xiaohongshu.com/search_result";

type SearchProvider = "xiaohongshu";

export function getPlaceSocialDiscovery(place: Pick<DestinationNode, "canonicalName" | "aliases" | "tags" | "nodeType">): SocialDiscoveryMetadata {
  const searchKeywords = buildXiaohongshuKeywords(place);

  return {
    xiaohongshu: {
      provider: "xiaohongshu",
      label: "小红书攻略",
      searchKeywords,
      searchUrl: getExternalSearchUrl("xiaohongshu", searchKeywords[0])
    }
  };
}

export function getExternalSearchUrl(provider: SearchProvider, keyword: string) {
  if (provider !== "xiaohongshu") {
    throw new Error(`Unsupported social discovery provider: ${provider}`);
  }

  const url = new URL(XIAOHONGSHU_SEARCH_BASE_URL);
  url.searchParams.set("keyword", keyword);
  return url.toString();
}

export function isXiaohongshuContent(value: string) {
  if (/小红书|xiaohongshu|xhslink/i.test(value)) return true;

  const url = extractFirstUrl(value);
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.endsWith("xiaohongshu.com") || hostname.endsWith("xhslink.com");
  } catch {
    return false;
  }
}

export function isDouyinContent(value: string) {
  if (/抖音|douyin|iesdouyin|amemv/i.test(value)) return true;

  const url = extractFirstUrl(value);
  if (!url) return false;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      hostname.endsWith("douyin.com") ||
      hostname.endsWith("iesdouyin.com") ||
      hostname.endsWith("amemv.com")
    );
  } catch {
    return false;
  }
}

export function extractFirstUrl(value: string) {
  return value.match(/https?:\/\/[^\s]+/i)?.[0];
}

function buildXiaohongshuKeywords(place: Pick<DestinationNode, "canonicalName" | "aliases" | "tags" | "nodeType">) {
  const keywords = [
    `${place.canonicalName} 攻略`,
    ...contextualKeywords(place),
    ...place.aliases.slice(0, 2).map((alias) => `${alias} 攻略`)
  ];

  return Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))).slice(0, 4);
}

function contextualKeywords(place: Pick<DestinationNode, "canonicalName" | "tags" | "nodeType">) {
  const keywords: string[] = [];

  if (place.tags.some((tag) => /day_trip|一日|周边/.test(tag)) || ["attraction", "poi", "area"].includes(place.nodeType)) {
    keywords.push(`${place.canonicalName} 一日游`);
  }

  if (place.tags.some((tag) => /tokyo|东京|day_trip/.test(tag))) {
    keywords.push(`${place.canonicalName} 东京`);
  }

  if (place.tags.some((tag) => /food|city|shopping|culture|temple|theme_park/.test(tag))) {
    keywords.push(`${place.canonicalName} 旅行`);
  }

  return keywords;
}
