# TripRoom — Overnight P0 Launch Goal

这是今晚最高优先级任务。明天早上我必须看到一个**可以实际演示的成型版本**。

请先读取当前 repo、主 Spec、`data-model.md`、Prisma Schema 和现有代码，然后直接基于现有项目继续开发。

**不要重新设计产品，不要扩大 Scope，不要做与以下三个目标无关的重构。**

明早必须完成：

1. **Travel Planning Agent 真正可用**
2. **DeepSeek 真实模型已经接入并实际参与分析 / 规划**
3. **存在一个任何人点击即可访问的公开 URL**

---

## P0-1：先验证 DeepSeek 真实模型调用

我已经在本地环境中配置好 DeepSeek 相关环境变量和真实 API Key。

请：

- 从服务端读取环境变量；
- 禁止前端直接读取 API Key；
- 禁止把 Key 写进 Git、README、日志或代码；
- 优先复用当前已有 ModelProvider abstraction；
- 如果当前没有统一 ModelProvider，则最小实现：

```text
ModelProvider
├── DeepSeekModelProvider
└── MockModelProvider
```

先完成一个真实 server-side smoke test。

必须确认：

> 返回内容确实来自 DeepSeek API，而不是 Mock / hardcode。

然后把 DeepSeek 接到两个实际能力：

### A. Preference Analysis

```text
Evidence
↓
DeepSeek
↓
Signal
↓
MemberPlaceProfile / RoomPlaceProfile
```

至少验证一条真实自然语言能够经过模型分析。

### B. Travel Planning Agent

```text
Planning Context
↓
DeepSeek
↓
TravelPlanningAgent
↓
Candidate Plans
```

比赛主链优先使用真实 DeepSeek，不要继续使用 hardcoded Plan。

---

# P0-2：Travel Planning Agent 必须端到端可用

Planning 需要读取当前已经存在的：

- Trip 基础信息；
- Member；
- RoomPlaceProfile；
- MemberPlaceProfile；
- Reaction / Preference；
- Constraint；
- 已探索 Place；

生成真正基于当前团队数据的旅行方案。

最小链路：

```text
PlanningContextBuilder
↓
TravelPlanningAgent
↓
DeepSeekModelProvider
↓
Raw Candidates
↓
Validator
↓
Scorer
↓
Candidate Plans
↓
Planning UI
```

---

# P0-3：至少生成 2 个有效候选方案

用户进入 `[规划]` 后，至少生成：

> 2 个结构明显不同的候选方案。

如果能稳定生成更多，可以最多 5 个。

不要为了数量生成高度重复的方案。

每个方案至少包含：

- 总天数；
- 旅行主调性；
- 城市 / 区域；
- 每天主要行程；
- 每晚住在哪个区域；
- 主要 Place；
- 城市间移动关系；
- 粗预算；
- 推荐理由；
- Score。

---

# P0-4：Validator + Scorer 最小可用

不要让 DeepSeek 自己说：

> “这个方案 95 分”

然后直接展示。

至少保留代码侧：

```text
PlanValidator
PlanningScorer
```

Validator 最低检查：

- Hard Constraint；
- 天数；
- 明显时间冲突；
- 基本路线可执行性；
- 重复 / 错误 Place；
- 已知预算硬限制。

Scorer 至少考虑：

- Member Preference Fit；
- Group Fairness；
- Route Feasibility；
- Schedule / Pace；
- Budget Fit；
- Data Confidence。

当前规则允许先使用稳定 MVP heuristic。

最终展示给用户的方案：

> score >= 90

如果只有两个合格：

> 只展示两个。

不要为了凑数量伪造分数。

---

# P0-5：Planning UI 至少完整展示 Overview + Full Itinerary

候选方案首先展示 Overview，例如：

```text
方案 A｜东京 + 箱根 · 7 天

城市 + 自然 + 温泉
节奏偏松

主要地区：
东京 / 镰仓 / 箱根

预计住宿：
东京 4 晚
箱根 1 晚
东京 1 晚

预计花费：
¥X–Y / 人

Score：94

[查看完整行程]
```

点击：

> 查看完整行程

需要看到 Day-by-Day：

```text
Day 1
城市 / 区域
上午
下午
晚上
住宿
主要 Place
粗略交通
粗略费用
相关图片
```

当前不要求真实酒店、航班、OTA。

允许使用现有 Seed / Mock Travel Data。

---

# P0-6：方案与右侧地图联动

点击候选方案后：

右侧地图切到：

> PLAN MODE

至少展示：

- 方案涉及城市；
- 主要 Place；
- Day 顺序；
- 城市间移动；
- 住宿区域；
- Route 连接关系。

用户切换方案：

> 地图同步切换。

当前路线不需要达到导航级精度，但必须让评委一眼看懂：

> “这个方案到底怎么走。”

---

# P0-7：至少支持一次 AI Revision

用户可以输入例如：

> “第二天太满了，轻松一点。”

系统必须：

```text
Current Plan Version
↓
DeepSeek Revision
↓
New Plan Version
↓
Validator
↓
Re-score
↓
UI 更新
```

至少展示 Change Summary：

```text
v2

- Day 2 删除两个 Place
- 调整 Day 4 行程
- Score 92 → 95
```

本轮不要为了 Drag & Drop 阻塞上线。

如果拖拽尚未完成：

> 降为 P1。

---

# P0-8：部署公开 Web URL

localhost 不满足比赛要求。

