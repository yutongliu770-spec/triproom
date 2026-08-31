# TripRoom MVP

TripRoom 是一个 Mobile-first Responsive Web App 形态的旅行探索助手 MVP。当前阶段优先验证用户可以先 Solo 做攻略，再无损邀请旅伴进入 Group，共同围绕具体地点探索、表达偏好、沉淀素材，并自然形成旅行结构方案。

## 当前数据策略

当前 MVP 不接任何真实外部旅行数据 API，包括地点搜索、天气、航班、酒店、实时票价、实时交通和第三方 UGC / 社交媒体内容 API。

所有旅行内容来自本地 Seed Data，并通过 `MockTravelProvider` 输出。预算、交通、酒店、航班、天气等能力如果出现，均属于 `参考估算 / Mock Data`，不代表实时价格、库存、营业信息或可交易承诺。

探索地图使用 Seed 中的真实经纬度，并通过无需 API Key 的 OpenStreetMap raster tiles 显示真实地理底图。地图底图不代表 TripRoom 已接入真实地点搜索、导航、路线、营业时间或价格数据。

地点卡和 Place Detail 提供“小红书攻略”外部探索入口。该入口由 `lib/travel/social-discovery.ts` 生成真实的小红书 Web 搜索 URL，并在浏览器中打开真实外部页面；TripRoom 不抓取、不缓存、不伪造小红书帖子内容，也不假装调用小红书内容 API。用户主动粘贴的小红书链接或上传的小红书截图会作为 `social_media / xiaohongshu` Material 保存，与外部探索入口分开建模。

## 项目结构

```text
app/
  page.tsx
  demo/page.tsx
  demo/quick/page.tsx
  demo/fresh/page.tsx
  room/[tripId]/page.tsx
  room/[tripId]/join/page.tsx
  api/trips/
components/
  cards/
  chat/
  home/
  exploration/
  materials/
  plans/
  room/
  workspace/
  ui/
lib/
  ai/
  demo/
  graph/
    explore-recommendations.ts
  preferences/
    evidence-service.ts
    preference-analysis-service.ts
    preference-reducer.ts
    room-place-aggregator.ts
    constraint-service.ts
    model-provider.ts
  materials/
  plans/
  signals/
  travel/
    provider.ts
    mock-provider.ts
    social-discovery.ts
    service.ts
seed/
  japan-destinations.json
  demo-room-fresh.json
  demo-room-quick.json
specs/
  data-model.md
prisma/
  schema.prisma
  migrations/
tests/
```

## Provider Abstraction

旅行数据统一走以下链路：

```text
Application / Agent
        ↓
TravelDataService
        ↓
TravelProvider
        ↓
MockTravelProvider
        ↓
seed/*.json
```

页面组件和 Agent 不直接读取 `seed/*.json`。当前唯一读取 Seed Data 的实现是 `lib/travel/mock-provider.ts`。

Explore 的本地推荐由 `lib/graph/explore-recommendations.ts` 负责。它基于同一批 `DestinationNode`、`DestinationRelation`、`MemberSignal` 和 `RoomNodeState` 生成卡片批次，不创建 `ExplorePlace` 或 `MapPlace` 等并行地点对象。

社交发现入口由 `lib/travel/social-discovery.ts` 生成，不属于旅行内容 Provider，也不读取第三方内容。当前只支持小红书 Web 搜索入口，未来如获得正式授权，可再新增合规的 `XiaohongshuContentProvider`。

未来如需增加 Real Provider，应从 `lib/travel/provider.ts` 的 `TravelProvider` 接口扩展，并在 `lib/travel/service.ts` 中切换 Provider 实例。当前预留能力包括：

- `searchDestinations()`
- `searchPlaces()`
- `getPopularPlaces()`
- `getChildPlaces()`
- `getPlaceDetails()`
- `getRelatedPlaces()`
- `resolvePlaceMention()`
- `getPlaceImages()`
- `getRouteEstimate()`
- `getBudgetEstimate()`
- `searchHotels()`
- `searchFlights()`
- `getWeather()`

