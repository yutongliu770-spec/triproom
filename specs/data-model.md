# TripRoom Data Model

本文档解释 TripRoom 偏好系统的数据为什么存在、六张核心表分别承担什么语义、哪些数据是 Source of Truth、哪些数据是 Derived Data、AI Processing Lifecycle 如何触发，以及 Travel Planning Agent 如何读取这些数据。

本文档不是工程 Schema 的替代品：

- 实际数据库实现继续使用当前项目已确定的 PostgreSQL + Prisma。
- `prisma/schema.prisma` 是工程层面的数据库 Schema。
- `prisma/migrations/` 是具体数据库迁移历史。
- 本文档解释产品语义、数据关系和 Agent 读取契约。

当数据库结构发生语义级变化时，需要同步更新本文档。只加索引、调整字段类型、优化性能这类纯工程变化，不一定需要更新本文档。

## 1. 数据为什么存在

TripRoom 在 Explore / Group Chat / Planning 中会持续产生用户真实旅行偏好：

- 聊天；
- Reaction；
- 地点评论；
- 语音观点；
- 搜索；
- 外部链接 / 小红书 / 抖音素材；
- 对某个地点想去、不想去、想了解、必去、有顾虑等表达；
- 对候选方案的反馈。

这些数据不只是为了前端展示。它们的最终目标是持续沉淀用户和团队的真实旅行偏好，并作为 Travel Planning Agent 生成路线、校验路线和计算成员满意度的输入。

核心偏好链先理解为六张表：

```text
Evidence
  -> Signal
  -> Constraint
  -> MemberPlaceProfile
  -> RoomPlaceProfile
  -> PlanningContextSnapshot
```

`Place / Member / Room / Material / Plan` 是产品本身的业务数据，不算偏好系统的六张核心表。它们提供地点、成员、房间、素材和方案对象；偏好系统通过 Evidence 引用这些业务对象，再把它们转成规划可读的数据。

设计目标：

- 原始事实完整保留，不能被 AI 摘要替代；
- AI 语义判断必须能追溯到原始 Evidence；
- Profile 必须包含分数、自然语言总结、喜欢原因、顾虑、条件和来源引用；
- Planning Agent 读取稳定 Snapshot，不直接依赖持续变化的实时数据库状态；
- PlanValidator 可以直接读取 Constraint，避免团队平均分掩盖成员硬约束。

## 2. Evidence

回答：

```text
用户到底做过什么、说过什么？
```

Evidence 是统一证据索引层。它登记用户在 TripRoom 中发生过的原始表达和行为，但不复制一套完整 Source of Truth。

Evidence 应引用的业务对象：

- `ChatMessage`
- `Material`
- Reaction event
- `PlaceOpinion`
- Search event
- Plan feedback event
- 未来有意义的 open / dwell / dismiss / map focus 等行为事件

Source of Truth 属性：

- Evidence 是“某条原始事实已被登记为证据”的 Source of Truth。
- 原文、附件、URL、Reaction 具体内容仍由被引用的业务对象保存。
- `rawTextSnapshot` 只能是审计快照，不是 canonical 原文。
- AI 分析失败不能影响 Evidence 落库。

谁写：

- `EvidenceService`
- Chat / Reaction / Comment / Voice / Search / Material / Plan feedback 流程在写入原始业务数据后调用
- Backfill / rebuild job 可为历史业务数据补建 Evidence

谁读：

- `PreferenceAnalysisService`
- `PreferenceReducer`
- `RoomPlaceAggregator`
- `PlanningContextBuilder`
- `PlanValidator`
- debug / explanation 工具

MVP 最小实现：

- 不需要复杂事件总线。
- 可以先在后端 API handler 或 server action 中写入业务对象后同步写 Evidence。
- Evidence 写入成功后，再用轻量 async job / promise / queue adapter 触发分析。

## 3. Signal

回答：

```text
这条 Evidence 表达了什么偏好、意图、原因或条件？
```

Signal 是成员级语义信号层。当前项目已有 `MemberSignal`，后续应扩展它成为核心 `Signal`，不要新增一套高度重复的 `SemanticAssertion` 表。

示例：

```text
A：“镰仓海边和电车很好看，但专门跑一天有点不值。”
```

可生成多条 Signal：

