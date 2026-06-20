import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/context/ThemeContext';
import { VERSION } from '@/version';

function themeIconSrc(theme: string): string {
  if (theme === 'catppuccin') return '/assets/cat-theme.svg';
  if (theme === 'dark') return '/assets/dark-theme.svg';
  return '/assets/light-theme.svg';
}

export function Header() {
  const { theme, toggleTheme, logoGlow, toggleLogoGlow } = useTheme();

  const { data: dailyUri } = useQuery<string>({
    queryKey: ['daily-note-uri'],
    queryFn: async () => {
      const res = await fetch('/daily-note-uri');
      const d = await res.json();
      return d.uri as string;
    },
    staleTime: 60 * 60 * 1000,
  });

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const logoSrc = theme === 'catppuccin' ? '/assets/logo-catppuccin.png' : '/assets/logo.png';

  return (
    <header>
      <div className="header-title">
        <img
          src={logoSrc}
          className={`header-logo${logoGlow ? '' : ' no-glow'}`}
          alt="Logo"
          onClick={toggleLogoGlow}
        />
        <div>
          <h1>MonoVault <span className="header-version">v{VERSION}</span></h1>
          <div className="date">{dateStr}</div>
        </div>
      </div>
      <div className="header-actions">
        {dailyUri && (
          <button className="header-btn" onClick={() => { window.location.href = dailyUri; }} title="Open today's note">
            <img src="/assets/daily-note.svg" alt="Today's note" />
          </button>
        )}
        <button className="header-btn" onClick={() => window.location.reload()} title="Refresh">
          <img src="/assets/refresh.svg" alt="Refresh" />
        </button>
        <button className="header-btn" onClick={toggleTheme} title="Toggle theme">
          <img src={themeIconSrc(theme)} alt="Toggle theme" />
        </button>
      </div>
    </header>
  );
}
