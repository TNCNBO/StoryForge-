import { useAuthStore } from '../hooks/useAuthStore'

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>欢迎回来, {user?.username}</h1>
      <p style={styles.subtitle}>StoryForge 控制台</p>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3>项目</h3>
          <p>管理您的小说创作项目</p>
        </div>
        <div style={styles.card}>
          <h3>小说</h3>
          <p>创建和管理您的小说作品</p>
        </div>
        <div style={styles.card}>
          <h3>角色</h3>
          <p>塑造故事中的角色</p>
        </div>
        <div style={styles.card}>
          <h3>章节</h3>
          <p>编写和编辑章节内容</p>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: '2rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '1.5rem',
  },
  card: {
    padding: '1.5rem',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
}