- 喜欢海边：`aspect = sea`，`intent = want_to_go`，`polarity = positive`
- 喜欢电车体验：`aspect = train_experience`，`polarity = positive`
- 顾虑时间成本：`aspect = time_cost`，`intent = concern`
- 有条件兴趣：`intent = condition`，`conditionText = 不单独花一整天才可以`

Source of Truth 属性：

- Signal 是 Derived Data。
- Source of Truth 是 Evidence 及其引用的业务对象。
- 用户直接点击 Reaction 也应先登记 Evidence，再生成 Signal。
- Signal 可以重算，但不应覆盖或改写 Evidence。

谁写：

- Reaction service
- `PreferenceAnalysisService`
- Material extraction service
- Plan feedback parser
- Rebuild job

谁读：

- Explore recommender
- Comment Panel / Place Detail
- `PreferenceReducer`
- `RoomPlaceAggregator`
- `PlanningContextBuilder`
- Travel Planning Agent

MVP 最小实现：

- 先用规则 + MockModelProvider 提取 Signal。
- 后续接入真实模型时，只替换 ModelProvider，不重写业务层和数据库结构。

## 4. Constraint

回答：

```text
规划时必须尊重什么限制或强条件？
```

Constraint 保存预算、日期、出行能力、节奏、must-go、hard reject、路线条件等规划约束。它独立于 Signal，因为很多约束不属于单个地点，并且 PlanValidator 需要直接读取。

典型例子：

- 预算上限；
- 日期范围；
- 出行天数；
- 行走能力限制；
- 不想太赶；
- 饮食限制；
- 必去某地；
- 坚决不去某地；
- 不想为了镰仓单独花一天。

Source of Truth 属性：

- 从 Evidence / Signal 推断出的 Constraint 是 Derived Data。
- 用户在 onboarding / settings / planning form 中显式输入的 Constraint 可以视为 Source of Truth。
- 每条派生 Constraint 必须引用 Evidence 和/或 Signal。
- 显式用户约束不能被 AI 自动覆盖，只能由用户修改、废弃或确认。

谁写：

- Constraint extraction service
- Onboarding / settings / planning form
- Plan feedback parser
- System rule service

谁读：

- Travel Planning Agent
- PlanValidator
- PlanScorer
- `PlanningContextBuilder`
- Room summary UI

MVP 最小实现：

- 先覆盖 must-go、hard reject、预算、日期、节奏、路线条件这几类。
- 支持 `soft / strong / hard` severity。
- 先不做复杂冲突解决，只保留冲突并交给 Validator / Planning UI 解释。

## 5. MemberPlaceProfile

回答：

```text
当前这个成员怎么看这个地点？
```

MemberPlaceProfile 汇总一个成员对一个地点的 Evidence、Signal、Constraint 和 PlaceOpinion，让系统知道这个成员是否想去、为什么想去或不想去、有什么顾虑和条件。

示例：

```text
A x 镰仓

总体态度：有兴趣，但有条件
喜欢：
- 海边
- 电车氛围

顾虑：
- 不想专门花一整天

interestScore：0.72
evidence：ev_...
```

Source of Truth 属性：

- MemberPlaceProfile 是 Derived Data。
- 它必须可由 Evidence + Signal + Constraint + PlaceOpinion 重算。
- 它不能只有分数，还必须保留自然语言总结、喜欢原因、顾虑、条件和来源引用。

谁写：

- `PreferenceReducer`
- Backfill / rebuild job

谁读：

- Place Detail
- Comment Panel
- `RoomPlaceAggregator`
- `PlanningContextBuilder`
- Travel Planning Agent
- PlanScorer

MVP 最小实现：

- 每次只更新受影响的 `memberId + nodeId`。
- 不要每次扫描该成员全部历史数据。
- 先覆盖当前最新 Profile；未来如需要审计历史，再增加 profile history。

## 6. RoomPlaceProfile

回答：

```text
整个团队怎么看这个地点？
```

RoomPlaceProfile 聚合所有成员对某个地点的画像和约束，供 Explore、Discovered、Map 和 Planning 使用。

示例：

```text
镰仓

团队兴趣：0.82
讨论热度：0.76
分歧程度：0.18

A：有条件喜欢
B：强烈喜欢
C：一般
D：未知

共同正向原因：
- 海边
- 电车
- 氛围

主要顾虑：
- 时间成本
```

