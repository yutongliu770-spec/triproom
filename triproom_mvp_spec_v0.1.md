# TripRoom 多人旅行探索助手 MVP Spec

- **文档版本**：v0.1
- **文档日期**：2026-08-23
- **目标读者**：Codex、产品经理、前端工程师、后端工程师、AI/Agent 工程师
- **交付目标**：依据本 Spec，生成一个可以本地运行、可完成核心演示闭环的 Web MVP
- **工作名称**：TripRoom（仅为开发代号，可替换）

---

## 0. 给 Codex 的执行说明

请将本文视为 **PRD、Interaction Spec、AI Behavior Spec、Technical Spec 的合并文档**。

实现时遵守以下优先级：

1. **首先保证核心交互闭环真实可用**，不要优先扩展大量页面或外部 API。
2. **不要把产品实现成问卷、传统行程表或旅行版 Jira。**
3. **群聊、旅行卡片、旅行素材池是三个一级产品对象。**
4. **AI 是主动的知识与内容供给者，但不是持续抢话的话痨。**
5. **探索是可以任意展开和返回的图，不是必须逐层完成的漏斗。**
6. **用户主动分享的素材全部保留；“是否保存”和“是否喜欢”必须解耦。**
7. **所有 AI 推断先形成可追溯的结构化信号；LLM 不得直接修改数据库。**
8. **MVP 允许对搜索、预算、交通、语音转写使用 Mock/Adapter，但产品交互必须完整。**
9. 最终代码必须包含：`README.md`、`.env.example`、种子数据、数据库迁移、演示账户/演示房间、基础测试与清晰的启动命令。
10. 若文档中的某个细节未定义，优先选择**最轻量、可逆、可替换**的实现，不要自行增加复杂工作流。

---

# 1. 产品定义

## 1.1 一句话定位

> **TripRoom 是一个让一群朋友共同“把旅行想出来”的 AI 旅行空间：AI 主动提供具体目的地与景点内容，大家围绕卡片讨论和分享灵感，系统持续沉淀素材与观点，并在方向逐渐清晰后将它们组织成可比较、可修改的旅行方案。**

## 1.2 产品不是什么

TripRoom 不是：

- 让用户先填写完整需求问卷，再输出行程的生成器；
- 把每个人量化成满意度分数的多目标优化器；
- 从第一分钟就要求确认预算、酒店、每日安排的项目管理工具；
- 一次输出几十个“必去景点”的攻略百科；
- AI 在后台替所有人完成协商，最后交付一个所谓最优答案；
- 强制用户依次完成“国家 → 城市 → 景点”的筛选漏斗。

## 1.3 核心用户价值

用户进入时通常只有模糊意向：

> “我们想去日本，但不知道具体去哪。”

用户离开探索阶段时应得到：

- 对目的地空间的基本认知；
- 若干真正产生兴趣的具体地点和活动；
- 对其他成员想法的理解；
- 一组被保留下来的外部灵感；
- 2–3 个能够继续讨论的旅行结构方案。

最终价值不是“AI 更快写出一份行程”，而是：

> **降低攻略的信息和表达成本，同时保留共同想象、讨论和期待旅行的幸福感。**

## 1.4 Room 形态：Solo 与 Group 统一模型

TripRoom 不只服务多人群聊。统一模型为：

```text
TripRoom
├── 1 个成员：Solo Room
└── 2+ 个成员：Group Room
```

用户可以先一个人开始旅行探索，之后通过邀请入口无损加入旅伴。Solo 转 Group 时不得创建新的旅行项目，原有聊天、素材池、探索状态、成员偏好和已生成方案都必须保留。

MVP 不要求用户在创建时提前选择 Solo / Group。系统根据当前成员数量自然展示房间状态。

---

# 2. 已确认的产品原则

## 2.1 具体对象优先，抽象分类靠后

不要先让用户在“自然 / 人文 / 城市 / 娱乐”等抽象标签中做选择。

优先把具体对象摆到用户面前：

- 完全不知道去哪，但说“想去海岛” → 推荐冲绳、普吉岛、巴厘岛、长滩岛等具体目的地；
- 确定去日本 → 推荐东京、大阪、京都、北海道、冲绳等具体目的地区域；
- 明确先看东京 → 立即推荐浅草、涩谷、新宿、东京迪士尼、镰仓、箱根等具体景点、商圈和周边地。

抽象标签仅作为后台检索、排序和解释元数据，不作为主要入口。

## 2.2 探索是一张不断展开的图

用户可以随时：

- 深入某个目的地；
- 回到上一级；
- 跳到另一个分支；
- 从一个景点延展到附近目的地；
- 重新拾起此前暂时忽略的分支。

例如，用户已经在日本目的地卡片中明确说“东京肯定要去”，系统应立即展开东京，不得等待大阪、京都、北海道全部被评价。

## 2.3 AI 主动提供内容，不等待完整需求

当用户信息很少时，AI 必须主动询问少量高信息量问题，并很快开始内容供给。

AI 的基本循环是：

```text
Supply → React → Capture → Adapt → Converge
AI 给内容 → 人产生反应 → 系统沉淀 → AI 调整下一批内容 → 逐渐收敛
```

## 2.4 素材全部保留，偏好单独建模

用户主动分享的链接、截图、图片、地点、酒店、餐厅、视频和朋友推荐，均进入素材池。

但：

```text
进入素材池 ≠ 用户喜欢 ≠ 团队选择 ≠ 已进入方案
```

系统必须分别记录素材本身、来源、每个成员的反应强度以及素材在当前旅行中的状态。

## 2.5 讨论默认公开，敏感限制可私下表达

普通旅行感受默认发布到群聊，让成员彼此看见：

- “这个海边我很喜欢。”
- “感觉有点远。”
- “我不太喜欢游乐园。”

预算、健康、宗教、惊喜安排等敏感约束可以使用“仅 AI 可见”输入。

MVP 中，私密信息只在当前 TripRoom 内有效，不做跨旅行长期记忆。

## 2.6 AI 不使用硬性时间或评价数量强制推进

“每人至少表达一个观点”“主要候选平均至少一条评价”可以作为内部成熟度信号，但不是硬门槛。

AI 是否展开、供给新内容或提出方案，必须综合：

- 已知信息；
- 群体兴趣强度；
- 当前讨论是否活跃；
- 是否出现路线级选择；
- 新动作能否带来明显增量价值。

## 2.7 先比较旅行结构，再生成每日行程

信息逐渐成熟后，AI 首先给出类似以下方向方案：

- 东京 + 富士山 / 箱根；
- 东京 + 大阪；
- 大阪 + 京都。

每个方案描述：

- 大致天数分配；
- 主要体验；
- 代表地点；
- 移动强度；
- 粗略预算；
- 得到什么、舍弃什么。

只有方向得到基本认可后，才进入 Day 1 / Day 2 的具体行程。

---

## 2.8 当前信息架构更新：Group / Place Workspace / Exploration Map

TripRoom 的房间体验采用三块职责清晰的结构：

```text
TripRoom
├── Group
│   ├── Room info / invite / member switcher
│   ├── Public group chat
│   ├── AI group replies
│   └── Light Place / Plan references and room events
├── Place Workspace
│   ├── 探索 Explore
│   ├── 沉淀 Discovered Repository
│   └── 规划 Planning Workspace
└── Exploration Map
    ├── Continuous geographic map
    ├── Semantic zoom
    ├── Place state / unread indicators
    └── Map-to-Place-Detail navigation
```

产品原则：

```text
Chat 负责沟通，Place 负责沉淀。
Explore 负责发现，Discovered 负责团队共享记忆，Planning 负责形成旅行方案。
地图负责空间化呈现，而不是再维护一套独立内容。
所有 Group / Explore / Map / Planning 对同一地点的操作，都必须围绕同一个 place_id。
```

桌面当前比例为 `Group 28% / Place Workspace 36% / Exploration Map 36%`，左侧 Group 宽度保持稳定，中间 Place Workspace 与右侧 Exploration Map 等宽。Group 收起后左侧保留窄栏，其余空间由 Workspace 与 Map 等分。移动端不得把三栏压缩在同一视口，应使用 `讨论 / 探索 / 地图 / 规划` 或等价导航；`沉淀` 可作为探索工作区的二级模式。

## 2.9 Place 持久对象与统一观点

Place 是 Room 的一等持久对象。当前 MVP 以 `DestinationNode.id` 作为 `place_id`，后续接入真实 Provider 时可把 `providerPlaceId`、坐标和外部元数据补齐，但 UI 和状态不得拆出 `FeedPlace / DiscoveredPlace / MapPlace / ChatPlace` 等平行对象。

Place 应携带或关联：

- 基础地点信息、图片、AI 摘要和层级关系；
- 成员 reaction、文字观点、语音观点和私下探索信号；
- 用户分享素材、截图、外部 URL 和小红书来源；
- 地图坐标、Room 级兴趣 / 讨论 / 分歧 / 规划状态；
- 成员级 reaction、未读数和已读时间。

成员对地点的表达统一使用 `PlaceOpinion`，来源包含：

- `group_chat`：群聊里自然提到地点；
- `explore_comment`：AI Exploration Input 中的探索方向或地点反馈；
- `voice_comment`：语音转写评论；
- `card_comment`：地点卡片下的评论。

不得维护两套互相割裂的评论系统。Place Detail 的 `大家观点` 视图聚合 `PlaceOpinion` 和 `MemberSignal`。

## 2.10 Group Chat 与 Place 解耦

Group Chat 是沟通层，不是地点内容的主要展示层。Chat 中允许出现：

- 成员文本、语音转写、AI 轻量回复；
- AI 总结；
- 素材保存事件；
- 轻量 Place Reference / Place Chip；
- 轻量 Plan Reference。

Chat 中不再展示完整大 Place Card 或完整 Plan Card。AI 推荐的地点批次进入 Place Workspace 的 `探索`；AI 生成或修订的方案进入 `规划`。

如果成员在 Group Chat 中表达对地点的意见，例如：

```text
B：镰仓挺好，但是一天久。
```

系统必须：

1. 保存原始 Chat Message；
2. 通过 Place Resolver 解析已有 Place；
3. 生成 / 更新 B 对该 Place 的 `PlaceOpinion`；
4. 生成 / 更新 B 的 `MemberSignal`；
5. 更新该 Place 的 `RoomNodeState`；
6. 为其他成员更新 `MemberPlaceState.unreadCount`；
7. 同步 Exploration Map 状态。

用户不需要再去卡片下重复评论一次。

## 2.11 Explore / Discovered / Planning

`探索` 是看见可能性，不是立刻排日程。Explore 展示单张主视觉地点卡，支持上一张 / 下一张、桌面鼠标拖动、移动端手指左右 Swipe、顶部图片 Swipe、Reaction、文字 / 语音观点、评论面板、小红书外部入口和路径级随机切换。它不是无限娱乐 Feed，也不在 UI 暴露卡片总数、剩余数量或已探索分母。

Explore 顶部模式 Tabs 必须紧凑，显示为 `探索 / 沉淀 / 规划`。Tabs 下方维护唯一的 `exploration_path`，例如 `日本` 或 `日本 / 京都`。`exploration_path` 表示用户主动确认的“正在探索区域”，只能由 Search、Breadcrumb 删除末级、Breadcrumb 同级随机切换、卡片上的“探索该城市 / 区域”按钮或其它明确范围操作更新；Swipe 当前卡片不得自动更新 `exploration_path`。搜索成功后搜索框保留用户原始输入；搜索城市更新到 Country / City，搜索具体 Place 更新到 Country / City / Place。删除末级后回到上一级并刷新当前推荐。随机切换某一级时只能选择合法的同级节点，并保持 Parent / Child hierarchy 合法，例如 `日本 / 京都` 随机切换京都后可以变成 `日本 / 东京`，不得生成非法父子关系。

Standard Place Card is the canonical detailed Place presentation used across Explore, Map, Discovered and Planning.

Standard Place Card 使用同一套视觉与交互逻辑展示同一个 `place_id`。Explore 当前主卡、Exploration Map 点击 Place、Discovered Mini Card 点击 Place、Chat 中打开 Place、Planning 中打开 Place，都必须进入同一个 Standard Place Card。允许存在地图 Compact Card、聊天轻量引用和已发现 Mini Card，但它们只是入口，不得复制一套独立详细卡片。

Explore 中的 Standard Place Card 使用竖向卡片。默认内容只包含 Parent City / Region、Place Name、1-2 行介绍、2-3 个 Highlights、推荐游玩时间、必要粗预算、团队意愿、讨论热度、Reaction、右下角评论入口和小红书攻略入口。Parent City / Region 胶囊必须提供显式探索范围切换入口，例如“探索京都”；只有用户点击该入口时，当前 `exploration_path` 才切换到对应城市 / 区域，且该点击不得被卡片 Swipe 手势吞掉。顶部 `images[]` 区域必须固定比例或固定高度，支持左右 Swipe、有效箭头和圆点 Page Indicator，图片切换不得改变卡片整体高度；如果某个图片区域箭头没有实际作用，必须删除。默认状态下一张卡片应能在中央主要区域完整看到，不需要整体上下滚动才能看完。卡片内部不得重复显示“正在探索 XXX”，该状态只由卡片上方 Breadcrumb 表达。