请把当前项目部署成：

> **任何人点击即可直接访问的公开网址。**

要求：

- 不需要安装依赖；
- 不需要 clone repo；
- 不需要运行本地数据库；
- 不需要登录开发工具；
- Desktop 可以稳定演示；
- Mobile 至少可以正常打开使用。

请选择当前项目最容易、最稳定的部署方案，不要为了更换平台浪费时间。

---

# P0-9：线上数据库

当前继续使用：

> PostgreSQL + Prisma

不要更换数据库或 ORM。

本地：

```text
DATABASE_URL = local PostgreSQL
```

线上：

```text
DATABASE_URL = cloud PostgreSQL
```

请完成：

```text
Cloud PostgreSQL
↓
Prisma Migration
↓
Demo Seed
↓
Deployed Backend
```

业务代码不要依赖 localhost。

---

# P0-10：线上 DeepSeek Secret

部署环境中需要配置与本地一致的 DeepSeek 环境变量。

真实 API Key：

> 只能配置在部署平台的 Environment Variables / Secrets 中。

不要：

- commit `.env.local`；
- 把 API Key 写入 repo；
- 暴露给浏览器。

部署完成后必须重新执行一次：

> Production DeepSeek Smoke Test

确认线上环境确实能够调用模型。

---

# P0-11：准备 Quick Demo

公开链接打开后不能是空状态。

至少准备一个：

> Quick Demo Room

预置：

- A / B / C / D；
- 部分已探索 Place；
- Reaction；
- PlaceOpinion；
- Material；
- 足够的 MemberPlaceProfile / RoomPlaceProfile；
- 一部分地图已经点亮；
- 同时仍保留未探索地点。

目标：

> 评委打开页面后 30 秒内理解“多人探索 → 偏好沉淀 → AI 规划”的产品价值。

不要把 Planning 结果提前全部写死。

Planning 候选仍然应该通过当前真实 Planning Pipeline 生成。

---

# P0-12：明早最终必须跑通这条 Demo Flow

```text
打开公开 URL
↓
进入 Quick Demo
↓
看到 A/B/C/D 已有探索和观点
↓
看到地图上的团队兴趣状态
↓
进入「规划」
↓
真实 DeepSeek 生成候选方案
↓
至少 2 个方案通过 Validator / Scorer
↓
查看方案 Overview
↓
点击一个方案
↓
右侧地图展示 Route
↓
查看 Full Itinerary
↓
输入：
“第二天太满了，轻松一点”
↓
DeepSeek 修改方案
↓
生成新 Plan Version
↓
重新 Validate + Score
↓
页面和地图同步更新
```

这条链必须稳定。

---

# 今晚全部降为 P1

以下内容不要阻塞明早结果：

- 完整 OAuth；
- 真正多人 WebSocket；
- 原生 App；
- Push；
- 实时酒店 API；
- 实时机票 API；
- 实时天气 API；
- 真实支付；
- 完整 Drag & Drop；
- 高级推荐算法；
- Vector DB；
- Kafka / 分布式 Worker；
- 复杂 UI 动效；
- 大规模重构；
- 非必要视觉 polish。

---

# 执行优先级

严格按：

### Priority 1
DeepSeek 真实调用成功。

### Priority 2
TravelPlanningAgent 真实端到端跑通。

### Priority 3
Planning UI + Plan Map + Revision 跑通。

### Priority 4
公网部署 + 云 PostgreSQL + 线上 DeepSeek Secret。

### Priority 5
Quick Demo Seed + 最终流程验证。

### Priority 6
剩余时间才修非阻塞视觉问题。

---

# 如果遇到阻塞

不要停在“架构设计完成”。

只有在必须由我提供以下内容时才停下来：

- 部署平台登录 / 授权；
- 云数据库账号；
- 无法读取的 DeepSeek Key；
- GitHub 权限；
- 其他明确的外部权限。

如果发生阻塞，请明确告诉我：

> **我需要做什么、点哪里、提供什么。**

不要只告诉我“部署失败”。

---

# 明早请给我 Launch Report

我只需要清晰看到：

1. **公开 URL**
2. Quick Demo URL / 入口
3. DeepSeek Production Smoke Test 是否通过
4. Evidence 分析是否真实使用 DeepSeek
5. Planning Agent 是否真实使用 DeepSeek
6. 当前实际使用的 ModelProvider / Model
7. Planning 候选是否真实基于 Room 偏好数据
8. Validator / Scorer 是否生效
9. Full Itinerary 是否可用
10. PLAN Map 是否可用
11. AI Revision 是否可用
12. 云 PostgreSQL 是否正常
13. 哪些部分仍然是 Mock
14. 已知 Bug
15. TypeScript / Lint / Test / Build 状态
16. 如果还有阻塞，我明早必须做的动作是什么

---

## 最终成功标准

明天早上我要看到的不是：

> “架构已经准备好了。”

而是：

> **一个我能直接点击的公网链接。**

并且这个链接里：

> **DeepSeek 已经真实接入，Travel Planning Agent 能根据当前多人偏好生成旅行方案、展示路线与每日行程，并且可以通过 AI 继续修改。**

如果“做得更漂亮”和“主链可运行”冲突：

> **优先主链可运行。**

如果“架构更完美”和“今晚能完成”冲突：

> **优先最小、正确、可继续扩展的实现。**

不要通过复制第二套业务逻辑或大量 hardcode 伪装完成核心 AI 能力。