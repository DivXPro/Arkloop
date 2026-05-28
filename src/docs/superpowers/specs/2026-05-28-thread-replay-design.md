# Thread Replay 设计文档

## 概述

为 Arkloop 的 thread 增加回放功能，允许将完整对话过程以自动播放的形式回放，用于演示和分享。回放界面复用现有客户端聊天布局，与普通 thread 聊天外观一致，仅移除输入功能。

## 目标

- 完整对话回放（用户消息 + AI 回复），按时间顺序逐条流入
- 纯自动播放，无需任何播放控制 UI（暂停/进度条/调速等）
- 回放界面与正常聊天界面外观一致，复用 `ChatShell` 布局
- 支持两种场景：
  - 登录用户回放自己的 thread
  - 公开分享链接，任何人无需登录即可观看

## 非目标

- 支持暂停/快进/后退等播放控制
- 导出为视频/GIF
- 编辑或修改回放内容
- 服务端预计算回放脚本

## 路由设计

| 路由 | 场景 | 认证 |
|------|------|------|
| `/t/:threadId/replay` | 登录用户回放自己的 thread | 需登录 |
| `/replay/:token` | 公开分享回放 | 无需登录 |

## 组件架构

### 新增组件

```
apps/web/src/components/
├── ReplayPage.tsx           # /replay/:token 入口
├── ReplayShell.tsx          # 回放布局容器（复用 ChatShell 结构）
├── ReplayMessageList.tsx    # 回放消息列表（逐条流入逻辑）
└── ReplayIndicator.tsx      # 极简回放状态指示器（可选）
```

### 复用组件

- `MessageBubble` —— 消息气泡渲染
- `MarkdownRenderer` —— Markdown 内容
- `CopTimeline` —— AI 工具调用时间线
- `CopSegmentBlocks` —— AI 分段内容
- `useTypewriter` —— 打字机效果
- `ChatSkeleton` —— 加载占位

### 组件关系

```
ReplayPage (/replay/:token)
  └── ReplayShell
        ├── Header (thread 标题, "返回分享"链接)
        └── ReplayMessageList
              ├── 消息流入控制器 (ReplayEngine)
              │     └── 按 created_at 调度消息出现
              └── 消息渲染
                    ├── MessageBubble (user)
                    └── MessageBubble + CopTimeline + ... (assistant)
```

## 数据流

### 公开分享回放 (`/replay/:token`)

```
1. 页面加载
2. 调用 getSharedThread(token) 获取完整数据
3. 解析 messages 数组，按 created_at 排序
4. 解析每条 assistant 消息的元数据：
   - assistantTurn（分段内容）
   - searchSteps
   - codeExecutions
   - artifacts
   - widgets
5. 构建播放序列（PlaySequence）
6. 启动 ReplayEngine，逐条流入
```

### 登录用户回放 (`/t/:threadId/replay`)

```
1. 页面加载
2. 复用现有 ChatSession 数据流，通过 agentClient.listMessages() 获取消息
3. 复用现有 message-meta 元数据（已缓存在 localStorage）
4. 构建播放序列
5. 启动 ReplayEngine
```

## 播放机制

### 播放序列构建

每条消息根据类型生成不同的 `ReplayStep`：

```typescript
type ReplayStep =
  | { kind: 'user'; message: AgentMessage; delayAfterMs: number }
  | { kind: 'assistant'; message: AgentMessage; segments: ReplaySegment[] }

type ReplaySegment =
  | { kind: 'thinking'; delayMs: number }                    // 思考 shimmer
  | { kind: 'text'; content: string; typewriterSpeed: number } // 打字机文本
  | { kind: 'tool'; toolCall: ToolCall; delayAfterMs: number } // 工具调用卡片
```

### 调度规则

| 步骤 | 延迟/速度 |
|------|----------|
| 用户消息滑入 | 固定 500ms 后出现，停留 800ms |
| AI 思考 shimmer | 固定 1.5s |
| AI 文本打字机 | 每字符 30ms（约 30~50 字/秒） |
| AI 工具调用展开 | 固定 1s |
| 步骤间切换 | 200ms |
| 消息间切换 | 1s |

### ReplayEngine

以 React Hook 实现（`useReplayEngine`），而非 class：

```typescript
function useReplayEngine(steps: ReplayStep[]) {
  const [visibleMessages, setVisibleMessages] = useState<AgentMessage[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const abortRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      for (const step of steps) {
        if (cancelled || abortRef.current) break
        await playStep(step, setVisibleMessages)
      }
      if (!cancelled) setIsComplete(true)
    }
    run()
    return () => { cancelled = true }
  }, [steps])

  return { visibleMessages, isComplete }
}
```

## 动画效果

### 用户消息

复用现有 `animateUserEnter` 动画：
- 从底部向上滑入
- opacity 0 → 1
- translateY 20px → 0
- duration 400ms, ease-out

### AI 文本

复用 `useTypewriter` hook：
- 逐字显示文本内容
- 支持 markdown 实时渲染
- 打字过程中 CopTimeline 工具调用按位置展开

### AI 工具调用

复用现有组件动画：
- `CopTimeline` 的 shimmer → 内容展开
- `TopLevelCopToolBlock` 的折叠/展开动画
- `ArtifactStreamBlock` 的渐进加载

### 滚动

复用 `useScrollPin`：
- 自动平滑滚动跟随最新消息
- 用户手动滚动时停止自动跟随（播放继续）
- 滚动到底部后恢复跟随

## 状态管理

### 回放专用 Context

```typescript
interface ReplayContextValue {
  isReplay: boolean           // 是否处于回放模式
  isPlaying: boolean          // 是否正在播放（用于极简指示器）
  visibleMessages: AgentMessage[]
  currentStepIndex: number
  totalSteps: number
  isComplete: boolean
}
```

### 与现有 Context 的关系

- 回放模式不依赖 `RunLifecycleProvider`（无 SSE 连接）
- 不依赖 `MessageStoreProvider` 的实时更新逻辑
- 复用 `MessageMeta` 读取已缓存的元数据（登录场景）

## 与现有代码集成

### ChatShell 适配

在 `ChatShell` 中检测回放路由：

```typescript
const isReplayMode = location.pathname.includes('/replay') || searchParams.get('replay') === '1'
```

当 `isReplayMode` 为 true 时：
- 隐藏 `ChatInput`
- 隐藏消息操作按钮（重试、编辑、fork）
- 隐藏"新消息"通知
- 替换 SSE 连接为 ReplayEngine

### MessageBubble 适配

在 `MessageBubble` 中检测回放模式：
- 隐藏操作栏（复制可保留）
- 禁用交互式 widget 的操作回调
- 保持只读展示

### SharePage 入口

在 `SharePage` 底部添加"▶ 播放回放"按钮：
- 点击导航到 `/replay/${token}`
- 按钮样式与品牌一致

## 安全考虑

- `/replay/:token` 复用 `getSharedThread` 的权限校验（密码保护、过期检查）
- 不暴露任何需要认证的数据
- 回放页面只读，无写入操作

## 未来扩展

- 播放控制（暂停、调速、拖拽进度）
- 导出为 MP4/GIF
- 评论区互动
- 章节标记（快速跳转到关键消息）