评论入口展示的是当前 Room 围绕该 Place 的有效观点 / 内容数量，不是未读数量，位置应在卡片默认态右下角。点击评论入口不得跳转独立 Comment Page，而是在 Standard Place Card 内让卡片缩小并上移，底部向上弹出类似小红书评论区的 Comment Panel；关闭后恢复标准卡片默认状态，不改变当前 Place、Map 状态或 `exploration_path`。

Comment Panel 顶部固定展示 `感兴趣程度`，但不能做成多个并列模块卡片。顶部只需要显示团队兴趣状态和进度条，并在下一行显示 `讨论度：刚开始探索 / 持续讨论 / 讨论很热` 等状态。

- `interestScore`：展示 A / B / C / D 等成员对该 Place 的当前态度，当前成员可直接修改想去 / 一般 / 不想去，继续复用 Reaction、PreferenceSignal / `MemberSignal` 和 `MemberPlaceState`，表达大家总体有多想去；
- `engagementScore`：表达该 Place 被讨论 / 互动得有多热，不得把讨论多等同于大家都喜欢。

成员态度与观点必须采用类似抖音评论区的连续评论流，不再拆成一个个模块弹窗或独立卡片。每条评论左侧展示成员头像，右侧展示成员名，成员名下方展示该成员的表态和 `PlaceOpinion` / `voice_comment`；Demo 阶段允许用 Mock 讨论补齐 A / B / C / D 的展示内容，但真实评论应优先覆盖对应成员的 Mock 文案。底部保留 `小红书 / 抖音链接` 区域，展示用户分享的小红书链接、用户分享的抖音链接、外部链接、上传截图、AI Seed Content 或未来 Search Content。每条外部内容必须清楚区分来源类型，并保留 `place_id`、`source_type`、`source_provider`、`source_url`、`source_member_id`、title、summary、image / attachment 和 created_at，不得只展示 AI 摘要。小红书可以保留真实外部搜索入口；抖音不得伪造自动搜索，只展示用户真实分享到 Room 的抖音 URL。

Place comments are aggregated from all PlaceOpinion sources rather than maintained as a separate comment system.

`AI Exploration Input` 位于 Explore Mode 内，不是第二个群聊。它默认只在当前成员和 AI 之间使用，用于调整探索方向、记录冷启动偏好、推荐相关地点、必要时创建待解析地点。用户明确选择分享时，才同步到 Group Chat。系统应区分：

- `observed_signal`：从浏览、打开、停留等弱行为得到；
- `expressed_preference`：明确表达的兴趣或不兴趣；
- `strong_preference`：必去、强烈拒绝等高强度偏好；
- `constraint`：预算、健康、时间、宗教、惊喜安排等限制。

`沉淀` 是 Room 级 Place Repository，不是个人收藏。The Discovered workspace uses a Country → City → Place hierarchy.

Discovered 的第一层是 Country 行，例如日本，保持简洁，只展示团队兴趣、当前成员是否有新动态和展开 / 收起。第二层是当前 Room 已发现或 Seed / Provider 中重点相关的 City / Region Compact Card，支持横向滑动和展开 / 收起，不要求展示全国所有行政城市。City Card 必须展示“探索度”进度条，但不得展示 `14 / 20`、总地点数或 denominator。探索度定义为团队对该城市代表性旅行内容的覆盖程度，可综合 displayed、detail_viewed、reaction、opinion、material、多成员参与和类型/区域覆盖，不能简单按卡片数量计算。第三层是 Small Vertical Collectible Place Mini Card，只展示缩略图 / 虚化图片背景、Place Name、1 行特色、团队 Interest 和 unread 提示。Mini Card 点击后必须打开同一个 Standard Place Card。

`规划` 是结构方案和版本所在的工作区。Plan 通过 `place_id` 引用 Place，不复制地点数据；方案反馈仍可进入 `MemberSignal` 并参与后续修订。

## 2.12 URL / Material / Resolver / Unread / Map

用户在 Group Chat 或 AI Exploration Input 粘贴 URL 时，系统必须保留原始 `sourceUrl`，生成 `Material`，并尽量绑定已有 Place。Place Resolver 的顺序为：

1. 优先匹配已有 Place 的 canonical name、aliases、provider id；
2. 高置信时创建新 Place 或绑定已有 Place；
3. 不确定时创建 `UnresolvedPlaceMention`，不得伪造坐标或 Provider id；
4. 通过别名避免重复地点，例如 USJ、Universal Studios Japan、环球影城应解析到同一个 Place。

Unread 是成员级状态，只由对当前成员有意义的新信息产生：新的 `PlaceOpinion`、语音观点、Reaction、Material、外部链接或 AI 重要补充。单纯浏览、打开图片、打开卡片详情、背景排序分数变化不应产生未读。

Exploration Map 使用同一批 Place 和状态。地图保留连续 pan / zoom、Semantic Zoom 和 breadcrumb；点击地图 Pin / Compact Card 打开中央 Place Detail；点击未读红点打开 Place Detail 的 `大家观点 / 最新动态` 方向。地图不得维护独立评论弹窗或第二套 Place Detail。

## 2.13 Layout / Scroll / Swipe Update

Desktop Layout：

- The root page must not scroll vertically on desktop; each main panel owns its own scrolling behavior.
- Header 使用固定高度；Header 下方 body 占满剩余高度；
- Group / Place Workspace / Exploration Map 三个面板高度固定，不互相撑开页面；
- Group 支持收起 / 展开；收起后展示窄栏、当前成员头像、未读提示和展开入口，不刷新房间状态；
- Group Chat 内部顺序为 Group Header、独立滚动消息列表、固定底部 Chat Composer；
- Place Workspace 顶部模式 Tabs 固定且高度紧凑；`探索` 模式下 Search / Breadcrumb 控制区应尽量压缩，主卡片舞台占主要空间，`AI Exploration Input` 固定在底部；
- `沉淀` 和 `规划` 模式各自内部滚动，底部操作不应被页面级滚动带走；
- Exploration Map 面板固定在右侧区域内，地图 pan / zoom 只改变地图内部状态，不改变页面高度；
- Place Detail 打开时不得把页面撑高；详情应以中央工作区内容或 overlay / panel 形式出现。

Explore Card Layout：

- Explore 卡片默认使用 Standard Place Card 的竖向布局，展示短决策信息：可 Swipe 图片、Parent City / Region、地点名、1-2 行简介、最多 3 个亮点、建议停留时间、粗略预算、成员表态摘要、Reaction、评论入口和小红书入口；
- 长描述、完整素材、成员观点和外部内容进入 Standard Place Card 的 Comment Panel / 内容展开区，不应默认占满主卡；
- 单张核心卡必须能完整显示在中央工作区的主视口内，且位于底部输入上方。

Single-card Swipe Interaction：

- Explore uses a single-card swipe model rather than a continuous horizontal carousel.
- Swipe changes the currently viewed Place and does not implicitly create a positive or negative preference signal.
- 显式偏好只能来自 Reaction、文字观点、语音观点或群聊自然表达；
- Desktop 支持上一张 / 下一张按钮和鼠标拖动；Mobile 支持手指左右 Swipe；
- 当前卡片位置应在聊天、地图、沉淀和规划视图切换之间保持；Swipe 当前卡片只更新当前卡片位置和地图高亮，不更新 `exploration_path`；当 AI 明确替换一批新卡片时，可以从第一张新卡开始。

---

# 3. MVP 目标与边界

## 3.1 MVP 要证明的核心假设

MVP 只需证明以下五件事：

1. AI 能在用户需求模糊时主动提供有帮助的具体旅行内容；
2. 具体地点卡片能比抽象问卷更自然地引发多人表达；
3. 用户分享的外部素材能被自动保留、识别和组织；
4. AI 能根据成员持续产生的反馈改变后续内容，而不是每轮从零回答；
5. 一段自然讨论能够逐渐长出 2–3 个团队愿意继续修改的旅行结构方案。

## 3.2 P0 功能范围

必须实现：

- 创建 TripRoom；
- Solo Room 和 Group Room 的统一房间体验；
- Solo Room 可通过邀请入口无损加入 Demo 成员并变成 Group Room；
- 通过邀请链接或邀请码加入；
- 多人实时或准实时群聊；
- MVP 使用 Member Switcher 在单端模拟多人身份；
- 桌面房间分为 Group / Place Workspace / Exploration Map；
- 移动端以讨论、探索、地图、规划等导航组织，不压缩三栏；
- AI 冷启动引导；
- 目的地 / 景点 / 商圈 / 活动卡片；
- 地点卡片主要展示在 Place Workspace 的 Explore；
- Standard Place Card 作为 Explore / Map / Discovered / Planning 的统一详细 Place 展示；
- Chat 中只展示轻量 Place Reference，不展示大地点卡片；
- 卡片点击查看详情；
- 卡片评论入口以内联 Comment Panel 展开，不跳独立页面；
- Comment Panel 以上弹评论区展示感兴趣程度、讨论度、成员态度评论流、小红书 / 抖音链接；
- Discovered 使用 Country → City → Place 层级收藏结构；
- 地点卡和 Place Detail 提供真实小红书外部攻略入口；
- 卡片快速 Reaction；
- 卡片文字评论；
- 卡片语音输入与转写；
- 评论支持“公开到群聊 / 仅 AI 可见”；
- 公开评论自动发布到群聊；
- 群聊自然提及地点时自动沉淀为 PlaceOpinion / MemberSignal；
- Place Detail 聚合概览、大家观点和攻略素材；
- Room 级 Place Repository 支持全部、我的兴趣、有新动态、高兴趣、有分歧、最近更新；
- AI 推荐素材自动进入素材池；
- 用户链接、截图、图片自动进入素材池；
- URL / 截图 / 图片保留原始来源并尽量绑定已有 Place；
- 素材来源与成员反馈记录；
- RoomPlaceState 与 MemberPlaceState 分开建模；
- 成员级地点未读提示；
- 地点主层级树 + 关系边；
- 基于真实经纬度和真实地图底图的 Exploration Map；
- Exploration Map 是连续地图，支持自由 pan / zoom，不通过点击地点进入子地图；
- Exploration Map 支持基于当前中心、Zoom 和层级关系解析地理上下文；
- Exploration Map 支持 Semantic Zoom；
- Exploration Map 支持从 Pin / Label 渐进升级为地图 Compact Place Card；
- 点击地图 Compact Place Card 只打开完整 Place Detail，不自动改变地图中心、Zoom 或层级；
- 非线性节点展开；
- AI 回答成员对地点的追问；
- AI 根据群体反馈供应下一批内容；
- AI 主动总结当前共同兴趣和关键分歧；
- AI 主动提出 2–3 个结构方案；
- 旅行结构方案在 Planning Workspace 中生成、评论和修订；
- 成员对方案评论；
- AI 根据结构级反馈形成新方案版本；
- 演示用日本种子知识库；
- 演示房间与完整 Demo 数据。

MVP 明确采用 **Mobile-first Responsive Web App**。当前不开发原生 iOS / Android App；手机宽度是主要真实体验，桌面端用于开发、演示和展示辅助信息。

## 3.3 P1，可在时间允许时实现

- 可视化关系图；
- 更丰富的 Seed / Mock Data；
- 更完整的 Mock 路线估算；
- 更完善的 Mock 预算模拟；
- 方案内拖拽组合地点；
- 活动通知与未参与提醒；
- 完整移动端适配；
- 行程导出。

## 3.4 明确不做

- 真实支付和预订；
- 退款、取消和订单管理；
- 完整 OTA；
- 真实航班 API；
- 真实酒店 API；
- 实时天气 API；
- Google Maps / Mapbox 等付费或专有地图 API；
- 实时票价 API；
- 实时交通 API；
- 第三方 UGC / 社交媒体内容 API；
- 签证、保险、费用结算；
- 每位用户一个自主 Agent 的多 Agent 辩论；
- 自动读取受限制社交平台的全部内容；
- 伪造小红书帖子、Fake URL、本地 Mock 攻略页或假装调用小红书 API；
- 精确、实时、具有交易承诺的价格；
- 跨旅行长期画像；
- 复杂公平性评分和公开成员分数；
- 必须逐层完成的流程门禁。

---

# 4. 目标用户与使用场景

## 4.1 核心用户