Source of Truth 属性：

- RoomPlaceProfile 是 Derived Data。
- 它必须可由 MemberPlaceProfile + Evidence + Signal + Constraint + PlaceOpinion 重算。
- 它不能只保存团队平均分，否则会丢失成员级硬约束和分歧。

谁写：

- `RoomPlaceAggregator`
- Backfill / rebuild job

谁读：

- Explore ranking
- Discovered Workspace
- Exploration Map
- `PlanningContextBuilder`
- Travel Planning Agent
- PlanScorer

MVP 最小实现：

- 任意 MemberPlaceProfile 变化后，只重算对应 Place 的 RoomPlaceProfile。
- 不全量刷新整个 Room。

## 7. PlanningContextSnapshot

回答：

```text
这一次 TravelPlanningAgent 实际看到了哪些输入？
```

PlanningContextSnapshot 保存某次 TravelPlanningAgent 生成或修订方案前实际使用的数据快照。用户后续继续聊天、偏好改变，也不影响解释当时方案为什么那样生成。

Source of Truth 属性：

- 它是“某次 Agent 调用输入”的 Source of Truth。
- 它不是偏好本身的 Source of Truth。
- 偏好事实仍来自 Evidence 引用的原始业务数据。

谁写：

- `PlanningContextBuilder`，在调用 TravelPlanningAgent 前立即写入。

谁读：

- Travel Planning Agent
- PlanVariant writer
- PlanValidator
- PlanScorer
- 方案解释 UI
- debug / admin 工具

MVP 最小实现：

- 用户真正点击“生成方案”或“更新方案”时创建。
- Agent 使用固定 Snapshot，不直接读取分析过程中持续变化的实时数据库状态。

## 8. 各表字段

本节是未来落地 PostgreSQL + Prisma 的字段级建议，不代表本轮已经实现。

### Evidence 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip / Room |
| `memberId` | `String?` | 产生证据的成员，系统事件可为空 |
| `targetType` | enum/string | `trip` / `node` / `material` / `plan` / `search` |
| `targetId` | `String?` | 目标对象 id |
| `evidenceType` | enum/string | `chat_message` / `place_comment` / `voice_comment` / `reaction` / `search` / `material` / `upload` / `plan_feedback` / `system_event` |
| `sourceEntityType` | enum/string | 原始业务对象类型 |
| `sourceEntityId` | `String?` | 原始业务对象 id |
| `sourceMessageId` | `String?` | 来源聊天消息 |
| `sourceMaterialId` | `String?` | 来源素材 |
| `sourcePlaceOpinionId` | `String?` | 来源地点观点 |
| `rawTextSnapshot` | `String? @db.Text` | 可选短原文快照，仅用于审计展示 |
| `rawPayload` | `Json?` | 原始行为 payload |
| `metadata` | `Json?` | 结构化补充信息 |
| `analysisStatus` | enum/string | `pending` / `processing` / `completed` / `failed` |
| `analysisError` | `String? @db.Text` | 最近一次分析失败原因 |
| `visibility` | enum/string | `group` / `ai_only` 等 |
| `occurredAt` | `DateTime` | 用户行为实际发生时间 |
| `createdAt` | `DateTime` | 入库时间 |
| `updatedAt` | `DateTime` | 更新时间 |
| `deletedAt` | `DateTime?` | 软删除标记 |

