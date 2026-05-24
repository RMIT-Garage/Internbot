import { redirect } from 'next/navigation'

export default function CoordinatorContractsPage() {
  redirect('/coordinator/jobs?stage=verification')
}
