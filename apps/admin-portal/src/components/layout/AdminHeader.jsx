'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { SIDEBAR_NAV_GROUPS } from '@/constants/sidebarNav';
import { PERMISSIONS } from '@/constants/rbac';
import { formatTimeAgo } from '@/utils/timeUtils';
import apiClient from '@/lib/api';
import {
  Menu,
  Bell,
  Search,
  User,
  LogOut,
  History,
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  X,
} from '@/components/icons';

export default function AdminHeader({ setIsSidebarOpen }) {
  const router = useRouter();
  const { currentUser, isSuperAdmin, hasPermission, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const [currentDate] = useState(() => {
    const d = new Date();
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  });

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      if (!currentUser) return;
      try {
        const res = await apiClient.get('/activity-logs?limit=5').catch(() => null);
        if (active && res?.logs) {
          setNotifications(
            res.logs.map((l) => ({
              id: l.id,
              title: l.category || 'Activity',
              subtitle: `${l.user}: ${l.action}`,
              time: l.timestamp,
              href: '/activity-log',
            }))
          );
        }
      } catch {
        // Non-blocking
      }
    }
    loadNotifications();
    return () => {
      active = false;
    };
  }, [currentUser]);

  const searchableRoutes = useMemo(() => {
    const items = [];
    SIDEBAR_NAV_GROUPS.forEach((group) => {
      group.items.forEach((item) => {
        const allowed =
          isSuperAdmin ||
          item.href === '/profile' ||
          (item.permission ? hasPermission(item.permission) : true);
        if (allowed) {
          items.push({ ...item, group: group.title });
        }
      });
    });
    return items;
  }, [isSuperAdmin, hasPermission]);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (window.innerWidth < 640) {
          setIsMobileSearchOpen(true);
        } else {
          searchInputRef.current?.focus();
          setIsSearchOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const filteredRoutes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchableRoutes.slice(0, 6);
    return searchableRoutes
      .filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.group.toLowerCase().includes(q) ||
          r.href.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, searchableRoutes]);

  const navigateToRoute = (href) => {
    router.push(href);
    setSearchQuery('');
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setActiveIndex(0);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (!isSearchOpen) {
      setIsSearchOpen(true);
      searchInputRef.current?.focus();
      return;
    }
    const target = filteredRoutes[activeIndex] || filteredRoutes[0];
    if (target) {
      navigateToRoute(target.href);
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchOpen(true);
      setActiveIndex((prev) =>
        filteredRoutes.length ? (prev + 1) % filteredRoutes.length : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchOpen(true);
      setActiveIndex((prev) =>
        filteredRoutes.length
          ? (prev - 1 + filteredRoutes.length) % filteredRoutes.length
          : 0
      );
    } else if (e.key === 'Enter' && filteredRoutes.length > 0) {
      e.preventDefault();
      const target = filteredRoutes[activeIndex] || filteredRoutes[0];
      if (target) navigateToRoute(target.href);
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-[64px] w-full items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8 shadow-xs">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden focus:outline-none transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden md:flex flex-col min-w-0">
          <h1 className="text-sm lg:text-base font-semibold text-slate-700 leading-tight">
            Welcome back,{' '}
            <span className="font-bold text-slate-900">
              {currentUser?.name || 'Administrator'}
            </span>
          </h1>
          <p className="text-[11px] text-slate-500 font-normal leading-normal">
            Incubation Center NIT Patna
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 lg:gap-3 shrink-0">
        <div className="hidden xl:flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-slate-600">
          <CalendarDays className="w-4 h-4 text-[#1E40AF]" />
          <span>{currentDate || 'Today'}</span>
        </div>

        {/* Mobile Search Button */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSearchOpen(true);
            setActiveIndex(0);
          }}
          className="sm:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Search portal"
          title="Search portal"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Live Portal Quick Search */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative hidden sm:block w-56 lg:w-72"
        >
          <button
            type="submit"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-[#1E40AF] transition-colors cursor-pointer"
            aria-label="Search"
            title="Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setActiveIndex(0);
              setIsSearchOpen(true);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search pages... (Ctrl+K)"
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1E40AF] focus:bg-white transition-all"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveIndex(0);
                searchInputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden lg:inline-block absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400 bg-white border border-slate-200 rounded pointer-events-none">
              ⌘K
            </kbd>
          )}
          {isSearchOpen && (
            <>
              <div
                onClick={() => setIsSearchOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute right-0 left-0 mt-1.5 rounded-lg border border-[#E2E8F0] bg-white shadow-lg z-50 divide-y divide-slate-100 overflow-hidden max-h-80 overflow-y-auto">
                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {searchQuery.trim() ? 'Matching Pages' : 'Quick Navigation'}
                </div>
                {filteredRoutes.length > 0 ? (
                  filteredRoutes.map((route, idx) => {
                    const Icon = route.icon;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={route.href}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => navigateToRoute(route.href)}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                          isActive ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {Icon && <Icon className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {route.label}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {route.group}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                      </button>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-slate-400">
                    No matching pages found for &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </div>
            </>
          )}
        </form>

        {/* Live Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen((prev) => !prev)}
            className="relative p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>

          {isNotifOpen && (
            <>
              <div
                onClick={() => setIsNotifOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute right-0 mt-1.5 w-80 rounded-md border border-[#E2E8F0] bg-white p-0 shadow-lg z-50">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#E2E8F0] bg-slate-50 rounded-t-md">
                  <p className="text-xs font-semibold text-slate-800">
                    Recent Activity ({notifications.length})
                  </p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-[#1E40AF] text-white">
                    Live
                  </span>
                </div>
                <div className="divide-y divide-[#E2E8F0] max-h-64 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.href}
                        onClick={() => setIsNotifOpen(false)}
                        className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-2.5 block"
                      >
                        <History className="w-4 h-4 text-[#1E40AF] shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {n.subtitle}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-0.5 block">
                            {n.time ? formatTimeAgo(n.time) : 'Just now'}
                          </span>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="p-5 text-center text-xs text-slate-400">
                      <CheckCircle2 className="w-5 h-5 mx-auto text-slate-300 mb-1" />
                      No recent notifications.
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-[#E2E8F0] text-center bg-slate-50 rounded-b-md">
                  <Link
                    href="/activity-log"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline"
                  >
                    View all activity logs
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Avatar & Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-0.5 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
          >
            {currentUser?.avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[#1E40AF] flex items-center justify-center text-xs font-bold text-white">
                {currentUser?.name?.[0] || 'U'}
              </span>
            )}
          </button>

          {isUserMenuOpen && (
            <>
              <div
                onClick={() => setIsUserMenuOpen(false)}
                className="fixed inset-0 z-40"
              />
              <div className="absolute right-0 mt-1.5 w-56 rounded-md border border-[#E2E8F0] bg-white p-2 shadow-lg z-50">
                <div className="px-2.5 py-2 border-b border-[#E2E8F0] mb-1 flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-blue-50 text-[#1E40AF] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                    {currentUser?.name?.[0] || 'U'}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {currentUser?.name}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {currentUser?.email}
                    </p>
                  </div>
                </div>

                <Link
                  href="/profile"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>My Profile</span>
                </Link>

                <div className="my-1 border-t border-[#E2E8F0]" />

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Search Modal */}
      {isMobileSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/50 backdrop-blur-xs sm:hidden"
          onClick={() => setIsMobileSearchOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2 px-3 py-2.5 border-b border-[#E2E8F0]"
            >
              <Search className="w-4 h-4 text-[#1E40AF] shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search admin pages..."
                className="flex-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsMobileSearchOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {filteredRoutes.length > 0 ? (
                filteredRoutes.map((route) => {
                  const Icon = route.icon;
                  return (
                    <button
                      key={route.href}
                      type="button"
                      onClick={() => navigateToRoute(route.href)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {Icon && <Icon className="w-4 h-4 text-[#1E40AF] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {route.label}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {route.group}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  No matching pages found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
