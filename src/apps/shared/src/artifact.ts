/**
 * 轻量 Artifact 引用
 */
export interface ArtifactHandle {
  id: string
  kind: string
}

/**
 * Artifact 来源信息
 */
export interface ArtifactProducer {
  type: 'agent' | 'plugin' | 'input-library' | 'import'
  id: string
  runId?: string
  pluginId?: string
}

/**
 * 完整 Artifact 资源描述
 */
export interface ArtifactResource {
  id: string
  kind: string
  version?: string
  title: string
  summary?: string
  labels?: string[]
  mimeType?: string
  producer: ArtifactProducer
  fetchMode: 'object-blob' | 'api-resource' | 'external-url' | 'plugin-resolver' | 'inline-json'
  descriptor: Record<string, unknown>
  capabilities?: string[]
}

/**
 * 插件 Viewer 注册信息
 */
export interface ArtifactViewerRegistration {
  pluginId: string
  supports: string[]
  openMode: 'route' | 'embedded-browser' | 'hybrid' | 'panel'
  priority: number
}

/**
 * 插件打开时的上下文
 */
export interface ArtifactContext {
  artifact: ArtifactResource
  invocation: {
    sourceSurface: 'chat' | 'input-library' | 'workspace'
    trigger: 'click' | 'command' | 'agent'
    preferredMode?: 'route' | 'embedded-browser' | 'hybrid'
  }
  relatedArtifacts?: ArtifactResource[]
  sessionContext?: unknown
}

/**
 * 系统级 kind 渲染配置（非消息字段，启动时注册）
 */
export interface KindConfig {
  previewable: boolean
  cardType: string
  defaultDisplay: string
  defaultViewer?: string
}

/**
 * 内联 artifact 标记解析后的段落
 */
export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'artifact'; id: string; kind: string; title?: string }
