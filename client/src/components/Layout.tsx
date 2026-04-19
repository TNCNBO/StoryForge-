import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../hooks/useAuthStore'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>StoryForge</div>
        <nav style={styles.nav}>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            退出
          </button>
        </nav>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e5e7eb',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#4f46e5',
  },
  nav: {
    display: 'flex',
    gap: '1rem',
  },
  logoutBtn: {
    padding: '0.375rem 0.75rem',
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  main: {
    padding: '2rem',
  },
}
