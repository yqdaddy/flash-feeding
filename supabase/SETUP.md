# Supabase 部署指南

面向：部署者/评审人。预计 10 分钟完成。

## 0. 架构一览

```
┌─────────────────────────────────────────────────────┐
│  React + Vite（GitHub Pages）                        │
│     │ supabase-js (anon key)                        │
│     ▼                                               │
│  Supabase 免费层                                     │
│    ├─ Auth：Email 登录（用户名 → 伪邮箱映射）         │
│    ├─ PostgreSQL：4 张表 + RLS 行级安全              │
│    └─ REST API (PostgREST)                          │
└─────────────────────────────────────────────────────┘
```

**安全模型**：
- `anon key` 暴露在前端是官方设计（类似 Firebase 公钥）
- 所有数据安全由数据库 RLS 策略保证——每个登录用户只能读写自己的 `user_id` 数据
- `service_role key` 拥有完全权限，**绝不能**放入前端代码

## 1. 创建 Supabase 项目

1. 访问 https://supabase.com 注册/登录（可用 GitHub 账号一键登录）
2. 点击 **New project** → 填写：
   - Name：`feeding-tracker`（或任意名称）
   - Database Password：设置强密码（记住，后续连接数据库用）
   - Region：`Southeast Asia (Singapore)` 离中国最近
3. 等待 1~2 分钟初始化完成

## 2. 执行数据库迁移

1. 左侧菜单 **SQL Editor** → **New query**
2. 打开本地文件 `supabase/migrations/001_init.sql`，全选复制粘贴到编辑器
3. 点击 **Run**（或按 `Ctrl/Cmd + Enter`）
4. 验证：
   - 左侧 **Table Editor** 出现 4 张表：`babies` / `feedings` / `diapers` / `sleeps`
   - 再点击 Run 一次，应无报错（幂等设计）
5. 确认 RLS：
   - 进入 Authentication → Policies，每张表应显示 "Row Level Security is enabled"

## 3. 认证设置（关键步骤，别漏）

**必须关闭邮箱验证**，否则伪邮箱方案无法登录：

1. 左侧 **Authentication** → **Providers**
2. 找到 **Email** provider → 展开配置
3. **Confirm email** 开关设为 **OFF**

> 为什么必须关闭：用户注册时 Supabase 会向伪邮箱（`username@users.feeding.local`）发送验证邮件，但 `.local` 域名不会真实投递，用户永远收不到验证邮件，账号将处于"未验证"状态无法登录。

## 4. 获取密钥并配置前端

1. 左侧 **Project Settings**（齿轮图标）→ **API**
2. 复制两项：
   - **Project URL** → 对应 `VITE_SUPABASE_URL`
   - **anon public** key → 对应 `VITE_SUPABASE_ANON_KEY`
3. 在前端项目根目录：
   ```bash
   cp .env.example .env
   # 编辑 .env，填入真实值
   ```

## 5. GitHub Pages 部署说明

前端仓库需配置：

### 5.1 环境变量注入

在 GitHub 仓库 **Settings** → **Secrets and variables** → **Actions** 添加：
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 5.2 部署 Workflow 示例

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 5.3 vite.config.ts 设置

```typescript
export default defineConfig({
  base: '/仓库名/', // 替换为实际仓库名
  // ...
});
```

## 6. 免费层 Keep-Alive（防止项目被暂停）

Supabase 免费层项目 **7 天无 API 活动会被暂停**。暂停后：
- 数据保留，但 API 返回 5xx 或项目不可达
- 需手动在 Dashboard 点击 "Restore project" 恢复

### 自动 Ping 方案

在前端仓库添加定时任务：

```yaml
# .github/workflows/supabase-keepalive.yml
name: Supabase Keep-Alive
on:
  schedule:
    - cron: '30 0 * * *'  # 每天 UTC 00:30（北京时间 08:30）
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST API
        run: |
          HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
            "${{ secrets.VITE_SUPABASE_URL }}/rest/v1/" \
            -H "apikey: ${{ secrets.VITE_SUPABASE_ANON_KEY }}")
          echo "HTTP status: $HTTP_CODE"
          if [ "$HTTP_CODE" != "200" ]; then
            echo "::warning::Supabase may be paused. Check dashboard."
            exit 1
          fi
```

> 说明：`GET /rest/v1/` 是极轻量请求，不消耗额度。配置后若 Actions 报警，登录 Supabase Dashboard 手动恢复即可。

## 7. 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 注册报 "User already registered" | 用户名已被占用 | 换个用户名 |
| 注册成功但登录报 "Email not confirmed" | Confirm email 没关 | 回到第 3 步关闭 |
| 登录报 "Invalid login credentials" | 用户名或密码错误 | 检查输入 |
| 表里看不到其他用户数据 | RLS 正常生效 | 预期行为 |
| 项目突然无法访问 | 7 天未活动被暂停 | Dashboard 点 Restore，或配置 keep-alive |

## 8. 免费层额度参考（截至 2026）

| 资源 | 免费额度 |
|------|----------|
| 数据库 | 500 MB |
| 文件存储 | 1 GB |
| 月活用户 | 50,000 |
| 带宽 | 5 GB / 月 |
| 项目数 | 2 个活跃项目 |

> 数据来源：https://supabase.com/pricing — 以官网最新为准