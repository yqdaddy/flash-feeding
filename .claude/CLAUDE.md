# 闪电喂养记录器（Atoms Demo）

## 项目简介

婴儿喂养记录 Web 应用，核心亮点：
- 3 秒闪电记录（喂奶/换尿布/睡眠）
- 多胞胎支持（双宝同步记录）
- 长辈友好（大按钮大字体）
- 游客模式 + 登录云同步

## 技术栈

- 前端：React 18 + Vite + TypeScript + Tailwind CSS
- 状态：Zustand
- 后端：Supabase（PostgreSQL + Auth + RLS）
- 部署：GitHub Pages

## Agent 团队

| 角色 | Agent | 调用方式 |
|------|-------|----------|
| 产品经理 | 产品经理 | @dev-atoms-产品经理 |
| 前端开发者 | 前端开发者 | @dev-atoms-前端开发者 |
| 后端架构师 | 后端架构师 | @dev-atoms-后端架构师 |
| AI 工程师 | AI 工程师 | @dev-atoms-ai工程师 |
| UX 设计师 | UX 设计师 | @dev-atoms-ux设计师 |
| 现实检验者 | 现实检验者 | @dev-atoms-现实检验者 |

## 协调 Skill

使用 `/dev-atoms "任务描述"` 启动协调流程。

## 相关 Skill

- `/deploy-supabase` - Supabase 部署配置指南

## UI/UX 设计技能

本项目在做 UI 相关工作时必须使用以下技能：

| Skill | 作用 | 使用场景 |
|-------|------|----------|
| taste-skill | 反 AI 模式设计规范 | 所有 UI 开发 |
| ui-ux-pro-max | 专业 UI/UX 指南 | 设计系统、配色、字体、布局 |
| iconify-api-skill | 150k+ SVG 图标库 | 需要图标时优先使用 |

### 设计铁律

- ❌ 禁止 Inter 字体
- ❌ 禁止 AI 紫渐变
- ❌ 禁止手撸 SVG 图标（用 iconify-api-skill）
- ❌ 禁止 Em-dash（—）
- ❌ 禁止 Emoji 作为 UI 图标

### 使用方式

```bash
# 搜索图标
python3 ~/.claude/skills/iconify-api-skill/scripts/iconify_cli.py search "baby"

# 获取设计系统
python3 ~/.claude/templates/skills/ui-ux-pro-max/scripts/search.py "母婴 app 温暖" --design-system
```

## 开发规范

### 代码规范

- TypeScript 严格模式
- 函数组件 + Hooks
- Tailwind CSS 原子化

### 提交规范

- feat: 新功能
- fix: Bug 修复
- docs: 文档更新
- 中文提交信息

## 注意事项

1. 禁止添加 Co-authored-by
2. 长辈友好优先（大按钮大字体）
3. 多胞胎场景必须测试