## Seed Data

Seed Data 位于：

- `seed/japan-destinations.json`：日本目的地、景点、关系边、示例预算档位和示例交通关系。
- `seed/demo-room-fresh.json`：Start from Scratch 冷启动房间，只保留“我们想去日本旅游”的模糊意向。
- `seed/demo-room-quick.json`：Quick Demo 房间，预置约 30% 已探索状态的原始消息、Reaction、PlaceOpinion 和外部素材。

Demo seed 定义初始化事实，以及用于稳定演示的确定性派生结果。PostgreSQL 可用时，`seed:demo` 会直接写入 Quick Demo 的 `Raw / Evidence / Reaction / Material / Signal / MemberPlaceProfile / RoomPlaceProfile`，不调用 DeepSeek 或其他真实模型，避免比赛前 reset 被外部网络阻塞。用户后续真实交互仍通过 `EvidenceService -> PreferenceAnalysisService -> ModelProvider -> PreferenceReducer -> RoomPlaceAggregator` 增量更新偏好链。没有数据库时，`MockTravelProvider` 会基于同一批 seed facts 生成 fallback 展示状态，保证评委仍能看到预置演示，但该 fallback 会以 `demoSeedFallback` 标记。

已确认的演示入口：

- `/demo`：Demo 入口选择页。
- `/demo/quick`：跳转到 `/room/demo-japan-quick`，用于评委快速看到多人探索、地图点亮、分歧和素材沉淀。
- `/demo/fresh`：跳转到 `/room/demo-japan-7d`，用于展示从“我们想去日本旅游”开始的冷启动。

首页 `创建 TripRoom` 按钮会直接进入 `/demo`，与顶部 `打开演示房间` 保持同一入口；正式创建房间流程属于后续账户 / 多房间能力。

## 公网部署

当前保留 Vercel 作为主部署，同时提供 Netlify 免费默认域名作为中国大陆网络备用入口：

- Vercel：继续由 GitHub / Vercel 自动部署维护。
- Netlify 备用入口：`https://triproom-demo.netlify.app/room/demo-japan-7d`。

Netlify 使用同一套 Next.js App Router、Prisma、Neon PostgreSQL 和 DeepSeek 环境变量，不复制业务逻辑。Netlify 最小配置位于 `netlify.toml`，本地缓存、依赖和 secret 通过 `.netlifyignore` 排除。因为 Netlify Functions 在 Linux runtime 运行，Prisma Client 需要在 `prisma/schema.prisma` 中包含 `rhel-openssl-3.0.x` binary target。

Netlify 生产环境至少需要配置：

- `DATABASE_URL`
- `MODEL_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MODEL`
- `MODEL_NAME`
- `TRAVEL_PROVIDER=mock`

## Solo / Group Demo 行为

当前 MVP 没有正式账户体系。Fresh Demo 默认以 1 位成员进入 Solo Room，初始只知道“想去日本旅游”，不预设天数、城市、景点、预算或路线方向。点击左侧 `+ 邀请旅伴` 会依次加入 Demo 成员，Room 从 1 人自然变成 2+ 人 Group Room。Quick Demo 默认激活 A / B / C / D 四位成员，并带有一部分已经发生过的探索事实，但仍复用同一个 Room 页面和数据模型。

左侧成员头像是 Demo Member Switcher，用于在单端模拟 A / B / C / D 多人加入同一房间。切换当前身份后：

- 新聊天消息归属当前 member；
- Reaction 归属当前 member；
- 地点卡片文字评论 / 语音评论归属当前 member；
- 成员信号按 `memberId` 分开记录；
- 切换身份不会刷新 Room 或丢失聊天、素材、Carousel 和 Reaction 状态。

同一浏览器的多个同一 Room 标签页会通过 `localStorage + BroadcastChannel` 同步房间快照，实现准实时 Demo：

