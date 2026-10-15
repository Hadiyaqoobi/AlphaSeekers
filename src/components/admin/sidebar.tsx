'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/components/logout-button';

type SidebarProps = {
  locale: string;
  userName: string;
  userRole: string;
  userEmail?: string | null;
  /** True for super admins — reveals the Super Admin console entry. */
  isSuper?: boolean;
  /** Granular "module.action" permissions for scoped employees. */
  permissions?: string[];
  /** Legacy full admin or super admin — sees every admin nav item. */
  unrestricted?: boolean;
};

type NavItem = { href: string; label: string; icon: string };
type NavGroup = { items: NavItem[] };

export function Sidebar({
  locale,
  userName,
  userRole,
  isSuper = false,
  permissions = [],
  unrestricted = false,
}: SidebarProps) {
  const t = useTranslations('nav');
  // Labels that already have Dari in other namespaces are reused rather than
  // duplicated as new (English-only) nav keys.
  const tAll = useTranslations();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const close = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handleKey); };
  }, [mobileOpen, close]);

  const isAdmin = userRole === 'ADMIN';
  // Teacher pages (my classes, my hours, class setup) are for teachers only: an
  // admin teaches no classes, so they opened empty. Staff manage teachers from
  // the admin pages.
  const isTeacher = userRole === 'TEACHER';

  // The raw enum (STUDENT/TEACHER/ADMIN) used to be printed under the name.
  const roleLabel =
    userRole === 'STUDENT'
      ? tAll('register.student')
      : userRole === 'TEACHER'
        ? tAll('register.teacher')
        : userRole === 'ADMIN'
          ? tAll('admin.title')
          : userRole;

  // A scoped employee (role=ADMIN with explicit permissions) only sees the
  // admin items it can actually use. Legacy/unrestricted admins see everything.
  const permSet = new Set(permissions);
  const canSee = (perm: string) => unrestricted || permSet.has(perm);

  const groups: NavGroup[] = [
    {
      items: [
        { href: `/${locale}/dashboard`, label: t('dashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { href: `/${locale}/classes`, label: t('classes'), icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      ],
    },
    {
      items: [
        { href: `/${locale}/webinars`, label: t('webinars'), icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z' },
        { href: `/${locale}/library`, label: t('library'), icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
        { href: `/${locale}/opportunities`, label: t('opportunities'), icon: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z' },
      ],
    },
    {
      items: [
        { href: `/${locale}/learn`, label: t('selfLearning'), icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5' },
        { href: `/${locale}/study-assistant`, label: t('aiTutor'), icon: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' },
        { href: `/${locale}/team`, label: t('team'), icon: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
        // Public stories: open to every signed-in user (moderation is the admin item below).
        { href: `/${locale}/stories`, label: t('stories'), icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10' },
      ],
    },
    // Account: password change, notification settings, Telegram and push all
    // live on Profile, which signed-in users previously had no link to. Contact
    // is the help route every role can open (the support queue needs
    // support.view, which teachers and students do not have).
    {
      items: [
        { href: `/${locale}/profile`, label: t('profile'), icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' },
        { href: `/${locale}/contact`, label: t('contact'), icon: 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z' },
      ],
    },
    ...(isAdmin ? [{
      items: [
        { href: `/${locale}/staff/dashboard`, label: t('staff'), icon: 'M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5' },
        ...(canSee('users.view') ? [{ href: `/${locale}/admin/users`, label: t('users'), icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H9m6 0a5.97 5.97 0 00-.786-3.07M9 19.128v-.003c0-1.113.285-2.16.786-3.07M9 19.128H2.25a8.963 8.963 0 01-.727-3.071A3 3 0 014.5 10.365c.266-.068.54-.104.818-.104M9 19.128a5.97 5.97 0 01.786-3.07' }] : []),
        ...(canSee('classes.view') ? [{ href: `/${locale}/admin/classes`, label: t('admin'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }] : []),
        ...(canSee('content.view') ? [{ href: `/${locale}/admin/posts`, label: t('storyModeration'), icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' }] : []),
        ...(canSee('analytics.view') ? [{ href: `/${locale}/admin/analytics`, label: t('analytics'), icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' }] : []),
        ...(canSee('system.settings') ? [{ href: `/${locale}/admin/settings`, label: t('siteSettings'), icon: 'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75' }] : []),
        ...(canSee('support.view') ? [{ href: `/${locale}/admin/support`, label: t('support'), icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z' }] : []),
        // AI Health is superadmin-only
        ...(isSuper ? [{ href: `/${locale}/admin/ai`, label: t('aiHealth'), icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z' }] : []),
      ],
    }] : []),
    // Super Admin console — internal staff tooling, super admins only.
    ...(isSuper ? [{
      items: [
        { href: `/${locale}/super`, label: 'Super Admin', icon: 'M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z' },
      ],
    }] : []),
    // A teacher only needs their classes: staff set every date and time, and the
    // Meet link reaches the teacher by email (availability and setup pages are
    // no longer offered to them).
    ...(isTeacher ? [{
      items: [
        { href: `/${locale}/teacher/classes`, label: tAll('dashboard.sections.myClasses'), icon: 'M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342' },
      ],
    }] : []),
  ];

  const initial = (userName ?? 'U').charAt(0).toUpperCase();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const navContent = (
    <div className="flex flex-col h-full" style={{ background: '#0A1118' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1A2D3D' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/wordmark-192.png"
          alt="AlphaSeekers"
          width={66}
          height={52}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.filter((group) => group.items.length > 0).map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="flex items-center gap-3 px-3 h-10 rounded-lg text-sm transition-colors relative"
                  style={
                    active
                      ? {
                          background: 'rgba(0, 230, 118, 0.10)',
                          color: '#00E676',
                          fontWeight: 500,
                        }
                      : { color: '#8AA4B8' }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(0, 230, 118, 0.05)';
                      e.currentTarget.style.color = '#E8EEF2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.color = '#8AA4B8';
                    }
                  }}
                >
                  {active && (
                    <span
                      className="absolute start-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-e"
                      style={{ background: '#00E676', boxShadow: '0 0 6px rgba(0,230,118,0.6)' }}
                    />
                  )}
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1A2D3D' }}>
        <div className="flex items-center gap-3 mb-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: '#142230', color: '#00E676', border: '1px solid rgba(0,230,118,0.2)' }}
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: '#E8EEF2' }}>{userName}</p>
            <p className="text-xs" style={{ color: '#5A7A94' }}>{roleLabel}</p>
          </div>
        </div>
        <LogoutButton callbackUrl={`/${locale}`} label={t('logout')} variant="nav" />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 start-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ background: '#0D1419', border: '1px solid #1A2D3D' }}
        onClick={() => setMobileOpen(true)}
        aria-label={t('openMenu')}
      >
        <svg className="w-5 h-5" style={{ color: '#8AA4B8' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={close} aria-hidden="true" />
      )}

      {/* Sidebar panel. On desktop it is sticky, not static: static, it scrolled
          away with the page and left "Log out" floating halfway down long pages. */}
      <aside
        className={`fixed top-0 start-0 z-40 h-screen w-64 transition-transform lg:translate-x-0 lg:rtl:translate-x-0 lg:sticky lg:top-0 lg:z-auto ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
        style={{ background: '#0A1118', borderInlineEnd: '1px solid #1A2D3D' }}
      >
        {/* Mobile close */}
        {mobileOpen && (
          <button
            className="absolute top-4 end-3 lg:hidden flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: '#8AA4B8' }}
            onClick={close}
            aria-label={t('closeMenu')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {navContent}
      </aside>
    </>
  );
}
