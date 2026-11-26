'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PERMISSIONS } from '@/constants/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/common/PageHeader';
import DataTable from '@/components/Common/DataTable';
import Toast from '@/components/Common/Toast';
import TableActionButton from '@/components/Common/TableActionButton';
import { Button, Input, Badge, ConfirmModal } from '@/components/ui';
import apiClient from '@/lib/api';
import {
  Shield,
  Save,
  Lock,
  Loader2,
  RefreshCw,
  X,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
} from '@/components/icons';

const CORE_ROLE_ORDER = ['Super Admin', 'Admin', 'Developer', 'Member'];

function sortRoles(list = []) {
  return [...list].sort((a, b) => {
    const idxA = CORE_ROLE_ORDER.indexOf(a.name);
    const idxB = CORE_ROLE_ORDER.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });
}

const RESOURCE_BUNDLES = [
  {
    id: 'induction',
    label: 'Induction Services',
    matchResources: [
      'induction',
      'induction_application',
      'induction_evaluation',
      'induction_interview',
      'induction_settings',
      'induction_account',
    ],
  },
  {
    id: 'teams',
    label: 'Teams',
    matchResources: ['team'],
  },
  {
    id: 'inquiries',
    label: 'Inquiries',
    matchResources: ['cms_queries'],
  },
  {
    id: 'notices_faqs',
    label: 'Notices + FAQs',
    matchResources: ['cms_notices', 'cms_faqs'],
  },
  {
    id: 'incubations',
    label: 'Incubations',
    matchResources: ['cms_incubations'],
  },
  {
    id: 'talks',
    label: 'Entrepreneurship Talks',
    matchResources: ['cms_talks'],
  },
  {
    id: 'events',
    label: 'Events',
    matchResources: ['cms_events', 'event'],
  },
  {
    id: 'gallery',
    label: 'Gallery',
    matchResources: ['cms_gallery'],
  },
];