- 群聊消息；
- 素材池；
- 成员信号；
- 统一地点观点；
- 成员级地点未读状态；
- 当前探索焦点；
- 中央探索卡片池；每个标签页保留自己的当前卡片位置，避免多个打开标签互相覆盖正在看的地点；
- 成员级 Explore 状态，包括 `exploration_path`、搜索原始输入、当前聚焦范围、当前区域候选、偏好倾向、已看过的 Place 和当前卡片位置；
- 结构方案与新版修订。

真实登录、多设备实时协作和 WebSocket Realtime 属于后续 P1。

## Room 信息架构

当前 `/room/demo-japan-7d` 桌面布局分为三个固定高度区域。页面根容器锁定在当前视口高度内，不产生桌面页面级纵向滚动；左侧 Group、中央 Place Workspace、右侧 Exploration Map 各自管理内部滚动。

- 左侧 `Group`：房间信息、成员切换、邀请入口、公开群聊、AI 群聊回复、素材保存事件和轻量地点 / 方案引用。
- 中央 `Place Workspace`：Room 的主工作区，顶部使用紧凑的 `探索 / 沉淀 / 规划` 三个模式；大地点卡片、地点详情、团队观点、攻略素材和方案编辑都在这里完成。
- 右侧 `Exploration Map`：基于同一批 `DestinationNode` 的空间化探索图，只负责地图、语义缩放、地点状态和未读提示。

桌面默认比例接近 `Group 28% / Place Workspace 36% / Exploration Map 36%`，保持左侧 Group 宽度稳定，中间工作区与右侧地图等宽；Group 收起后左侧保留 `72px` 窄栏，其余空间继续由工作区与地图等分。Group 收起只隐藏左侧完整内容，保留聊天、输入框、当前成员、工作区和地图状态，并显示窄栏头像、未读数和展开入口。

移动端不把三栏挤在一屏内，而是使用 `讨论 / 探索 / 地图 / 规划` 顶部切换；`沉淀` 仍作为 Place Workspace 内的二级模式使用。

## Place / Chat / Workspace 数据流

`DestinationNode` 是当前 MVP 的 Place 持久对象。Explore、沉淀地点库、地图、素材、观点和旅行方案都围绕同一个 `nodeId / place_id` 工作，不再维护 `FeedPlace / MapPlace / ChatPlace` 等并行副本。

偏好系统的数据模型 Source of Truth 位于 `specs/data-model.md`。后端偏好链已经开始使用 PostgreSQL + Prisma 持久化，当前核心链路为：

```text
用户行为 / 原始输入
        ↓
Evidence
        ↓
MemberSignal
        ↓
MemberPlaceProfile
        ↓
RoomPlaceProfile
        ↓
前端读取真实后端偏好状态
```

`MemberSignal` 继续作为 Signal 层使用，不新建重复的 `SemanticAssertion`。`RoomNodeState` 继续服务现有地图和收藏 UI，其 interest / engagement / disagreement 会由 `RoomPlaceAggregator` 根据 `RoomPlaceProfile` 同步更新。

当前后端服务边界：

- `EvidenceService`：保存原始事实后的 Evidence 索引，并触发偏好分析。
- `PreferenceAnalysisService`：调用 `ModelProvider.analyzeEvidence()` 生成 Signal 和派生 Constraint。
- `PreferenceReducer`：增量更新受影响的 `MemberPlaceProfile`。
- `RoomPlaceAggregator`：增量更新对应地点的 `RoomPlaceProfile` 和 `RoomNodeState`。
- `ConstraintService`：保存显式或派生的预算、日期、must-go、hard reject、路线条件等约束。

当前偏好分析默认仍可使用 `MockModelProvider` 保持本地可运行；Hackathon Planning 主链可通过 `MODEL_PROVIDER=deepseek` 或服务端存在 `DEEPSEEK_API_KEY` 切换到 `DeepSeekModelProvider`。React Component 不直接调用 Prisma 或模型，规划按钮只调用后端 API。

