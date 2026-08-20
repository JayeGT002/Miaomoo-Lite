// 页面顶部通知气泡：白底、阴影、黑字（用户偏好）
import { useEffect, useState } from 'react'

export interface Notice { id: number; msg: string }

let seq = 0

export function useNotify() {
  const [notices, setNotices] = useState<Notice[]>([])
  const notify = (msg: string) => {
    const id = ++seq
    setNotices((ns) => [...ns, { id, msg }])
    setTimeout(() => setNotices((ns) => ns.filter((n) => n.id !== id)), 3600)
  }
  return { notices, notify }
}

export default function Notify({ notices }: { notices: Notice[] }) {
  useEffect(() => { void notices }, [notices])
  if (notices.length === 0) return null
  return (
    <div className="notify-stack">
      {notices.map((n) => (
        <div key={n.id} className="notify-bubble">{n.msg}</div>
      ))}
    </div>
  )
}
