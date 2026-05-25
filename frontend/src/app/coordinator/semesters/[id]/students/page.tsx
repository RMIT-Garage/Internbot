import SemesterStudentsClient from './SemesterStudentsClient'

export function generateStaticParams() {
  return [{ id: '_' }]
}

export default function SemesterStudentsPage() {
  return <SemesterStudentsClient />
}
