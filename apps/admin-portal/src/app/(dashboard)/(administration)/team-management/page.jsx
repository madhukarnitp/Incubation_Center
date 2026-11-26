'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PageHeader from '@/components/common/PageHeader';
import Toast from '@/components/Common/Toast';
import TableActionButton from '@/components/Common/TableActionButton';
import { Button, Input, Badge, Card, ConfirmModal } from '@/components/ui';
import apiClient from '@/lib/api';
import TeamService from '@/services/admin/teamService';
import {
  Users,
  Users2,
  Shield,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Save,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Image as ImageIcon,
  Bell,
  CalendarDays,
  Rocket,
  Mic,
  Inbox,
  ClipboardCheck,
  Activity,
  Eye,
} from '@/components/icons';

const TEAM_SECTIONS = [
  { id: 'ALL', label: 'All Teams' },
  { id: 'OPERATIONAL', label: 'Operational' },
  { id: 'GLOBAL', label: 'Global Executive' },
  { id: 'FACULTY', label: 'Faculty Team' },
];

const POSITION_PRESETS = {
  OPERATIONAL: ['Lead', 'Co-Lead', 'Member'],
  GLOBAL: ['Club Secretary', 'Joint Secretary', 'Coordinator', 'Co-Coordinator', 'Member'],
  FACULTY: ['Professor-In-Charge', 'Faculty Advisor', 'Faculty Mentor'],
};

const TEAM_ADMIN_POSITIONS = new Set([
  'lead',
  'co-lead',
  'club secretary',
  'coordinator',
]);

const RESOURCE_ACCESS_OPTIONS = [
  {
    id: 'induction',
    label: 'Induction Services',
    icon: ClipboardCheck,
    keys: [
      'induction_application:read:any',
      'induction_application:update:any',
      'induction_evaluation:read:any',
      'induction_evaluation:create:any',
      'induction_evaluation:update:any',
      'induction_interview:assign:any',
      'induction_settings:read:any',
      'induction_settings:update:any',
      'induction_account:read:any',
      'induction_account:create:any',
      'induction_account:update:any',
    ],
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: Shield,
    keys: [
      'team:read:any',
      'team:create:any',
      'team:update:any',
      'team:delete:any',
      'team:assign:any',
      'user:read:any',
    ],
  },
  {
    id: 'inquiries',
    label: 'Inquiries',
    icon: Inbox,
    keys: ['cms_queries:manage:any'],
  },
  {
    id: 'notices_faqs',
    label: 'Notices + FAQs',
    icon: Bell,
    keys: ['cms_notices:manage:any', 'cms_faqs:manage:any'],
  },
  {
    id: 'incubations',
    label: 'Incubations',
    icon: Rocket,
    keys: ['cms_incubations:manage:any'],
  },
  {
    id: 'talks',
    label: 'Entrepreneurship Talks',
    icon: Mic,
    keys: ['cms_talks:manage:any'],
  },
  {
    id: 'events',
    label: 'Events',
    icon: CalendarDays,
    keys: ['cms_events:manage:any'],
  },
  {
    id: 'gallery',
    label: 'Gallery',
    icon: ImageIcon,
    keys: ['cms_gallery:manage:any'],
  },
];

function getTeamResourceLabels(teamPermissions = []) {
  const keys = new Set(teamPermissions.map((p) => p.key));
  return RESOURCE_ACCESS_OPTIONS.filter((opt) =>
    opt.keys.some((k) => keys.has(k))
  ).map((opt) => opt.label);
}