群聊是沟通层，不再承载大地点卡。AI 推荐地点时，Chat 中只显示轻量 Place Reference；完整地点卡保留在中央 `探索`。方案同理，Chat 只出现轻量方案引用，完整方案位于 `规划`。

成员对地点的表达统一沉淀为：

- `MemberSignal`：结构化偏好信号，区分正向、中立、负向、想了解、顾虑等；
- `PlaceOpinion`：可读的成员观点，来源可以是 `group_chat`、`explore_comment`、`voice_comment` 或 `card_comment`；
- `RoomNodeState`：Room 级地点状态，记录讨论热度、兴趣、分歧、提及和展示；
- `MemberPlaceState`：成员级地点状态，记录当前成员对地点的 reaction、未读数和已读时间。

如果成员在群聊自然提到已知地点，例如“箱根挺好，但是一天久”，系统会保存群聊消息、解析已有 Place、生成该成员的 `PlaceOpinion` 和 `MemberSignal`、更新 `RoomNodeState`，并为其他成员增加该地点未读。

`AI Exploration Input` 位于中央 `探索` 模式内，不是第二个群聊。它默认只用于当前成员和 AI 调整探索方向、推荐相关地点、记录探索信号；用户勾选“分享到群聊”后才会把输入同步为公开聊天消息。

Explore Search、Breadcrumb、卡片上的探索区域按钮和 AI Exploration Input 共用同一个 `exploration_path` / Explore 状态。`exploration_path` 只保留 Country / City 两层，不展示 district / attraction / poi 等更细层级；选中 `日本` 时展示日本下面的全部地点卡片，选中 `日本 / 东京` 时展示东京下面的全部地点卡片。搜索成功后保留用户原始输入；搜索城市会把路径更新到 Country / City；搜索具体地点会把该 Place 放到当前卡片，但路径仍停留在所属 Country / City；搜索“温泉 / 自然 / 传统文化”这类模糊体验会写入推荐倾向，影响当前探索区域内卡片排序，但不会变成只看单一类型的硬过滤。

外部 URL、小红书链接、截图和图片会保存为 `Material`，原始 `sourceUrl` 会被保留。系统优先使用现有 Place 别名解析并绑定 `primaryNodeId`；无法确认时保持 `unresolved`，不伪造坐标或外部 Provider 数据。

## 卡片与移动端体验

AI 推荐多个地点时，地点卡在中央 `探索` 中展示为单卡 Swipe 模型，不再平铺成 Grid，也不再使用连续横向 Carousel。界面一次只突出一张主卡，保留下一张堆叠提示、上一张 / 下一张按钮，并支持桌面鼠标拖动和移动端手指左右滑动。Swipe 只改变当前查看的 Place 和地图高亮，不会自动改写 `exploration_path`，也不会自动写入喜欢或不喜欢；偏好仍必须通过显式 Reaction、文字或语音表达。

Explore 默认优先展示具体 Place，例如 attraction、district、area、landmark 或 representative POI，而不是东京、京都、大阪这类城市卡。初始 `exploration_path` 是 `日本`，下方卡片展示日本范围内的全部具体地点，并按城市 / 区域交错排列，不能只连续展示某一个城市的小簇；用户点击卡片上的定位按钮才会把路径主动切换到所属城市或区域，例如 `日本 / 京都`。删除末级会回到国家层，点击城市级随机切换会在合法城市 / 区域内替换同级目的地。推荐池内部可以有限，但 UI 不显示卡片总数、剩余数量或已探索分母；当前方向暂时没有更多推荐时，只提示“这个方向目前已经探索得差不多了”并提供换地方、回上级、搜索新地点等动作。

`StandardPlaceCard` 是当前详细 Place 展示的唯一标准组件。Explore 当前主卡、Map 点击地点、Discovered Mini Card 点击地点、Chat Place Reference 打开地点、Planning 方案地点打开后，都复用同一个 Standard Place Card，并通过同一个 `place_id / DestinationNode.id` 加载数据。

