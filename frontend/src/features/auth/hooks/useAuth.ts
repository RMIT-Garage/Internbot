import { useState, useEffect } from 'react'
import { getDocs, onSnapshot } from '@firebase/firestore'
import { authCollection } from '@/lib/firebase/firestore'

export default function useAuth() {
  const [data, setData] = useState<Auth[]>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      authCollection,
      (snapshot) => {
        const authData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setData(authData)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  return { data, loading, error }
}
