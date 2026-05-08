# Open Design Runtime Boundary Note

## Purpose

记录当前 `open-design` Page 插件接入的边界判断，避免后续继续把插件接入演化成宿主 runtime 的内建产品特性。

这不是新的实现方案，也不是替代现有设计稿的完整 spec。它只说明：

- 哪些能力应该保留在宿主
- 哪些信息应该从宿主收回到 plugin 声明侧
- 后续重构时的迁移方向

## Current Assessment

当前实现已经具备两类值得保留的平台能力：

1. 通用本地 runtime 管理能力
2. 主工作区 `BrowserView` 挂载能力

这些能力本身没有问题，后续也可以复用给其他本地 Page/Hybrid 插件。

但当前版本仍有一些 `open-design` 专属信息停留在 desktop 宿主侧，包括：

- desktop config schema 里的 `integrations.openDesign`
- main process registry 中对 `open-design` 的显式分支
- `projectPath`、默认端口和启动细节以 integration 形态存在

这类信息如果继续扩张，会把“插件接入”逐渐做成“宿主内建 integration”。

## Desired Boundary

### Host Owns Capabilities

宿主应只保留通用能力：

- 启动/停止/重启本地子进程
- 执行健康检查
- 维护运行状态
- 将 URL 挂载到主工作区或侧边浏览器容器
- 在插件关闭或应用退出时清理生命周期

宿主不应内建具体产品的目录结构、环境变量语义、启动参数组合或配置模型。

### Plugin Owns Declaration

插件应声明自己的运行信息：

- 需要启动的进程列表
- 每个进程的命令、参数、`cwd`、环境变量模板
- 健康检查方式
- 承载模式：`Page` / `Browser` / `Hybrid`
- 本地必需配置，例如 `projectPath`

也就是说：

- 宿主负责执行
- 插件负责描述

## What To Keep

以下内容可以保留，并继续作为平台能力演进：

- `src/apps/desktop/src/main/managed-local-apps/runtime-manager.ts`
- `src/apps/desktop/src/main/browser-main-area.ts`
- `src/apps/desktop/src/main/ipc.ts` 中的通用 `managedApps.*`
- `src/apps/desktop/src/preload/index.ts` 中的通用桌面桥
- Web 侧 `page-external` 展示语义
- `DesktopMainAreaHost`

这些模块解决的是“宿主能力”问题，不属于 `open-design` 特判。

## What To Avoid Expanding

后续不要继续扩这些位置里的 `open-design` 专属逻辑：

- `src/apps/desktop/src/main/types.ts`
- `src/apps/desktop/src/main/config.ts`
- `src/apps/desktop/src/main/managed-local-apps/registry.ts`
- `src/apps/desktop/src/main/index.ts`

特别是不要继续增加：

- 新的 `integrations.openDesign.*` 字段
- 更多按 `appId === "open-design"` 分支展开的逻辑
- 更多只有 `open-design` 才会使用的主进程配置

## Migration Direction

后续如果继续收敛边界，推荐顺序如下：

1. 将 `projectPath` 从 desktop integration config 挪到 plugin 本地配置
2. 将 `open-design` 的 launcher spec 下沉到 plugin 声明层
3. 让 desktop runtime manager 消费通用 launcher spec，而不是按 app id 特判
4. 删除 `integrations.openDesign` 与 main process registry 里的 `open-design` 专属分支

迁移完成后的理想状态是：

- 新增一个本地 Page plugin 时
- 不需要修改 desktop 主配置 schema
- 不需要在 main process 增加新的产品专属分支
- 只需要新增 plugin launcher spec 与少量本地配置

## Practical Rule

判断边界是否健康，可以用一个简单标准：

如果未来再接第二个类似的本地插件，是否需要继续修改：

- desktop config schema
- desktop main registry
- desktop main 入口文件

如果答案是“需要”，说明当前边界仍然过于宿主中心，应该继续把声明下沉到 plugin 层。

## Conclusion

当前版本已经做出了可复用的平台能力，但 `open-design` 仍然带有一定 integration 化倾向。

后续应遵循这一原则：

- 宿主只提供能力
- 插件提供声明
- 具体产品不成为 desktop runtime 的内建对象
