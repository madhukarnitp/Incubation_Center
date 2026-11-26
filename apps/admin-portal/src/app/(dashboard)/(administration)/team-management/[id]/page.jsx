'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Toast from '@/components/Common/Toast';
import TableActionButton from '@/components/Common/TableActionButton';
import { Button, Input, Badge, Card, ConfirmModal } from '@/components/ui';
import TeamMemberPermissionMatrix from '@/components/teams/TeamMemberPermissionMatrix';
import apiClient from '@/lib/api';
import TeamService from '@/services/admin/teamService';
import {
  ArrowLeft,
  Users,
  Users2,
  Shield,
  ShieldCheck,
  Activity,
  Plus,
  Trash2,
  X,
  Loader2,
  UserPlus,
  Edit2,
  Search,
  RefreshCw,
  CheckCircle2,
  Save,
  AlertCircle,
} from '@/components/icons';

const POSITION_PRESETS = {
  OPERATIONAL: ['Lead', 'Co-Lead', 'Member'],
  GLOBAL: ['Club Secretary', 'Joint Secretary', 'Coordinator', 'Co-Coordinator', 'Member'],
  FACULTY: ['Professor-In-Charge', 'Faculty Advisor', 'Faculty Mentor'],
};

const TABS = [
  { id: 'members', label: 'Team Members', icon: Users },
  { id: 'roles', label: 'Team Roles & Access', icon: Shield },
  { id: 'activity', label: 'Activity Logs', icon: Activity },
];

function sectionBadge(type) {
  if (type === 'GLOBAL') return { label: 'Global Executive', variant: 'purple' };
  if (type === 'FACULTY') return { label: 'Faculty Team', variant: 'amber' };
  return { label: 'Operational', variant: 'blue' };
}

