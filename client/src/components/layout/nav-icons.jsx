const paths = {
  dashboard: <path d="M4 5h6v6H4zM14 5h6v4h-6zM14 13h6v6h-6zM4 15h6v4H4z" />,
  jobs: <path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8Zm6 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 13h18" />,
  applications: <path d="M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6" />,
  assessments: <path d="m5 12 5 5 9-10M4 4h16v16H4z" />,
  post: <path d="M12 5v14M5 12h14" />,
  students: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2.2.7 3.5 2.6 3.5 5.6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  logout: <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9" />,
  bell: (
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
};

function NavIcon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      {paths[name]}
    </svg>
  );
}

export default NavIcon;