- 3–6 名朋友、情侣或家庭成员；
- 有共同旅行意向，但对目的地了解不完整；
- 讨论主要发生在聊天中；
- 至少一人通常承担大量查资料和整理工作；
- 用户愿意看图、点卡片、说一句感受，但不愿先填写长问卷。

## 4.2 核心场景

四个人准备进行一次日本旅行：

> “我们大概有 7 天，想去日本。东京、富士山、环球影城听起来都不错，但具体有什么、怎么安排还不知道。”

系统需要让他们：

1. 快速建立东京、大阪、京都、富士山等地的具体认知；
2. 通过地点卡片产生表达；
3. 分享小红书截图、链接和朋友推荐；
4. 逐渐发现团队共同想去什么、在哪些地方存在分歧；
5. 最终比较“东京 + 富士山”与“东京 + 大阪”等结构方案。

---

# 5. 核心产品对象

MVP 有三个一级交互对象和四个后台对象。

## 5.1 一级交互对象

### A. 群聊 Chat

作用：

- 人与人真实讨论；
- AI 提供知识、回答问题、总结和提出方案；
- 卡片评论和语音观点公开出现；
- 所有重要变化可追溯。

### B. 旅行卡片 Travel Card

作用：

- 把具体地点、景点、商圈、活动变成容易理解和反应的对象；
- 降低用户自行搜索和组织表达的成本；
- 作为探索图中的可展开节点。

AI 推荐的一组地点卡必须归属于触发它的 AI Message，而不是脱离聊天流的固定推荐区域：

```text
Message
├── text
└── content.place_carousel[]
```

这样 AI 和后续上下文可以理解“刚才那几个里面，我更喜欢第二个”。

### C. 旅行素材池 Inspiration Pool

作用：

- 保存 AI 推荐和用户主动带入的所有内容；
- 显示来源、成员反馈、状态和关联地点；
- 避免灵感散落在聊天历史里；
- 为后续方案生成提供共享上下文。

## 5.2 后台核心对象

### D. 地点知识图 Destination Graph

- 主结构是层级树；
- 非层级关系使用边补充；
- 支持任意分支快速展开和回退。

### E. 成员信号 Member Signal

记录成员对素材或地点的：

- 看过；
- 主动分享；
- 想了解；
- 正向 / 中性 / 负向 Reaction；
- 文字或语音观点；
- 强烈想去；
- 明确不去；
- 顾虑和原因。

### F. 房间上下文 Room Context

记录：

- 已知的旅行天数和大致时间；
- 当前焦点节点；
- 已探索节点；
- 团队兴趣聚类；
- 未解决的问题；
- 现有方案版本；
- AI 最近做过的动作。

### G. 方案 Plan Variant

先保存结构级方案，再保存细节级行程。

---

# 6. 整体交互流程

## 6.1 创建房间

组织者输入：

- 房间名称，例如“国庆日本旅行”；
- 可选的大致目的地；
- 可选的大致天数；
- 自己的昵称和头像。

创建后得到：

- 邀请链接；
- 房间码；
- 一个空白群聊；
- AI 首次引导。

MVP 中不要求正式账户体系。可使用：

- 匿名访客身份；
- 昵称 + 随机头像；
- 浏览器本地保存 member token；
- 房间邀请码控制访问。

Hackathon MVP 可使用 Demo Member Switcher 单端模拟多人。该 Switcher 只是当前成员来源，不应伪造数据：消息、Reaction、评论和 Preference Signal 必须写入真实 `member_id` / `author_member_id`。

Solo Room 页面保留明显的“+ 邀请旅伴”入口。当前 MVP 可用“添加 Demo Member”行为依次加入 B / C / D；当成员数从 1 变成 2+，原 Room 直接进入 Group 状态。

## 6.1.1 Demo 初始状态

Start from Scratch Demo Room 必须从真正模糊的旅行意向开始：

```text
A：我们想去日本旅游。
```

除此之外，初始数据不得提前写入：

- 旅行天数；
- 东京、大阪、京都、富士山、USJ 等具体偏好；
- 预算；
- 已形成的路线方向；
- 任何隐藏的 PreferenceSignal。

初始结构应接近：

```text
destination_country = Japan
duration = unknown
city_preferences = unknown
place_preferences = empty
budget = unknown
planning_direction = unknown
```

AI 第一轮应进入 Exploration / Knowledge Supply，主动给出日本几个主要旅行方向的 Place Carousel，而不是要求用户先填写完整问卷或直接生成详细行程。

## 6.1.2 Hackathon Demo 入口

TripRoom 需要提供两个用于 Hackathon / 评委体验的 Demo 入口。两者不是两套产品，也不得复制两套页面或业务逻辑；差异只在 Initial Seed State。

```text
/demo                 Demo 入口选择页
/demo/quick           Quick Demo，跳转 /room/demo-japan-quick
/demo/fresh           Start from Scratch，跳转 /room/demo-japan-7d
/room/[tripId]        同一套 TripRoom 主界面
```

### Quick Demo

Quick Demo 用于评委快速感知产品价值。该 Room 预置约 30% 已探索状态，但还没有进入最终规划。

Quick Demo 至少预置：

- A / B / C / D 四个 Demo Member，并默认全部加入 Room；
- 一部分已发生的群聊；
- 成员 Reaction；
- PlaceOpinion，包括卡片文字评论和语音观点；
- 用户主动分享的小红书 / 外部 Material；
- 若干已经探索过的 Place 和若干仍未探索的 Place；
- 一部分成员偏好已经形成；
- 地图上部分地点被点亮；
- 某些地点团队兴趣较高；
- 某些地点讨论很多但存在分歧。

Quick Demo 的预置数据应尽量以 Raw / Evidence / Reaction / Material 作为 seed。PostgreSQL 可用时，`seed:demo` 为保证比赛 reset 稳定，可以使用确定性派生数据直接重建以下链路，不调用真实模型：

```text
Evidence
  -> Signal
  -> MemberPlaceProfile
  -> RoomPlaceProfile
```

用户后续真实交互必须继续通过正式 backend pipeline 增量生成 Signal / Profile。若数据库不可用，允许使用同一批 seed facts 在 MockTravelProvider 中生成 fallback 展示状态，但必须清楚标记为 demo fallback，不得把它当作生产偏好计算。

Quick Demo 中必须保留现场可触发动作：

- 切换成员后对地点新增 Reaction 或评论，并看到 PlaceOpinion、Profile 和地图状态更新；
- 查看或新增一条小红书 / 抖音 / 外部素材，并绑定到对应 Place；
- 进入 Planning Workspace，由 `PlanningContextBuilder -> TravelPlanningAgent -> DeepSeekModelProvider -> Validator -> Scorer` 生成至少 2 个有效候选方案，展示完整日程和 PLAN Map，并支持“第二天太满了，轻松一点”这类 AI Revision 生成新 PlanVersion。

### Start from Scratch

Start from Scratch 用于展示冷启动能力。该 Room 初始只保留：

```text
我们想去日本旅游。
```

不得提前预设：

- 天数；
- 东京 / 京都 / 富士山 / USJ 等具体偏好；
- 预算；
- 已形成路线；
- 隐藏 Preference / Profile。

AI 应从这个模糊状态开始推荐地点，用户再通过探索、Reaction、评论和素材逐步形成 Preference、点亮地图，并在后续进入 Planning。

### Demo Reset

Demo 数据必须可重复恢复。MVP 推荐提供：

```bash
npm run seed:demo
```

该命令只允许重置已知 demo trip，不得影响非 demo 数据；在正式 Production 环境必须拒绝执行。每次 reset 后 Quick Demo 应恢复同一组固定初始事实，再通过 backend pipeline 重新生成派生偏好数据。

## 6.2 冷启动：用户信息为零或极少

### 示例 1：完全模糊

用户：

> “我们想出去玩，但还不知道去哪。”

AI 不应询问一串问题。AI 应先问一个高信息量问题：

> “你们现在有没有一种大致感受？例如海岛、雪景、城市、美食，或者只是想轻松度假。说一个最模糊的方向也可以。”

若用户回答“想去海岛”，AI 立即给 4–6 张具体目的地卡片，而不是先让用户选择“潜水 / 度假 / 自然”等抽象类型。

### 示例 2：已知国家

用户：

> “我们大概想去日本。”

AI 先问最多 1–2 个必要问题：

- “大概能玩几天？”
- “现在脑子里已经想到哪些地方或项目？”

随后主动输出日本的 4–6 张目的地区域卡片。

### 示例 3：已有多个点

用户：

> “我们想去日本 7 天，东京、富士山和环球影城都有点兴趣。”

AI 应先做轻量事实说明：

> “你们提到的地点跨了关东和关西：东京、富士山在东侧，环球影城在大阪。7 天可以做，但不同组合的移动强度差异很大。”

然后给出东京、大阪 / USJ、富士山 / 箱根、京都等具体卡片，供讨论。

## 6.3 第一批内容供给

每批默认展示 3–5 张卡片，最多 6 张。

第一批卡片要求：

- 都是具体目的地对象；
- 有足够差异，但不使用抽象类型作为主标题；
- 每张卡能让用户形成基本印象；
- 显示建议停留时间和预算档位；
- 显示 2–4 个代表性具体地点或活动；
- 不一次倾倒全部信息。

## 6.4 用户点击和展开

用户点击东京卡片后可以：

- 查看更完整描述；
- 看代表性地点；
- Reaction；
- 文字或语音评论；
- 点击“继续看看东京”；
- 直接询问 AI。

如果成员明确说“东京肯定去，我们先看东京”，系统立即把东京设置为当前焦点，并供应东京子节点卡片。

此时无需等待其他日本目的地获得评价。

## 6.5 具体地点讨论

东京第一批可包含：

- 浅草 / 上野；
- 涩谷 / 新宿；
- 东京迪士尼；
- 镰仓；
- 箱根。

用户可以：

- 点 ❤️ 想去；
- 点 😐 一般；
- 点 ❌ 不太想；
- 点 ? 想了解；
- 使用语音表达具体观点；
- 在群聊中追问。

AI 应根据反应继续供给：

- 多人喜欢镰仓 → 展开江之岛、镰仓高校前、小町通等；
- 多人喜欢迪士尼 → 提供需占用整天、适合提前订票等规划级知识；
- 有人担心箱根移动 → 提供与东京组合方式，而不是继续推荐无关地点。

## 6.6 外部灵感输入

用户可：

- 粘贴链接；
- 上传截图或图片；
- 发送地点名称；
- 转述朋友推荐。

系统行为：

1. 原始内容立即进入素材池；
2. 创建来源记录；
3. 尝试提取地点、活动、体验描述和主观观点；
4. 与已有地点节点去重或建立关联；
5. 在群聊中发送简短确认；
6. 不自动把素材视为“用户喜欢”。

小红书等受限链接若无法读取：

> “这个链接我先保存了，但页面内容暂时无法完整读取。可以上传截图，我会从截图中提取地点和体验信息。”

不得伪装成已经成功读取。

## 6.7 AI 根据新信号调整供给

AI 不对每条普通观点立即重新生成方案。

AI 应：

- 普通新偏好 → 更新素材和信号；
- 明显兴趣聚类 → 推荐同节点子项、相邻节点或可组合地点；
- 事实问题 → 即时回答；
- 讨论停滞 → 提供一批新的具体内容或提出一个关键问题；
- 结构级信息变化 → 重新组织旅行方向。

## 6.8 形成结构方案

当已经出现足够方向性信号时，AI 主动但不强制地提议：

> “你们现在已经有两个比较清楚的方向了。要不要我先把它们拼成两版旅行框架，看看哪一种更让大家期待？”

若用户同意，生成 2–3 个结构方案。

例如：

### 方案 A：东京 + 富士山 / 箱根

- 东京 4–5 天；
- 富士山 / 箱根 1–2 天；
- 城市、迪士尼、自然、温泉；
- 移动较少；
- 不包含 USJ。

### 方案 B：东京 + 大阪

- 东京 4 天；
- 大阪 3 天；
- 东京城市体验、迪士尼、USJ、大阪美食；
- 有一次长距离移动；
- 富士山通常需要舍弃或压缩。

方案卡必须说明“得到什么”和“放弃什么”，不能只给评分。

## 6.9 方案迭代

成员可对方案：

- Reaction；
- 评论；
- 语音表达；
- 指定“保留 A 的东京、加入 B 的大阪”；
- 询问交通、预算、节奏。

AI 处理方式：

- 仅某个 POI 的轻量偏好 → 局部记录，不立即产生新版本；
- 天数、主要城市、必须项目、预算档位等结构变化 → 产生新版本；
- 新版本必须显示与上一版的主要差异。

## 6.10 进入具体行程

只有某个结构方案获得基本认同后，AI 才提示：

> “方向已经比较稳定了。接下来我可以把它细化成每天怎么走，也可以先查住宿区域和大交通。你们想先看哪一块？”

