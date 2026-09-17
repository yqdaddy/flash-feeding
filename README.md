# 闪电喂养

一个为多胞胎家庭设计的婴儿喂养记录 Web 应用。核心亮点：**多胞胎支持**，3 秒完成一次记录。

## 功能特性

- **闪电记录**：3 个超大按钮，3 秒完成喂奶/换尿布/睡觉记录
- **多胞胎支持**：独立管理每个宝宝的档案，支持同步记录模式
- **智能建议**：基于月龄的奶量推荐区间，温和提醒
- **双宝对比**：并排对比今日奶量和 7 天趋势
- **游客模式**：无需登录即可使用，数据保存在本地
- **云端同步**：登录后数据自动同步到 Supabase

## 技术栈

- React 18 + Vite + TypeScript
- Tailwind CSS
- Zustand (状态管理)
- React Router (HashRouter)
- Supabase (云端数据库与认证)

## 本地运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 环境配置

复制 `.env.example` 为 `.env` 并填入 Supabase 配置：

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

未配置时应用会以游客模式运行，所有数据保存在浏览器本地存储。

## 部署到 GitHub Pages

1. 在 GitHub 仓库设置中启用 Pages，选择 Source: GitHub Actions
2. 推送代码到 main 分支
3. 工作流会自动构建并部署

## 截图

*(待补充)*

![首页](docs/screenshots/home.png)
![对比页](docs/screenshots/compare.png)

## 数据结构

| 表名 | 字段 |
|---|---|
| Baby | id, user_id, name, gender, birth_date, avatar, color, created_at |
| Feeding | id, user_id, baby_id, type, amount_ml, fed_at, created_at |
| Diaper | id, user_id, baby_id, type, changed_at, created_at |
| Sleep | id, user_id, baby_id, start_time, end_time, duration_min, created_at |

## 免责声明

本应用提供的喂养建议仅供参考，不替代专业医嘱。如有疑问，请咨询儿科医生。

## 许可证

MIT