Explore 中的 Standard Place Card 使用竖向卡片：顶部 `images[]` 支持固定高度横向切换、有效箭头和圆点指示；卡片横向 Swipe 优先切换地点，避免用户在大图上滑动时只切图片、不切地点。下半部分默认只保留城市 / 区域上下文、地点名、1-2 行简介、2-3 个亮点、建议游玩时间、粗预算、团队意愿、讨论热度、Reaction、右下角评论入口和小红书入口，保证单张卡在中央工作区主视口内尽量完整看完。城市 / 区域上下文胶囊本身是显式定位入口，点击后才切换 `exploration_path`，并会阻止外层卡片 Swipe 手势干扰。卡片内部不再重复显示“正在探索 XXX”，该状态只由卡片上方 Breadcrumb 表达。

评论入口显示的是当前 Room 围绕该 Place 的有效观点 / 内容数量，不是当前成员未读数。点击评论入口不会跳转页面，而是在 Standard Place Card 内让卡片缩小上移，并从底部弹出类似小红书 / 抖音评论区的面板。Comment Panel 顶部只展示 `感兴趣程度`、`团队兴趣` 进度条和一行 `讨论度` 状态；成员内容使用评论流样式展示，每条左侧是成员头像，右侧是成员名、表态和文字 / 语音观点，Demo 中会用 Mock 讨论补齐 A / B / C / D 的演示内容；底部保留小红书真实搜索入口，以及成员主动分享的小红书、抖音或外链 Material，并保留 `sourceProvider`、`sourceUrl` 和来源成员信息。关闭后恢复标准卡片默认状态。

每张主要地点卡提供“小红书攻略”入口，打开真实小红书搜索结果页。入口只负责 Discover / External Entry，不会提前把帖子内容写入 TripRoom。

每个核心 seed 地点通过 `images[]` 提供 3 张演示图片，组件通过 `TravelDataService -> MockTravelProvider -> seed/*.json` 获取，不在 React 组件里硬编码图片列表。

`沉淀` 是团队共同收集的 Hierarchical Collection，不是平铺地点网格。当前结构为 `Country → City / Region → Place`：Country 行保持简洁，只展示团队兴趣和是否有新动态；City 使用可横向滑动的 Compact Card 并支持展开 / 收起，前台只展示“探索度”进度条，不展示 `已看 / 总数` 或 denominator；City 与 Place 小卡都使用更小密度的 Collectible 样式，以地点图片作为虚化背景，只保留地点名、1 行特色或统计、团队 Interest 和未读提示。City 探索度综合 shown、opened/focused、Reaction、PlaceOpinion、Material、多成员参与和类型覆盖计算，不是简单卡片数量。Mini Card 点击后打开同一个 Standard Place Card，不创建沉淀专用详情卡。

## Exploration Map

右侧 `Exploration Map` 是 Room 的空间化共享记忆，不是最终行程地图。它基于同一组 Place / `DestinationNode` 展示 Seed Popular Places、层级关系、成员讨论、Reaction、评论、素材沉淀和当前成员未读动态。

地图界面使用真实经纬度投影到 OpenStreetMap tile，不使用卡片 Grid、假地图背景、随机坐标或手工摆位模拟地图。

地图是一个连续可拖拽、可缩放的探索面板，不通过点击地点进入独立子地图。用户可以用滚轮 / 触控板、地图上的 +/- 控制和拖拽改变视野；移动端通过拖拽、双指缩放和同一组控制按钮使用。点击地图上的 Pin / Compact Card 只打开下方 Place Detail，不改变地图中心、缩放或层级；Detail 里的 `聚焦此地点` 才会显式把地图移到该地点。