MVP 可只实现一版基础 Day-by-Day 行程，不必实现真实预订。

---

# 7. AI 角色与行为规格

## 7.1 AI 的五个角色

### 1. Knowledge Supplier，知识与内容供给者

主动提供目的地、景点、交通结构、建议天数和预算级别。

### 2. Guide，旅行向导

帮助成员理解具体地点为什么值得去、适合什么节奏、与哪些地方组合。

### 3. Memory，共享记忆

保存素材、来源、成员表达和讨论上下文。

### 4. Facilitator，讨论主持人

总结共同兴趣，指出当前真正需要讨论的问题，但不替人裁决。

### 5. Planner，方案组织者

将已经形成的兴趣和限制组织成结构方案，再细化为行程。

## 7.2 AI 的主动程度

AI 的主动性不是固定频率，而是情境函数。

### 高主动场景

- 信息为零或极少；
- 只有国家或模糊方向；
- 用户明确要求推荐；
- 当前讨论缺乏内容对象；
- 新的结构级限制出现；
- 存在明显事实错误；
- 已形成清晰兴趣分支，需要继续展开；
- 已具备结构方案条件；
- 讨论长时间无新信号且仍未形成方向。

### 中主动场景

- 用户正在评价卡片；
- 出现局部问题；
- 需要补充交通、时间或组合知识；
- 若干观点需要轻量总结；
- 新分享内容需要确认和解释。

### 低主动场景

- 成员之间正在热烈交流；
- 新信息只是普通单点偏好；
- AI 刚刚提供了一批内容，尚未有足够反应；
- AI 没有新的信息增量；
- 只是为了表现存在感。

## 7.3 介入决策模型

实现一个可配置的软评分，不使用单一硬规则。

```text
intervention_score =
  direct_request
+ factual_urgency
+ information_gain
+ exploration_value
+ progress_value
+ structural_impact
- human_conversation_activity
- recent_ai_speaking_penalty
- repetition_penalty
- interruption_cost
```

建议判断：

- `direct_request`：被 @、被提问、用户点击“问 AI”；
- `factual_urgency`：错误会导致路线理解偏差；
- `information_gain`：能显著扩展用户认知；
- `exploration_value`：能沿当前兴趣展开新节点；
- `progress_value`：能把讨论收敛成可回答问题；
- `structural_impact`：天数、目的地、预算级别等发生变化；
- `human_conversation_activity`：成员正在连续交流；
- `recent_ai_speaking_penalty`：AI 刚发过较长内容；
- `repetition_penalty`：已解释过相同内容；
- `interruption_cost`：插话会打断有意义的人际讨论。

阈值仅作为内部默认值，允许用户直接召唤 AI 覆盖阈值。

## 7.4 AI 内容供给策略

### 原则

- 一次供给 3–5 个具体对象；
- 优先高代表性、高可理解性、高视觉吸引力；
- 兼顾差异性，但不要求用户先选择抽象类型；
- 根据群体信号逐步个性化；
- 避免重复推荐已经明确排除的对象；
- 用户可以随时跳转到任何分支。

### 下一批候选来源

1. 当前焦点节点的子节点；
2. 当前焦点节点的相邻一日游 / 可组合节点；
3. 多人正向信号所对应的类似节点；
4. 结构方案中必要但尚未认知的节点；
5. 用户分享素材中识别出的新节点；
6. 当前候选的有效替代方案。

### 推荐排序的软分数

```text
candidate_score =
  context_relevance
+ group_interest_match
+ novelty
+ representativeness
+ route_fit
+ source_signal
- already_seen_penalty
- rejected_penalty
- redundancy
```

不向用户展示此分数。

## 7.5 AI 消息风格

- 中文自然、像会做攻略的朋友；
- 先给结论，再给少量必要解释；
- 不一次输出百科全书；
- 每次只推进一个主要问题；
- 多使用“你们现在提到的…”“我先给大家摆几张具体的…”；
- 不说“已将偏好权重 +1”；
- 不公开成员评分；
- 不轻易说“最优方案”；
- 对估算数据明确写“粗略”“以实际查询为准”；
- 对用户 UGC 观点注明“用户分享经验”，不冒充事实。

## 7.6 AI 不得执行的行为

- 将点击直接解释为喜欢；
- 将主动分享直接解释为“必须去”；
- 把某次旅行中的评价写成永久人格偏好；
- 因为多数人喜欢就忽略明确的硬约束；
- 在大家热烈聊天时持续插入长文；
- 每出现一个新评价就重写整套方案；
- 伪造实时价格、库存、营业信息；
- 声称读到了无法访问的社交平台内容；
- 暴露“仅 AI 可见”的敏感信息；
- 强迫所有卡片获得评价后才允许继续。

---

# 8. 旅行卡片规格

## 8.1 卡片类型

P0 支持：

1. `destination`：国家、区域、城市；
2. `district`：商圈、城区、街区；
3. `poi`：具体景点；
4. `activity`：温泉、滑雪、主题乐园、潜水等；
5. `route_option`：结构方案卡；
6. `external_material`：用户分享的链接或截图卡。

## 8.2 Destination / POI 卡字段

每张卡至少包含：

```ts
interface TravelCard {
  id: string;
  nodeId: string;
  type: 'destination' | 'district' | 'poi' | 'activity';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  imageAlt: string;
  shortSummary: string;
  highlights: string[];              // 2–4 条
  suggestedStay?: {
    minDays?: number;
    maxDays?: number;
    text: string;
  };
  budget?: {
    band: 'low' | 'medium' | 'high' | 'luxury' | 'unknown';
    text: string;
    basis?: string;
    asOf?: string;
    isEstimate: boolean;
  };
  travelCost?: {
    text: string;                    // 例如“东京出发适合半天至一天”
  };
  representativeItems?: Array<{
    name: string;
    nodeId?: string;
  }>;
  sourceSummary?: string;
  socialDiscovery?: {
    xiaohongshu?: {
      provider: 'xiaohongshu';
      label: string;
      searchKeywords: string[];
      searchUrl: string;
    };
  };
  actions: Array<'open' | 'react' | 'voice' | 'comment' | 'ask' | 'expand'>;
}
```

## 8.3 卡片视觉要求

- 图片优先，建议 16:9；
- 每个核心地点支持 `images[]`，用于详情内图片横向切换；
- 标题和一句话特色必须首屏可见；
- 卡片默认 Compact，只展示足够用户产生第一反应的信息；
- 详情信息必须通过用户点击“查看详情”后分层展开，移动端推荐 Bottom Sheet / Full-screen Sheet，桌面端推荐 Modal / Side Panel；
- 不在卡片正面堆积大量文本；
- 快速 Reaction 始终可见；
- 显示已有成员头像和 Reaction 汇总；
- 点击后打开详情抽屉或模态框，关闭后回到原聊天位置和当前卡片位置；
- AI 一次推荐多个地点时必须使用单卡 Swipe 舞台，不直接平铺成 Grid；
- 移动端当前卡片占主要宽度，并露出下一张一小部分提示可滑动；
- 桌面端可使用更宽卡片、鼠标拖动和左右箭头，但仍保持一次突出一张主卡。
- 每张主要地点卡应提供“小红书攻略”外部探索入口，入口打开真实小红书搜索 / 内容入口，不使用 Fake URL、`#`、本地 Mock 页面或虚构帖子。

地点内部多图片切换属于卡片内部能力。若移动端双层横滑冲突，优先保证主卡 Swipe 的手势稳定，图片 Swipe 通过卡片内部图片区域处理。

## 8.3.1 Social Discovery / Xiaohongshu External Entry

`socialDiscovery.xiaohongshu` 表示 Discover / External Entry，不表示 TripRoom 已经收集到帖子内容。

当前 MVP 使用 Web 端真实小红书搜索页：

```text
https://www.xiaohongshu.com/search_result?keyword=<encoded query>
```

搜索 query 应从 Place 生成，例如：

- `镰仓 攻略`
- `镰仓 一日游`
- `镰仓 东京`

必须遵守：

- Xiaohongshu entry must open real Xiaohongshu content/search and must not be mocked.
- 不实现非官方爬虫、绕过登录、绕过访问控制或大规模抓取；
- 不假装存在未接入的小红书内容 API；
- 若平台要求登录、限流或改变网页行为，TripRoom 只保留真实外部跳转，不承诺读取内容；
- 用户主动粘贴小红书链接、分享文案、截图或图片时，才作为 `Material.source_type = social_media`、`source_provider = xiaohongshu` 保存。

## 8.4 Reaction

P0 默认四个：

- ❤️ `want_to_go`：想去；
- 😐 `neutral`：一般；
- ❌ `not_interested`：不太想；
- ? `want_to_know`：想了解。

长按或二级菜单可增加：

- 🔥 `must_go`：很想去 / 必去；
- ⚠️ `concern`：有顾虑。

点击 Reaction 后：

1. 立即更新卡片汇总；
2. 生成 Member Signal；
3. 在群聊中生成轻量事件消息；
4. 不要求用户再填写说明；
5. 可继续添加语音或文字观点。

## 8.5 语音评论

每张卡提供麦克风按钮。

流程：

1. 点击或按住开始录音；
2. 显示录音状态和时长；
3. 结束后调用 SpeechToTextAdapter；
4. 展示转写文本供用户快速确认或编辑；
5. 用户发送；
6. 群聊出现一条带卡片引用的评论；
7. 后台提取偏好、顾虑和原因。

转写失败时：

- 保留录音草稿；
- 提示重新录制或改为文字；
- 不丢失用户已经录制的文件。

## 8.6 卡片点击不等于偏好

`open` 和 `view_detail` 仅形成弱行为信号，不直接影响方案选择。

偏好强度由以下信号综合：

```text
AI 展示                     0
用户打开 / 查看详情          弱关注
用户主动分享                 中等关注
快速 Reaction                明确轻量偏好
用户正向或负向评论           高信息量偏好
明确“非常想去 / 必须去”       强偏好
明确“不能去 / 坚决不去”       约束或强排斥
```

---

# 9. 旅行素材池规格

## 9.1 素材池定位

素材池是 TripRoom 的共享外部记忆，不是传统收藏夹。

它需要保存：

- AI 推荐过的对象；
- 用户分享的对象；
- 每个成员产生的反应；
- 讨论中形成的原因；
- 素材是否进入当前方案；
- 素材之间的地点关系。

## 9.2 素材准入时机

### 自动进入

- AI 在群聊中发送的所有旅行卡；
- 用户粘贴的 URL；
- 用户上传的截图 / 图片；
- 用户通过地点搜索发送的 POI；
- 用户明确写出的具体地点、酒店或餐厅；
- 用户转述的朋友推荐。

### 不自动进入

- 完全泛化的闲聊，例如“日本挺好”；
- 与旅行无关的图片；
- 仅包含情绪、无可识别对象的消息。

不确定时可以先创建 `unresolved_material`，后续再识别。

## 9.3 素材状态

```ts
type MaterialStatus =
  | 'seen'              // 已出现，尚无明确反馈
  | 'interested'        // 至少一人明确感兴趣
  | 'controversial'     // 有明显正负分歧
  | 'selected'          // 已进入某个方案
  | 'dropped'           // 当前暂时放弃
  | 'unresolved';       // 尚未识别清楚
```

状态由系统计算，允许组织者手动调整。

## 9.4 素材展示分组

默认分组：

- 很想去；
- 值得继续看看；
- 有分歧；
- 已进入方案；
- 暂时放下；
- 待识别。

支持筛选：

- 成员；
- 来源；
- 类型；
- 地点层级；
- 当前状态。

## 9.5 素材去重

同一地点可能来自：

- AI 推荐；
- 成员 A 小红书截图；
- 成员 B 地图链接；
- 多条文字讨论。

系统应合并为同一 DestinationNode 下的多个 Material Source，不应创建四个互不关联的“镰仓”。

无法高置信度合并时：

- 标记候选重复；
- 后台或 UI 提供“是否为同一地点”；
- 不擅自覆盖原始素材。

---

# 10. 偏好与信号模型

## 10.1 信号层级

### A. Observed Signal

由系统观察到，但不当作确定偏好：

- 打开卡片；
- 主动分享；
- 反复询问；
- 在该对象上停留较久。

### B. Expressed Preference

用户明确表达：

- Reaction；
- “这个挺喜欢”；
- “这个感觉一般”；
- “有点害怕”；
- “觉得太远”。

### C. Confirmed Constraint

明确影响方案：

- “这个一定要去”；
- “这个绝对不去”；
- “我们只有 7 天”；
- “预算最多到这个档位”；
- “我不能走太久”；
- “不接受连续换酒店”。

## 10.2 Member Signal 数据结构

