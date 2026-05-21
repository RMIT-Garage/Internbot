import StudentContractDetailPage from './_client'

export const dynamicParams = false

export function generateStaticParams() {
  return []
}

export default function Page() {
  return <StudentContractDetailPage />
}