地图当前地理上下文由 `lib/graph/map-context.ts` 根据地图中心、Zoom、可见地点和 `parentId` / `DestinationRelation` 层级关系解析，不使用反向地理编码 API。右侧会显示 `当前您在看：日本 > 东京 > 浅草 / 上野` 形式的状态 Breadcrumb。Breadcrumb 是当前视野状态展示，点击某一级只做显式聚焦，不作为返回子地图的导航栈。

地图 Marker 使用渐进 Overlay：未探索 Seed Place 默认保持弱 Pin / Label；被聊天提到、成员 Reaction、素材关联或重点展开后，会升级为悬浮 Compact Place Card。Compact Card 仍锚定同一个 `DestinationNode.geo` 投影坐标，以地点图片作为虚化背景，并显示地点名、兴趣/讨论状态、当前成员未读红点和轻量小红书入口；地图上的小红书入口使用收纳式悬浮小标识，避免放大卡片占地。点击 Pin / Compact Card 会打开中央 Place Workspace 的 Place Detail；点击未读红点会打开 `大家观点 / 最新动态` 方向的详情，不在地图内维护独立评论弹窗。

当前实现使用 Semantic Zoom：

- `country` / `region`：只展示国家范围内的 city / region 卡片，例如东京、大阪、京都、北海道、冲绳；城市卡会显示全部重点子地点数和已探索数，包含已讨论和未探索 Seed 子地点；
- `city`：展示当前城市的下一级 district / attraction / 周边地点，进入东京视野后东京父卡不再与浅草、涩谷、迪士尼等子地点重叠展示；
- `district` / `attraction` / `poi`：继续展示街区、景点或 POI 内部的更具体地点；若没有更深子节点，则展示当前层级的同级地点或当前地点。

地图状态由 `RoomNodeState` 表达：`engagementScore` 表示讨论热度，`interestScore` 表示团队兴趣，`disagreementScore` 表示分歧。Chat 提到已知地点、卡片 Reaction、卡片评论和素材关联都会影响探索状态。

当前 Explore Card 会驱动地图上的临时 active Place。切换卡片时，Room 会写入当前 `activePlaceId`，右侧地图高亮同一个 `DestinationNode` 的 marker / compact card；如果地点已经在当前视野内，地图不移动；如果不在视野内，地图只平滑移动到区域级视野，并把自动缩放限制在探索语义层级内，不进入街道或建筑级缩放。用户手动 pan / zoom 后，地图不会因为普通地图浏览反向重排 Feed；只有卡片切换、搜索或显式范围操作会重新触发地图聚焦。

Place Detail 复用同一套 Place / `DestinationNode`，在中央工作区展示 `概览`、`大家观点`、`攻略素材` 三个标签。`大家观点` 汇总所有公开 `PlaceOpinion` 和成员 reaction；`攻略素材` 展示已绑定 Material、已收集的小红书素材和外部小红书攻略入口。

如果聊天里出现 Seed 中不存在的地点，当前 Mock 阶段只显示为“新发现地点 · 尚未定位”，不会伪造坐标、父级或真实 Provider id。未来接入 Google Places、Mapbox 或 OSM 时，应通过 `TravelProvider.resolvePlaceMention()` 解析后再写入 Canonical Place。

## 环境变量

复制 `.env.example` 为 `.env.local` 后即可本地运行。当前不需要任何旅行 API Key。

关键变量：

```text
TRAVEL_PROVIDER="mock"
AI_ADAPTER_MODE="mock"
MODEL_PROVIDER="mock"
MODEL_NAME="mock-preference-v1"
MODEL_API_KEY=""
SPEECH_TO_TEXT_ADAPTER_MODE="mock"
VISION_EXTRACTION_ADAPTER_MODE="mock"
PRICE_ESTIMATE_ADAPTER_MODE="mock"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
```

公开 Hackathon Demo 的服务端 / Vercel 环境应配置：

```text
DATABASE_URL
MODEL_PROVIDER="deepseek"
DEEPSEEK_API_KEY
DEEPSEEK_BASE_URL
DEEPSEEK_MODEL
TRAVEL_PROVIDER="mock"
```