```ts
interface MemberSignal {
  id: string;
  tripId: string;
  memberId: string;
  targetType: 'node' | 'material' | 'plan';
  targetId: string;
  sourceMessageId?: string;
  signalType:
    | 'exposed'
    | 'opened'
    | 'shared'
    | 'want_to_know'
    | 'positive'
    | 'neutral'
    | 'negative'
    | 'must_go'
    | 'hard_reject'
    | 'concern'
    | 'questioned';
  polarity: -1 | 0 | 1;
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
  reason?: string;
  extractedAttributes?: Array<{
    key: string;       // 例如 sea_view / time_cost / thrill_rides
    polarity: -1 | 0 | 1;
    text: string;
  }>;
  visibility: 'group' | 'ai_only';
  scope: 'trip';
  confidence: number;
  createdAt: string;
}
```

## 10.3 信号聚合

系统需要计算但不向用户展示精确分数：

- 共同兴趣；
- 强烈个人兴趣；
- 明显分歧；
- 主要顾虑；
- 尚未获得观点的成员；
- 被反复提到的属性，例如“海边”“少移动”“主题乐园”。

前台使用自然语言：

> “东京目前是最明确的共同方向。”

> “镰仓有多人喜欢，但主要顾虑是要占用半天到一天。”

不要显示：

> “东京团队评分 87.4。”

## 10.4 私密信号

若评论设置为 `ai_only`：

- 原文只对本人和 AI 可见；
- 其他成员不看到该消息；
- AI 可以在规划中使用；
- AI 对群组输出时只能使用匿名化、非敏感表达；
- MVP 不需要复杂披露梯度，但必须防止原文泄露。

---

# 11. 地点知识树与探索图

## 11.1 数据结构原则

存储不是纯树，而是：

> **主层级树 + 关系图**

主层级支持：

```text
日本
├── 东京
│   ├── 浅草 / 上野
│   ├── 涩谷 / 新宿
│   ├── 东京迪士尼
│   ├── 镰仓
│   └── 箱根
├── 大阪
│   ├── USJ
│   ├── 道顿堀
│   └── 梅田
├── 京都
├── 北海道
└── 冲绳
```

关系边补充：

- `nearby_day_trip`：东京 → 镰仓；
- `pairs_well_with`：大阪 ↔ 京都；
- `alternative_to`：箱根 ↔ 河口湖；
- `requires_long_transfer`：东京 ↔ 大阪；
- `contains`：日本 → 东京；
- `same_theme`：多个海岛或主题乐园；
- `source_mentions`：素材 → 地点；
- `selected_in_plan`：地点 → 方案。

## 11.2 DestinationNode

```ts
interface DestinationNode {
  id: string;
  provider?: 'seed' | 'mock' | 'google_places' | 'mapbox' | 'osm' | string;
  providerPlaceId?: string;
  canonicalName: string;
  aliases: string[];
  nodeType:
    | 'country'
    | 'region'
    | 'city'
    | 'district'
    | 'area'
    | 'attraction'
    | 'poi'
    | 'activity'
    | 'transit_hub';
  parentId?: string;
  countryCode?: string;
  geo?: {
    latitude: number;
    longitude: number;
  };
  shortSummary: string;
  longDescription?: string;
  highlights: string[];
  tags: string[];                 // 后台检索，不作为首层用户筛选
  suggestedStayText?: string;
  budgetBand?: 'low' | 'medium' | 'high' | 'luxury' | 'unknown';
  heroImageUrl?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  imageAlt: string;
  dataSource?: string;
  dataFreshness?: 'seed_static' | 'cached' | 'live' | 'unresolved';
  dataAsOf?: string;
  lastSyncedAt?: string;
  popularityScore?: number;
  socialDiscovery?: {
    xiaohongshu?: {
      provider: 'xiaohongshu';
      label: string;
      searchKeywords: string[];
      searchUrl: string;
    };
  };
  isSeedData: boolean;
  createdAt: string;
  updatedAt: string;
}
```

`DestinationNode` 是当前代码中的 Canonical Place。未来接 Google Places、Mapbox 或 OSM 时，Provider Adapter 必须先转换成该结构，业务层和 UI 不直接消费 `GooglePlace`、`MapboxFeature` 或 `OSMNode`。

## 11.3 DestinationRelation

```ts
interface DestinationRelation {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationType:
    | 'contains'
    | 'nearby_day_trip'
    | 'pairs_well_with'
    | 'alternative_to'
    | 'requires_long_transfer'
    | 'same_theme'
    | 'reachable_from';
  metadata?: Record<string, unknown>;
  source?: string;
}
```

## 11.4 RoomNodeState

地点知识是全局的，但每个房间对节点有独立探索状态。

```ts
interface RoomNodeState {
  tripId: string;
  nodeId: string;
  state:
    | 'undiscovered'
    | 'shown'
    | 'opened'
    | 'focused'
    | 'pinned'
    | 'selected'
    | 'dismissed';
  explorationState?: 'seed' | 'discovered' | 'engaged' | 'candidate' | 'selected';
  engagementScore?: number;
  interestScore?: number;
  disagreementScore?: number;
  firstDiscoveredAt?: string;
  lastInteractedAt?: string;
  mentionCount?: number;
  interactionCount?: number;
  source?: 'seed' | 'conversation' | 'card' | 'material' | 'mock';
  shownCount: number;
  lastShownAt?: string;
  aggregateSignal?: {
    positiveMembers: number;
    negativeMembers: number;
    interestedMembers: number;
    comments: number;
  };
}
```

`RoomNodeState` 在产品语义上也是 Room 级 `RoomPlaceState`：它只保存团队聚合后的地点探索状态，不重复保存每个成员的具体态度。成员级态度仍由 `MemberSignal`、评论、语音评论和素材来源保存。

## 11.5 Exploration Map 与 Semantic Zoom

Exploration Map 不是最终行程地图，而是 TripRoom 的空间化共享记忆，用于回答：

- 已经探索了哪里；
- 大家目前对哪些 Place 更感兴趣；
- 哪些 Place 讨论很多但意见分裂；
- 每个 Place 已经沉淀了哪些素材和成员观点。

地图初始即存在，并展示当前目的地范围内的 Seed / Popular Places。未产生讨论、推荐、Reaction 或素材关联的地点保持弱化状态，不代表不存在或被排除。

Exploration Map 必须使用真实地理地图和真实经纬度。当前 MVP 可使用 OpenStreetMap raster tiles 等无需 API Key 的轻量底图；地点内容、预算、交通和介绍仍来自 Seed / Mock Provider。不得使用手工排列卡片、随机坐标、假地图背景或纯 SVG 示意位置伪装地图。

地图交互模型：

- Exploration Map 必须是一个连续地图，不允许通过点击 Place 进入另一个独立子地图；
- 地图必须支持自由 Pan / Zoom：桌面端支持鼠标滚轮、触控板、拖拽和 +/- 控制；移动端支持拖拽、双指缩放和同一组控制；
- 点击 Pin / Label / Compact Place Card 只打开 Large Place Detail / Panel，不改变地图中心、Zoom、当前层级或可见地点集合；
- 如需改变地图视野，必须通过显式动作触发，例如 Place Detail 中的 `聚焦此地点` 或 Breadcrumb 中的聚焦按钮；
- 打开和关闭 Large Place Detail 不得重置地图状态；
- 地图不维护“进入 / 返回子地图”的导航栈，Breadcrumb 仅表达当前地理上下文。

当前地理上下文规则：

- 系统应根据地图中心点、当前 Zoom、可见 Place id、`parentId` 和 `DestinationRelation` 层级关系解析 `Current Geographic Context`；
- Context 应展示为 `当前您在看：日本 > 东京 > 浅草` 这类 Breadcrumb；
- Context Resolver 不依赖反向地理编码 API，不通过经纬度字符串猜父级；
- 当中心点位于多个 Place 附近时，优先使用当前 Semantic Zoom 对应层级和层级树关系决定上下文。

语义缩放规则：

- `country`：日本大范围，只展示 `city` / `region` 层卡片，例如 Tokyo、Osaka、Kyoto、Hokkaido、Okinawa；
- `region`：仍以国家范围的 city / region 作为主要可见对象，避免过早混入 district / POI；
- `city`：展示当前城市的下一级 `district`、`area`、`attraction`、周边一日游或强相关地点；
- `district`：展示当前街区或区域内部的 attraction / POI；
- `attraction` / `poi`：展示具体景点、地标、街区内部地点或活动；若没有更深子节点，则保留当前对象或同级对象；
- Semantic Zoom 阈值由实现集中定义，当前 MVP 参考为：Zoom 4-5 = `country`，6-7 = `region`，8-9 = `city`，10-12 = `district`，13 = `attraction`，14 = `poi`。

点击父级 Place 不应自动展开子 Place。父级 Place 的 Large Place Detail 应展示当前 Room 对该 Place 的探索状态和高兴趣子地点；只有显式聚焦或继续缩放后，地图可见层级才切换到其子节点。

大范围城市卡统计规则：

- Zoom out 到日本大范围时，城市 / 区域卡应显示该父级下全部重点子地点数量和已探索数量；
- 全部重点子地点数量包含已讨论地点和未探索 Seed 地点，不得只按当前已显示 / 已讨论对象统计；
- Zoom in 到东京等城市后，应隐藏或弱化东京父卡，改为展示浅草 / 上野、涩谷 / 新宿、东京迪士尼、镰仓等子地点，避免父子层级卡片同时重叠。

Pin 视觉编码：

- 颜色深浅表示 `interestScore`；
- Pin 尺寸表示 `engagementScore`；
- 高 `disagreementScore` 使用轻量 warning / 外圈提示；
- 父 Place 的状态来自自身信号与子 Place 的加权聚合，不简单平均所有子节点。

Map places may progressively upgrade from Pin → Label → Compact Place Card as Room engagement increases.

地图 Overlay 规则：

- Seed / 未探索：弱 Pin + Place Name，不展示完整卡片；
- Discovered：Pin + Small Label；
- Engaged：Floating Compact Place Card，显示 Place Name、缩略图、兴趣状态、讨论状态和轻量外部探索入口；
- Candidate / Selected：更明显的 Compact Card；
- Compact Card 必须由同一个 `DestinationNode.geo.latitude / longitude` 投影定位，随 Zoom、Resize 和未来 Pan 重算位置；
- Semantic Zoom 决定展示层级，国家视角不同时展示 city、district、POI 多层级卡片；
- 同一区域优先展示高 `engagementScore` / `interestScore` / `disagreementScore` 的少量 Compact Card，其余地点保持 Pin / Label，避免地图严重遮挡；
- 点击 Compact Card 打开完整 Place Detail / Panel，不在地图原位把小卡撑大。

Place Detail 至少展示：

- 基础信息、多图片、Highlights、推荐游玩时间、预算、交通和 Related Places；
- People：成员 Reaction、文字观点、语音观点和 PreferenceSignal；
- Content：用户上传 Material、小红书用户分享内容、AI Seed Content 和其他 Inspiration；
- External Discovery：`去小红书看热门攻略` 真实跳转；
- `在群聊中讨论`，返回聊天输入上下文。

## 11.6 非线性展开规则

- 用户可直接从父节点进入任一子节点；
- 用户可从某个子节点跳到关系节点；
- 无需完成同级节点评价；
- 被 dismiss 的节点不主动重复出现，但用户仍可搜索回来；
- selected 不代表其他分支永久关闭；
- 形成方案后仍允许返回探索。

---

# 12. 探索成熟度与方案触发

## 12.1 两种成熟度

### Participation Readiness

表示成员是否真正参与：

- 每个成员是否至少表达过一个有效观点；
- 主要候选是否有多成员反馈；
- 是否只有组织者单方面推动。

### Planning Readiness

表示当前是否可以形成有意义的结构方案：

- 大致天数已知；
- 目的地范围已有明显焦点；
- 至少出现若干具体兴趣点；
- 存在一个可比较的路线选择；
- 没有关键事实缺失到无法比较。

两者都不是硬门槛。

## 12.2 触发方案建议的软条件

满足越多，AI 越适合主动提出方案：

- `trip_duration_known = true`；
- 至少一个一级目的地有强方向性信号；
- 至少 2–3 个具体节点有有效反馈；
- 每位成员至少出现一个表达，或存在明确“暂时不参与”的状态；
- 已出现两种不同的路线结构；
- 当前继续追加地点的边际价值下降；
- 人员开始问“怎么组合”“够不够时间”“哪种更好”。

AI 提议而非强制：

> “现在可以先看两版旅行框架了，要不要我整理？”

用户选择“继续探索”后，不应反复催促。

## 12.3 结构级变化

以下变化触发方案重新计算：

- 天数变化；
- 出发 / 返程日期变化；
- 新增或移除主要城市；
- 某个活动升级为必去；
- 某个城市明确排除；
- 预算档位明显变化；
- 行动能力或换酒店限制；
- 新增长距离交通段。

## 12.4 局部变化

