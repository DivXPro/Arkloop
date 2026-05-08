# Open Design Page Plugin Design

## Goal

将 `/Users/huhui/Projects/open-design` 以 Arkloop 桌面端插件的方式接入，面向用户呈现为 `Page` 模式插件：

- 打开后由 Open Design 占据 Arkloop 主工作区
- 不显示右侧浏览器面板 chrome
- 退出插件后恢复 Arkloop 原有 chat/workspace
- Open Design 仍以本地独立 Web 应用形态运行，而不是并入 Arkloop React 页面

本设计优先目标是“先做可用嵌入”，不要求首版完成 Arkloop 线程、运行上下文或深度工作流联动。

## Context

### Arkloop 现状

- Web 侧已有插件运行时、插件注册表和 `Page` / `Browser` / `Hybrid` 三种展示语义。
- 当前 `Page` 实现本质是 React 路由页面；当前 `Browser` / `Hybrid` 则依赖桌面端 `BrowserView`。
- 桌面端已有较成熟的子进程管理、端口分配、健康检查、优雅关闭与 `BrowserView` 挂载能力。
- 现有右侧浏览器面板与插件接管浏览器之间已经有“避免复用同一路径”的约束，新的主区域接管能力必须与右侧面板隔离。

### Open Design 现状

- Open Design 是明确拆分的本地优先应用，包含 `apps/daemon`、`apps/web`、`apps/desktop`、`apps/packaged`。
- `apps/daemon` 支持 `--port`、`--host`、`--no-open`，并真实消费 `OD_DATA_DIR`。
- `apps/web` 是 Next.js 应用，开发态和服务态都依赖 daemon 提供的 `/api`、`/artifacts`、`/frames`。
- Open Design 官方桌面形态本身也是 Electron 宿主，因此不适合在 Arkloop 内再嵌套其 packaged/desktop 版本。

## Recommended Approach

推荐方案是：

1. 将 Open Design 在 Arkloop 中定义为 `Page` 语义插件
2. Arkloop 桌面主进程托管 Open Design 的本地运行时
3. 由 Arkloop 桌面端 `BrowserView` 在主工作区承载 Open Design Web
4. 将运行时实现抽象为通用的 `managed local apps`，Open Design 只是首个实例

该方案满足产品语义，同时复用 Arkloop 现有桌面能力，避免将 Open Design 硬改为 Arkloop 内部 React 子页面。

## Alternatives Considered

### Option A: Browser Plugin

将 Open Design 作为 `Browser` 模式插件接到右侧浏览器面板。

优点：

- 最接近 Arkloop 当前已有实现
- 最小化前端布局修改

缺点：

- 不符合 Open Design 作为完整工作台的产品语义
- 用户体验像“附属浏览器工具”，而不是主工作区能力
- 后续再切换到 `Page` 会引入二次改造

### Option B: React Route Page

将 Open Design 前端代码直接并入 Arkloop Web，作为普通 `Page` 路由页面渲染。

优点：

- 表面上最符合 `Page` 定义

缺点：

- Open Design 不是一个可直接 import 的局部 React 组件，而是独立的 daemon + web 应用
- 会让 Arkloop 承担 Open Design 的前端构建、运行与兼容负担
- 明显偏离 Open Design 原生架构，风险过高

### Option C: Nested Packaged/Desktop

在 Arkloop 中启动 Open Design 自己的 packaged/desktop 版本。

优点：

- 最接近 Open Design 官方桌面体验

缺点：

- Electron inside Electron，进程模型和窗口托管复杂
- 难与 Arkloop 插件系统和主区域布局对齐
- 不适合“先做可用嵌入”

## Architecture

### High-Level Model

整体架构分为四层：

1. `web plugin binding`
2. `desktop IPC bridge`
3. `managed local apps runtime`
4. `main-area BrowserView host`

职责边界如下：

- 插件负责声明和交互控制，不负责 spawn 外部进程
- 主进程 runtime 负责端口、环境变量、健康检查、重启与关闭
- 主区域宿主负责 `BrowserView` 挂载，不复用右侧浏览器面板路径
- Open Design 保持为外部本地 Web 应用，不被改造成 Arkloop 内部页面

### Managed Local Apps

新增一套通用主进程模块，例如：

- `src/apps/desktop/src/main/managed-local-apps/types.ts`
- `src/apps/desktop/src/main/managed-local-apps/runtime-manager.ts`
- `src/apps/desktop/src/main/managed-local-apps/registry.ts`
- `src/apps/desktop/src/main/managed-local-apps/apps/open-design.ts`

其中：

