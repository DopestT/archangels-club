import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, User, Bookmark, Radio } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../context/LanguageContext';
import Avatar from '../ui/Avatar';
import Logo from '../brand/Logo';
import NotificationCenter from '../notifications/NotificationCenter';
import LanguageSwitcher from '../ui/LanguageSwitcher';

export default function Navbar() {
  const { user, isAuthenticated, isCreator, isAdmin, logout } = useAuth();
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [location.pathname]);

  function handleLogout() { logout(); navigate('/'); }

  const navLinks = [
    { to: '/explore',  label: t('nav.explore') },
    ...(isAuthenticated ? [{ to: '/live', label: t('live.now'), live: true }] : []),
    ...(isAuthenticated ? [{ to: '/dashboard', label: t('nav.dashboard') }] : []),
    ...(isAuthenticated && !isAdmin ? [{ to: '/vault', label: t('member.vault') }] : []),
    ...(isCreator ? [{ to: '/creator', label: t('nav.creator_studio') }] : []),
    ...(isAdmin ? [{ to: '/admin', label: t('nav.admin') }] : []),
  ] as { to: string; label: string; live?: boolean }[];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-bg-primary/96 backdrop-blur-md border-b border-gold-border/50' : 'bg-transparent'}`}>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo — icon on mobile, wordmark on desktop */}
          <Link to="/" className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity">
            <span className="md:hidden"><Logo variant="icon" size="sm" /></span>
            <span className="hidden md:block"><Logo variant="wordmark" size="sm" /></span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 xl:gap-2">
            {navLinks.map(({ to, label, live }) => (
              <Link key={to} to={to} className={`relative px-4 py-2 xl:px-5 text-sm font-sans rounded transition-colors flex items-center gap-1.5 ${location.pathname === to || location.pathname.startsWith(to + '/') ? 'text-gold' : 'text-arc-secondary hover:text-white'}`}>
                {live && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"
                    style={{
                      transformOrigin: 'center bottom',
                      animation: 'pixar-dot-bounce 1.1s cubic-bezier(0.22,1,0.36,1) both, live-dot-pulse 2.2s ease-in-out 1.1s infinite',
                    }}
                  />
                )}
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            {isAuthenticated ? (
              <>
                <NotificationCenter />
                <div className="relative">
                  <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 p-1 rounded-full hover:bg-bg-hover transition-colors">
                    <Avatar src={user?.avatar_url} name={user?.display_name} size="sm" ring />
                    <span className="text-sm text-arc-secondary pr-1">{user?.display_name}</span>
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-bg-surface border border-gold-border rounded-xl overflow-hidden shadow-gold z-50">
                      <div className="px-4 py-3 border-b border-gold-border/50">
                        <p className="text-xs text-arc-secondary font-sans">Signed in as</p>
                        <p className="text-sm text-white font-medium truncate">{user?.email}</p>
                      </div>
                      <div className="p-1.5">
                        <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm text-arc-secondary hover:text-white hover:bg-bg-hover rounded-lg transition-colors">
                          <LayoutDashboard className="w-4 h-4" /> {t('nav.dashboard')}
                        </Link>
                        {!isAdmin && (
                          <Link to="/vault" className="flex items-center gap-3 px-3 py-2 text-sm text-arc-secondary hover:text-white hover:bg-bg-hover rounded-lg transition-colors">
                            <Bookmark className="w-4 h-4" /> {t('member.vault')}
                          </Link>
                        )}
                        {isCreator && (
                          <Link to="/creator" className="flex items-center gap-3 px-3 py-2 text-sm text-arc-secondary hover:text-white hover:bg-bg-hover rounded-lg transition-colors">
                            <User className="w-4 h-4" /> {t('nav.creator_studio')}
                          </Link>
                        )}
                        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-arc-error hover:bg-arc-error/10 rounded-lg transition-colors">
                          <LogOut className="w-4 h-4" /> {t('nav.sign_out')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">{t('nav.sign_in')}</Link>
                <Link to="/signup" className="btn-gold text-sm px-5 py-2.5">{t('nav.request_access')}</Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2 text-arc-secondary hover:text-white" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg-surface border-t border-gold-border/50 px-4 py-4">
          <nav className="flex flex-col gap-1 mb-4">
            {navLinks.map(({ to, label, live }) => (
              <Link key={to} to={to} className="px-4 py-3 text-sm font-sans text-arc-secondary hover:text-white rounded-lg hover:bg-bg-hover transition-colors flex items-center gap-2">
                {live && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-red-500"
                    style={{
                      transformOrigin: 'center bottom',
                      animation: 'pixar-dot-bounce 1.1s cubic-bezier(0.22,1,0.36,1) both, live-dot-pulse 2.2s ease-in-out 1.1s infinite',
                    }}
                  />
                )}
                {label}
              </Link>
            ))}
          </nav>
          {isAuthenticated ? (
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-arc-error border border-arc-error/30 rounded-lg mb-2">
              <LogOut className="w-4 h-4" /> {t('nav.sign_out')}
            </button>
          ) : (
            <div className="flex flex-col gap-2 mb-2">
              <Link to="/login" className="btn-outline w-full text-center">{t('nav.sign_in')}</Link>
              <Link to="/signup" className="btn-gold w-full text-center">{t('nav.request_access')}</Link>
            </div>
          )}
          <div className="border-t border-white/5 pt-2">
            <LanguageSwitcher compact />
          </div>
        </div>
      )}
    </header>
  );
}