export default function RoleManagementPage() {
  const [roles, setRoles] = useState([]);
  const [canonicalPermissions, setCanonicalPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Create / Edit Role modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: '',
    bundleIds: [],
  });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permRes] = await Promise.all([
        apiClient.get('/roles'),
        apiClient.get('/roles/permissions'),
      ]);
      setRoles(sortRoles(rolesRes?.roles || []));
      setCanonicalPermissions(permRes?.permissions || []);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setToast({
        type: 'error',
        message: 'Failed to load roles and resources from backend.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resourceBundles = useMemo(
    () =>
      RESOURCE_BUNDLES.map((bundle) => ({
        ...bundle,
        perms: canonicalPermissions.filter((p) =>
          bundle.matchResources.includes(p.resource)
        ),
      })).filter((b) => b.perms.length > 0),
    [canonicalPermissions]
  );

  const getRoleBundleIds = useCallback(
    (role) => {
      if (!role) return [];
      if (role.name === 'Super Admin') return resourceBundles.map((b) => b.id);
      const roleKeys = new Set(
        (role.permissions || []).map((p) =>
          typeof p === 'string' ? p : p.key || `${p.resource}:${p.action}:${p.scope}`
        )
      );
      return resourceBundles
        .filter((b) => b.perms.some((p) => roleKeys.has(p.key)))
        .map((b) => b.id);
    },
    [resourceBundles]
  );

  const handleOpenCreate = () => {
    setEditingRole(null);
    setRoleForm({ name: '', bundleIds: [] });
    setIsModalOpen(true);
  };

  const handleOpenEdit = useCallback(
    (role) => {
      setEditingRole(role);
      setRoleForm({
        name: role.name || '',
        bundleIds: getRoleBundleIds(role),
      });
      setIsModalOpen(true);
    },
    [getRoleBundleIds]
  );

  const toggleBundle = (bundleId) => {
    setRoleForm((prev) => {
      const exists = prev.bundleIds.includes(bundleId);
      return {
        ...prev,
        bundleIds: exists
          ? prev.bundleIds.filter((id) => id !== bundleId)
          : [...prev.bundleIds, bundleId],
      };
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) return;

    setSavingRole(true);
    try {
      const permKeys = [];
      roleForm.bundleIds.forEach((bId) => {
        const bundle = resourceBundles.find((b) => b.id === bId);
        if (bundle) {
          bundle.perms.forEach((p) => permKeys.push(p.key));
        }
      });
      const uniqueKeys = Array.from(new Set(permKeys));

      if (editingRole) {
        const isCore = editingRole.isSystem || CORE_ROLE_ORDER.includes(editingRole.name);
        if (isCore) {
          await apiClient.put(`/roles/${editingRole.id}/permissions`, {
            permissionKeys: uniqueKeys,
          });
        } else {
          await apiClient.put(`/roles/${editingRole.id}`, {
            name: roleForm.name.trim(),
            permissionKeys: uniqueKeys,
          });
        }
        setToast({
          type: 'success',
          message: `Role "${roleForm.name.trim()}" updated.`,
        });
      } else {
        await apiClient.post('/roles', {
          name: roleForm.name.trim(),
          permissionKeys: uniqueKeys,
        });
        setToast({
          type: 'success',
          message: `Role "${roleForm.name.trim()}" created.`,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to save role.',
      });
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deleteRoleTarget) return;
    try {
      await apiClient.delete(`/roles/${deleteRoleTarget.id}`);
      setToast({
        type: 'success',
        message: `Role "${deleteRoleTarget.name}" deleted.`,
      });
      setDeleteRoleTarget(null);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Failed to delete role.',
      });
      setDeleteRoleTarget(null);
    }
  };

  const isEditingSuperAdmin = editingRole?.name === 'Super Admin';
  const isEditingCore =
    Boolean(editingRole) &&
    (editingRole.isSystem || CORE_ROLE_ORDER.includes(editingRole.name));

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Role Name',
        sortable: true,
        render: (role) => (
          <span className="font-bold text-slate-900 text-sm">{role.name}</span>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        sortable: false,
        render: (role) => {
          const isCustom = !role.isSystem && !CORE_ROLE_ORDER.includes(role.name);
          return (
            <Badge variant={isCustom ? 'blue' : 'slate'} size="xs">
              {isCustom ? 'Custom' : 'System'}
            </Badge>
          );
        },
      },
      {
        key: 'resources',
        header: 'Resources',
        sortable: false,
        render: (role) => {
          const isSuper = role.name === 'Super Admin';
          const bundleLabels = isSuper
            ? ['All Resources (Full Authority)']
            : resourceBundles
                .filter((b) => getRoleBundleIds(role).includes(b.id))
                .map((b) => b.label);

          return bundleLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {bundleLabels.map((lbl) => (
                <Badge key={lbl} variant={isSuper ? 'purple' : 'blue'} size="xs">
                  {lbl}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              No resources assigned
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        className: 'text-center',
        render: (role) => {
          const isCustom = !role.isSystem && !CORE_ROLE_ORDER.includes(role.name);
          const isSuper = role.name === 'Super Admin';

          if (isSuper) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Locked
              </span>
            );
          }

          return (
            <div className="inline-flex items-center justify-center gap-1.5">
              <TableActionButton
                icon={Edit2}
                label="Edit"
                onClick={() => handleOpenEdit(role)}
              />
              {isCustom && (
                <TableActionButton
                  icon={Trash2}
                  label="Delete"
                  tone="danger"
                  onClick={() => setDeleteRoleTarget(role)}
                />
              )}
            </div>
          );
        },
      },
    ],
    [resourceBundles, getRoleBundleIds, handleOpenEdit]
  );

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS}>
      <div className="space-y-5 animate-in fade-in duration-200">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <PageHeader
          icon={Shield}
          title="Role Management"
          description="Create and manage roles and their assigned resource permissions."
          actions={
            <div className="flex items-center gap-2">
              <TableActionButton
                icon={RefreshCw}
                label="Refresh"
                size="md"
                tooltipSide="bottom"
                onClick={loadData}
                disabled={isLoading}
                iconClassName={isLoading ? 'animate-spin' : ''}
              />
              <TableActionButton
                icon={Plus}
                label="Add Role"
                tone="primary"
                size="md"
                tooltipSide="bottom"
                onClick={handleOpenCreate}
              />
            </div>
          }
        />

        {/* Roles DataTable */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-md border border-[#E2E8F0] shadow-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
            <p className="text-xs">Loading roles...</p>
          </div>
        ) : (
          <DataTable
            data={roles}
            columns={columns}
            searchPlaceholder="Search roles..."
            searchKeys={['name']}
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            emptyMessage="No roles found."
          />
        )}

        {/* Create / Edit Role Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingRole ? 'Edit Role' : 'Add Role'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Assign resource access permissions for this role.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRole} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Role Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Media Manager, Induction Coordinator"
                    value={roleForm.name}
                    disabled={isEditingCore}
                    onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Assigned Resources
                    </label>
                    <span className="text-[11px] text-[#1E40AF] font-semibold">
                      {roleForm.bundleIds.length} / {resourceBundles.length} selected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {resourceBundles.map((bundle) => {
                      const selected = roleForm.bundleIds.includes(bundle.id);
                      return (
                        <button
                          key={bundle.id}
                          type="button"
                          disabled={isEditingSuperAdmin}
                          onClick={() => toggleBundle(bundle.id)}
                          className={`px-3 py-2.5 rounded-lg border text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-blue-50 border-blue-200 text-[#1E40AF]'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{bundle.label}</span>
                          {selected && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    disabled={savingRole}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={savingRole ? Loader2 : Save}
                    disabled={savingRole || !roleForm.name.trim()}
                  >
                    {savingRole ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(deleteRoleTarget)}
          onClose={() => setDeleteRoleTarget(null)}
          onConfirm={handleDeleteRole}
          title="Delete Role"
          message={`Are you sure you want to delete "${deleteRoleTarget?.name}"? Any users with only this role will be reassigned to Member.`}
          confirmText="Delete Role"
          variant="danger"
        />
      </div>
    </ProtectedRoute>
  );
}