`DEEPSEEK_API_KEY` 只允许放在后端或部署平台 Secret 中，不写入 Git，也不暴露给浏览器。

## 启动

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`npm run dev` 会先执行 `predev`，自动清理 `.next`、`node_modules/.cache/next` 和系统临时目录中的 Next SWC 缓存。不要在 dev server 运行时同时执行 `npm run build`；如果本地先跑 `next build` 后再跑 `next dev`，或热更新过程中出现 `Cannot find module './vendor-chunks/lucide-react.js'` 这类运行时错误，先停掉 dev server 再重新执行 `npm run dev`。

打开：

```text
http://localhost:3000/demo
```

直接进入两个演示房间：

```text
http://localhost:3000/demo/quick
http://localhost:3000/demo/fresh
http://localhost:3000/room/demo-japan-quick
http://localhost:3000/room/demo-japan-7d
```

比赛或演示前重置固定 Demo 数据：

```bash
npm run seed:demo
```

`seed:demo` 只会重建已知 demo trip（`demo-japan-quick` 和 `demo-japan-7d`），并在 `NODE_ENV=production` 或 `VERCEL_ENV=production` 时拒绝执行。刷新页面后，数据库状态会优先于浏览器旧 localStorage 快照。

测试移动端体验时，可在浏览器 DevTools 中切到手机宽度，验证 `讨论 / 探索 / 地图 / 规划` 切换、单卡 Swipe、底部输入、邀请旅伴和探索地图在窄屏下仍可使用，且页面本身不会产生横向滚动。

## 测试

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

当前测试覆盖：

- `TravelDataService + MockTravelProvider`：确保外部旅行能力在没有 API Key 的情况下返回 Mock 数据，并为 Place / TravelCard 生成小红书外部探索 URL。
- `Demo Seeds`：验证 Fresh Demo 保持冷启动，Quick Demo 由原始 seed facts 生成 Evidence / Signal / Profile fallback 和地图点亮状态。
- `Preference Data Chain`：在 `DATABASE_URL` 指向已迁移 PostgreSQL 时，验证一条成员原话可以写入 Evidence，并流经 Signal、MemberPlaceProfile、RoomPlaceProfile，且保留来源引用和自然语言原因。
- `RoomExperience` 核心路径：模糊日本意向冷启动、Solo Room、邀请 Demo Member 进入 Group、Member Switcher、左侧 Group 聊天与收起 / 展开、中央 Place Workspace、Explore Search、`exploration_path` Breadcrumb、卡片 Swipe 不改探索区域、卡片定位按钮主动切换城市 / 区域、合法同级随机切换、Cluster 推荐、单卡 Swipe Explore、Standard Place Card、卡片图片切换、Comment Panel、沉淀 Country → City → Place 层级收藏、City 探索度、Mini Card 打开统一 Standard Card、小红书攻略入口、用户分享小红书链接/截图入素材池、成员级 Reaction、群聊提及自动生成 PlaceOpinion、语音转写消息、方案生成、方案地点打开、方案评论和新版修订。
- Exploration Map 核心路径：真实地图底图、真实经纬度 Pin、Seed Popular Places 灰态展示、连续地图自由缩放 / 拖拽、地图上下文 Breadcrumb、Semantic Zoom 层级切换、城市重点子地点统计、地图 Compact Place Card、地图点击打开中央 Place Detail、聊天提及地点、多人 Reaction、成员观点、素材来源、成员未读提示和未定位新地点展示。

## API 路由

当前 API route 使用 Mock Demo 数据返回，主要用于前后端契约和演示闭环：

