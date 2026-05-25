import SemesterStudentsClient from './SemesterStudentsClient'

export function generateStaticParams() {
  return []
}

export default async function SemesterStudentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SemesterStudentsClient semesterId={id} />
}
