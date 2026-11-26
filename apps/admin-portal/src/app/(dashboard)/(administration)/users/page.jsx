'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DataTable from '@/components/Common/DataTable';
import Toast from '@/components/Common/Toast';
import TableActionButton from '@/components/Common/TableActionButton';
import PageHeader from '@/components/common/PageHeader';
import { Button, Input, Badge, ConfirmModal } from '@/components/ui';
import apiClient from '@/lib/api';
import TeamService from '@/services/admin/teamService';
import {
  Shield,
  UserPlus,
  UserCheck,
  Ban,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Save,
  Loader2,
  AlertCircle,
  Users2,
} from '@/components/icons';

export default function UserRoleManagementPage() {
  const { currentUser, canAddUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Detailed View Modal
  const [detailUser, setDetailUser] = useState(null);

  // Confirm Modals
  const [toast, setToast] = useState(null);
  const [banConfirmUser, setBanConfirmUser] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    teamId: '',
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [usersRes, teamsRes] = await Promise.all([
        apiClient.get('/users?limit=100'),
        TeamService.getTeams().catch(() => []),
      ]);

      setUsers(usersRes?.users || []);
      setAvailableTeams(teamsRes || []);
    } catch (err) {
      console.error('Failed to load user management data:', err);
      setToast({
        type: 'error',
        message: 'Failed to load user data. Please ensure you have sufficient permissions.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setModalError('');
    setFormData({
      name: '',
      email: '',
      phoneNumber: '',
      teamId: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setModalError('');
    const singleTeamId = user.team?.id || user.teams?.[0]?.id || '';
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phoneNumber: user.phoneNumber || '',
      teamId: singleTeamId,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        phoneNumber: formData.phoneNumber.trim() || undefined,
        teamId: formData.teamId || null,
      };

      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, payload);
        setToast({ type: 'success', message: `Updated ${formData.name} successfully.` });
      } else {
        await apiClient.post('/users', {
          ...payload,
          email: formData.email.trim(),
        });
        setToast({
          type: 'success',
          message: `User ${formData.email} registered. They may now sign in using Google OAuth.`,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Operation failed';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setModalLoading(false);
    }
  };

  const confirmToggleBan = async () => {
    const user = banConfirmUser;
    if (!user) return;
    setBanConfirmUser(null);

    try {
      if (user.banned) {
        await apiClient.delete(`/users/${user.id}/ban`);
        setToast({ type: 'success', message: `Unbanned ${user.name || user.email}.` });
      } else {
        await apiClient.post(`/users/${user.id}/ban`, { reason: 'Suspended by admin' });
        setToast({ type: 'success', message: `Banned ${user.name || user.email}.` });
      }
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update ban status',
      });
    }
  };

  const confirmDeleteUser = async () => {
    const user = deleteConfirmUser;
    if (!user) return;
    setDeleteConfirmUser(null);

    try {
      await apiClient.delete(`/users/${user.id}`);
      setToast({ type: 'success', message: `Deleted ${user.name || user.email}.` });
      if (detailUser?.id === user.id) setDetailUser(null);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err.response?.data?.error || 'Failed to delete user',
      });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (user) => {
        const isCurrent = user.id === currentUser?.id;
        return (
          <div className="flex items-center gap-2.5">
            {user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.image}
                alt={user.name || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0] shrink-0"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-[#1E40AF] text-white flex items-center justify-center font-bold text-xs shrink-0">
                {user.name?.[0] || user.email?.[0] || 'U'}
              </span>
            )}
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>{user.name || 'Unnamed'}</span>
              {isCurrent && <Badge variant="blue" size="xs">You</Badge>}
            </div>
          </div>
        );
      },
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      render: (user) => (
        <span className="text-xs text-slate-600">{user.email}</span>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      sortable: false,
      render: (user) => {
        const team = user.team || user.teams?.[0];
        if (!team) {
          return <span className="text-[11px] text-slate-400 italic">Unassigned</span>;
        }
        return (
          <Badge variant="blue" size="xs">
            {team.name}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (user) =>
        user.banned ? (
          <Badge variant="rose" icon={Ban}>
            Suspended
          </Badge>
        ) : (
          <Badge variant="emerald" icon={CheckCircle2}>
            Active
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      className: 'text-center',
      render: (user) => {
        const isCurrent = user.id === currentUser?.id;
        return (
          <div
            className="flex items-center justify-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <TableActionButton
              icon={Edit2}
              label="Edit"
              onClick={() => handleOpenEdit(user)}
            />
            {!isCurrent && (
              <>
                <TableActionButton
                  icon={user.banned ? UserCheck : Ban}
                  label={user.banned ? 'Unban' : 'Ban'}
                  tone={user.banned ? 'success' : 'warning'}
                  onClick={() => setBanConfirmUser(user)}
                />
                <TableActionButton
                  icon={Trash2}
                  label="Delete"
                  tone="danger"
                  onClick={() => setDeleteConfirmUser(user)}
                />
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_USERS}>
      <div className="space-y-5 animate-in fade-in duration-200">
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Page Header */}
        <PageHeader
          icon={Shield}
          title="Users"
          description="Click any user to view their team, personal roles, and account source. Each user belongs to at most one team."
          actionText={canAddUser ? 'Add User' : undefined}
          actionIcon={canAddUser ? UserPlus : undefined}
          onAction={canAddUser ? handleOpenAdd : undefined}
        />

        {/* User Data Table */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-md border border-[#E2E8F0] shadow-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
            <p className="text-xs">Loading registered users...</p>
          </div>
        ) : (
          <DataTable
            data={users}
            columns={columns}
            searchPlaceholder="Search by name or email..."
            searchKeys={['name', 'email']}
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50]}
            onRowClick={(user) => setDetailUser(user)}
            emptyMessage="No registered users found."
          />
        )}

        {/* Modal: Detailed User View */}
        {detailUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 font-sans">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {detailUser.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={detailUser.image}
                      alt={detailUser.name || 'User'}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <span className="w-11 h-11 rounded-full bg-[#1E40AF] text-white flex items-center justify-center font-bold text-base shrink-0">
                      {detailUser.name?.[0] || detailUser.email?.[0] || 'U'}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {detailUser.name || 'Unnamed User'}
                      </h3>
                      {detailUser.banned ? (
                        <Badge variant="rose" size="xs" icon={Ban}>
                          Suspended
                        </Badge>
                      ) : (
                        <Badge variant="emerald" size="xs" icon={CheckCircle2}>
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{detailUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailUser(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                {/* Suspension Alert if Banned */}
                {detailUser.banned && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
                    <Ban className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold">Account Suspended</div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        {detailUser.bannedReason || 'Suspended by administrator'}
                        {detailUser.bannedAt
                          ? ` · ${new Date(detailUser.bannedAt).toLocaleDateString()}`
                          : ''}
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile & Account Details Grid */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Profile &amp; Account Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-[#E2E8F0] bg-slate-50/50">
                      <div className="text-[11px] font-semibold text-slate-500">Email</div>
                      <div className="font-semibold text-slate-900 mt-0.5 break-all">
                        {detailUser.email}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[#E2E8F0] bg-slate-50/50">
                      <div className="text-[11px] font-semibold text-slate-500">Phone Number</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {detailUser.phoneNumber || (
                          <span className="text-slate-400 font-normal italic">Not provided</span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[#E2E8F0] bg-slate-50/50">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Department &amp; Post
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {[detailUser.department, detailUser.post].filter(Boolean).join(' · ') || (
                          <span className="text-slate-400 font-normal italic">Not specified</span>
                        )}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-[#E2E8F0] bg-slate-50/50">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Account Source &amp; Joined
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {detailUser.creationSource === 'induction'
                          ? 'Induction Selection'
                          : 'Manual Admin'}
                        {detailUser.createdAt
                          ? ` · ${new Date(detailUser.createdAt).toLocaleDateString()}`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bio & Social Links (if present) */}
                {(detailUser.bio ||
                  detailUser.linkedin ||
                  detailUser.github ||
                  detailUser.instagram) && (
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white space-y-2.5">
                    {detailUser.bio && (
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Bio
                        </div>
                        <p className="text-slate-700 leading-relaxed">{detailUser.bio}</p>
                      </div>
                    )}
                    {(detailUser.linkedin || detailUser.github || detailUser.instagram) && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {detailUser.linkedin && (
                          <a
                            href={detailUser.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 text-[11px] font-semibold text-[#1E40AF]"
                          >
                            LinkedIn
                          </a>
                        )}
                        {detailUser.github && (
                          <a
                            href={detailUser.github}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-800"
                          >
                            GitHub
                          </a>
                        )}
                        {detailUser.instagram && (
                          <a
                            href={detailUser.instagram}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-rose-50 text-[11px] font-semibold text-rose-700"
                          >
                            Instagram
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Team & Roles Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Assigned Team */}
                  <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Users2 className="w-3.5 h-3.5 text-[#1E40AF]" />
                        Team
                      </span>
                      {detailUser.team?.position && (
                        <Badge variant="blue" size="xs">
                          {detailUser.team.position}
                        </Badge>
                      )}
                    </div>
                    {detailUser.team ? (
                      <div className="space-y-2">
                        <div className="font-bold text-slate-900 text-sm">
                          {detailUser.team.name}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[11px] text-slate-500 mr-1">Team Roles:</span>
                          {(detailUser.team.roles || []).length > 0 ? (
                            detailUser.team.roles.map((r) => (
                              <Badge key={r.id} variant="purple" size="xs">
                                {r.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">None</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Not assigned to any team.</p>
                    )}
                  </div>

                  {/* Roles Assigned (Team Role + Additional Roles) */}
                  <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white space-y-2.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-700" />
                      Roles Assigned
                    </span>
                    {(detailUser.team?.roles || []).length === 0 &&
                    (detailUser.roles || []).length === 0 ? (
                      <p className="text-slate-400 italic">No roles assigned.</p>
                    ) : (
                      <div className="space-y-2">
                        {(detailUser.team?.roles || []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Team:
                            </span>
                            {detailUser.team.roles.map((r) => (
                              <Badge key={`team-${r.id}`} variant="purple" size="xs">
                                {r.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(detailUser.roles || []).length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-500">
                              Additional:
                            </span>
                            {detailUser.roles.map((r) => (
                              <Badge key={`add-${r.id}`} variant="emerald" size="xs">
                                {r.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {detailUser.id !== currentUser?.id && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={detailUser.banned ? UserCheck : Ban}
                        className={
                          detailUser.banned
                            ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'
                            : 'text-amber-600 border-amber-200 hover:bg-amber-50'
                        }
                        onClick={() => {
                          const target = detailUser;
                          setDetailUser(null);
                          setBanConfirmUser(target);
                        }}
                      >
                        {detailUser.banned ? 'Unban' : 'Ban'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        icon={Trash2}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => {
                          const target = detailUser;
                          setDetailUser(null);
                          setDeleteConfirmUser(target);
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailUser(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={Edit2}
                    onClick={() => {
                      const target = detailUser;
                      setDetailUser(null);
                      handleOpenEdit(target);
                    }}
                  >
                    Edit User
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Add or Edit User */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 font-sans">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingUser ? 'Edit User' : 'Add User'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {editingUser
                        ? 'Update user details, assigned team, and additional roles.'
                        : 'Pre-register a user for Google sign-in and assign their team and additional roles.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {modalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4 text-xs">
                <div>
                  <Input
                    label="Full Name *"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Madhukar Kumar"
                  />
                </div>

                <div>
                  <Input
                    label="Google Email Address *"
                    type="email"
                    required
                    disabled={Boolean(editingUser)}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@gmail.com or user@nitp.ac.in"
                  />
                </div>

                <div>
                  <Input
                    label="Phone Number (Optional)"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+91 9876543210"
                  />
                </div>

                {/* Single Team Assignment */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Team
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Each member can belong to only one team and inherits that team&apos;s roles.
                  </p>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData({ ...formData, teamId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                  >
                    <option value="">No Team Assigned</option>
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-[#E2E8F0]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    disabled={modalLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={modalLoading ? Loader2 : Save}
                    disabled={modalLoading}
                  >
                    {modalLoading
                      ? 'Saving...'
                      : editingUser
                        ? 'Save Changes'
                        : 'Register User'}
                  </Button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(banConfirmUser)}
          onClose={() => setBanConfirmUser(null)}
          onConfirm={confirmToggleBan}
          title={banConfirmUser?.banned ? 'Unban User' : 'Ban User'}
          message={
            banConfirmUser?.banned
              ? `Restore access for "${banConfirmUser?.name || banConfirmUser?.email}"?`
              : `Suspend "${banConfirmUser?.name || banConfirmUser?.email}" and revoke their active sessions?`
          }
          confirmText={banConfirmUser?.banned ? 'Unban User' : 'Ban User'}
          variant={banConfirmUser?.banned ? 'primary' : 'danger'}
        />

        <ConfirmModal
          isOpen={Boolean(deleteConfirmUser)}
          onClose={() => setDeleteConfirmUser(null)}
          onConfirm={confirmDeleteUser}
          title="Delete User"
          message={`Permanently delete "${deleteConfirmUser?.name || deleteConfirmUser?.email}"? This action cannot be undone.`}
          confirmText="Delete User"
          variant="danger"
        />
      </div>
    </ProtectedRoute>
  );
}