以下只更新素材和局部行程：

- 喜欢 / 不喜欢某个普通景点；
- 新增餐厅；
- 对商圈的普通偏好；
- 同城内地点替换；
- 一条新的 UGC 体验。

---

# 13. 结构方案规格

## 13.1 PlanVariant

```ts
interface PlanVariant {
  id: string;
  tripId: string;
  version: number;
  title: string;
  summary: string;
  status: 'draft' | 'active' | 'superseded' | 'selected';
  totalDays?: number;
  segments: Array<{
    nodeId: string;
    name: string;
    days: number;
    representativeNodeIds: string[];
    experienceSummary: string;
  }>;
  includedNodeIds: string[];
  excludedHighlights: string[];
  mobilityText: string;
  budgetText: string;
  budgetIsEstimate: boolean;
  gains: string[];
  tradeoffs: string[];
  basedOnSignalIds: string[];
  unresolvedQuestions: string[];
  parentPlanId?: string;
  changeSummary?: string[];
  createdAt: string;
}
```

## 13.2 方案卡必须展示

- 方案标题；
- 城市 / 区域顺序；
- 大致天数；
- 代表性地点；
- 主要体验；
- 移动强度；
- 粗预算及假设；
- 方案优点；
- 主要取舍；
- 尚需确认的问题；
- 成员评论入口；
- 与上一版差异。

## 13.3 方案生成原则

- 生成 2–3 个真正不同的方向；
- 不生成仅交换一天顺序的伪差异；
- 必须引用房间素材和成员信号；
- 用户主动分享且获得正向反馈的素材应优先被解释；
- 不必塞入所有素材；
- 明确写出舍弃项；
- 不声称唯一最优；
- 若预算、交通为估算，必须标明。

---

# 14. 群聊消息类型

```ts
type ChatMessageType =
  | 'user_text'
  | 'user_voice'
  | 'user_attachment'
  | 'ai_text'
  | 'ai_card_batch'
  | 'reaction_event'
  | 'material_saved_event'
  | 'room_summary'
  | 'plan_proposal'
  | 'plan_revision'
  | 'system_event';
```

## 14.1 用户评论卡片后的群聊样式

```text
[成员 A · 镰仓]
🎙 “海边和电车我挺喜欢，不过如果专门花一天过去感觉有点久。”
```

其他成员可以直接回复该消息。

## 14.2 Reaction 事件

轻量展示，不刷屏：

```text
A 想去镰仓 · B 也想去
```

多个短时间内的 Reaction 应聚合为一条。

## 14.3 AI 卡片批次

AI 文本最多 2–4 段，随后嵌入卡片批次。

示例：

> “东京已经是大家最明确的方向。我先放 5 个很不一样的具体选项，你们看到有感觉的直接点或说一句就行，不需要先把东京全部研究完。”

随后发送卡片。

卡片批次是该 AI Message 的结构化内容，必须在 Place Workspace 的 `探索` 模式中实现为真正可操作的单卡 Swipe 模型。它不应作为页面底部、侧边栏或群聊内的独立全局模块。

Swipe 行为要求：

- Mobile 支持手指左右 Swipe；
- 当前卡片占主要视野，下一张卡露出一部分；
- 不产生页面整体横向滚动；
- Swipe 后保留当前位置；
- Reaction、查看详情、语音和评论按钮仍可正常点击；
- Swipe 只改变当前查看的 Place 和地图高亮，不自动生成正向或负向偏好，也不自动改变 `exploration_path`；
- Desktop 保持单卡主视图，不变成 Grid；
- Desktop 支持鼠标拖动和左右箭头按钮。

---

# 15. 页面与组件规格

## 15.1 路由

```text
/                       产品首页 / 创建房间
/room/[tripId]          TripRoom 主界面
/room/[tripId]/join     加入房间
/demo                   Demo 入口选择页
/demo/quick             Quick Demo 入口
/demo/fresh             Start from Scratch Demo 入口
```

## 15.2 桌面端布局

建议三栏：

```text
┌────────────┬───────────────────────────┬────────────────────┐
│ 房间信息   │ 群聊 + 卡片主区域         │ 灵感池 / 当前探索   │
│ 成员       │                           │ / 方案              │
└────────────┴───────────────────────────┴────────────────────┘
```

左栏：

- 房间名称；
- 成员头像；
- 邀请按钮；
- 当前已知信息；
- 当前探索焦点。

中栏：

- 群聊消息；
- AI 卡片批次；
- 评论输入；
- 附件上传；
- 语音输入；
- @AI。

右栏标签：

1. `灵感`；
2. `探索`；
3. `方案`。

## 15.3 移动端布局

TripRoom 当前定位为 Mobile-first Responsive Web App。移动端核心结构：

```text
顶部：Room 名称 / 当前身份 / + 邀请旅伴
主体：群聊 / AI 推荐内容 / 地点 Carousel
底部：消息输入 / 语音 / 附件
素材池与方案：Tab / Drawer / Sheet 打开
```

底部三 Tab 可用于：

- 聊天；
- 灵感；
- 方案。

探索节点通过顶部面包屑或抽屉显示。

桌面端是增强布局，不得存在只能在桌面端使用的 P0 功能。

## 15.4 主要组件

```text
RoomHeader
MemberAvatarGroup
InviteDialog
ChatTimeline
ChatComposer
VoiceRecorder
AttachmentUploader
AIMessage
TravelCardBatch
TravelCard
TravelCardDetailDrawer
ReactionBar
MaterialPool
MaterialItem
MaterialFilters
ExplorationBreadcrumb
RelatedNodeStrip
RoomContextSummary
PlanVariantCard
PlanComparison
SourceBadge
EstimateBadge
PrivateMessageToggle
```

## 15.5 视觉方向

- 图像驱动；
- 温暖、轻松、有旅行期待感；
- 避免企业后台、表格和项目管理感；
- 使用大图、圆角卡片、柔和层级；
- 聊天仍是主体验；
- 不展示复杂进度百分比和评分仪表盘；
- 卡片之间有充足留白；
- 头像与成员观点需要有明显存在感。

---

# 16. 数据库模型

建议使用 PostgreSQL。以下为核心表，可根据 ORM 调整字段名。

当前 MVP 的 seed 与 Demo Room 使用稳定字符串 id（例如 `demo-japan-7d`、`tokyo`、`kamakura`），便于 Mock Provider、前端状态和测试共享同一节点引用。生产化时可迁移为 UUID，但不得破坏节点、素材、消息和成员信号之间的正式关系。

## 16.1 trips

```text
id TEXT PK
name TEXT
invite_code TEXT UNIQUE
created_by TEXT
status TEXT
rough_destination TEXT NULL
trip_duration_days INT NULL
rough_date_text TEXT NULL
current_focus_node_id TEXT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

## 16.2 members

```text
id TEXT PK
display_name TEXT
avatar_url TEXT NULL
created_at TIMESTAMP
```

## 16.3 trip_members

```text
trip_id TEXT FK
member_id TEXT FK
role TEXT          // organizer | member
join_status TEXT
last_seen_at TIMESTAMP
PRIMARY KEY (trip_id, member_id)
```

## 16.4 chat_messages

```text
id TEXT PK
trip_id TEXT FK
author_type TEXT   // member | ai | system
author_member_id TEXT NULL
message_type TEXT
text_content TEXT NULL
payload JSONB
visibility TEXT    // group | ai_only
reply_to_message_id UUID NULL
created_at TIMESTAMP
```

## 16.5 destination_nodes

字段参考 `DestinationNode`，并持久化：

```text
provider TEXT
provider_place_id TEXT NULL
country_code TEXT NULL
latitude FLOAT NULL
longitude FLOAT NULL
images JSONB
data_freshness TEXT
last_synced_at TEXT NULL
popularity_score FLOAT NULL
social_discovery JSONB NULL
```

这些字段用于兼容 Seed、Google Places、Mapbox、OSM 等不同 Provider 的规范化地点数据。`social_discovery` 保存 Place 级外部探索入口 metadata，例如小红书搜索关键词和真实跳转 URL；它不是抓取到的社交媒体内容。

## 16.6 destination_relations

字段参考 `DestinationRelation`。

## 16.7 room_node_states

字段参考 `RoomNodeState`。核心字段：

```text
trip_id TEXT FK
node_id TEXT FK
state TEXT
exploration_state TEXT       // seed | discovered | engaged | candidate | selected
engagement_score FLOAT
interest_score FLOAT
disagreement_score FLOAT
first_discovered_at TIMESTAMP NULL
last_interacted_at TIMESTAMP NULL
mention_count INT
interaction_count INT
source TEXT                  // seed | conversation | card | material | mock
shown_count INT
last_shown_at TIMESTAMP NULL
aggregate_signal JSONB
PRIMARY KEY (trip_id, node_id)
```

## 16.8 materials

```text
id TEXT PK
trip_id TEXT FK
created_by_type TEXT      // ai | member | system
created_by_member_id TEXT NULL
material_type TEXT        // card | url | image | screenshot | text | hotel | restaurant
source_type TEXT          // ai_recommendation | ai_seed | user_share | external_link | upload | external_search | social_media
source_provider TEXT NULL // seed | mock | user_upload | user_link | google_places | mapbox | osm | xiaohongshu | ...
source_url TEXT NULL
raw_text TEXT NULL
attachment_url TEXT NULL
title TEXT
summary TEXT NULL
status TEXT
primary_node_id TEXT NULL
extraction_status TEXT    // pending | success | partial | failed
extraction_confidence FLOAT
created_at TIMESTAMP
updated_at TIMESTAMP
```

用户主动分享的小红书链接、分享文案、截图或图片属于 Material：

```text
source_type = social_media
source_provider = xiaohongshu
source_url = 用户主动提供的 URL（如有）
primary_node_id = 识别出的 Place（如能识别）
```

这与 Place Card / Place Detail 上的“小红书攻略”外部入口不同。外部入口只负责跳转到真实小红书搜索 / 内容入口，不代表 TripRoom 已保存该帖子内容。

## 16.9 material_nodes

```text
material_id TEXT FK
node_id TEXT FK
relation_type TEXT       // primary | mentions | nearby | source_location
PRIMARY KEY (material_id, node_id, relation_type)
```

## 16.10 member_signals

字段参考 `MemberSignal`。

## 16.11 room_insights

```text
id TEXT PK
trip_id TEXT FK
insight_type TEXT        // shared_interest | divergence | concern | missing_info | key_decision
text TEXT
node_ids JSONB
member_ids JSONB
supporting_signal_ids JSONB
confidence FLOAT
status TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

## 16.12 plan_variants

字段参考 `PlanVariant`，复杂字段使用 JSONB。

## 16.13 ai_events

```text
id TEXT PK
trip_id TEXT FK
event_type TEXT
input_message_id TEXT NULL
input_payload JSONB
extracted_updates JSONB
intervention_decision JSONB
model_metadata JSONB
status TEXT
error_text TEXT NULL
created_at TIMESTAMP
```

---

# 17. AI 处理流水线

每个新事件都进入统一流水线。

```text
1. Ingest Event
   ↓
2. Normalize Message / Attachment / Reaction
   ↓
3. Extract Entities, Materials, Signals, Facts, Constraints
   ↓
4. Validate Structured Output
   ↓
5. Persist Updates
   ↓
6. Recompute Room Context and Insights
   ↓
7. Decide Whether AI Should Intervene
   ↓
8. Generate Text / Cards / Plan if Needed
   ↓
9. Validate Privacy, Sources and Estimates
   ↓
10. Persist and Publish AI Message
```

## 17.1 LLM 不直接写数据库

LLM 输出结构化 `proposedUpdates`，服务端：

- 使用 Schema 校验；
- 检查成员权限；
- 去重；
- 决定是否真正写入；
- 记录审计事件。

## 17.2 EventAnalysis Schema

```ts
interface EventAnalysis {
  extractedNodes: Array<{
    name: string;
    canonicalNodeId?: string;
    confidence: number;
  }>;
  newMaterials: Array<{
    title: string;
    materialType: string;
    sourceType: string;
    summary?: string;
    nodeIds: string[];
    confidence: number;
  }>;
  signals: MemberSignal[];
  structuralUpdates: Array<{
    key: 'trip_duration' | 'rough_date' | 'destination_focus' | 'budget_band' | 'constraint';
    value: unknown;
    confidence: number;
    requiresConfirmation: boolean;
  }>;
  factsOrClaims: Array<{
    text: string;
    type: 'verified_fact' | 'user_experience' | 'unverified_claim';
    source?: string;
  }>;
  requiresAIResponse: boolean;
  responseReason?: string;
}
```

## 17.3 InterventionDecision Schema