### Signal 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip |
| `memberId` | `String` | 信号所属成员 |
| `evidenceId` | `String?` | 来源 Evidence |
| `targetType` | enum/string | `trip` / `node` / `material` / `plan` / `search` |
| `targetId` | `String` | 目标对象 id |
| `signalType` | enum/string | `preference` / `concern` / `intent` / `constraint_candidate` / `feedback` |
| `polarity` | int/enum | 负向 / 中立 / 正向 |
| `intensity` | int/float | 强度 |
| `confidence` | `Float` | 提取置信度 |
| `reason` | `String? @db.Text` | 自然语言原因 |
| `aspect` | enum/string? | `sea` / `food` / `temple` / `shopping` / `mobility` / `budget` / `time_cost` 等 |
| `intent` | enum/string? | `want_to_go` / `avoid` / `learn_more` / `must_go` / `hard_reject` / `condition` / `concern` |
| `conditionText` | `String? @db.Text` | 条件性偏好说明 |
| `constraintCandidate` | `Boolean` | 是否可能生成 Constraint |
| `extractedAttributes` | `Json?` | 结构化提取结果 |
| `sourceMessageId` | `String?` | 来源消息 |
| `sourceMaterialId` | `String?` | 来源素材 |
| `sourcePlaceOpinionId` | `String?` | 来源观点 |
| `visibility` | enum/string | 可见性 |
| `scope` | enum/string | 成员 / 房间 / 规划范围 |
| `createdBy` | enum/string | `user_action` / `rule` / `ai` |
| `modelName` | `String?` | AI 提取模型 |
| `modelVersion` | `String?` | 模型版本 |
| `extractionRunId` | `String?` | 提取批次 |
| `invalidatedAt` | `DateTime?` | 失效时间 |
| `createdAt` | `DateTime` | 创建时间 |

### Constraint 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip |
| `memberId` | `String?` | 成员级约束；团队约束可为空 |
| `targetType` | enum/string? | `trip` / `node` / `material` / `plan` |
| `targetId` | `String?` | 目标对象 id |
| `sourceKind` | enum/string | `explicit_user_input` / `derived_from_evidence` / `derived_from_signal` / `system_rule` |
| `constraintType` | enum/string | `budget` / `date` / `duration` / `mobility` / `pace` / `food` / `must_go` / `hard_reject` / `route_condition` / `lodging` / `other` |
| `severity` | enum/string | `soft` / `strong` / `hard` |
| `polarity` | int/enum? | 正向必须包含、负向必须排除或中性限制 |
| `priorityScore` | `Float?` | 重要程度 |
| `confidence` | `Float?` | 派生约束置信度；显式输入可为 1 |
| `summary` | `String @db.Text` | 自然语言约束说明 |
| `conditionText` | `String? @db.Text` | 条件说明 |
| `structuredValue` | `Json?` | 金额、币种、日期、最长移动时间、最大步行量等 |
| `evidenceIds` | `Json?` | 来源 Evidence 列表 |
| `signalIds` | `Json?` | 来源 Signal 列表 |
| `status` | enum/string | `active` / `superseded` / `rejected` / `resolved` / `invalidated` |
| `modelName` | `String?` | AI 派生模型 |
| `modelVersion` | `String?` | 模型版本 |
| `createdAt` | `DateTime` | 创建时间 |
| `updatedAt` | `DateTime` | 更新时间 |
| `invalidatedAt` | `DateTime?` | 失效时间 |

### MemberPlaceProfile 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip |
| `memberId` | `String` | 成员 |
| `nodeId` | `String` | 地点，引用 `DestinationNode.id` |
| `interestScore` | `Float` | 综合兴趣分 |
| `positiveScore` | `Float?` | 正向信号强度 |
| `negativeScore` | `Float?` | 负向信号强度 |
| `confidenceScore` | `Float` | 聚合置信度 |
| `stance` | enum/string | `strong_like` / `like` / `conditional` / `neutral` / `concerned` / `avoid` / `unknown` |
| `summary` | `String @db.Text` | 成员对该地点的自然语言总结 |
| `positiveReasons` | `Json` | 喜欢原因列表 |
| `negativeReasons` | `Json` | 顾虑 / 不喜欢原因列表 |
| `conditionText` | `String? @db.Text` | 条件性偏好说明 |
| `constraintSummary` | `String? @db.Text` | 相关约束摘要 |
| `mustGo` | `Boolean` | 是否为该成员 must-go |
| `hardReject` | `Boolean` | 是否为该成员 hard reject |
| `evidenceCount` | `Int` | 参与聚合的 Evidence 数 |
| `signalCount` | `Int` | 参与聚合的 Signal 数 |
| `constraintIds` | `Json?` | 关键 Constraint ID |
| `topSignalIds` | `Json` | 关键 Signal ID |
| `sourceEvidenceIds` | `Json` | 关键 Evidence ID |
| `lastSignalAt` | `DateTime?` | 最近信号时间 |
| `aggregationVersion` | `String` | 聚合逻辑版本 |
| `lastCalculatedAt` | `DateTime` | 最近计算时间 |
| `staleAt` | `DateTime?` | 上游变化后标记过期 |
| `createdAt` | `DateTime` | 创建时间 |
| `updatedAt` | `DateTime` | 更新时间 |

