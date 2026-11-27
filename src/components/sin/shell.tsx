'use client';

import * as Menu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { signOut } from '@/server/actions';
import type { ShellData } from '@/server/shell';
import dynamic from 'next/dynamic';
import { m } from 'motion/react';
import { useUnread } from './notifications';

// ⌘K, atajos y notificaciones se descargan la primera vez que se abren (menos JS en la carga inicial)
const CommandMenu = dynamic(() => import('./command').then((x) => x.CommandMenu), { ssr: false });
const ShortcutsDialog = dynamic(() => import('./command').then((x) => x.ShortcutsDialog), { ssr: false });
const NotificationsPanel = dynamic(() => import('./notifications').then((x) => x.NotificationsPanel), { ssr: false });
import { StreakPill } from './streak';
import { Avatar, Icon, Isotype, btn } from './ui';

type ShellCtx = { data: ShellData; openSearch: () => void; openNotifs: () => void; openShortcuts: () => void };
const Ctx = createContext<ShellCtx | null>(null);
export const useShell = () => useContext(Ctx);

/** Estado de los overlays globales (⌘K, notificaciones, atajos) + atajos de teclado globales. */
export function ShellProvider({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const [search, setSearch] = useState(false);
  const [notifs, setNotifs] = useState(false);
  const [keys, setKeys] = useState(false);
  const [used] = useState({ s: false, n: false, k: false });
  if (search) used.s = true;
  if (notifs) used.n = true;
  if (keys) used.k = true;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      } else if (!typing && e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearch(true);
      } else if (!typing && e.key === '?') {
        e.preventDefault();
        setKeys(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const value = useMemo(() => ({ data, openSearch: () => setSearch(true), openNotifs: () => setNotifs(true), openShortcuts: () => setKeys(true) }), [data]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {(search || used.s) && <CommandMenu open={search} onOpenChange={setSearch} index={data.index} onShortcuts={() => (setSearch(false), setKeys(true))} />}
      {data.user && (notifs || used.n) && <NotificationsPanel open={notifs} onOpenChange={setNotifs} />}
      {(keys || used.k) && <ShortcutsDialog open={keys} onOpenChange={setKeys} />}
    </Ctx.Provider>
  );
}

const NAV = [
  { href: '/', label: 'Inicio', icon: 'home' },
  { href: '/cursos', label: 'Cursos', icon: 'school' },
  { href: '/circulos', label: 'Círculos', icon: 'groups' },
];
const PATH = [
  { href: '/perfil#progreso', label: 'Progreso', icon: 'insights' },
  { href: '/perfil#logros', label: 'Logros', icon: 'emoji_events' },
  { href: '/perfil#certificados', label: 'Certificados', icon: 'workspace_premium' },
];
const isCur = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

function Sidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const path = usePathname();
  const shell = useShell()!;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const unread = useUnread(shell.data.unread);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `irb_sb=${c ? 0 : 1}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.metaKey || e.ctrlKey) && e.key === '\\' && (e.preventDefault(), toggle());
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [toggle]);
  const item = (n: { href: string; label: string; icon: string }) => (
    <Link key={n.href} href={n.href} className="sb-item" aria-current={isCur(path, n.href) ? 'page' : undefined} title={collapsed ? n.label : undefined}>
      {isCur(path, n.href) && <m.span layoutId="sb-ind" className="sb-ind" transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />}
      <Icon name={n.icon} />
      <span className="sb-label">{n.label}</span>
    </Link>
  );
  return (
    <aside className="sidebar" data-collapsed={collapsed} aria-label="Navegación principal">
      <Link href="/" className="sb-logo" aria-label="Academia IRB® · inicio">
        <span className="sb-iso">
          <Isotype size={32} />
        </span>
        <img className="sb-brand" src="/brand/irb-ximena.png" alt="IRB® Ximena Duque Valencia" width={150} height={26} />
        <span className="sb-sub">Academia</span>
      </Link>
      <nav className="sb-nav">
        {NAV.map(item)}
        <p className="sb-overline t-overline">Tu camino</p>
        {PATH.map(item)}
        <div style={{ height: 16 }} />
        {shell.data.user && (
          <button type="button" className="sb-item" onClick={shell.openNotifs} title={collapsed ? 'Notificaciones' : undefined}>
            <Icon name="notifications" />
            {unread > 0 && collapsed && <span className="dot-badge tnum">{unread > 9 ? '9+' : unread}</span>}
            <span className="sb-label">Notificaciones</span>
            {unread > 0 && <span className="sb-badge tnum">{unread}</span>}
          </button>
        )}
        {item({ href: '/ayuda', label: 'Ayuda', icon: 'help' })}
      </nav>
      <div className="sb-foot">
        {shell.data.user && (
          <Link href="/perfil" className="sb-item" title={collapsed ? shell.data.user.name : undefined} style={{ marginBottom: 4 }}>
            <Avatar name={shell.data.user.name} size={24} />
            <span className="sb-label stack" style={{ lineHeight: '16px' }}>
              <span className="clamp1">{shell.data.user.name.split(' ')[0]}</span>
              <span className="t-label-s c-variant">{shell.data.streak ? `${shell.data.streak.totalDays} días de práctica` : 'Mi perfil'}</span>
            </span>
          </Link>
        )}
        <button type="button" className="sb-item" onClick={toggle} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'} aria-expanded={!collapsed}>
          <Icon name={collapsed ? 'left_panel_open' : 'left_panel_close'} />
          <span className="sb-label">Contraer menú</span>
        </button>
      </div>
    </aside>
  );
}

export function UserMenu({ name, size = 24 }: { name: string; size?: 24 | 32 }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="icon-btn" aria-label={`Cuenta de ${name}`}>
        <Avatar name={name} size={size} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="end" sideOffset={8}>
          <div className="menu-label">
            <b className="t-label-l">{name}</b>
          </div>
          <Menu.Item asChild>
            <Link className="menu-item" href="/perfil">
              <Icon name="person" /> Mi perfil
            </Link>
          </Menu.Item>
          <Menu.Item asChild>
            <Link className="menu-item" href="/perfil#ajustes">
              <Icon name="settings" /> Ajustes
            </Link>
          </Menu.Item>
          <Menu.Separator className="divider" style={{ margin: '4px 0' }} />
          <Menu.Item className="menu-item" onSelect={() => void signOut()}>
            <Icon name="arrow_back" /> Salir
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function TopBar() {
  const shell = useShell()!;
  const { user, streak, next } = shell.data;
  const unread = useUnread(shell.data.unread);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const main = document.getElementById('main');
    const on = () => setScrolled((main && main.scrollTop > 4) || window.scrollY > 4);
    main?.addEventListener('scroll', on, { passive: true });
    window.addEventListener('scroll', on, { passive: true });
    return () => (main?.removeEventListener('scroll', on), window.removeEventListener('scroll', on));
  }, []);
  return (
    <header className="topbar" data-scrolled={scrolled}>
      <Link href="/" className="topbar-brand" aria-label="Inicio">
        <Isotype size={28} />
        <em className="r-em">Academia</em>
      </Link>
      <div className="topbar-search">
        <button type="button" className="search-trigger" onClick={shell.openSearch} aria-label="Buscar cursos, clases y prácticas" aria-keyshortcuts="Meta+K Control+K">
          <Icon name="search" />
          <span>¿Qué quieres practicar hoy?</span>
          <span className="kbd">⌘K</span>
        </button>
      </div>
      <div className="topbar-actions">
        {user ? (
          <>
            {streak && <StreakPill streak={streak} />}
            <button type="button" className="icon-btn" onClick={shell.openNotifs} aria-label={unread ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}>
              <Icon name="notifications" />
              {unread > 0 && <span className="dot-badge tnum">{unread > 9 ? '9+' : unread}</span>}
            </button>
            {next && (
              <Link className={btn('tertiary', 'md', 'ask-top')} href={`${next.href}?ask=1`}>
                <span className="iso sm" aria-hidden="true" />
                Pregunta
              </Link>
            )}
            <UserMenu name={user.name} />
          </>
        ) : (
          <Link className={btn('primary')} href="/entrar">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}

export function MobileNav() {
  const path = usePathname();
  const shell = useShell()!;
  const items = [
    { href: '/', label: 'Inicio', icon: 'home' },
    { href: '/cursos', label: 'Cursos', icon: 'school' },
    { href: shell.data.next?.href ?? '/practicas/fuegos', label: 'Práctica', icon: 'self_improvement' },
    { href: '/circulos', label: 'Círculos', icon: 'groups' },
    { href: shell.data.user ? '/perfil' : '/entrar', label: 'Perfil', icon: 'person' },
  ];
  return (
    <nav className="mnav" aria-label="Navegación">
      <div className="mnav-bar">
        {items.map((n) => (
          <Link key={n.label} href={n.href} className="mnav-item" aria-current={isCur(path, n.href) ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </div>
      <button type="button" className="mnav-search" onClick={shell.openSearch} aria-label="Buscar">
        <Icon name="search" size={24} />
      </button>
    </nav>
  );
}

/** Shell ≥1024: sidebar 250/72 + barra superior 64. En móvil: barra de cristal flotante abajo. */
export function AppShell({ data, collapsed, children }: { data: ShellData; collapsed: boolean; children: React.ReactNode }) {
  return (
    <ShellProvider data={data}>
      <div className="shell">
        <Sidebar initialCollapsed={collapsed} />
        <div className="shell-main" id="main">
          <TopBar />
          {children}
        </div>
      </div>
      <MobileNav />
    </ShellProvider>
  );
}

