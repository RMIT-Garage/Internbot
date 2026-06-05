import { redirect } from 'next/navigation'

type DemoRedirectPageProps = {
  searchParams?: Promise<{
    feature?: string
  }>
}

export default async function DemoPage({ searchParams }: DemoRedirectPageProps) {
  const resolvedSearchParams = await searchParams
  const feature = resolvedSearchParams?.feature
  redirect(feature ? `/assistant?feature=${encodeURIComponent(feature)}` : '/assistant')
}
