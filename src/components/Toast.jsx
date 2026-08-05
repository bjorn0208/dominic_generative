export default function Toast({ message, type }) {
  return (
    <div className="toast" style={{ background: type === 'error' ? 'var(--red)' : 'var(--ink)' }}>
      {message}
    </div>
  )
}
