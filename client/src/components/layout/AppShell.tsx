import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, Compass, LayoutDashboard, Bell, Crown } from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../../context/AuthContext';

const MOBILE_NAV = [
  { to: '/',         icon: <Home className="w-5 h-5" />,          label: 'Home',    public: true },
  { to: '/explore',  icon: <Compass className="w-5 h-5" />,       label: 'Explore', public: true },
  { to: '/dashboard',icon: <LayoutDashboard className="w-5 h-5" />,label: 'Dashboard', public: false },
  { to: '/notifications', icon: <Bell className="w-5 h-5" />,     label: 'Alerts',  public: false },
  { to: '/creator',  icon: <Crown className="w-5 h-5" />,         label: 'Studio',  creatorOnly: true },
];

export default function AppShell() {
  const { isAuthenticated, isCreator } = useAuth();
  const { pathname } = useLocation();

  const navItems = MOBILE_NAV.filter(n => {
    if (n.creatorOnly) return isAuthenticated && isCreator;
    if (!n.public) return isAuthenticated;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary">
      <Navbar />
      <main className="flex-1 pt-16 lg:pt-18 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Footer />

      {/* Mobile bottom nav */}
      {isAuthenticated && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/8 bg-bg-surface/95 backdrop-blur-md">
          <div className="flex items-center justify-around px-2 py-2 safe-area-bottom">
            {navItems.map((n) => {
              const active = pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${active ? 'text-gold' : 'text-arc-muted hover:text-arc-secondary'}`}
                >
                  {n.icon}
                  <span className="text-[10px] font-medium">{n.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
