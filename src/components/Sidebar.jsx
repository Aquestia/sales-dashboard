const NAV = [
  {
    group: 'מכירות',
    icon: '📊',
    items: [
      { key: 'sales',    label: 'דוח מכירות' },
      { key: 'bo',       label: 'Back Orders' },
      { key: 'invoices', label: 'חשבוניות' },
    ]
  },
  {
    group: 'ייצור',
    icon: '🏭',
    items: [
      { key: 'production', label: 'תכנון ייצור' },
    ]
  },
  {
    group: 'לקוחות',
    icon: '👥',
    items: [
      { key: 'customer', label: 'כרטיס לקוח' },
      { key: 'custinfo', label: 'פרטי לקוח' },
    ]
  },
  {
    group: 'דוח יומי',
    icon: '📅',
    items: [
      { key: 'snapshot', label: 'תוכנית / משלוח / חשבוניות' },
    ]
  },
  {
    group: 'ניהול',
    icon: '⚙️',
    items: [
      { key: 'upload', label: 'העלאת קובץ' },
    ]
  },
]

export default function Sidebar({ page, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Aquestia</div>
      <nav>
        {NAV.map(group => (
          <div key={group.group} className="nav-group">
            <div className="nav-group-label">{group.icon} {group.group}</div>
            {group.items.map(item => (
              <button
                key={item.key}
                className={'nav-item' + (page === item.key ? ' active' : '')}
                onClick={() => onNav(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
