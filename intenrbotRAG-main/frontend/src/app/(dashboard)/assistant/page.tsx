import { ChatInterface } from '@/components/demo/ChatInterface'

const ALLOWED_FEATURES = new Set(['faq-rag', 'contract-checker', 'job-checker'])

type AssistantPageProps = {
  searchParams?: Promise<{
    feature?: string
  }>
}

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  const resolvedSearchParams = await searchParams
  const rawFeature = resolvedSearchParams?.feature
  const feature = rawFeature && ALLOWED_FEATURES.has(rawFeature) ? rawFeature : 'faq-rag'

  return (
    <div className="h-full w-full">
      <ChatInterface feature={feature} />
    </div>
  )
}