- `ManagedLocalAppSpec` 描述某个本地应用如何启动、如何探活、如何关闭
- `runtime-manager` 提供 `ensureApp`、`getStatus`、`restartApp`、`stopApp`
- `registry` 注册所有可托管应用
- `apps/open-design.ts` 只承载 Open Design 自身差异配置

首版抽象只覆盖当前需要的能力：

- 本地子进程启动
- 端口分配
- 环境变量注入
- 健康检查
- 日志路径管理
- 运行状态
- 退出清理

不扩展为通用插件平台，也不支持任意复杂编排。

### Open Design App Spec

Open Design 对应一个 `ManagedLocalAppSpec`：

- `id`: `open-design`
- `presentation`: `page`
- `mountTarget`: `main-workspace`
- `dataDir`: Arkloop 用户数据目录下的独立 integration 路径
- `processes`: `daemon` + `web`

daemon 进程定义：

- 命令：`node apps/daemon/dist/cli.js --port <daemonPort> --host 127.0.0.1 --no-open`
- 环境变量：`OD_PORT`、`OD_DATA_DIR`
- ready 条件：HTTP 健康检查成功

web 进程定义：

- 命令：使用 Open Design web 的固定端口服务启动方式
- 环境变量：`OD_DAEMON_URL=http://127.0.0.1:<daemonPort>`
- ready 条件：`webUrl` 首页可访问

### Main-Area BrowserView

Arkloop 当前右侧浏览器面板逻辑不能直接复用为 `Page` 插件承载层。

需要在桌面端抽出更底层的 BrowserView 挂载能力，支持至少两个独立挂载目标：

- `right-panel`
- `main-workspace`

`main-workspace` 的特性：

- 一个 managed app 绑定一个专属 BrowserView
- 生命周期与插件激活态解耦
- 可独立 show/hide
- bounds 由主工作区容器同步
- 不参与全局右侧浏览器面板的 tab 竞争

## Plugin Model

### Registry Shape

在 Web 插件注册表中，Open Design 插件不应继续沿用“组件 + browser URL resolver”这一旧模型，而应声明：

- `id: "open-design"`
- `desktopOnly: true`
- `presentation: "page"`
- `managedAppId: "open-design"`
- `mountTarget: "main-workspace"`

这表示：

- 插件只声明它绑定哪个 managed app
- URL、进程和健康状态由桌面 runtime 提供

### Runtime Flow

用户打开插件时：

1. `PluginRuntimeProvider` 将 `open-design` 设为 active plugin
2. 插件宿主页调用桌面 IPC：`managedApps.ensure("open-design")`
3. 成功后调用 `managedApps.mountMainArea({ appId, bounds })`
4. 主区域容器同步 bounds，桌面端将 BrowserView 挂载到主工作区
5. BrowserView 导航到 `webUrl`

用户关闭插件时：

1. 清除 active plugin
2. 卸载主区域 BrowserView
3. 恢复 Arkloop 原工作区
4. 不主动停止 Open Design 进程

再次进入插件时：

- 若 runtime 为 `running`，直接复用
- 若 runtime 为 `failed` 或 `stopped`，重新执行 ensure

## IPC Design

桌面端需要新增一组 managed apps IPC，而不是把 Open Design 逻辑塞进已有 browser-tabs 或 sidecar IPC。

建议暴露：

- `managedApps.ensure(appId)`
- `managedApps.getStatus(appId)`
- `managedApps.restart(appId)`
- `managedApps.stop(appId)`
- `managedApps.mountMainArea({ appId, bounds })`
- `managedApps.updateMainAreaBounds({ appId, bounds })`
- `managedApps.unmountMainArea({ appId })`

Web 侧只消费稳定接口，不感知端口分配、子进程命令或健康检查细节。

## Runtime Lifecycle

### Startup Sequence

`ensure("open-design")` 的推荐流程：

1. 校验 Open Design 根路径和构建产物存在
2. 准备 Arkloop 侧 runtime 目录、data 目录、log 目录
3. 分配 daemon 端口
4. 启动 daemon
5. 等待 daemon 健康检查通过
6. 分配 web 端口
7. 启动 web
8. 等待 web 健康检查通过
9. 返回 `{ status, daemonUrl, webUrl, ports }`

ready 判定不能依赖固定 sleep，必须使用健康检查。

### Port Strategy

不写死端口，只做“优先固定、冲突回退”：

- daemon 默认偏好端口，例如 `17456`
- web 默认偏好端口，例如 `17573`
- 若冲突则自动回退到空闲端口

理由：

- 用户本机可能已有其他 Open Design 实例
- 多工作树、多开发环境并存时固定端口风险高
- 与 Arkloop 现有 sidecar 端口探测思路一致

