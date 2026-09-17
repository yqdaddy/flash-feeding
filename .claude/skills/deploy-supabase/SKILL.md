---
name: deploy-supabase
description: Supabase 部署配置 Skill，一键完成数据库迁移、认证配置和环境变量设置
---

# Supabase 部署 Skill

## 概述

为"闪电喂养记录器"项目配置 Supabase 后端服务。

## 前置条件

- [ ] 已注册 [Supabase 账号](https://supabase.com)
- [ ] 已安装 Node.js 18+

## 部署步骤

### Step 1: 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 **New Project**
3. 填写：
   - **Name**: `feeding-logger`（或任意名称）
   - **Database Password**: 自动生成或自定义（记下来！）
   - **Region**: 选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`（离中国最近）
4. 等待约 2 分钟项目初始化完成

### Step 2: 执行数据库迁移

1. 进入项目后，点击左侧 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase/migrations/001_init.sql` 的全部内容
4. 点击 **Run** 执行
5. 确认看到 "Success. No rows returned" 表示建表成功

**验证**：点击左侧 **Table Editor**，应看到 4 张表：`babies`、`feedings`、`diapers`、`sleeps`

### Step 3: 配置认证（关键！）

1. 点击左侧 **Authentication** → **Providers**
2. 找到 **Email**，确保：
   - ✅ **Enable Email provider** 已开启
   - ❌ **Confirm email** 关闭（否则伪邮箱收不到验证邮件无法登录！）
3. 点击 **Save**

### Step 4: 获取 API 密钥

1. 点击左侧 **Settings** → **API**
2. 复制两个值：
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

### Step 5: 配置前端环境变量

```bash
# 在项目根目录创建 .env 文件
cp .env.example .env

# 编辑 .env，填入上面复制的值
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6: 验证部署

```bash
# 本地运行
npm run dev

# 测试功能：
# 1. 打开 http://localhost:5173
# 2. 注册一个用户（任意用户名+密码）
# 3. 添加宝宝
# 4. 记录一次喂奶
# 5. 在 Supabase Table Editor 查看数据是否写入
```

## Keep-Alive 配置（防止免费层暂停）

Supabase 免费项目 7 天无活动会暂停。配置 GitHub Actions 定时 ping：

1. 创建 `.github/workflows/keepalive.yml`：

```yaml
name: Keep Supabase Active
on:
  schedule:
    - cron: '0 0 * * *'  # 每天 UTC 0点（北京时间 8点）
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -s -X GET "${{ secrets.SUPABASE_URL }}/rest/v1/" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

2. 在 GitHub 仓库 **Settings** → **Secrets and variables** → **Actions** 添加：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## 常见问题

### Q: 注册后登录失败？
**A**: 检查 Authentication → Providers → Email → **Confirm email** 是否已关闭

### Q: 数据写入失败？
**A**: 检查 RLS 是否正确配置。在 SQL Editor 运行：
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
所有表 `rowsecurity` 应为 `true`

### Q: 跨设备数据不同步？
**A**: 确保已登录账号。游客模式数据只存在本地 localStorage

## 检查清单

部署完成后确认：

- [ ] Supabase 项目已创建
- [ ] 4 张表已创建（babies, feedings, diapers, sleeps）
- [ ] RLS 已启用
- [ ] Email 认证已开启，Confirm email 已关闭
- [ ] .env 文件已配置
- [ ] 本地 `npm run dev` 可正常使用
- [ ] 注册/登录功能正常
- [ ] Keep-alive workflow 已配置（可选）

---

*本 Skill 由 HR 团队搭建工具生成*