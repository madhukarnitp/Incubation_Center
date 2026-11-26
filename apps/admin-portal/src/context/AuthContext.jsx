'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import { getApiBaseUrl } from '@/lib/env';
import { PERMISSIONS, ROLES } from '@/constants/rbac';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Validate session against the centralized backend API
  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get('/users/me');
      if (res && res.user) {
        const primaryRole = res.isSuperAdmin
          ? 'Super Admin'
          : res.roles?.[0]?.name || res.user.role || 'Member';
        const userTeams = res.teams || res.user.teams || [];
        const teamAdminFlag =
          Boolean(res.isTeamAdmin) ||
          userTeams.some((t) =>
            ['lead', 'co-lead', 'club secretary', 'coordinator'].includes(
              (t.position || '').toLowerCase()
            )
          );
        const normalizedUser = {
          ...res.user,
          role: primaryRole,
          roles: res.roles || [],
          teams: userTeams,
          isTeamAdmin: teamAdminFlag,
        };
        setCurrentUser(normalizedUser);
        setRoles(res.roles || []);
        setPermissions(res.permissions || []);
        setIsSuperAdmin(Boolean(res.isSuperAdmin));
        setIsTeamAdmin(teamAdminFlag);
        return normalizedUser;
      }
      setCurrentUser(null);
      setRoles([]);
      setPermissions([]);
      setIsSuperAdmin(false);
      setIsTeamAdmin(false);
      return null;
    } catch {
      // 401 Unauthorized or no active session
      setCurrentUser(null);
      setRoles([]);
      setPermissions([]);
      setIsSuperAdmin(false);
      setIsTeamAdmin(false);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  /**
   * Google OAuth Login Initiation
   * Redirects the user directly to BetterAuth Google Social sign-in
   */
  const initiateGoogleSignIn = async () => {
    const apiBaseUrl = getApiBaseUrl();
    const callbackURL = `${window.location.origin}/dashboard`;

    try {
      // 1. First try POST to BetterAuth sign-in social endpoint
      const res = await fetch(`${apiBaseUrl}/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          provider: 'google',
          callbackURL,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch (err) {
      console.warn('POST /auth/sign-in/social error, falling back to GET navigation:', err);
    }

    // 2. Direct browser navigation to GET /auth/sign-in/social
    window.location.href = `${apiBaseUrl}/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackURL)}`;
  };

  /**
   * Server-side Session Invalidation & Logout
   */
  const logout = async () => {
    try {
      await apiClient.post('/auth/sign-out', {});
    } catch (err) {
      console.warn('Error during backend sign out:', err);
    } finally {
      setCurrentUser(null);
      setRoles([]);
      setPermissions([]);
      setIsSuperAdmin(false);
      setIsTeamAdmin(false);
      router.push('/login');
    }
  };

  /**
   * Permission Verification
   * Supports both legacy shorthand keys and backend canonical RBAC keys.
   */
  const hasPermission = (permission) => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;

    const userRole = roles[0]?.name || currentUser.role;
    if (userRole === ROLES.SUPER_ADMIN || userRole === 'Super Admin') return true;
    if (roles.some((r) => r.name?.toLowerCase() === 'developer')) return true;

    // Check direct match
    if (permissions.includes(permission)) return true;

    // Shorthand <-> Canonical key mapping
    const MAPPINGS = {
      [PERMISSIONS.MANAGE_GALLERY]: ['cms_gallery:manage:any', 'cms_gallery:read:any', 'cms_gallery:create:any', 'cms_gallery:update:any', 'cms_gallery:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_NOTICES]: ['cms_notices:manage:any', 'cms_notices:read:any', 'cms_notices:create:any', 'cms_notices:update:any', 'cms_notices:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_EVENTS]: ['cms_events:manage:any', 'cms_events:read:any', 'cms_events:create:any', 'cms_events:update:any', 'cms_events:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_INCUBATIONS]: ['cms_incubations:manage:any', 'cms_incubations:read:any', 'cms_incubations:create:any', 'cms_incubations:update:any', 'cms_incubations:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_TALKS]: ['cms_talks:manage:any', 'cms_talks:read:any', 'cms_talks:create:any', 'cms_talks:update:any', 'cms_talks:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_FAQS]: ['cms_faqs:manage:any', 'cms_faqs:read:any', 'cms_faqs:create:any', 'cms_faqs:update:any', 'cms_faqs:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_QUERIES]: ['cms_queries:manage:any', 'cms_queries:read:any', 'cms_queries:create:any', 'cms_queries:update:any', 'cms_queries:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_TEAM]: ['cms_team:manage:any', 'cms_team:read:any', 'cms_team:create:any', 'cms_team:update:any', 'cms_team:delete:any', 'cms:read:any'],
      [PERMISSIONS.MANAGE_TEAMS]: ['team:read:any', 'team:create:any', 'team:update:any'],
      [PERMISSIONS.MANAGE_USERS]: ['user:read:any', 'user:create:any', 'user:update:any'],
      [PERMISSIONS.INDUCTION_VIEW]: ['induction_application:read:any'],
      [PERMISSIONS.INDUCTION_EVALUATE]: ['induction_evaluation:create:any', 'induction_evaluation:read:any'],
      [PERMISSIONS.INDUCTION_SETTINGS]: ['induction_settings:read:any', 'induction_settings:update:any'],
    };

    if (permission === PERMISSIONS.MANAGE_TEAMS && isTeamAdmin) {
      return true;
    }

    const alternatives = MAPPINGS[permission];
    if (alternatives && alternatives.some((alt) => permissions.includes(alt))) {
      return true;
    }

    return false;
  };

  /**
   * Granular CRUD check for a specific resource module (e.g. 'cms_gallery', 'create')
   */
  const hasCrudPermission = (resource, action = 'view') => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;
    const userRole = roles[0]?.name || currentUser.role;
    if (userRole === ROLES.SUPER_ADMIN || userRole === 'Super Admin') return true;
    if (roles.some((r) => r.name?.toLowerCase() === 'developer')) return true;

    const norm = action === 'view' ? 'read' : action;
    return (
      permissions.includes(`${resource}:${norm}:any`) ||
      permissions.includes(`${resource}:manage:any`) ||
      permissions.includes(`cms:${norm}:any`)
    );
  };

  /**
   * Route access verification
   */
  const canAccessRoute = (path) => {
    if (!currentUser) return false;
    if (isSuperAdmin) return true;

    const userRole = roles[0]?.name || currentUser.role;
    if (userRole === ROLES.SUPER_ADMIN || userRole === 'Super Admin') return true;
    if (roles.some((r) => r.name?.toLowerCase() === 'developer')) return true;

    if (path.startsWith('/profile') || path.startsWith('/activity-log')) return true;
    if (path === '/dashboard' || path === '/') {
      return (
        isTeamAdmin ||
        permissions.some((p) => !p.endsWith(':own')) ||
        (userRole !== ROLES.MEMBER && userRole !== 'Member')
      );
    }

    if (path.includes('/main-website/notices')) return hasPermission(PERMISSIONS.MANAGE_NOTICES);
    if (path.includes('/main-website/incubations')) return hasPermission(PERMISSIONS.MANAGE_INCUBATIONS);
    if (path.includes('/main-website/events')) return hasPermission(PERMISSIONS.MANAGE_EVENTS);
    if (path.includes('/main-website/team')) return hasPermission(PERMISSIONS.MANAGE_TEAM);
    if (path.includes('/main-website/gallery')) return hasPermission(PERMISSIONS.MANAGE_GALLERY);
    if (path.includes('/main-website/faqs')) return hasPermission(PERMISSIONS.MANAGE_FAQS);
    if (path.includes('/main-website/talks')) return hasPermission(PERMISSIONS.MANAGE_TALKS);
    if (path.includes('/main-website/queries')) return hasPermission(PERMISSIONS.MANAGE_QUERIES);
    if (path.includes('/users')) return hasPermission(PERMISSIONS.MANAGE_USERS);
    if (path.includes('/team-management')) return isTeamAdmin || hasPermission(PERMISSIONS.MANAGE_TEAMS) || hasPermission(PERMISSIONS.MANAGE_USERS);
    if (path.includes('/induction/evaluation')) return hasPermission(PERMISSIONS.INDUCTION_EVALUATE);
    if (path.includes('/induction/settings')) return hasPermission(PERMISSIONS.INDUCTION_SETTINGS);
    if (path.includes('/induction')) return hasPermission(PERMISSIONS.INDUCTION_VIEW);
    if (path.includes('/role-management')) return isSuperAdmin;

    return false;
  };

  /**
   * Update Profile
   */
  const updateProfile = async (formData) => {
    try {
      const res = await apiClient.put('/users/me', formData);
      if (res && res.user) {
        const primaryRole = res.isSuperAdmin
          ? 'Super Admin'
          : res.roles?.[0]?.name || res.user.role || 'Member';
        const userTeams = res.teams || res.user.teams || [];
        const teamAdminFlag =
          Boolean(res.isTeamAdmin) ||
          userTeams.some((t) =>
            ['lead', 'co-lead', 'club secretary', 'coordinator'].includes(
              (t.position || '').toLowerCase()
            )
          );
        const normalizedUser = {
          ...res.user,
          role: primaryRole,
          roles: res.roles || [],
          teams: userTeams,
          isTeamAdmin: teamAdminFlag,
        };
        setCurrentUser(normalizedUser);
        setIsTeamAdmin(teamAdminFlag);
        return normalizedUser;
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      throw err;
    }
  };

  const isAdmin =
    isSuperAdmin ||
    isTeamAdmin ||
    roles.some((r) => r.name === 'Admin' || r.name === ROLES.ADMIN);
  const isMember = roles.some((r) => r.name === 'Member' || r.name === ROLES.MEMBER);
  const isDeveloper = roles.some((r) => r.name?.toLowerCase() === 'developer');
  const canAddUser = isSuperAdmin || isDeveloper;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        roles,
        permissions,
        isLoading,
        isAuthenticated: Boolean(currentUser),
        isSuperAdmin,
        isTeamAdmin,
        isAdmin,
        isMember,
        isDeveloper,
        canAddUser,
        updateProfile,
        login: initiateGoogleSignIn,
        initiateGoogleSignIn,
        logout,
        checkSession,
        hasPermission,
        hasCrudPermission,
        canAccessRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
