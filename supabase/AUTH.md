# 认证设计方案：用户名 + 密码（伪邮箱映射）

## 背景

Supabase Auth 原生只支持 **email + 密码** 注册登录。产品需求要求"用户名 + 密码"。

本方案通过 **伪邮箱映射** 实现，无需自建认证服务，完全复用 Supabase Auth 的安全机制（密码哈希、会话管理、令牌刷新）。

## 方案原理

| 前端输入 | Supabase 存储 | 说明 |
|---------|--------------|------|
| username | → `username@users.feeding.local` | 伪邮箱（.local 域名不会真实投递） |
| password | → password | 原样传递 |

- **唯一性保证**：同 username → 同伪邮箱 → Supabase `auth.users.email` 唯一约束自动拒绝重复注册
- **用户名展示**：真实用户名存入 `user_metadata.username`，前端从 JWT 或 `getUser()` 读取展示
- **安全性**：完全依赖 Supabase Auth，数据库 RLS 以 `auth.uid()` 鉴权

## 用户名规范化（关键）

**必须**在转换伪邮箱前对用户名做规范化处理：

```typescript
const normalized = username.trim().toLowerCase();
```

否则 `"Zoe"` 与 `"zoe "` 会被当作两个不同账号。

### 前端校验规则（建议）

| 规则 | 原因 |
|------|------|
| 长度 3~20 字符 | 防止过短/过长 |
| 仅允许 `a-zA-Z0-9_` | Supabase 对 email 有格式校验；中文/空格/@ 可能被拒或引发歧义 |
| 禁止 `@` | 防止用户名本身包含邮箱域名部分 |

> 注意：用户名建议用英文/数字，中文字符在伪邮箱中可能通过，但不同 Supabase 版本对非 ASCII 的处理可能有差异，建议保守限制为 ASCII。

## 代码示例

### 伪邮箱转换函数（pseudoEmail.ts）

```typescript
/**
 * 把用户名转换为 Supabase 可用的伪邮箱
 * @param username 用户输入的用户名
 * @returns 伪邮箱地址
 */
export function toPseudoEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  return `${normalized}@users.feeding.local`;
}

/**
 * 从伪邮箱还原用户名（一般不需要，展示请用 user_metadata.username）
 */
export function fromPseudoEmail(pseudoEmail: string): string {
  return pseudoEmail.replace(/@users\.feeding\.local$/, '');
}

/**
 * 用户名前端校验
 * @returns null 表示合法，否则返回错误信息
 */
export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (u.length < 3 || u.length > 20) {
    return '用户名长度需在 3~20 个字符之间';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return '用户名只能包含英文字母、数字和下划线';
  }
  return null; // 合法
}
```

### 注册/登录调用

```typescript
import { supabase } from './supabaseClient';
import { toPseudoEmail, validateUsername } from './pseudoEmail';

// ---- 注册 ----
export async function signUpWithUsername(username: string, password: string) {
  const validationError = validateUsername(username);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase.auth.signUp({
    email: toPseudoEmail(username),
    password,
    options: {
      data: { username },  // 真实用户名写入 user_metadata
    },
  });

  if (error) {
    // Supabase 错误码映射
    if (error.message.includes('already registered')) {
      throw new Error('用户名已被占用');
    }
    throw error;
  }
  return data.user;
}

// ---- 登录 ----
export async function signInWithUsername(username: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toPseudoEmail(username),
    password,
  });
  if (error) {
    if (error.message.includes('Invalid login')) {
      throw new Error('用户名或密码错误');
    }
    throw error;
  }
  return data.session;
}

// ---- 获取当前用户名（展示用）----
export async function getCurrentUsername(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.user_metadata?.username ?? null;
}
```

## 已知取舍

| 方面 | 取舍 | 说明 |
|------|------|------|
| 找回密码 | **不可用** | 伪邮箱收不到邮件，无法通过邮件重置密码 |
| 密码强度 | 默认 6 位 | Supabase 默认最少 6 字符，可在控制台 Auth → Policies 调整 |
| 邮箱格式 | ASCII 限制 | 用户名限制为英文/数字/下划线，规避 email 校验风险 |
| 大小写敏感 | 统一小写 | `"Zoe"` 与 `"zoe"` 视为同一账号 |
| 多设备登录 | 正常支持 | 同一账号密码可在任意设备登录 |

### 找回密码替代方案

因伪邮箱收不到邮件，用户忘记密码后无法自助重置。可选方案：

1. **提示用户牢记密码**（单用户/家庭场景可接受）
2. **增加备用邮箱**（需扩展 user_metadata，前端实现二次验证，复杂度较高）
3. **管理员重置**（需 service_role key 的后端 API，免费层可不实现）

当前推荐方案 1，并在前端登录页加提示文案。

## 前置配置

部署时必须在 Supabase 控制台关闭 **Confirm email**，否则用户注册后需点击验证邮件而伪邮箱收不到——导致无法登录。

详见 `SETUP.md` 第 3 步。