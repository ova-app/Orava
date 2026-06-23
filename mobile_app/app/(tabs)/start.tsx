import { useEffect } from 'react'
import { useRouter } from 'expo-router'

export default function StartTab() {
  const router = useRouter()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- effet de montage volontaire (ORA-093)
  useEffect(() => {
    router.replace('/workout/session')
  }, [])
  return null
}