- `POST /api/trips`
- `GET /api/trips/:tripId`
- `POST /api/trips/:tripId/join`
- `GET /api/trips/:tripId/preferences`
- `GET /api/trips/:tripId/messages`
- `POST /api/trips/:tripId/messages`
- `POST /api/trips/:tripId/attachments`
- `POST /api/trips/:tripId/nodes/:nodeId/reactions`
- `POST /api/trips/:tripId/nodes/:nodeId/comments`
- `POST /api/trips/:tripId/voice/transcribe`
- `GET /api/trips/:tripId/materials`
- `POST /api/trips/:tripId/materials`
- `PATCH /api/trips/:tripId/materials/:materialId`
- `GET /api/trips/:tripId/exploration`
- `POST /api/trips/:tripId/exploration/focus`
- `POST /api/trips/:tripId/exploration/inputs`
- `POST /api/trips/:tripId/exploration/search`
- `POST /api/trips/:tripId/constraints`
- `POST /api/trips/:tripId/preferences/retry`
- `GET /api/trips/:tripId/plans`
- `POST /api/trips/:tripId/plans/generate`
- `POST /api/trips/:tripId/plans/:planId/comments`
- `POST /api/trips/:tripId/plans/:planId/revise`
- `POST /api/trips/:tripId/ai/process-event`

## 数据库

`prisma/schema.prisma` 和迁移位于 `prisma/migrations/`。当前 MVP 的旅行内容仍来自 Mock Seed Data，但偏好链已经可以写入 PostgreSQL：Chat Message、Reaction、Place Comment、Voice Comment / Transcript、Exploration Input 和 Material 会先保存原始事实，再创建 Evidence，并触发 ModelProvider 分析生成 Signal / Constraint / Profile。

数据模型的产品语义说明位于 `specs/data-model.md`。该文档将偏好系统核心链路收敛为 `Evidence → Signal → Constraint → MemberPlaceProfile → RoomPlaceProfile → PlanningContextSnapshot` 六张核心表，并说明它们为什么存在、谁写谁读，以及 Travel Planning Agent 如何读取它们。`Place / Member / Room / Material / Plan` 属于产品业务数据，数据库实际实现仍以 PostgreSQL + Prisma schema / migration 为准。

`DestinationNode` 预留 `social_discovery` JSON 字段，用于保存 Place 级外部探索入口 metadata。当前运行时由 `social-discovery.ts` 生成小红书搜索 URL；正式接入授权社交内容 Provider 时可写入该字段。

Planning 主链由 `PlanningContextBuilder -> TravelPlanningService -> ModelProvider.generateTravelPlans() -> PlanValidator -> PlanningScorer -> PlanVariant` 组成。生成方案时会创建 `PlanningContextSnapshot`，DeepSeek 只读取该快照整理出的 Room / Member / Place / Preference / Constraint 上下文；后端再执行确定性校验、评分并持久化 `PlanVariant` 的完整日程、路线、分数、校验结果和模型信息。Hackathon Demo 中，`POST /plans/generate` 会优先复用已持久化、`modelName=deepseek` 且校验通过的候选方案，避免现场反复等待模型或触发 Vercel 函数超时；没有可复用方案时才实时调用 DeepSeek。AI Revision 通过 `POST /api/trips/:tripId/plans/:planId/revise` 创建新的 PlanVersion，并把原方案标记为 `superseded`；已有可复用 DeepSeek Revision 时同样优先快速返回。

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
npm run seed:demo
```

`postinstall` 会执行 `prisma generate`，保证 Vercel / clean install 后 Prisma Client 与 schema 同步。`db:seed` 会保证 Fresh Demo 和 Quick Demo 都存在；`seed:demo` 会先清理这两个固定 Demo Room，再按 seed facts 和确定性派生结果重建，并输出 `clearing trip / creating trip / creating members / creating places / creating evidence / deriving signals / generating member profiles / generating room profiles` 等进度日志。`db:migrate` 需要可用的 PostgreSQL 和 `DATABASE_URL`。当前没有数据库时，`/demo` 仍会回落到 seed/localStorage 状态运行；但真实偏好链、Profile 持久化、确定性 reset 和数据库端到端测试需要 PostgreSQL。
