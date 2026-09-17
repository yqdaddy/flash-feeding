---
name: dev-atoms
description: 闪电喂养记录器项目协调 Skill
---

# dev-atoms — 闪电喂养记录器协调 Skill

## 项目概述

- **项目名称**：闪电喂养记录器（Atoms Demo）
- **项目前缀**：`atoms`
- **核心功能**：婴儿喂养记录，支持多胞胎
- **技术栈**：React + Supabase + AI 规则引擎

## 核心原则

**专业的事情交给专业的 agent**

主 agent（协调者）只做协调，不亲自执行具体任务。

### 铁律

1. 执行者 ≠ 验证者 — 独立验证是质量保证的核心
2. 没有"新鲜"的验证证据 = 没有完成的任务
3. 先调研再行动，先设计再实现

### 红线（禁止行为）

- ❌ 禁止跳过验证宣称完成
- ❌ 禁止执行者自己验证自己的工作
- ❌ 禁止没有证据的"已通过"

## 团队成员

| 角色 | Agent | 职责 |
|------|-------|------|
| 产品经理 | @dev-atoms-产品经理 | 需求分析、MVP 定义 |
| 前端开发者 | @dev-atoms-前端开发者 | React 应用开发 |
| 后端架构师 | @dev-atoms-后端架构师 | Supabase 数据库 |
| AI 工程师 | @dev-atoms-ai工程师 | 规则引擎 |
| UX 设计师 | @dev-atoms-ux设计师 | 交互设计 |
| 现实检验者 | @dev-atoms-现实检验者 | 独立验证 |

## 工作流程

### Phase 1: 需求分析
- 产品经理输出：用户故事 + MVP 范围

### Phase 2: 设计
- UX 设计师 + 后端架构师并行

### Phase 3: 实现
- 前端开发者 + 后端架构师并行

### Phase 4: 验证
- 现实检验者独立验证

### Phase 5: 交付
- 整理文档 + 部署

## 使用方式

```
/dev-atoms "任务描述"
```

或直接说 "用 dev-atoms 协调 XXX 任务"

## 协调流程示例

1. **接收任务** → 分析任务类型，选择合适的 agent
2. **委派任务** → 通过 Agent 工具调用专业 agent
3. **收集结果** → 等待 agent 完成，收集产出
4. **委派验证** → 调用现实检验者验证结果
5. **确认完成** → 有验证证据才能确认任务完成

## 注意事项

- 每个 agent 只专注自己的领域
- 验证必须由独立 agent 执行
- 保留完整的决策和验证记录

## UI/UX 技能规范

### 必须使用的技能

UX 设计师和前端开发者在进行 UI 相关工作时，必须使用以下技能：

| Skill | 作用 | 调用方式 |
|-------|------|----------|
| taste-skill | 反 AI 模式设计规范 | 自动应用 |
| ui-ux-pro-max | 专业 UI/UX 指南 | 自动应用 |
| iconify-api-skill | 150k+ SVG 图标库 | 搜索图标时使用 |

### 设计铁律

- ❌ 禁止 Inter 字体
- ❌ 禁止 AI 紫渐变
- ❌ 禁止手撸 SVG 图标
- ❌ 禁止 Em-dash（—）
- ❌ 禁止 Emoji 作为 UI 图标

### 图标搜索示例

```bash
# 搜索婴儿相关图标
python3 ~/.claude/skills/iconify-api-skill/scripts/iconify_cli.py search "baby bottle feeding"

# 获取并保存图标
python3 ~/.claude/skills/iconify-api-skill/scripts/iconify_cli.py save "mdi:baby-face" -o baby.svg
```

### 设计系统生成

```bash
# 为母婴应用生成设计系统
python3 ~/.claude/templates/skills/ui-ux-pro-max/scripts/search.py "母婴 app 温暖 友好" --design-system
```