export default function TeamsManagementPage() {
  const router = useRouter();
  const { isSuperAdmin, hasPermission } = useAuth();
  const canManageAllTeams = isSuperAdmin || hasPermission(PERMISSIONS.MANAGE_TEAMS);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeSection, setActiveSection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'OPERATIONAL',
    roleId: '',
    leadUserId: '',
    coLead1UserId: '',
    coLead2UserId: '',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsList, usersRes, rolesRes, overviewRes] = await Promise.all([
        TeamService.getTeams(),
        canManageAllTeams
          ? apiClient.get('/users?limit=100').catch(() => ({ users: [] }))
          : Promise.resolve({ users: [] }),
        canManageAllTeams
          ? apiClient.get('/roles').catch(() => ({ roles: [] }))
          : Promise.resolve({ roles: [] }),
        TeamService.getOverview().catch(() => null),
      ]);
      setTeams(Array.isArray(teamsList) ? teamsList : teamsList?.teams || []);
      setAllUsers(usersRes?.users || []);
      setAllRoles(rolesRes?.roles || []);
      if (overviewRes) setOverview(overviewRes);
    } catch (err) {
      console.error('Failed to load teams data:', err);
      setToast({ type: 'error', message: 'Failed to load teams and members.' });
    } finally {
      setIsLoading(false);
    }
  }, [canManageAllTeams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return teams.filter((t) => {
      const matchesSection =
        activeSection === 'ALL' || (t.type || 'OPERATIONAL') === activeSection;
      if (!matchesSection) return false;
      if (!q) return true;
      return (
        t.name?.toLowerCase().includes(q) ||
        t.members?.some(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q)
        )
      );
    });
  }, [teams, activeSection, searchQuery]);

  const handleOpenCreate = (defaultSection = 'OPERATIONAL') => {
    setEditingTeam(null);
    setFormData({
      name: '',
      description: '',
      type: defaultSection === 'ALL' ? 'OPERATIONAL' : defaultSection,
      roleId: '',
      leadUserId: '',
      coLead1UserId: '',
      coLead2UserId: '',
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (team) => {
    setEditingTeam(team);
    const members = team.members || [];
    const lead = members.find((m) =>
      ['lead', 'club secretary', 'professor-in-charge'].includes(
        (m.position || '').toLowerCase()
      )
    );
    const coLeads = members.filter((m) =>
      ['co-lead', 'joint secretary', 'coordinator', 'co-coordinator'].includes(
        (m.position || '').toLowerCase()
      )
    );
    setFormData({
      name: team.name || '',
      description: team.description || '',
      type: team.type || 'OPERATIONAL',
      roleId: team.roles?.[0]?.id || '',
      leadUserId: lead?.id || '',
      coLead1UserId: coLeads[0]?.id || '',
      coLead2UserId: coLeads[1]?.id || '',
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setModalError('Team name is required');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      const leadershipIds = new Set(
        [formData.leadUserId, formData.coLead1UserId, formData.coLead2UserId].filter(
          Boolean
        )
      );

      const preservedMembers = (editingTeam?.members || [])
        .filter(
          (m) =>
            !leadershipIds.has(m.id) &&
            !['lead', 'co-lead'].includes((m.position || '').toLowerCase())
        )
        .map((m) => ({
          userId: m.id,
          position: m.position || 'Member',
        }));

      const leadershipMembers = [];
      if (formData.leadUserId) {
        leadershipMembers.push({ userId: formData.leadUserId, position: 'Lead' });
      }
      if (formData.coLead1UserId) {
        leadershipMembers.push({ userId: formData.coLead1UserId, position: 'Co-Lead' });
      }
      if (formData.coLead2UserId) {
        leadershipMembers.push({ userId: formData.coLead2UserId, position: 'Co-Lead' });
      }

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        roleIds: formData.roleId ? [formData.roleId] : [],
        members: [...leadershipMembers, ...preservedMembers],
      };

      if (editingTeam) {
        await TeamService.updateTeam(editingTeam.id, payload);
        setToast({
          type: 'success',
          message: `Team "${formData.name}" updated.`,
        });
      } else {
        await TeamService.createTeam(payload);
        setToast({
          type: 'success',
          message: `Team "${formData.name}" created.`,
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

  const handleDeleteTeam = async () => {
    if (!deleteConfirmTeam) return;
    try {
      await TeamService.deleteTeam(deleteConfirmTeam.id);
      setToast({
        type: 'success',
        message: `Team "${deleteConfirmTeam.name}" deleted.`,
      });
      setDeleteConfirmTeam(null);
      await loadData();
    } catch (err) {
      setToast({
        type: 'error',
        message: err?.message || 'Failed to delete team.',
      });
      setDeleteConfirmTeam(null);
    }
  };

  const sectionBadge = (type) => {
    if (type === 'GLOBAL') return { label: 'Global Executive', variant: 'purple' };
    if (type === 'FACULTY') return { label: 'Faculty Team', variant: 'amber' };
    return { label: 'Operational', variant: 'blue' };
  };

  return (
    <ProtectedRoute requiredPermission={PERMISSIONS.MANAGE_TEAMS} allowTeamAdmin>
      <div className="space-y-5 animate-in fade-in duration-200">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <PageHeader
          icon={Users2}
          title="Teams & Access Management"
          description="Create dynamic teams (Media, Design, Web, etc.), assign Leads & Co-Leads as Team Admins, and grant whole-resource access."
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
              {canManageAllTeams && (
                <TableActionButton
                  icon={Plus}
                  label="Add Team"
                  tone="primary"
                  size="md"
                  tooltipSide="bottom"
                  onClick={() => handleOpenCreate(activeSection)}
                />
              )}
            </div>
          }
        />

        {/* Team Overview KPI Strip */}
        {overview && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Teams', value: overview.totalTeams, color: 'text-slate-900' },
              { label: 'Active Teams', value: overview.activeTeams, color: 'text-emerald-700' },
              { label: 'Total Members', value: overview.totalMembers, color: 'text-[#1E40AF]' },
              { label: 'Total Leads', value: overview.totalLeads, color: 'text-purple-700' },
              { label: 'Total Co-Leads', value: overview.totalCoLeads, color: 'text-blue-700' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-white border border-[#E2E8F0] rounded-xl px-4 py-3 shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-slate-500">{kpi.label}</div>
                <div className={`text-lg font-bold mt-0.5 ${kpi.color}`}>{kpi.value ?? 0}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {TEAM_SECTIONS.map((sec) => {
              const count =
                sec.id === 'ALL'
                  ? teams.length
                  : teams.filter((t) => (t.type || 'OPERATIONAL') === sec.id).length;
              const active = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setActiveSection(sec.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#1E40AF] text-white shadow-xs'
                      : 'bg-white border border-[#E2E8F0] text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{sec.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or members..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#1E40AF]"
            />
          </div>
        </div>

        {/* Teams Tabular View */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#E2E8F0]">
            <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
            <p className="text-xs text-slate-500 mt-3 font-semibold">Loading teams...</p>
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-[#E2E8F0] text-center p-6">
            <Users2 className="w-12 h-12 text-slate-300 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No teams found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Create a team dynamically to assign members, Leads/Co-Leads, and resource access.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => handleOpenCreate(activeSection)}
            >
              Create Team
            </Button>
          </div>
        ) : (
          <Card className="bg-white border border-[#E2E8F0] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-[#E2E8F0] text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Team Name</th>
                    <th className="py-3 px-4">Section</th>
                    <th className="py-3 px-4">Lead</th>
                    <th className="py-3 px-4">Total Members</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    {canManageAllTeams && <th className="py-3 px-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredTeams.map((team) => {
                    const secInfo = sectionBadge(team.type);
                    const members = team.members || [];
                    const teamRoles = team.roles || [];
                    return (
                      <tr
                        key={team.id}
                        onClick={() => router.push(`/team-management/${team.id}`)}
                        className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="min-w-[200px]">
                            <div className="font-bold text-slate-900 text-sm group-hover:text-[#1E40AF] transition-colors">
                              {team.name}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">
                              {team.description || 'Click to open team members & roles'}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant={secInfo.variant} size="xs">
                            {secInfo.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-xs text-slate-800 font-semibold">
                            {team.leadName || '—'}
                          </div>
                          {team.coLeadName && (
                            <div className="text-[11px] text-slate-500">
                              Co: {team.coLeadName}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                            {members.length}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-[220px]">
                          {teamRoles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {teamRoles.slice(0, 3).map((r) => (
                                <Badge key={r.id} variant="purple" size="xs">
                                  {r.name}
                                </Badge>
                              ))}
                              {teamRoles.length > 3 && (
                                <Badge variant="slate" size="xs">
                                  +{teamRoles.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No role assigned</span>
                          )}
                        </td>
                        {canManageAllTeams && (
                          <td
                            className="py-3.5 px-4 text-center whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <TableActionButton
                                icon={Edit2}
                                label="Edit"
                                onClick={() => handleOpenEdit(team)}
                              />
                              <TableActionButton
                                icon={Trash2}
                                label="Delete"
                                tone="danger"
                                onClick={() => setDeleteConfirmTeam(team)}
                              />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Create / Edit Team Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center">
                    <Users2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {editingTeam ? 'Edit Team' : 'Add Team'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure team details, assigned team role, and leadership.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTeam} className="flex-1 overflow-y-auto p-6 space-y-5">
                {modalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* 1. Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Team Name <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Media Team, Design Team"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Section
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                    >
                      <option value="OPERATIONAL">Operational Team</option>
                      <option value="GLOBAL">Global Executive</option>
                      <option value="FACULTY">Faculty Team</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Description
                    </label>
                    <Input
                      type="text"
                      placeholder="Brief description of the team's responsibilities"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                </div>

                {/* 2. Team Role (Select Only One) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Team Role (Assigned to Whole Team)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    All members of this team inherit this role automatically.
                  </p>
                  <select
                    value={formData.roleId}
                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                  >
                    <option value="">No team role selected</option>
                    {allRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                        {role.description ? ` — ${role.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Team Leadership (1 Lead, 1 Co-Lead, optional Co-Lead 2) */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Team Leadership
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Assign 1 Lead and Co-Leads (Co-Lead 2 is optional). Regular members can be added on the team details page.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Team Lead
                      </label>
                      <select
                        value={formData.leadUserId}
                        onChange={(e) =>
                          setFormData({ ...formData, leadUserId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                      >
                        <option value="">Select Lead</option>
                        {allUsers
                          .filter(
                            (u) =>
                              u.id !== formData.coLead1UserId &&
                              u.id !== formData.coLead2UserId
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                              {u.team && u.team.id !== editingTeam?.id
                                ? ` (in ${u.team.name})`
                                : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Co-Lead 1
                      </label>
                      <select
                        value={formData.coLead1UserId}
                        onChange={(e) =>
                          setFormData({ ...formData, coLead1UserId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                      >
                        <option value="">Select Co-Lead 1</option>
                        {allUsers
                          .filter(
                            (u) =>
                              u.id !== formData.leadUserId &&
                              u.id !== formData.coLead2UserId
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                              {u.team && u.team.id !== editingTeam?.id
                                ? ` (in ${u.team.name})`
                                : ''}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Co-Lead 2 (Optional)
                      </label>
                      <select
                        value={formData.coLead2UserId}
                        onChange={(e) =>
                          setFormData({ ...formData, coLead2UserId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#1E40AF]"
                      >
                        <option value="">Select Co-Lead 2</option>
                        {allUsers
                          .filter(
                            (u) =>
                              u.id !== formData.leadUserId &&
                              u.id !== formData.coLead1UserId
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name || u.email}
                              {u.team && u.team.id !== editingTeam?.id
                                ? ` (in ${u.team.name})`
                                : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                    disabled={modalLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={modalLoading ? Loader2 : Save}
                    disabled={modalLoading}
                  >
                    {modalLoading
                      ? 'Saving...'
                      : editingTeam
                      ? 'Update Team'
                      : 'Create Team'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(deleteConfirmTeam)}
          onClose={() => setDeleteConfirmTeam(null)}
          onConfirm={handleDeleteTeam}
          title="Delete Team"
          message={`Are you sure you want to delete "${deleteConfirmTeam?.name}"? Members will lose permissions granted by this team.`}
          confirmText="Delete Team"
          variant="danger"
        />
      </div>
    </ProtectedRoute>
  );
}
