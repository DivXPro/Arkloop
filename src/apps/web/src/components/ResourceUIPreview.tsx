import { useState, useEffect } from 'react'
import { getResourceContent } from '../resource-ui-store'
import { getResourceToolOutput } from '../resource-ui-data-store'
import { ArtifactIframe } from './ArtifactIframe'

type Props = {
  uri: string
  title?: string
  contentType?: string
}

export function ResourceUIPreview({ uri, title, contentType }: Props) {
  const [content, setContent] = useState<string | undefined>(() => getResourceContent(uri))
  const [toolOutput, setToolOutput] = useState<unknown>(() => getResourceToolOutput(uri))

  useEffect(() => {
    const c = getResourceContent(uri)
    const o = getResourceToolOutput(uri)
    setContent(c)
    setToolOutput(o)
  }, [uri])

  if (!content) {
    return null
  }

  return (
    <ArtifactIframe
      mode="static"
      content={content}
      contentType={contentType}
      frameTitle={title}
      initialData={toolOutput}
      style={{ minHeight: '300px' }}
    />
  )
}
