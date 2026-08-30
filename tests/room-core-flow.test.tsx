import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RoomExperience } from "@/components/room/RoomExperience";
import { getDemoRoom } from "@/lib/demo/room";
import { generateJapanPlanVariants } from "@/lib/plans/generator";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TripRoom core demo flow", () => {
  it("completes the P0 room exploration path with mock data", async () => {
    window.localStorage.clear();
    const room = await getDemoRoom();
    const generatedPlans = generateJapanPlanVariants({ tripId: room.trip.id, totalDays: 7 });
    const revisedPlans = generateJapanPlanVariants({
      tripId: room.trip.id,
      totalDays: 7,
      parentPlanId: generatedPlans[0].id
    }).map((plan, index) => ({
      ...plan,
      id: `${plan.id}-revision-${index + 1}`,
      version: plan.version + 10,
      parentPlanId: generatedPlans[0].id,
      changeSummary: ["响应修改要求：第二天太满了，轻松一点"]
    }));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/plans/generate")) {
        return jsonResponse({ plans: generatedPlans });
      }
      if (url.includes("/plans/") && url.endsWith("/revise")) {
        return jsonResponse({ plans: revisedPlans });
      }
      throw new TypeError("Network request intentionally skipped in UI test.");
    });
    render(<RoomExperience initialRoom={room} />);

    expect(room.trip.tripDurationDays).toBeUndefined();
    expect(room.signals).toHaveLength(0);
    expect(screen.getAllByText("日本旅行探索").length).toBeGreaterThan(1);
    expect(screen.getByText("我们想去日本旅游。")).toBeTruthy();
    expect(screen.getByText("好呀，目前有什么想法吗？如果说没有的话，可以在中间的探索区域里自行探索。")).toBeTruthy();
    expect(screen.getAllByText(/Solo Room/).length).toBeGreaterThan(0);
    expect(screen.getByText(/当前身份：安安/)).toBeTruthy();
    expect(screen.getByText(/已点亮 0 个地点/)).toBeTruthy();
    expect(screen.getByLabelText("单卡 Swipe 浏览")).toBeTruthy();
    expect(screen.getByLabelText("向右滑动卡片")).toBeTruthy();
    expect(screen.getAllByLabelText(/去小红书查看.*攻略/).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("单卡 Swipe 浏览")).getByText("岚山")).toBeTruthy();
    expect(within(screen.getByLabelText("单卡 Swipe 浏览")).getByText("浅草 / 上野")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).getByText("日本")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("京都")).toBeNull();
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("岚山")).toBeNull();

    fireEvent.click(screen.getByLabelText("探索京都"));
    await waitFor(() => {
      expect(within(screen.getByLabelText("正在探索路径")).getByText("京都")).toBeTruthy();
    });
    expect(within(screen.getByLabelText("单卡 Swipe 浏览")).getByText("岚山")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("向右滑动卡片"));
    await within(screen.getByLabelText("单卡 Swipe 浏览")).findByText("伏见稻荷大社");
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("伏见稻荷大社")).toBeNull();
    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("沉淀"));
    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("探索"));
    expect(within(screen.getByLabelText("单卡 Swipe 浏览")).getByText("伏见稻荷大社")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("收起 Group"));
    await screen.findByLabelText("展开 Group");
    fireEvent.click(screen.getByLabelText("展开 Group"));
    await screen.findByText(/当前身份：安安/);

    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("探索"));
    await screen.findByText("OpenStreetMap");
    await screen.findByText(/真实经纬度/);
    expect(screen.getByLabelText("真实地理探索地图")).toBeTruthy();
    expect(screen.getByLabelText("查看 岚山 的探索状态")).toBeTruthy();
    expect(screen.getByLabelText("查看 伏见稻荷大社 的探索状态")).toBeTruthy();
    expect(screen.queryByLabelText("查看 东京 的探索状态")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("搜索城市、景点或想看的体验..."), {
      target: { value: "大阪" }
    });
    fireEvent.click(screen.getByText("搜索"));
    await within(screen.getByLabelText("单卡 Swipe 浏览")).findByText("环球影城 USJ");
    expect((screen.getByPlaceholderText("搜索城市、景点或想看的体验...") as HTMLInputElement).value).toBe("大阪");
    expect(within(screen.getByLabelText("正在探索路径")).getByText("大阪")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("环球影城 USJ")).toBeNull();
    expect(screen.getByLabelText("查看 环球影城 USJ 的探索状态")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("向右滑动卡片"));
    await within(screen.getByLabelText("单卡 Swipe 浏览")).findByText("道顿堀 / 心斋桥");
    expect(screen.getByLabelText("查看 道顿堀 / 心斋桥 的探索状态")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).getByText("大阪")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("道顿堀 / 心斋桥")).toBeNull();

    fireEvent.click(screen.getByLabelText("移除大阪"));
    await waitFor(() => {
      expect(within(screen.getByLabelText("正在探索路径")).getByText("日本")).toBeTruthy();
    });
    fireEvent.click(screen.getAllByLabelText("换个地方")[0]);
    await waitFor(() => {
      expect(within(screen.getByLabelText("正在探索路径")).queryByText("日本")).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText("比如：想多看自然风景，少一点主题乐园"), {
      target: { value: "想多看温泉和自然风景，少一点主题乐园" }
    });
    fireEvent.click(screen.getByLabelText("提交探索方向"));
    expect(within(screen.getByLabelText("正在探索路径")).getByText("日本")).toBeTruthy();
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("岚山")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: { value: "我想先看看东京" }
    });
    fireEvent.click(screen.getByLabelText("发送"));

    await screen.findByText(/东京可以先作为当前焦点/);
    expect(screen.getAllByText("浅草 / 上野").length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("正在探索路径")).queryByText("镰仓")).toBeNull();
    await screen.findByText(/已点亮 [1-9]\d* 个地点/);

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: { value: "镰仓交通会不会太远？" }
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText(/镰仓从东京出发适合半天到一天/);

    fireEvent.click(screen.getByLabelText("向右滑动卡片"));
    fireEvent.click(screen.getByLabelText("向右滑动卡片"));
    fireEvent.click(screen.getByLabelText("向右滑动卡片"));
    const kamakuraCard = within(screen.getByLabelText("单卡 Swipe 浏览"))
      .getByText("镰仓")
      .closest("article");
    expect(kamakuraCard).toBeTruthy();
    fireEvent.click(within(kamakuraCard!).getByText("想去"));
    await screen.findByText(/表达了 想去/);
    expect((await screen.findAllByText("安安")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("+ 邀请旅伴"));
    await screen.findByText(/博文 已加入这个 TripRoom/);
    await waitFor(() => {
      expect(screen.getAllByText(/Group Room/).length).toBeGreaterThan(0);
    });
    await screen.findByText(/当前身份：博文/);

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: { value: "我想去 USJ，但东京也可以保留。" }
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText("我想去 USJ，但东京也可以保留。");

    fireEvent.click(screen.getAllByText("一般")[0]);
    await screen.findByText(/博文 对「/);
    expect((await screen.findAllByText("博文")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: { value: "我还想看看清澄白河。" }
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText("我还想看看清澄白河。");

    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("沉淀"));
    await screen.findByLabelText("层级旅行收藏");
    await within(screen.getByLabelText("层级旅行收藏")).findByText("日本");
    const cityCollection = await screen.findByLabelText("日本城市收藏");
    fireEvent.click(within(cityCollection).getByText("东京").closest("button")!);
    expect((await screen.findAllByText("浅草 / 上野")).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: {
        value: "小红书攻略 https://www.xiaohongshu.com/search_result?keyword=浅草%20攻略"
      }
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText(/小红书链接已保存到素材池/);
    expect((await screen.findAllByText(/小红书/)).length).toBeGreaterThan(0);

    await screen.findByText("Exploration Map");
    await screen.findByText("OpenStreetMap");
    expect(screen.getByText(/语义缩放 ·/)).toBeTruthy();
    expect(screen.getAllByText(/Zoom \d+/).length).toBeGreaterThan(0);
    expect(within(screen.getByLabelText("当前地理上下文")).getByText("日本")).toBeTruthy();
    expect(screen.getByLabelText("查看 浅草 / 上野 的探索状态")).toBeTruthy();
    expect(screen.queryByLabelText("地图地点卡片 镰仓")).toBeNull();
    fireEvent.click(screen.getByLabelText("查看 浅草 / 上野 的探索状态"));
    await screen.findByText(/Place Detail/);
    await screen.findByLabelText("Standard Place Card 浅草 / 上野");
    expect(screen.getAllByLabelText("去小红书查看浅草 / 上野攻略").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("查看浅草 / 上野观点"));
    await screen.findByLabelText("浅草 / 上野评论区");
    await screen.findByLabelText("感兴趣程度");
    await screen.findByLabelText("成员态度评论");
    await screen.findByText(/讨论度：/);
    expect(screen.getByLabelText("回复博文")).toBeTruthy();
    await screen.findByLabelText("小红书或抖音链接");
    await screen.findByText("去小红书看浅草 / 上野热门攻略");
    fireEvent.click(screen.getByText("返回工作区"));
    await screen.findByText("新发现地点 · 尚未定位");
    await screen.findByText("清澄白河");

    fireEvent.change(screen.getByPlaceholderText(/我想先看看东京/), {
      target: { value: "箱根挺好，但是一天久。" }
    });
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText("箱根挺好，但是一天久。");
    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("沉淀"));
    fireEvent.click(screen.getAllByText("箱根")[0]);
    await screen.findByLabelText("Standard Place Card 箱根");
    fireEvent.click(screen.getByLabelText("查看箱根观点"));
    await screen.findByLabelText("箱根评论区");
    await screen.findByLabelText("成员态度评论");
    expect((await screen.findAllByText("箱根挺好，但是一天久。")).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByText("返回工作区"));
    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("探索"));
    fireEvent.click(within(screen.getByLabelText("单卡 Swipe 浏览")).getByLabelText("下一张图片"));
    fireEvent.click(screen.getByLabelText(/查看.*观点/));
    await screen.findByLabelText(/评论区/);
    fireEvent.click(screen.getByLabelText(/收起.*观点/));

    fireEvent.click(screen.getByLabelText("上传截图或图片"));
    await screen.findByText(/截图已保存到素材池/);

    fireEvent.click(screen.getByLabelText("语音输入"));
    fireEvent.click(screen.getByLabelText("发送"));
    await screen.findByText(/海边和电车我挺喜欢/);

    fireEvent.click(within(screen.getByLabelText("Place Workspace")).getByText("规划"));
    fireEvent.click(screen.getByText("生成方案"));
    await screen.findAllByText("东京 + 富士山 / 箱根");

    const planInputs = await screen.findAllByPlaceholderText(/评论方案/);
    fireEvent.change(planInputs[0], {
      target: { value: "保留东京和箱根，但能不能加 USJ？" }
    });
    fireEvent.click(screen.getAllByText("发送")[0]);
    await screen.findByText(/对方案「东京 \+ 富士山 \/ 箱根」/);

    fireEvent.click(screen.getAllByText("根据结构反馈生成新版")[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/与上一版差异/).length).toBeGreaterThan(0);
    });
  }, 15000);
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