### RoomPlaceProfile 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip |
| `nodeId` | `String` | 地点，引用 `DestinationNode.id` |
| `teamInterestScore` | `Float` | 团队综合兴趣 |
| `engagementScore` | `Float` | 讨论热度 |
| `disagreementScore` | `Float` | 分歧程度 |
| `memberStances` | `Json` | 每个成员的 stance 摘要 |
| `summary` | `String @db.Text` | 团队对该地点的自然语言总结 |
| `commonPositiveReasons` | `Json` | 共同正向原因 |
| `mainConcerns` | `Json` | 主要顾虑 |
| `conditionalFitNotes` | `Json?` | 条件性适配说明 |
| `unresolvedQuestions` | `Json?` | 待确认问题 |
| `mustGoMemberIds` | `Json?` | must-go 成员列表 |
| `hardRejectMemberIds` | `Json?` | hard reject 成员列表 |
| `memberProfileIds` | `Json` | 参与聚合的 MemberPlaceProfile ID |
| `sourceEvidenceIds` | `Json` | 关键 Evidence ID |
| `topSignalIds` | `Json` | 关键 Signal ID |
| `constraintIds` | `Json?` | 关键 Constraint ID |
| `aggregationVersion` | `String` | 聚合逻辑版本 |
| `lastCalculatedAt` | `DateTime` | 最近计算时间 |
| `staleAt` | `DateTime?` | 上游变化后标记过期 |
| `createdAt` | `DateTime` | 创建时间 |
| `updatedAt` | `DateTime` | 更新时间 |

### PlanningContextSnapshot 字段

| 字段 | 类型建议 | 说明 |
| --- | --- | --- |
| `id` | `String @id` | 主键 |
| `tripId` | `String` | 所属 Trip |
| `createdByMemberId` | `String?` | 触发规划的成员 |
| `triggerType` | enum/string | `manual_generate` / `auto_offer` / `plan_revision` / `validation_only` |
| `tripSnapshot` | `Json` | Trip 基础条件快照 |
| `membersSnapshot` | `Json` | 成员快照 |
| `destinationNodesSnapshot` | `Json` | 参与规划的地点快照 |
| `destinationRelationsSnapshot` | `Json` | 参与规划的地点关系快照 |
| `roomPlaceProfilesSnapshot` | `Json` | RoomPlaceProfile 快照 |
| `memberPlaceProfilesSnapshot` | `Json` | MemberPlaceProfile 快照 |
| `constraintsSnapshot` | `Json` | Constraint 快照 |
| `keyEvidenceRefs` | `Json` | 关键 Evidence 引用 |
| `keySignalRefs` | `Json` | 关键 Signal 引用 |
| `providerContextSnapshot` | `Json?` | 路线、预算、天气、交通等 Provider 上下文 |
| `modelName` | `String?` | Planner 模型 |
| `modelVersion` | `String?` | Planner 模型版本 |
| `createdAt` | `DateTime` | 创建时间 |

## 9. 表之间关系

核心关系：

```text
Trip
  -> Evidence
  -> Signal
  -> Constraint
  -> MemberPlaceProfile
  -> RoomPlaceProfile
  -> PlanningContextSnapshot
  -> PlanVariant
```

业务对象关系：

- `Evidence.tripId -> Trip.id`
- `Evidence.memberId -> Member.id`
- `Evidence.targetId -> DestinationNode.id / Material.id / PlanVariant.id / SearchEvent.id`
- `Evidence.sourceMessageId -> ChatMessage.id`
- `Evidence.sourceMaterialId -> Material.id`
- `Evidence.sourcePlaceOpinionId -> PlaceOpinion.id`

偏好链关系：

