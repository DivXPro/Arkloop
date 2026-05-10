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
  type: 'agent' | 'extension' | 'input-library' | 'import'
  id: string
  runId?: string
  extensionId?: string
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
  fetchMode: 'object-blob' | 'api-resource' | 'external-url' | 'extension-resolver' | 'inline-json'
  descriptor: Record<string, unknown>
  capabilities?: string[]
  display?: 'inline' | 'panel'
}

/**
 * 插件 Viewer 注册信息
 */
export interface ArtifactViewerRegistration {
  extensionId: string
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
 * inlineMode 决定 inline 状态下的渲染方式
 * viewer 指定打开时使用的 viewer（可选）
 */
export interface KindConfig {
  inlineMode: 'image' | 'iframe' | 'card-preview' | 'social-card' | 'product-card' | 'link'
  viewer?: string
}

/**
 * 内联 artifact 标记解析后的段落
 */
export type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'artifact'; id: string; kind: string; title?: string }
