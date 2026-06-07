export function HudIcon({ type }) {
  if (type === 'knowledge') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-icon">
        <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v12.5A2.75 2.75 0 0 1 16.25 21h-8.5A2.75 2.75 0 0 1 5 18.25V5.75Z" />
        <path d="M8.5 7.25h7M8.5 11h7M8.5 14.75h4.5" />
      </svg>
    );
  }

  if (type === 'debug') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-icon">
        <path d="M8 8.5h8M8 15.5h8M9.25 4.5v3.25M14.75 4.5v3.25M9.25 16.25v3.25M14.75 16.25v3.25" />
        <path d="M6.75 7.75h10.5v8.5H6.75z" />
      </svg>
    );
  }

  if (type === 'mind-map') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-icon">
        <path d="M7 6.5h4.5M16.5 8.5h.01M16.5 15.5h.01M7 17.5h4.5" />
        <path d="M4.75 4.75h5.5v3.5h-5.5zM13.75 6.75h5.5v3.5h-5.5zM13.75 13.75h5.5v3.5h-5.5zM4.75 15.75h5.5v3.5h-5.5z" />
        <path d="M10.25 6.5h3.5M10.25 17.5h3.5M16.5 10.25v3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="sidebar-icon">
      <path d="M12 4.5v15M7.5 8.25v7.5M16.5 8.25v7.5M4.5 11v2M19.5 11v2" />
      <path d="M9 19.5h6" />
    </svg>
  );
}