- `Signal.evidenceId -> Evidence.id`
- `Constraint.evidenceIds -> Evidence.id[]`
- `Constraint.signalIds -> Signal.id[]`
- `MemberPlaceProfile.sourceEvidenceIds -> Evidence.id[]`
- `MemberPlaceProfile.topSignalIds -> Signal.id[]`
- `MemberPlaceProfile.constraintIds -> Constraint.id[]`
- `RoomPlaceProfile.memberProfileIds -> MemberPlaceProfile.id[]`
- `RoomPlaceProfile.sourceEvidenceIds -> Evidence.id[]`
- `RoomPlaceProfile.topSignalIds -> Signal.id[]`
- `RoomPlaceProfile.constraintIds -> Constraint.id[]`
- `PlanningContextSnapshot.keyEvidenceRefs -> Evidence.id[]`
- `PlanningContextSnapshot.keySignalRefs -> Signal.id[]`

唯一性建议：

- `MemberPlaceProfile`: unique by `tripId + memberId + nodeId`
- `RoomPlaceProfile`: unique by `tripId + nodeId`
- active `Constraint`: 可以允许同类型多条共存，因为成员表达可能冲突；不要过早强行合并。

工程取舍：

- `evidenceIds`、`signalIds`、`memberProfileIds` 第一版可以用 JSONB 数组，简化迁移。
- 如果后续需要复杂查询和强一致引用，再拆 join table。

## 10. Source of Truth / Derived Data

Source of Truth：

- `Trip`
- `Member` / `TripMember`
- `DestinationNode` / `DestinationRelation`
- `ChatMessage`
- `Material`
- Reaction event
- 用户直接写入的 `PlaceOpinion`
- `Evidence`

Derived Data：

- `Signal`
- 从 Evidence / Signal 推断出的 `Constraint`
- `MemberPlaceProfile`
- `RoomPlaceProfile`
- `PlanningContextSnapshot`
- `RoomNodeState`
- `MemberPlaceState`
- `MemberExploreState`
- `PlanEvaluation`
- `MemberPlanEvaluation`

混合情况：

- 用户显式填写的 Constraint 是 Source of Truth。
- AI 从聊天、评论或素材中推断出的 Constraint 是 Derived Data。
- 从 ChatMessage 抽取出来的 PlaceOpinion 是派生索引，必须引用原始消息。
- 用户在地点卡直接写下的 PlaceOpinion 是原始事实。

基本规则：

- Source of Truth 优先落库。
- Derived Data 可以失败、延迟、重算或失效。
- AI 失败不影响原始 Evidence。
- 派生数据必须保存来源引用。

## 11. 数据计算逻辑

日常计算以事件触发的增量更新为主，不采用固定时间统一分析作为主流程。

### Evidence 计算

Evidence 不做复杂计算。它在用户行为发生时立即写入，并记录：

- 谁产生；
- 何时产生；
- 面向什么对象；
- 来源业务对象是什么；
- 是否需要后续 AI 分析。

### Signal 计算

Signal 来自 Evidence 分析。

输入：

- Evidence；
- 被 Evidence 引用的原始业务对象；
- 相关 DestinationNode；
- 当前 Trip / Member 上下文。

输出：

- aspect；
- intent；
- polarity；
- intensity；
- confidence；
- reason；
- conditionText；
- constraintCandidate。

MVP 计算方式：

- 显式 Reaction 用规则直接转 Signal。
- 自然语言先用 MockModelProvider / rule-based parser。
- 未来接 RealModelProvider。

### Constraint 计算

Constraint 来自：

- 显式用户输入；
- Signal 中的 `constraintCandidate`；
- 对 Evidence 的规则或模型分析；
- Plan feedback。

计算规则：

- `must_go`、`hard_reject`、预算、日期、出行能力、路线条件优先提取。
- `hard` Constraint 进入 Validator。
- `soft` Constraint 进入 Planner / Scorer。
- 冲突不静默删除，保留给 Validator 或 UI 解释。

### MemberPlaceProfile 计算

触发：

- 某个 `memberId + nodeId` 出现新 Signal；
- 相关 Constraint 更新；
- 相关 PlaceOpinion 更新；
- 相关 Evidence 失效或重新分析。

聚合输入：

- 该成员对该地点的 active Signal；
- 相关 Constraint；
- 相关 PlaceOpinion；
- 关键 Evidence。

输出：

- interestScore；
- stance；
- positiveReasons；
- negativeReasons；
- conditionText；
- mustGo；
- hardReject；
- summary；
- 来源引用。

### RoomPlaceProfile 计算

触发：

- 任意 MemberPlaceProfile 发生变化；
- 相关 Constraint 变化；
- 成员加入或退出；
- 聚合逻辑升级。