```ts
interface InterventionDecision {
  shouldSpeak: boolean;
  mode:
    | 'ask_minimal_question'
    | 'supply_cards'
    | 'answer_fact'
    | 'acknowledge_material'
    | 'expand_branch'
    | 'summarize'
    | 'reframe_key_decision'
    | 'offer_plan'
    | 'revise_plan'
    | 'stay_silent';
  score: number;
  reasons: string[];
  suppressedBy?: string[];
  focusNodeId?: string;
  cardNodeIds?: string[];
  planIds?: string[];
}
```

## 17.4 AIGenerationResult Schema

```ts
interface AIGenerationResult {
  messageText?: string;
  cardBatch?: TravelCard[];
  roomSummary?: {
    sharedInterests: string[];
    divergences: string[];
    keyQuestion?: string;
  };
  plans?: PlanVariant[];
  proposedFollowUp?: string;
  citationsOrSources?: Array<{
    label: string;
    url?: string;
    asOf?: string;
    sourceType: 'seed' | 'mock' | 'search' | 'user_shared' | 'tool';
  }>;
}
```

---

# 18. 旅行数据策略与 Provider

当前 MVP **暂时不接任何真实外部旅行 API**。

包括但不限于：

- Google Maps；
- 天气 API；
- 航班 API；
- 酒店 API；
- 实时票价 API；
- 实时交通 API；
- 第三方 UGC / 社交媒体内容 API。

当前阶段的目标不是验证实时旅行数据能力，而是验证 TripRoom 的核心产品体验：

- 多人围绕具体地点和景点共同探索；
- AI 主动提供旅行知识和内容；
- 地点卡片促进用户表达观点；
- Reaction、文字评论、语音评论形成偏好信号；
- 用户分享的链接、截图、地点等进入旅行素材池；
- 探索过程支持非线性展开；
- AI 根据多人反馈调整推荐；
- 最终形成 2–3 个旅行结构方案。

所有旅行内容使用本地 Seed Data / Mock Data。预算、交通时间、酒店、航班、天气等如果不是实时数据，必须在 UI 和数据定义中明确标识为：

```text
参考估算 / Mock Data
```

不得让用户误认为这些是实时价格、实时交通、真实库存或可交易承诺。

## 18.1 Provider Abstraction

虽然本阶段不接真实 API，但系统保留统一的 Provider abstraction，方便未来替换真实数据源。

```text
Application / Agent
        ↓
Travel Data Service / Tool Gateway
        ↓
Travel Provider Interface
        ↓
MockTravelProvider
        ↓
Seed Data
```

业务逻辑、Agent 和 UI 不应直接读取 Seed JSON。当前只实现 `MockTravelProvider`，未来增加 Real Provider 时应复用同一接口和数据结构，不修改核心业务逻辑。

地点数据模型需要支持多图片：

```text
Place / DestinationNode
- id
- parent_place_id
- type
- short_description / long_description
- images[]
- highlights[]
- recommended_duration
- budget_estimate
- transport_summary
- related_place_ids
```

图片和地点内容不得硬编码在 React Component 中，应继续通过 Mock Provider / Travel Data Service 获取。

Provider 至少预留以下能力：

```ts
interface TravelProvider {
  searchDestinations(query: string, context?: unknown): Promise<DestinationNode[]>;
  searchPlaces(query: string, context?: unknown): Promise<DestinationNode[]>;
  getPopularPlaces(parentNodeId?: string, context?: unknown): Promise<DestinationNode[]>;
  getChildPlaces(parentNodeId: string, context?: unknown): Promise<DestinationNode[]>;
  getPlaceDetails(nodeId: string): Promise<DestinationNode | undefined>;
  getRelatedPlaces(nodeId: string, context?: unknown): Promise<DestinationNode[]>;
  resolvePlaceMention(name: string, context?: unknown): Promise<PlaceResolution>;
  getPlaceImages(nodeId: string): Promise<PlaceImage[]>;
  getRouteEstimate(fromNodeId: string, toNodeId: string): Promise<RouteEstimate>;
  getBudgetEstimate(input: unknown): Promise<BudgetEstimate>;
  searchHotels(input: unknown): Promise<HotelSearchResult[]>;
  searchFlights(input: unknown): Promise<FlightSearchResult[]>;
  getWeather(input: unknown): Promise<WeatherResult>;
}
```

当前未实现的真实能力由 Mock Provider 返回测试数据，并明确标识 `sourceType: 'mock'` 与 `isEstimate: true`。

## 18.1.1 Social Discovery Provider / Utility

Social Discovery 负责生成外部探索入口，不负责读取第三方内容。

当前 P0 支持：

```ts
getExternalSearchUrl('xiaohongshu', placeKeyword)
```

实现要求：

- 输入同一个 Canonical Place，例如 `place_id = kamakura`；
- 生成真实小红书 Web 搜索 URL；
- Chat Card、Map Compact Card、Place Detail 共享同一个 Place / `DestinationNode.socialDiscovery`；
- Reaction、Material、PreferenceSignal 仍围绕同一个 `place_id` 聚合；
- 不创建 `ChatPlace` / `MapPlace` 两套对象；
- 用户主动分享的小红书内容进入 Material，外部探索入口不自动创建 Material。

未来如果获得官方 API 或正式授权，可新增合规的 `XiaohongshuContentProvider`，但不得用非官方爬虫或 Fake URL 代替。

## 18.2 Dynamic Place Discovery

Chat / AI output 是 Exploration Map 的重要数据源。消息管线应提取 `mentioned_place_ids` 并更新对应 `RoomNodeState`：

```text
Chat / AI output
↓
Place Mention
↓
Place Resolver
↓
Local Place Registry
↓
TravelProvider.resolvePlaceMention()
↓
Resolved Place 或 UnresolvedPlaceMention
```

当前 Mock 阶段：

- 如果地点存在于 Seed Registry，直接 resolve 到已有 `DestinationNode.id`；
- 如果不存在，保存为 `UnresolvedPlaceMention`；
- 不得让 LLM 编造 `latitude`、`longitude`、`parent_place_id` 或 `provider_place_id`；
- 未定位地点可以在 UI 中显示为“新发现地点 · 尚未定位”，但不能随机画在地图坐标上。

## 18.3 Required Non-Travel Adapters

```ts
interface LLMAdapter {
  analyzeEvent(input: unknown): Promise<EventAnalysis>;
  decideIntervention(input: unknown): Promise<InterventionDecision>;
  generateResponse(input: unknown): Promise<AIGenerationResult>;
}

interface SpeechToTextAdapter {
  transcribe(audio: Blob): Promise<{ text: string; confidence?: number }>;
}

interface VisionExtractionAdapter {
  extract(imageUrl: string): Promise<{
    text?: string;
    locations: string[];
    summary?: string;
    confidence: number;
  }>;
}

```

## 18.4 MVP 实现策略

- `LLMAdapter`：使用任意支持结构化输出的模型，或提供 Mock 模式；
- `SpeechToTextAdapter`：MVP 默认 Mock 或浏览器演示能力，不要求外部语音 API；
- `VisionExtractionAdapter`：MVP 默认 Mock 截图地点识别，不要求外部视觉 API；
- `TravelProvider`：P0 只使用 `MockTravelProvider` 和本地 Seed Data；
- `BudgetEstimate` / `RouteEstimate`：P0 由 Mock Provider 返回参考估算，不接实时价格或交通；
- 所有旅行数据能力由 `TRAVEL_PROVIDER=mock` 控制；当前不要求任何真实旅行 API Key。

## 18.4 来源区分

系统必须区分：

- `seed`：预置知识；
- `mock`：Mock Provider 估算或占位结果；
- `tool`：未来外部工具查询；
- `user_shared`：用户带入的 UGC；
- `unverified`：尚未验证。

对价格和时效信息显示：

- “参考估算 / Mock Data”；
- 数据日期；
- 估算假设；
- “以实际查询为准”。

---

# 19. API 设计

可使用 Next.js Route Handlers 或独立后端。至少实现：

```text
POST   /api/trips
GET    /api/trips/:tripId
POST   /api/trips/:tripId/join
GET    /api/trips/:tripId/messages
POST   /api/trips/:tripId/messages
POST   /api/trips/:tripId/attachments
POST   /api/trips/:tripId/cards/:cardId/reactions
POST   /api/trips/:tripId/cards/:cardId/comments
POST   /api/trips/:tripId/voice/transcribe
GET    /api/trips/:tripId/materials
PATCH  /api/trips/:tripId/materials/:materialId
GET    /api/trips/:tripId/exploration
POST   /api/trips/:tripId/exploration/focus
GET    /api/trips/:tripId/plans
POST   /api/trips/:tripId/plans/generate
POST   /api/trips/:tripId/plans/:planId/comments
POST   /api/trips/:tripId/plans/:planId/revise
POST   /api/trips/:tripId/ai/process-event
```

所有写入接口：

- 验证 room membership；
- 使用幂等键防重复；
- 返回最新实体；
- 发布实时事件。

---

# 20. 推荐技术栈

## 20.1 前端

- Next.js App Router；
- TypeScript；
- React；
- Tailwind CSS；
- shadcn/ui 或等价可组合组件；
- TanStack Query 或 Server Actions；
- Zod 做前后端 Schema；
- 可选 Framer Motion 做轻量卡片动画。

## 20.2 后端与数据

- Next.js Route Handlers；
- PostgreSQL；
- Supabase 或等价服务用于数据库、对象存储和 Realtime；
- ORM 可用 Prisma 或 Drizzle；
- 对象存储保存截图和语音。

## 20.3 AI 层

- 单一 Orchestrator，不使用多 Agent 自由辩论；
- 结构化输出；
- Prompt 与 Schema 分离；
- Provider Adapter；
- 事件级审计；
- Travel Data Service 统一读取旅行数据；
- 当前 MVP 使用 MockTravelProvider + Seed Data，不接真实外部旅行 API。

## 20.4 代码目录建议

```text
app/
  page.tsx
  demo/page.tsx
  demo/quick/page.tsx
  demo/fresh/page.tsx
  room/[tripId]/page.tsx
  room/[tripId]/join/page.tsx
  api/
components/
  chat/
  cards/
  materials/
  exploration/
  plans/
  room/
lib/
  ai/
    orchestrator.ts
    prompts/
    schemas/
    adapters/
  db/
  events/
  graph/
  travel/
    provider.ts
    mock-provider.ts
    service.ts
  materials/
  signals/
  plans/
  realtime/
  utils/
prisma/ or drizzle/
  schema
  migrations/
seed/
  japan-destinations.json
  demo-room-fresh.json
  demo-room-quick.json
public/
  destinations/
tests/
  unit/
  integration/
  e2e/
```

---

# 21. 日本演示种子知识库

P0 至少预置以下节点，保证不接任何外部旅行 API 也能完成 Demo。Seed Data 只能由 `MockTravelProvider` 读取；Application、Agent 和 UI 通过 Travel Data Service 获取旅行数据。

## 21.1 一级节点

- 日本；
- 东京；
- 大阪；
- 京都；
- 北海道；
- 冲绳；
- 富士山 / 河口湖；
- 箱根。

## 21.2 东京分支

- 浅草 / 上野；
- 涩谷；
- 新宿；
- 银座 / 丸之内；
- 东京迪士尼度假区；
- 秋叶原；
- 镰仓；
- 箱根；
- 河口湖。

## 21.3 大阪分支

- 环球影城 USJ；
- 道顿堀 / 心斋桥；
- 梅田；
- 大阪城；
- 与京都组合关系。

## 21.4 京都分支

- 祇园；
- 伏见稻荷；
- 岚山；
- 清水寺；
- 与大阪组合关系。

## 21.5 北海道分支

- 札幌；
- 小樽；
- 富良野 / 美瑛；
- 冬季雪景活动。

## 21.6 冲绳分支

- 那霸；
- 海岛与潜水；
- 美丽海水族馆；
- 庆良间诸岛。

每个节点至少有：

- 一张本地演示图；
- 一句话特色；
- 2–4 个亮点；
- 建议停留时间；
- 预算档位；
- 父节点；
- 至少一个关系边。

所有预算为 Demo Estimate，页面必须标注。

---

# 22. 错误与边界场景

## 22.1 链接无法访问

- 仍保存链接；
- 标记 `partial` 或 `failed`；
- 请求截图；
- 不声称已提取完整内容。

## 22.2 截图地点识别不确定

- 创建 unresolved material；
- 展示“可能是镰仓 / 江之岛”；
- 让用户一键确认；
- 不擅自合并。

## 22.3 多成员同时操作

- Reaction 使用乐观更新；
- 服务端最终一致；
- 重复提交去重；
- 消息和 Reaction 按 server timestamp 排序。

## 22.4 没有人反馈 AI 卡片

AI 不立即追加更多卡片。可在适当时机问：

> “这些里面是都没感觉，还是信息有点多？我可以换一批，也可以先沿东京展开。”

## 22.5 一个人非常活跃，其他人沉默