export default function TeamDetailPage() {
  const { id: teamId } = useParams();
  const router = useRouter();
  const { isSuperAdmin, hasPermission } = useAuth();
  const canManageTeamRoles = isSuperAdmin || hasPermission(PERMISSIONS.MANAGE_TEAMS);

  const [team, setTeam] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState('members');
  const [memberSearch, setMemberSearch] = useState('');

  // Add Member panel state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState('existing'); // 'existing' | 'new'
  const [addingMember, setAddingMember] = useState(false);
  const [addExistingUserId, setAddExistingUserId] = useState('');
  const [addExistingPosition, setAddExistingPosition] = useState('Member');
  const [addExistingExtraRoleIds, setAddExistingExtraRoleIds] = useState([]);

  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    department: '',
    post: '',
    bio: '',
    linkedin: '',
    github: '',
    instagram: '',
    position: 'Member',
    roleIds: [],
  });

  // Personal Role Editor modal state
  const [roleEditorMember, setRoleEditorMember] = useState(null);
  const [editingMemberRoleIds, setEditingMemberRoleIds] = useState([]);
  const [savingMemberRoles, setSavingMemberRoles] = useState(false);

  // Team Roles Editor state
  const [editingTeamRoles, setEditingTeamRoles] = useState(false);
  const [selectedTeamRoleIds, setSelectedTeamRoleIds] = useState([]);
  const [savingTeamRoles, setSavingTeamRoles] = useState(false);

  // Permission Matrix modal & Remove Confirm
  const [matrixMember, setMatrixMember] = useState(null);
  const [removeConfirmMember, setRemoveConfirmMember] = useState(null);

  // Activity
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    setError('');
    try {
      const [teamData, availableUsers, rolesRes] = await Promise.all([
        TeamService.getTeamById(teamId),
        TeamService.getAvailableUsers(teamId).catch(() => []),
        apiClient.get('/roles').catch(() => ({ roles: [] })),
      ]);
      if (!teamData) {
        setError('Team not found.');
      } else {
        setTeam(teamData);
        setSelectedTeamRoleIds((teamData.roles || []).map((r) => r.id));
      }
      setAllUsers(availableUsers || []);
      setAllRoles(rolesRes?.roles || []);
    } catch (err) {
      console.error('Failed to load team details:', err);
      setError(err?.response?.data?.error || err?.message || 'Failed to load team details.');
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadActivity = useCallback(async () => {
    if (!teamId) return;
    setLogsLoading(true);
    try {
      const list = await TeamService.getTeamActivity(teamId);
      setLogs(list);
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Failed to load activity logs.' });
    } finally {
      setLogsLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (activeTab === 'activity') loadActivity();
  }, [activeTab, loadActivity]);

  const members = useMemo(() => team?.members || [], [team]);
  const teamRoles = useMemo(() => team?.roles || [], [team]);

  const existingMemberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members]
  );

  const nonMembers = useMemo(
    () => allUsers.filter((u) => !existingMemberIds.has(u.id)),
    [allUsers, existingMemberIds]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        (m.roles || []).some((r) => r.toLowerCase().includes(q))
    );
  }, [members, memberSearch]);

  const positionOptions =
    POSITION_PRESETS[team?.type || 'OPERATIONAL'] || POSITION_PRESETS.OPERATIONAL;

  const handleAddExistingMember = async (e) => {
    e.preventDefault();
    if (!addExistingUserId) return;
    setAddingMember(true);
    try {
      await TeamService.addMembers(teamId, [addExistingUserId], addExistingPosition);
      if (addExistingExtraRoleIds.length > 0) {
        const targetUser = allUsers.find((u) => u.id === addExistingUserId);
        const existingRoleIds = (targetUser?.roles || []).map((r) => r.id).filter(Boolean);
        const merged = Array.from(new Set([...existingRoleIds, ...addExistingExtraRoleIds]));
        await TeamService.updateMemberRoles(teamId, addExistingUserId, merged);
      }
      setAddExistingUserId('');
      setAddExistingPosition('Member');
      setAddExistingExtraRoleIds([]);
      setShowAddForm(false);
      setToast({ type: 'success', message: 'Member added to team.' });
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to add member.',
      });
    } finally {
      setAddingMember(false);
    }
  };

  const handleCreateAndAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberForm.name.trim() || !newMemberForm.email.trim()) return;
    setAddingMember(true);
    try {
      await TeamService.createAndAddMember(teamId, {
        ...newMemberForm,
        name: newMemberForm.name.trim(),
        email: newMemberForm.email.trim().toLowerCase(),
      });
      setNewMemberForm({
        name: '',
        email: '',
        phoneNumber: '',
        department: '',
        post: '',
        bio: '',
        linkedin: '',
        github: '',
        instagram: '',
        position: 'Member',
        roleIds: [],
      });
      setShowAddForm(false);
      setToast({
        type: 'success',
        message: `Member "${newMemberForm.name.trim()}" created and added to ${team.name}.`,
      });
      await loadData();
    } catch (err) {
      const errData = err?.response?.data?.error;
      const msg =
        typeof errData === 'string'
          ? errData
          : errData?.formErrors?.[0] || err?.message || 'Failed to create member.';
      setToast({ type: 'error', message: msg });
    } finally {
      setAddingMember(false);
    }
  };

  const handlePositionChange = async (userId, position) => {
    try {
      await TeamService.updateMemberPosition(teamId, userId, position);
      setToast({ type: 'success', message: `Position updated to "${position}".` });
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to update position.',
      });
    }
  };

  const openMemberRoleEditor = (member) => {
    setRoleEditorMember(member);
    const currentIds =
      member.roleIds && member.roleIds.length > 0
        ? member.roleIds
        : allRoles
            .filter((r) => (member.roles || []).includes(r.name))
            .map((r) => r.id);
    setEditingMemberRoleIds(currentIds);
  };

  const handleSaveMemberRoles = async () => {
    if (!roleEditorMember) return;
    setSavingMemberRoles(true);
    try {
      await TeamService.updateMemberRoles(teamId, roleEditorMember.id, editingMemberRoleIds);
      setToast({
        type: 'success',
        message: `Personal roles updated for ${roleEditorMember.name || roleEditorMember.email}.`,
      });
      setRoleEditorMember(null);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to update member roles.',
      });
    } finally {
      setSavingMemberRoles(false);
    }
  };

  const handleSaveTeamRoles = async () => {
    setSavingTeamRoles(true);
    try {
      await TeamService.updateTeamRoles(teamId, selectedTeamRoleIds);
      setToast({
        type: 'success',
        message: 'Team roles updated. All team members now inherit these roles.',
      });
      setEditingTeamRoles(false);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to update team roles.',
      });
    } finally {
      setSavingTeamRoles(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeConfirmMember) return;
    try {
      await TeamService.removeMember(teamId, removeConfirmMember.id);
      setToast({
        type: 'success',
        message: `${removeConfirmMember.name || removeConfirmMember.email} removed from team.`,
      });
      setRemoveConfirmMember(null);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to remove member.',
      });
      setRemoveConfirmMember(null);
    }
  };

  const secInfo = sectionBadge(team?.type);

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_TEAMS} allowTeamAdmin>
      <div className="space-y-5 animate-in fade-in duration-200">
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push('/team-management')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#1E40AF] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Teams Management
          </button>

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
            {team && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={UserPlus}
                onClick={() => {
                  setActiveTab('members');
                  setShowAddForm(true);
                }}
              >
                Add Team Member
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-[#E2E8F0]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
            <p className="text-xs text-slate-500 mt-3 font-semibold">Loading team details...</p>
          </div>
        ) : error || !team ? (
          <div className="p-8 bg-white rounded-xl border border-rose-200 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">{error || 'Team not found'}</h3>
            <Button variant="outline" size="sm" onClick={() => router.push('/team-management')}>
              Return to Teams Management
            </Button>
          </div>
        ) : (
          <>
            {/* Team Header Card */}
            <Card className="bg-white border border-[#E2E8F0] shadow-2xs p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-[#1E40AF] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                    {team.name?.[0] || 'T'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-slate-900">{team.name}</h1>
                      <Badge variant={secInfo.variant} size="xs">
                        {secInfo.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {team.description || 'Manage team members, inherited team roles, and personal added roles.'}
                    </p>
                  </div>
                </div>

                {/* Team Roles Summary & Quick Edit */}
                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Team Roles (Inherited by All Members):
                    </span>
                    {canManageTeamRoles && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTeamRoleIds(teamRoles.map((r) => r.id));
                          setEditingTeamRoles(true);
                        }}
                        className="text-[11px] font-semibold text-[#1E40AF] hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Assign / Edit Team Roles
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {teamRoles.length > 0 ? (
                      teamRoles.map((r) => (
                        <Badge key={r.id} variant="purple" size="xs">
                          <ShieldCheck className="w-3 h-3 mr-1 inline" />
                          {r.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        No whole-team role assigned yet
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] font-semibold text-slate-500">Total Members</div>
                  <div className="text-base font-bold text-[#1E40AF] mt-0.5">{members.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] font-semibold text-slate-500">Team Roles</div>
                  <div className="text-base font-bold text-purple-700 mt-0.5">{teamRoles.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] font-semibold text-slate-500">Lead / Co-Lead</div>
                  <div className="text-xs font-bold text-slate-800 mt-1 truncate">
                    {members.find((m) => (m.position || '').toLowerCase() === 'lead')?.name ||
                      'Unassigned'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] font-semibold text-slate-500">Resource Permissions</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {team.permissions?.length || 0}
                  </div>
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <div className="border-b border-[#E2E8F0] flex items-center gap-1 overflow-x-auto bg-white rounded-t-xl px-4 pt-1 border-x border-t">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-[#1E40AF] text-[#1E40AF]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'members' && (
              <div className="space-y-4">
                {/* Search + Add Member Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search members by name, email, or role..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E40AF]"
                    />
                  </div>

                  <Button
                    type="button"
                    variant={showAddForm ? 'outline' : 'primary'}
                    size="sm"
                    icon={showAddForm ? X : UserPlus}
                    onClick={() => setShowAddForm((prev) => !prev)}
                  >
                    {showAddForm ? 'Close Add Panel' : 'Add Team Member'}
                  </Button>
                </div>

                {/* Expandable Add Member Panel */}
                {showAddForm && (
                  <Card className="p-4 border border-blue-200 bg-blue-50/30 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAddMode('existing')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            addMode === 'existing'
                              ? 'bg-[#1E40AF] text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Add Existing User
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMode('new')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            addMode === 'new'
                              ? 'bg-[#1E40AF] text-white'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          Create New Member (User + Team)
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        New members automatically inherit all Team Roles ({teamRoles.map((r) => r.name).join(', ') || 'None'}).
                      </span>
                    </div>

                    {addMode === 'existing' ? (
                      <form onSubmit={handleAddExistingMember} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Select User <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={addExistingUserId}
                              onChange={(e) => setAddExistingUserId(e.target.value)}
                              required
                              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                            >
                              <option value="">Choose an existing user...</option>
                              {nonMembers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name || u.email} ({u.email})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Team Position
                            </label>
                            <select
                              value={addExistingPosition}
                              onChange={(e) => setAddExistingPosition(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                            >
                              {positionOptions.map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {allRoles.length > 0 && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Extra Personal Roles (Optional — in addition to Team Roles)
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {allRoles.map((role) => {
                                const selected = addExistingExtraRoleIds.includes(role.id);
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() =>
                                      setAddExistingExtraRoleIds((prev) =>
                                        prev.includes(role.id)
                                          ? prev.filter((id) => id !== role.id)
                                          : [...prev, role.id]
                                      )
                                    }
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                                      selected
                                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {role.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={addingMember || !addExistingUserId}
                          >
                            {addingMember ? 'Adding...' : 'Add to Team'}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateAndAddMember} className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Full Name <span className="text-rose-500">*</span>
                            </label>
                            <Input
                              type="text"
                              placeholder="e.g. Aarav Sharma"
                              value={newMemberForm.name}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, name: e.target.value }))
                              }
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Email <span className="text-rose-500">*</span>
                            </label>
                            <Input
                              type="email"
                              placeholder="aarav@college.edu"
                              value={newMemberForm.email}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, email: e.target.value }))
                              }
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Team Position
                            </label>
                            <select
                              value={newMemberForm.position}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, position: e.target.value }))
                              }
                              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                            >
                              {positionOptions.map((pos) => (
                                <option key={pos} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Phone Number
                            </label>
                            <Input
                              type="text"
                              placeholder="+91 9876543210"
                              value={newMemberForm.phoneNumber}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, phoneNumber: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Department
                            </label>
                            <Input
                              type="text"
                              placeholder="e.g. Computer Science"
                              value={newMemberForm.department}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, department: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Post / Designation
                            </label>
                            <Input
                              type="text"
                              placeholder="e.g. Graphic Designer"
                              value={newMemberForm.post}
                              onChange={(e) =>
                                setNewMemberForm((f) => ({ ...f, post: e.target.value }))
                              }
                            />
                          </div>
                        </div>

                        {allRoles.length > 0 && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Personal Added Roles (Extra roles for this member)
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {allRoles.map((role) => {
                                const selected = newMemberForm.roleIds.includes(role.id);
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    onClick={() =>
                                      setNewMemberForm((f) => ({
                                        ...f,
                                        roleIds: f.roleIds.includes(role.id)
                                          ? f.roleIds.filter((id) => id !== role.id)
                                          : [...f.roleIds, role.id],
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer ${
                                      selected
                                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                    }`}
                                  >
                                    {role.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={addingMember}
                          >
                            {addingMember ? 'Creating...' : 'Create & Add Member'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </Card>
                )}

                {/* Team Members Tabular List */}
                <Card className="bg-white border border-[#E2E8F0] shadow-2xs overflow-hidden">
                  {filteredMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center p-6">
                      <Users2 className="w-10 h-10 text-slate-300 mb-2" />
                      <h3 className="text-sm font-bold text-slate-800">
                        {members.length === 0 ? 'No members in this team yet' : 'No matching members'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 mb-4">
                        Add members to this team so they inherit the team roles and can be assigned personal extra roles.
                      </p>
                      {members.length === 0 && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={UserPlus}
                          onClick={() => setShowAddForm(true)}
                        >
                          Add First Member
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            <th className="py-3 px-4">Member</th>
                            <th className="py-3 px-4">Position</th>
                            <th className="py-3 px-4">Team Roles (Inherited)</th>
                            <th className="py-3 px-4">Personal Added Roles</th>
                            <th className="py-3 px-4 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredMembers.map((member) => {
                            const personalRoles = member.personalRoles || [];
                            return (
                              <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3 min-w-[200px]">
                                    <span className="w-8 h-8 rounded-full bg-[#1E40AF] text-white flex items-center justify-center font-bold text-xs shrink-0">
                                      {member.name?.[0] || member.email?.[0] || 'U'}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="font-bold text-slate-900 truncate">
                                        {member.name || 'Unnamed User'}
                                      </div>
                                      <div className="text-[11px] text-slate-500 truncate">
                                        {member.email}
                                      </div>
                                      {(member.department || member.post) && (
                                        <div className="text-[10px] text-slate-400 truncate">
                                          {[member.department, member.post].filter(Boolean).join(' · ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <select
                                    value={member.position || 'Member'}
                                    onChange={(e) => handlePositionChange(member.id, e.target.value)}
                                    className="text-xs font-semibold text-[#1E40AF] bg-blue-50/60 border border-blue-200 rounded-md px-2 py-1 focus:outline-none cursor-pointer"
                                  >
                                    {!positionOptions.includes(member.position) && member.position && (
                                      <option value={member.position}>{member.position}</option>
                                    )}
                                    {positionOptions.map((pos) => (
                                      <option key={pos} value={pos}>
                                        {pos}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                <td className="py-3.5 px-4 max-w-[220px]">
                                  {teamRoles.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {teamRoles.map((r) => (
                                        <Badge key={r.id} variant="purple" size="xs">
                                          {r.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">None</span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 max-w-[240px]">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {personalRoles.length > 0 ? (
                                      personalRoles.map((r) => (
                                        <Badge key={r.id} variant="blue" size="xs">
                                          {r.name}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">
                                        No extra role
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => openMemberRoleEditor(member)}
                                      className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-[10px] font-semibold text-slate-600 hover:text-[#1E40AF] transition-colors cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Edit Roles
                                    </button>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                  <div className="inline-flex items-center justify-center gap-1.5">
                                    <TableActionButton
                                      icon={Shield}
                                      label="Permissions"
                                      onClick={() => setMatrixMember(member)}
                                    />
                                    <TableActionButton
                                      icon={Trash2}
                                      label="Remove"
                                      tone="danger"
                                      onClick={() => setRemoveConfirmMember(member)}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'roles' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="p-5 bg-white border border-[#E2E8F0] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Whole-Team Roles
                      </h3>
                      <p className="text-xs text-slate-500">
                        Assign any role to the whole team. Every member automatically receives these permissions.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="xs"
                      icon={Save}
                      onClick={handleSaveTeamRoles}
                      disabled={savingTeamRoles}
                    >
                      {savingTeamRoles ? 'Saving...' : 'Save Team Roles'}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {allRoles.map((role) => {
                      const selected = selectedTeamRoleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() =>
                            setSelectedTeamRoleIds((prev) =>
                              prev.includes(role.id)
                                ? prev.filter((id) => id !== role.id)
                                : [...prev, role.id]
                            )
                          }
                          className={`w-full p-3 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selected
                              ? 'bg-purple-50 border-purple-300 text-slate-900'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{role.name}</div>
                            {role.description && (
                              <div className="text-[11px] text-slate-500">{role.description}</div>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              selected
                                ? 'bg-purple-700 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-3 h-3" />}
                            {selected ? 'Assigned' : 'Select'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-5 bg-white border border-[#E2E8F0] space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    Direct Team Resource Permissions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct resource-level permissions attached to this team.
                  </p>
                  {(team.permissions || []).length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-4">
                      No direct resource permissions assigned.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {team.permissions.map((p) => (
                        <Badge key={p.id} variant="blue" size="xs">
                          {p.key}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {activeTab === 'activity' && (
              <Card className="bg-white border border-[#E2E8F0] overflow-hidden">
                {logsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Loading activity logs...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    No activity recorded for this team yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <div key={log.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-semibold text-slate-900">{log.action}</div>
                          <div className="text-[11px] text-slate-500">
                            by {log.userName} ({log.userRole})
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </>
        )}

        {/* Team Roles Modal (from Header quick edit) */}
        {editingTeamRoles && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Assign Roles to {team?.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    All members in this team will inherit these roles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTeamRoles(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 max-h-80 overflow-y-auto space-y-2">
                {allRoles.map((role) => {
                  const selected = selectedTeamRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() =>
                        setSelectedTeamRoleIds((prev) =>
                          prev.includes(role.id)
                            ? prev.filter((id) => id !== role.id)
                            : [...prev, role.id]
                        )
                      }
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer ${
                        selected
                          ? 'bg-purple-50 border-purple-300 text-slate-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{role.name}</div>
                        {role.description && (
                          <div className="text-[11px] text-slate-500">{role.description}</div>
                        )}
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTeamRoles(false)}
                  disabled={savingTeamRoles}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveTeamRoles}
                  disabled={savingTeamRoles}
                >
                  {savingTeamRoles ? 'Saving...' : 'Save Team Roles'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Member Personal Added Roles Modal */}
        {roleEditorMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Personal Added Roles — {roleEditorMember.name || roleEditorMember.email}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    In addition to Team Roles ({teamRoles.map((r) => r.name).join(', ') || 'None'}), assign extra personal roles to this member.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleEditorMember(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 max-h-80 overflow-y-auto space-y-2">
                {allRoles.map((role) => {
                  const selected = editingMemberRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() =>
                        setEditingMemberRoleIds((prev) =>
                          prev.includes(role.id)
                            ? prev.filter((id) => id !== role.id)
                            : [...prev, role.id]
                        )
                      }
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 cursor-pointer ${
                        selected
                          ? 'bg-blue-50 border-blue-300 text-slate-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold">{role.name}</div>
                        {role.description && (
                          <div className="text-[11px] text-slate-500">{role.description}</div>
                        )}
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#1E40AF] shrink-0" />}
                    </button>
                  );
                })}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRoleEditorMember(null)}
                  disabled={savingMemberRoles}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveMemberRoles}
                  disabled={savingMemberRoles}
                >
                  {savingMemberRoles ? 'Saving...' : 'Save Personal Roles'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {matrixMember && (
          <TeamMemberPermissionMatrix
            teamId={teamId}
            member={matrixMember}
            onClose={() => setMatrixMember(null)}
            onSaved={loadData}
            onNotify={setToast}
          />
        )}

        <ConfirmModal
          isOpen={Boolean(removeConfirmMember)}
          onClose={() => setRemoveConfirmMember(null)}
          onConfirm={handleRemoveMember}
          title="Remove Team Member"
          message={`Remove "${removeConfirmMember?.name || removeConfirmMember?.email}" from ${team?.name}? They will lose permissions inherited from this team.`}
          confirmText="Remove Member"
          variant="danger"
        />
      </div>
    </ProtectedRoute>
  );
}