聚合输入：

- 同一 `tripId + nodeId` 下所有 MemberPlaceProfile；
- active Constraint；
- 关键 Signal / Evidence。

输出：

- teamInterestScore；
- engagementScore；
- disagreementScore；
- memberStances；
- commonPositiveReasons；
- mainConcerns；
- unresolvedQuestions；
- mustGo / hardReject 成员列表。

### PlanningContextSnapshot 计算

触发：

- 用户点击生成方案；
- 用户点击更新方案；
- 系统明确进入 plan revision；
- validation-only 流程。

计算输入：

- Trip；
- Members；
- DestinationNode / DestinationRelation；
- RoomPlaceProfile；
- 重要 MemberPlaceProfile；
- active Constraint；
- 关键 Evidence / Signal；
- TravelProvider 上下文。

输出：

- 一份冻结的规划输入快照。

## 12. AI Processing Lifecycle

本章定义什么时候触发 AI 分析、什么数据立即写、什么数据异步计算、Profile 什么时候更新、什么情况下全量重算。

### 12.1 总体链路

```text
用户产生新信息
Chat / Reaction / 评论 / Voice / Search / Material
        ↓
Evidence 立即落库
        ↓
触发 AI Analysis Job
        ↓
ModelProvider 分析
        ↓
生成 / 更新 Signal
        ↓
更新 MemberPlaceProfile
        ↓
更新 RoomPlaceProfile
        ↓
后续供 PlanningContextBuilder 使用
```

原则：

```text
原始 Evidence 先保存，AI 分析失败不能影响原始数据落库。
```

### 12.2 不采用固定时间统一分析为主流程

MVP 主要采用：

```text
Event-driven incremental processing / 事件触发的增量计算
```

不是每隔固定时间重新分析全部数据。

例如用户发送：

```text
镰仓海边很好看，但专门跑一天不值。
```

流程：

1. Evidence 立即保存。
2. 异步触发 `analyzeEvidence()`。
3. 生成对应 Signal。
4. 更新该 Member x Place 的 `MemberPlaceProfile`。
5. 更新该 Place 的 `RoomPlaceProfile`。

### 12.3 不同数据的更新时间

Evidence：

- 用户行为发生时立即写入。
- 包括发消息、Reaction、评论、分享链接、语音转写完成、上传素材、方案反馈。

Signal：

- 新 Evidence 写入后异步分析生成。
- 可以做短时间 debounce / batch，例如几秒内连续多条 Evidence 合并处理，避免频繁调用模型。

Constraint：

- 显式用户输入时立即写入。
- 从 Evidence / Signal 派生的 Constraint 在分析完成后写入。
- Constraint 状态变化应触发相关 Profile 更新。

MemberPlaceProfile：

- 该 Member x Place 出现新 Signal 后增量更新。
- 不要每次扫描该成员全部历史数据。

RoomPlaceProfile：

- 任意 MemberPlaceProfile 发生变化后重新聚合对应 Place。
- 只更新受影响 Place，不全量刷新整个 Room。

PlanningContextSnapshot：

- 用户真正触发“生成 / 更新旅行方案”时创建。
- Travel Planning Agent 使用固定 Snapshot，不直接依赖分析过程中持续变化的实时数据库状态。

### 12.4 什么时候需要全量重算

正常运行以增量更新为主。

只有以下场景才执行 full rebuild / recompute：

- Preference Prompt / Extraction Logic 升级；
- Signal 计算逻辑改变；
- Profile 聚合公式改变；
- 历史数据修复；
- Model version 升级后需要重新分析旧 Evidence；
- 管理员主动执行 rebuild。

因此需要支持：

```text
rebuildSignals()
rebuildMemberPlaceProfiles()
rebuildRoomPlaceProfiles()
```

这些不是日常主流程。

### 12.5 当前不是聚类任务

MVP 主要是：

```text
Semantic Extraction + Aggregation
```

不是复杂无监督 clustering。

例如：

```text
用户原话
↓
提取：
喜欢海边
喜欢电车
顾虑时间成本
↓
聚合成 MemberPlaceProfile
```

暂时不要为了自由文本分析引入复杂聚类系统。未来数据量足够大时再考虑自动主题聚类。

### 12.6 ModelProvider abstraction