AI 可以轻量邀请：

> “东京已经有不少想法了。其他人看到最有感觉的是哪一个？点一下也可以。”

不能强迫逐项评价。

## 22.6 用户改变主意

更新最新信号，同时保留历史证据。方案使用最近、明确、上下文匹配的表达。

## 22.7 AI 反复插话

使用最近发言惩罚和对话活跃度抑制。AI 每次卡片批次后至少等待有效用户信号，除非被直接提问。

## 22.8 价格或事实不确定

显示“待验证”或“粗略估算”，不得用确定口吻。

## 22.9 敏感私密输入

- 不在群聊展示；
- 不进入公开素材摘要；
- AI 仅以匿名约束影响方案；
- 日志中避免把原文发送到不必要的客户端。

---

# 23. 数据与隐私要求

- 房间数据只对成员可见；
- 邀请码不可顺序猜测；
- 上传文件使用签名 URL 或权限受控地址；
- 服务端检查 trip membership；
- `ai_only` 消息不通过群组 Realtime 广播；
- 不记录不必要的原始音频；用户可删除；
- 提供删除素材和评论入口；
- 所有 AI 生成和外部来源保留 source metadata；
- 用户 UGC 不自动升级为 verified fact；
- Demo 数据不得包含真实个人信息。

---

# 24. 埋点与 MVP 验证指标

## 24.1 核心行为指标

- 创建房间到第一条有效成员观点的时间；
- 卡片曝光 → 打开率；
- 卡片曝光 → Reaction 率；
- 语音评论使用率；
- 用户分享素材的捕获成功率；
- 素材去重成功率；
- 每位成员有效观点覆盖；
- AI 卡片批次后的讨论消息数；
- AI 主动介入后产生有效反馈的比例；
- AI 被忽略率；
- 从模糊意向到结构方案的完成率；
- 方案被继续修改的比例。

## 24.2 体验验证问题

演示或测试结束后询问：

- “这个过程有没有让你更知道目的地有什么？”
- “你是否觉得自己更容易表达想法？”
- “你是否更理解同行者想去什么？”
- “AI 是帮助讨论，还是打断讨论？”
- “最终方案是否感觉是大家一起想出来的？”

核心体验指标：

> **共同所有感：最终方案是否仍然被认为是“我们一起选出来的”。**

---

# 25. P0 验收标准

## 25.1 房间与多人

- [ ] 用户能创建房间并获得邀请链接；
- [ ] 至少 4 个不同访客身份能加入同一房间；
- [ ] 用户消息能在其他成员界面出现；
- [ ] 每条消息显示正确成员身份。

## 25.2 冷启动与内容供给

- [ ] Demo 初始只知道“我们想去日本旅游”；
- [ ] 初始没有旅行天数、城市、景点、预算或路线偏好；
- [ ] 初始 PreferenceSignal 为空；
- [ ] 输入“我们想去日本旅游”后，AI 从内容探索开始；
- [ ] AI 主动发送 4–6 张具体目的地卡，而不是抽象标签；
- [ ] 每张卡有图片、特色、代表地点、建议天数和预算档位；
- [ ] 卡片内容可来自种子库，不依赖外部搜索。

## 25.2.1 Place Swipe

- [ ] AI 推荐多个地点时使用单卡 Swipe 舞台；
- [ ] Mobile 可以手指左右 Swipe；
- [ ] Desktop 可以通过鼠标拖动或箭头切换；
- [ ] 卡片不会全部纵向排列或平铺成 Grid；
- [ ] 页面不存在错误的整体横向滚动。

## 25.3 非线性探索

- [ ] Desktop 右侧是真实地图，而不是卡片式地图概念；
- [ ] 地图使用真实经纬度和真实地图底图；
- [ ] 地图是连续地图，支持 Pan / Zoom；
- [ ] 点击地图地点只打开 Place Detail，不自动进入子地图或改变地图视野；
- [ ] 地图显示当前地理上下文 Breadcrumb；
- [ ] 初始热门 Place 已存在但处于弱化状态；
- [ ] Interest 通过 Pin 颜色深浅表达；
- [ ] Engagement 通过 Pin 大小或外圈表达；
- [ ] 用户可以直接选择东京查看 Detail；
- [ ] 用户可以通过显式聚焦或缩放进入东京视野；
- [ ] 不要求先评价其他城市；
- [ ] 东京展开后显示具体景点 / 商圈 / 周边卡；
- [ ] 用户可以返回日本层，也可以跳到大阪或京都；
- [ ] RoomNodeState 正确更新。

## 25.4 卡片互动

- [ ] Reaction 可即时提交并显示成员头像；
- [ ] 打开卡片不会自动变成喜欢；
- [ ] 用户可发表文字评论；
- [ ] 用户可录制语音并得到转写；
- [ ] 用户可将评论设置为“仅 AI 可见”；
- [ ] `ai_only` 评论不会广播给其他成员；
- [ ] 公开语音评论带卡片引用发布到群聊；
- [ ] AI 能从评论提取正向、负向和顾虑原因。

## 25.5 素材池

- [ ] AI 推荐卡自动进入素材池；
- [ ] 用户粘贴链接后立即保存；
- [ ] 用户上传截图后创建素材；
- [ ] 无法访问的链接明确提示，而不是伪装读取成功；
- [ ] 同一地点的多个来源可以合并展示；
- [ ] 素材显示来源、状态和成员反馈。

## 25.6 AI 主动行为

- [ ] 冷启动时 AI 主动；
- [ ] 群聊热烈讨论时 AI 不连续抢话；
- [ ] 事实错误时 AI 可及时纠正；
- [ ] 多人对某节点正向后，AI 能展开相关节点；
- [ ] 普通新偏好只更新上下文，不每次重做方案；
- [ ] 天数或主要城市变化时，AI 能识别为结构级变化。

## 25.7 结构方案

- [ ] AI 能根据当前素材和观点生成 2–3 个结构方案；
- [ ] 方案包含天数、目的地、代表地点、移动强度、粗预算、优点和取舍；
- [ ] 方案引用实际存在的节点和素材；
- [ ] 用户能评论方案；
- [ ] 结构级反馈能生成新版本；
- [ ] 新版本展示差异。

## 25.8 基础质量

- [ ] 桌面端可用；
- [ ] 移动端至少不破版；
- [ ] 页面有 Loading、Empty、Error 状态；
- [ ] 图片有 alt；
- [ ] Reaction 可键盘操作；
- [ ] `.env.example` 完整；
- [ ] 无任何外部旅行 API Key 时可进入 Mock Demo；
- [ ] `README.md` 包含一条命令启动路径。

---

# 26. 必测场景

## 场景 1：日本模糊探索

输入：

> “我们 4 个人想去日本 7 天，但还不知道具体去哪。”

预期：

- AI 问 1–2 个高价值问题；
- 提供东京、大阪、京都、北海道、冲绳等具体卡片；
- 不先提供抽象体验分类问卷。

## 场景 2：直接展开东京

成员 A：

> “东京肯定要去，我们先看东京吧。”

预期：

- 东京立即成为 focus；
- 展开东京具体地点；
- 不等待其他城市卡被评价。

## 场景 3：语音表达复杂偏好

成员 B 对镰仓说：

> “海边和电车我很喜欢，但专门占一天感觉有点久。”

预期：

- 群聊显示转写；
- 保存正向属性：海边、电车；
- 保存顾虑：时间成本；
- 不把镰仓自动升级为必去。

## 场景 4：小红书截图

成员 C 上传一张包含镰仓高校前的截图。

预期：

- 原图立即保存；
- 提取可能地点；
- 与镰仓节点关联；
- 来源显示为成员分享；
- 若识别不确定，要求确认。

## 场景 5：群聊正在热烈讨论

成员连续讨论东京与大阪。

预期：

- AI 不对每条消息回复；
- 在出现需要补充的路线知识或讨论开始重复时再总结。

## 场景 6：形成两版结构方案

已知：

- 7 天；
- 东京基本确定；
- 有人强烈想去 USJ；
- 多人喜欢富士山 / 箱根；

预期：

- AI 提议比较“东京 + 富士山”与“东京 + 大阪”；
- 每版写清取舍；
- 不直接生成唯一最终行程。

## 场景 7：普通变化与结构变化

普通变化：

> “我不太想去银座。”

预期：只更新信号。

结构变化：

> “我们的 7 天改成 5 天，而且 USJ 必须去。”

预期：触发方案重新组织。

---

# 27. Hackathon Demo 流程

建议 Demo 4–5 分钟。

## 0:00–0:40 创建房间

组织者创建“日本 7 天”，邀请三位成员。

## 0:40–1:20 AI 主动供给

群里说：

> “东京、富士山、环球影城都有点兴趣，但我们其实不太清楚日本怎么玩。”

AI 说明位置关系，给东京、大阪 / USJ、富士山 / 箱根、京都卡片。

## 1:20–2:00 非线性展开

成员直接说：

> “东京肯定去，先看东京。”

系统立刻展开浅草、涩谷、新宿、迪士尼、镰仓、箱根。

## 2:00–2:40 卡片与语音

成员对镰仓语音评论；其他成员 Reaction；观点进入群聊和素材池。

## 2:40–3:15 外部素材

上传小红书截图；系统提取镰仓高校前并关联镰仓节点。

## 3:15–4:10 AI 适应与收敛

AI 根据：

- 东京共同选择；
- USJ 强个人兴趣；
- 富士山 / 箱根多人正向；
- 7 天限制；

提出两版结构方案。

## 4:10–4:50 方案修改

成员提出：

> “保留 A 的东京和箱根，但能不能再加 USJ？”

AI 解释代价，生成修订版或指出 7 天会明显变赶。

## 4:50–5:00 定位总结

> “TripRoom 不是让大家先填需求再收答案，而是让 AI 持续把具体世界摆到大家面前，让旅行在共同探索中自然长出来。”

---

# 28. Codex 实现顺序

## Phase 1：静态体验骨架

- 创建房间；
- Demo 成员；
- 三栏布局；
- 群聊；
- 静态旅行卡；
- Reaction；
- 素材池。

## Phase 2：地点图与非线性展开

- 导入日本种子数据；
- parent / relation；
- RoomNodeState；
- focus / expand；
- 探索面包屑；
- 同层与关系节点推荐。

## Phase 3：消息与信号提取

- 文字评论；
- 语音转写；
- Member Signal；
- 素材来源；
- 群聊事件。

## Phase 4：AI Orchestrator

- Event Analysis；
- Intervention Decision；
- 内容供给；
- 回答问题；
- 总结和关键问题；
- Mock / Real Adapter。

## Phase 5：外部素材

- URL 保存；
- 图片上传；
- Vision 提取；
- 地点关联；
- 识别失败处理。

## Phase 6：方案生成与迭代

- Planning Readiness；
- 结构方案；
- 方案卡；
- 评论；
- 结构变化识别；
- 新版本差异。

## Phase 7：Demo 与 QA

- 预置演示房间；
- 演示数据；
- 错误状态；
- 基础 E2E；
- README；
- 本地一键启动。

---

# 29. Definition of Done

当以下条件全部满足时，MVP 视为完成：

1. 四名演示用户可以在一个 TripRoom 中共同聊天；
2. AI 能从极少信息开始主动给出具体日本目的地卡片；
3. 用户可以不按层级顺序直接深入东京；
4. 东京下的具体景点卡可点击、Reaction、文字和语音评论；
5. 评论会发布到群聊并形成结构化成员信号；
6. AI 推荐和用户分享内容全部进入素材池；
7. 小红书链接不可读时诚实提示，截图可被提取和保存；
8. AI 会根据团队反馈调整下一批卡片；
9. AI 不在成员热烈讨论时对每句话插话；
10. 当方向成熟时，AI 能产出两到三版旅行结构方案；
11. 方案基于已有节点、素材和成员观点，而不是凭空生成；
12. 普通偏好不会导致整套方案频繁重写，结构变化会触发新版本；
13. 无任何外部旅行 API Key 时，Demo 模式仍可完整运行；
14. 代码、迁移、种子数据、测试、README 和 `.env.example` 完整；
15. 体验看起来像共同做攻略的旅行空间，而不是问卷或项目管理后台。

---

# 30. 最终产品判断

MVP 的核心不是“生成一份日本七日游”，而是验证以下产品循环是否成立：

```text
AI 把具体地点和真实旅行对象摆到群里
        ↓
成员通过点击、Reaction、语音和分享产生观点
        ↓
系统把素材、来源和每个人的反应持续沉淀
        ↓
AI 根据这群人的真实反应改变下一步供给
        ↓
分散的灵感逐渐长成可比较、可修改的旅行方案
```

最终体验应让用户感到：

> **“这趟旅行不是 AI 替我们算出来的，而是我们在 AI 的帮助下一起发现并想出来的。”**
