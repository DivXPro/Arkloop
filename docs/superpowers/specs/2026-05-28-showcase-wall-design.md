# 案例墙（Showcase Wall）设计文档

## 背景

为 `web` 应用增加一个案例墙页面，以卡片形式呈现使用 Agent 的场景，帮助用户快速发现 Agent 的能力并一键体验。

## 数据模型

```typescript
// src/showcase/types.ts
export interface ShowcaseItem {
  id: string
  title: string
  description: string
  imageUrl: string
  prompt: string
  category?: string
  tags?: string[]
  replayUrl?: string  // 预留，回放功能后续实现
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一标识 |
| `title` | `string` | 卡片标题 |
| `description` | `string` | 卡片描述 |
| `imageUrl` | `string` | 卡片背景图 URL |
| `prompt` | `string` | 点击"试一试"时填入输入框的提示词 |
| `category` | `string?` | 分类（如"编程"、"写作"），可用于后续筛选 |
| `tags` | `string[]?` | 标签数组 |
| `replayUrl` | `string?` | 回放链接（预留字段，当前仅展示 disabled 按钮） |

## 数据层

```typescript
// src/showcase/data.ts

const defaultShowcases: ShowcaseItem[] = [
  {
    id: '1',
    title: '代码审查助手',
    description: '上传代码文件，获取详细的代码审查建议',
    imageUrl: '/showcase/code-review.jpg',
    prompt: '请审查以下代码，找出潜在问题和改进建议...',
    category: '编程',
  },
  // ... 更多默认案例
]

export interface ShowcaseDataState {
  items: ShowcaseItem[]
  loading: boolean
  error: string | null
}

export function useShowcases(): ShowcaseDataState {
  const [items, setItems] = useState<ShowcaseItem[]>(defaultShowcases)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const endpoint = import.meta.env.VITE_SHOWCASE_API_URL
    if (!endpoint) return
    setLoading(true)
    fetch(endpoint, { signal: AbortSignal.timeout(8000) })
      .then(r => r.json())
      .then(data => {
        setItems(data.showcases)
        setError(null)
      })
      .catch(err => {
        setError(err.message)
        // 保持本地数据，不替换
      })
      .finally(() => setLoading(false))
  }, [])

  return { items, loading, error }
}
```

**行为：**
1. 组件 mount 时立即展示本地默认数据
2. 同时后台发起接口请求
3. 请求成功 → 替换为接口数据
4. 请求失败 → 保留本地数据，`error` 标记可用于显示提示

## 组件层

### ShowcaseCard

```
┌──────────────────────────┐
│  [背景图片]                │
│                          │
│  标题                      │
│  简短描述                   │
│  ┌────────┐ ┌────────┐   │
│  │ 回放   │ │ 试一试 │   │
│  └────────┘ └────────┘   │
└──────────────────────────┘
```

- 背景图使用 `object-cover` 覆盖整张卡片
- 图片上方叠加渐变遮罩，保证底部文字可读性
- 标题 + 描述在卡片底部
- 两个按钮并排：回放（disabled 占位）、试一试（触发导航）
- 卡片 hover：轻微上浮 + 阴影加深

### ShowcaseGrid

响应式网格布局：

| 断点 | 列数 |
|------|------|
| `>=1280px` | 4 列 |
| `>=900px` | 3 列 |
| `>=600px` | 2 列 |
| `<600px` | 1 列 |

- gap: 20px
- 容器最大宽度跟随页面内容区

## 页面层

### ShowcasePage

页面结构：

```
┌──────────────────────────────────────────┐
│  ← 返回    案例墙              [刷新图标]  │  ← 顶部栏
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │卡片│ │卡片│ │卡片│ │卡片│            │
│  └────┘ └────┘ └────┘ └────┘            │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │卡片│ │卡片│ │卡片│ │卡片│            │
│  └────┘ └────┘ └────┘ └────┘            │
│                                          │
└──────────────────────────────────────────┘
```

- 顶部栏：左侧返回按钮（回首页），中间标题"案例墙"，右侧刷新按钮
- 下方是 `ShowcaseGrid`，通过 `useShowcases` 获取数据
- 加载状态：顶部一个小提示（如"正在更新案例..."），不阻塞已有内容
- 空状态：如果本地和接口均无数据，显示空状态提示

## 路由与入口

### 路由

在 `App.tsx` 的认证路由组中添加：

```tsx
<Route path="showcase" element={<ShowcasePage />} />
```

### 欢迎页入口

在 `WelcomePage` 的输入框下方添加：

```
不知道聊什么？看看案例墙 →
```

点击后 `navigate('/showcase')`。

### 侧边栏入口

在现有侧边栏导航中添加"案例墙"项，使用 `LayoutGrid` 或 `Sparkles` 图标。

### i18n

在 `zh.ts` / `en.ts` 中添加 `showcase` 相关翻译键：

```typescript
showcase: {
  title: '案例墙',
  back: '返回',
  refresh: '刷新',
  tryIt: '试一试',
  replay: '回放',
  emptyTitle: '暂无案例',
  emptyDesc: '稍后再来看看',
  entryLink: '不知道聊什么？看看案例墙',
}
```

## "试一试"流程

点击"试一试"后：

1. 调用 `queueSkillPrompt(item.prompt)` — 复用现有的 `pendingSkillPrompt` 机制
2. 调用 `navigate('/')` 跳转回首页
3. `WelcomePage` 检测到 `pendingSkillPrompt` 有值 → `chatInputRef.current?.setValue(...)` 填入输入框并聚焦 → `consumeSkillPrompt()` 清除

**复用原因：** Skill 的 prompt 排队机制和 Showcase 的"试一试"需求完全一致（跨页面传递 prompt 到输入框），且两者在实际使用中几乎不会同时触发。

## 文件结构

```
src/apps/web/src/
  showcase/
    types.ts          # ShowcaseItem 接口
    data.ts           # 本地配置 + useShowcases hook
    ShowcaseCard.tsx  # 卡片组件
    ShowcaseGrid.tsx  # 响应式网格
    ShowcasePage.tsx  # 页面壳（路由入口）
```

## 修改点

1. **`src/showcase/`** — 新增目录及 5 个文件
2. **`src/App.tsx`** — 添加 `/showcase` 路由
3. **`src/components/WelcomePage.tsx`** — 输入框下方添加入口链接
4. **`src/locales/zh.ts`** / **`src/locales/en.ts`** — 添加翻译键
5. **侧边栏组件** — 添加案例墙导航项（需确认具体文件位置）