不要让业务代码直接绑定某一家模型 SDK。

统一设计：

```text
ModelProvider
```

至少预留：

```text
analyzeEvidence()
summarizeMemberPlace()
summarizeRoomPlace()
```

当前可以使用：

```text
MockModelProvider
```

未来接入真实模型时替换成：

```text
RealModelProvider
```

例如 OpenAI / Anthropic / 其他模型。业务层和数据库结构不应因此重写。

### 12.7 API Key / 安全

真实模型接入后：

- API Key 只能放后端；
- 使用环境变量；
- 不允许暴露到浏览器；
- 不允许写进 Git。

例如：

```text
MODEL_API_KEY=
MODEL_PROVIDER=
MODEL_NAME=
```

前端只能调用自己的 Backend API。

### 12.8 建议的 Backend AI Service

可以按照当前项目结构设计类似：

```text
EvidenceService
保存 Evidence

PreferenceAnalysisService
调用 ModelProvider 分析 Evidence

PreferenceReducer
更新 MemberPlaceProfile

RoomPlaceAggregator
更新 RoomPlaceProfile

PlanningContextBuilder
生成 PlanningContextSnapshot
```

不要让 React Component 直接调用模型完成偏好分析。

MVP 最小实现方案：

- 不先实现复杂 Job Queue / Worker 系统。
- 先用后端 service 函数表达清楚边界。
- Evidence 落库后，可以用同步触发 + 可 retry 的 analysis status 模拟异步处理。
- 后续再替换成真正队列，不改变表语义。

### 12.9 失败处理

AI 分析属于派生过程，所以：

```text
Evidence 保存成功
+
AI 分析失败
```

不能导致用户原始信息丢失。

建议保留分析状态：

```text
pending
processing
completed
failed
```

失败后支持 retry。Evidence 仍然是 Source of Truth。

### 12.10 最终原则

```text
Database
负责保存事实

Backend AI Pipeline
负责决定什么时候分析

ModelProvider
负责理解自然语言

Profile Reducer / Aggregator
负责生成可用的用户与地点画像

PlanningContextBuilder
负责整理 Planner 输入

TravelPlanningAgent
负责使用这些信息规划
```

## 13. Planning Agent 怎么读取

Travel Planning Agent 不直接从零扫描所有聊天和素材。它应该读取 PlanningContextSnapshot。

生成方案前的读取顺序：

1. `PlanningContextBuilder` 读取业务基础数据：
   - Trip；
   - Members；
   - DestinationNode；
   - DestinationRelation；
   - 必要的 Material / PlaceOpinion 引用。
2. 读取偏好系统数据：
   - RoomPlaceProfile；
   - 重要 MemberPlaceProfile；
   - active Constraint；
   - 关键 Evidence；
   - 关键 Signal。
3. 读取 TravelProvider 上下文：
   - 路线；
   - 时间；
   - 预算；
   - 真实旅行知识；
   - 后续可能包括天气、酒店、航班等。
4. 写入 `PlanningContextSnapshot`。
5. Travel Planning Agent 基于 Snapshot 生成 `PlanVariant`。
6. PlanValidator / PlanScorer 基于同一 Snapshot 校验和评分。

Planner 必须看到：

- 团队整体兴趣；
- 每个成员对重点地点的态度；
- must-go 和 hard reject；
- 条件性偏好；
- 主要顾虑；
- 关键 Evidence 原文引用；
- 地点图谱和路线可行性。

Planner 不应该：

- 只按 `teamInterestScore` 排序选地点；
- 只看平均分；
- 忽略成员级 hard constraint；
- 用 AI 摘要替代原始 Evidence；
- 在没有 Snapshot 的情况下直接读实时数据库生成方案。

方案生成后，Validator / Scorer 应读取：

- `PlanVariant`
- `PlanningContextSnapshot`
- `Constraint`
- `MemberPlaceProfile`
- `RoomPlaceProfile`
- 关键 `Evidence`
- TravelProvider 的路线、时间、预算和地理事实

评估结果应覆盖：

- 确定性指标：时间、预算、路线、地理合理性、硬约束；
- 自然语言要求满足度：例如“不想为了镰仓单独花一天”；
- 逐成员满意度：分别从每个成员角度解释满足了什么、牺牲了什么、违反了什么。
