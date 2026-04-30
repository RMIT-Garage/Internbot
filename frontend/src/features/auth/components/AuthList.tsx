import { useAuth } from '../hooks/useAuth'

export default function AuthList() {
  const { data, loading, error } = useAuth()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error retrieving users</div>

  return (
    <div>
      <h1>User List</h1>
      <ul>
        {data?.map((auth) => (
          <li key={auth.id}>{auth.email}</li>
        ))}
      </ul>
    </div>
  )
}