### Data Isolation

Open Design 的 runtime 数据目录应放在 Arkloop 用户目录下，例如：

- `<arkloop-user-data>/integrations/open-design/data`
- `<arkloop-user-data>/integrations/open-design/logs`
- `<arkloop-user-data>/integrations/open-design/cache`

并通过 `OD_DATA_DIR` 注入给 daemon。

这样可以：

- 避免污染 `open-design` 源码仓库
- 保持 Arkloop 统一清理策略
- 为未来多 managed app 保持统一目录规范

### Shutdown Behavior

当用户关闭插件：

- 卸载主区域视图
- 不停止 runtime

当 Arkloop 应用退出：

- 统一 stop 所有 managed apps
- 优雅关闭 daemon 和 web 子进程
- 超时后强制 kill

## Failure Handling

状态模型建议统一为：

- `stopped`
- `starting`
- `running`
- `degraded`
- `failed`

附带字段：

- `daemonUrl`
- `webUrl`
- `ports`
- `pids`
- `lastError`
- `startedAt`

失败场景处理：

- daemon 启动失败：插件显示明确错误态，不挂载 BrowserView
- web 启动失败：保留 daemon 状态，允许只重试 web 或整体重启
- 健康检查超时：进入 `failed`，而不是无限 loading
- 子进程异常退出：有限次自动重启，超过阈值后进入 `failed`

首版用户可见状态至少包括：

- 启动中
- 启动失败
- 运行中

错误态应显示：

- 失败阶段
- 简要错误摘要
- 重试按钮
- 可选的日志路径入口

## Web UI Behavior

首版 `Page` 插件的 React 层应是一个很薄的宿主页：

- 启动中：loading / progress
- 失败：错误摘要 + 重试
- 运行中：透明占位容器，负责 main-area bounds 同步

它不负责渲染 Open Design 页面本身，只负责：

- 请求 ensure
- 触发 mount/unmount
- 呈现 Arkloop 级别的错误和恢复控件

## Development Mode

首版先仅支持“源码仓库接入模式”：

- 在 Arkloop desktop 配置中显式指定 Open Design 根路径
- 启动前检查是否已完成依赖安装与必要构建
- 按 Open Design 真实构建入口执行：
  - `pnpm --filter @open-design/daemon build`
  - `pnpm --filter @open-design/web build`

初版不集成 `apps/packaged` 或 `apps/desktop`，避免 Electron 宿主套娃。

## Testing Strategy

建议最小测试集：

### Desktop Runtime Tests

- 端口分配与回退
- Open Design 路径与构建产物校验
- daemon/web 启动顺序
- 健康检查超时
- stop/restart 行为

### BrowserView Tests

- main-area mount
- bounds 同步
- unmount 后恢复 Arkloop 主工作区
- 与右侧面板互不干扰

### Web Plugin Tests

- 打开插件时调用 `ensure`
- ensure 失败时显示错误态
- 关闭插件时只卸载视图，不 stop runtime
- 再次进入时复用 `running` runtime

### Manual Verification

- 首次打开插件成功
- 关闭再打开可快速复用
- daemon/web 任一失败时错误态可恢复
- Arkloop 退出时进程被清理

## Phased Delivery

### Phase 1

- 通用 `managed-local-apps` runtime
- Open Design app spec
- 主区域 BrowserView 挂载能力
- `open-design` Page 插件接入
- 最小错误态与重试

### Phase 2

- 更丰富的启动状态与日志入口
- 更完整的开发配置
- 增加 main-area / panel 的布局切换能力

### Phase 3

- 由 `Page` 演进到 `Hybrid`
- 为更多本地托管 Web 应用复用同一 runtime 抽象
- 评估是否需要将 Open Design 构建产物纳入 Arkloop 分发链路

## Non-Goals

首版不包含：

- 将 Open Design 前端直接并入 Arkloop Web 包
- 启动 Open Design packaged/desktop 并嵌套其 Electron
- Arkloop 与 Open Design 的深度业务联动
- 通用第三方插件市场或动态远程安装

## Final Recommendation

最终建议是：

- 产品语义采用 `Page`
- 技术承载采用“主区域 BrowserView + managed local apps runtime”
- 运行时抽象保持通用，Open Design 作为首个 spec 落地
- 首版专注于本地源码仓库接入和稳定生命周期

这条路径同时满足：

- 与 Open Design 真实架构一致
- 与 Arkloop 现有插件和桌面能力一致
- 能避免右侧浏览器面板争用问题
- 能为后续 `Hybrid` 和多应用托管保留清晰扩展点
