# Open Design Platform Convergence Design

## Goal

在 `plugin-spike` 分支上继续推进 `open-design` 接入，但改为“边收敛边保持可用”的平台化路径：

- 保留已经做出来的宿主平台能力
- 将 `open-design` 的启动声明从 desktop 宿主侧收回到 plugin 定义侧
- 避免继续把 `open-design` 演化成 desktop runtime 的内建 integration

本设计不推翻现有 `Page` 插件实现，也不要求这一步就抽出独立 launcher registry。

## What Stays

以下能力继续保留，作为宿主平台能力：

- 通用本地 runtime manager
- 主工作区 `BrowserView` 宿主
- 通用 `managedApps.*` IPC / preload 桥
- Web 侧 `page-external` 展示语义
- `OpenDesignPluginHost` 这类插件宿主页

这些模块解决的是“宿主如何执行本地 Page 插件”，而不是“宿主如何认识某个具体产品”。

## Problem To Fix

当前实现里仍然有几处 `open-design` 专属信息停留在 desktop 宿主侧：

- `integrations.openDesign`
- desktop config normalization 中的专属字段
- main process registry 中按 `open-design` 特判生成 spec
- desktop main 对 `open-design` 启动细节的显式认知

如果继续沿这条路径扩展，Arkloop runtime 会变成集成中心，而不是插件能力平台。

## Target Boundary

### Host Owns Execution

desktop 宿主只负责：

- 接收一个通用 launcher spec
- 启动/停止进程
- 执行健康检查
- 返回 runtime 状态
- 挂载/卸载主区域 `BrowserView`

desktop 宿主不应继续内建：

- `open-design` 的目录结构
- `open-design` 的环境变量语义
- `open-design` 的配置 schema
- `open-design` 的特定默认值组合

### Plugin Owns Declaration

插件定义负责声明：

- `managedAppId`
- `presentation`
- `mountTarget`
- `launcher`
  - `processes`
  - `env template`
  - `healthChecks`
  - `default ports`
  - `required local config`

这意味着：

- 宿主负责执行
- 插件负责描述

## Recommended Shape

### Plugin Registry Layer

在 `plugin registry` 中为 `open-design` 增加 launcher 声明，包含：

- daemon 进程定义
- web 进程定义
- 健康检查规则
- `Page` 承载方式
- `main-workspace` 挂载目标
- 必需本地配置项，例如 `projectPath`

这一阶段 launcher 声明先直接放在 plugin 定义附近，而不是马上抽成独立 registry。

### Desktop Runtime Layer

`managed-local-apps` 继续存在，但它不再根据 `open-design` 的 app id 主动拼装 spec。

desktop runtime 层只消费一份通用 launcher spec，例如：

- `id`
- `processes`
- `healthChecks`
- `mountTarget`
- `runtime data directory template`

这允许现有 runtime manager 和 BrowserView host 基本保持不变。

### Local Plugin Config

`projectPath` 之类的本地参数不再放在 `integrations.openDesign` 下。

这一步建议迁移到更通用的 plugin local config 入口，例如：

- `plugins.open-design.projectPath`

本轮不要求把所有 plugin local config 模型一次性做完整，但至少不再继续扩大 desktop integration config。

## Migration Plan

推荐按以下顺序收敛：

1. 在 plugin registry 中加入 launcher 声明结构
2. 让 desktop runtime registry 改为消费通用 launcher 声明
3. 删除 `integrations.openDesign` 和对应 normalization
4. 保留 `OpenDesignPluginHost`，但让它只依赖 plugin 声明和通用 runtime

## Non-Goals

本轮不做：

- 独立 launcher registry
- 第二个本地 plugin 的适配
- 重写 `OpenDesignPluginHost` UI
- 推翻现有 `managedApps.*` IPC 设计
- 调整 `Page` / `Browser` / `Hybrid` 语义

## Success Criteria

完成本轮收敛后，应满足：

- desktop config schema 不再包含 `integrations.openDesign`
- main process 中不再有按 `open-design` 写死生成 spec 的逻辑
- `open-design` 的启动声明位于 plugin 定义附近
- 现有 `Page` 接入链路仍然成立
- 宿主平台能力不回退

## Final Recommendation

推荐采用“先收进 plugin registry，后续再视情况抽独立 launcher registry”的路径。

原因：

- 可以边收敛边保持当前实现可用
- 不会过早引入第二层抽象
- 能优先消除 desktop runtime 对 `open-design` 的显式认知
- 后续如果出现第二个同类插件，再把 launcher 抽成独立 registry 也不晚
