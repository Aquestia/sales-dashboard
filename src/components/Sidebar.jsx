const NAV = [
  {
    group: 'מכירות',
    items: [
      { key: 'sales',    icon: '📊', label: 'דוח מכירות' },
      { key: 'monthly',  icon: '📋', label: 'מצב הזמנות יומי' },
      { key: 'bo',       icon: '⚠️', label: 'Back Orders' },
      { key: 'invoices', icon: '🧾', label: 'חשבוניות' },
      { key: 'delivery', icon: '🚚', label: 'תעודות משלוח ללא חשבוניות' },
    ]
  },
  {
    group: 'לקוחות',
    items: [
      { key: 'customer', icon: '🔍', label: 'כרטיס לקוח' },
      { key: 'custinfo', icon: '👤', label: 'פרטי לקוח' },
    ]
  },
  {
    group: 'דוח יומי',
    items: [
      { key: 'snapshot', icon: '📅', label: 'תוכנית / משלוח / חשבוניות' },
    ]
  },
  {
    group: 'ניהול',
    items: [
      { key: 'upload', icon: '📁', label: 'העלאת קובץ' },
    ]
  },
]

export default function Sidebar({ page, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">דאשבורד מכירות</div>
        <div className="sidebar-logo-sub">Aquestia Group</div>
      </div>
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(group => (
          <div key={group.group} className="nav-group">
            <div className="nav-group-label">{group.group}</div>
            {group.items.map(item => (
              <button
                key={item.key}
                className={'nav-item' + (page === item.key ? ' active' : '')}
                onClick={() => onNav(item.key)}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
