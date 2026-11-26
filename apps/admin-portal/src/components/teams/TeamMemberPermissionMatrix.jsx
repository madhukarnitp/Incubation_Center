'use client';

import React, { useState, useEffect, useCallback } from 'react';
import TeamService from '@/services/admin/teamService';
import { Button, Badge, ConfirmModal } from '@/components/ui';
import {
  Shield,
  Save,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Loader2,
  Lock,
  Clock,
  X,
} from '@/components/icons';

const SOURCE_BADGE_MAP = {
  'System Role': { variant: 'purple', label: 'System Role' },
  'Team Position': { variant: 'blue', label: 'Team Position' },
  'Direct Assignment': { variant: 'emerald', label: 'Direct' },
  Delegation: { variant: 'amber', label: 'Delegated' },
};

export default function TeamMemberPermissionMatrix({
  teamId,
  member,
  onClose,
  onSaved,
  onNotify,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const memberId = member?.id;

  const loadPermissions = useCallback(async () => {
    if (!teamId || !memberId) return;
    setLoading(true);
    try {
      const res = await TeamService.getMemberPermissions(teamId, memberId);
      const perms = res.permissions || [];
      setRows(perms);
      const firstExp = perms.find((p) => p.expiresAt)?.expiresAt;
      setExpiresAt(firstExp ? new Date(firstExp).toISOString().slice(0, 16) : '');
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to load member permissions.',
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, memberId, onNotify]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const toggleOp = (resource, field) => {
    setRows((prev) =>
      prev.map((row) => (row.resource === resource ? { ...row, [field]: !row[field] } : row))
    );
  };

  const toggleFullCrud = (resource) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.resource !== resource) return row;
        const isAll = row.canView && row.canCreate && row.canUpdate && row.canDelete;
        const nextVal = !isAll;
        return {
          ...row,
          canView: nextVal,
          canCreate: nextVal,
          canUpdate: nextVal,
          canDelete: nextVal,
        };
      })
    );
  };

  const toggleExceptional = (resource, action) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.resource !== resource) return row;
        const current = new Set(row.exceptionalActions || []);
        if (current.has(action)) current.delete(action);
        else current.add(action);
        return { ...row, exceptionalActions: Array.from(current) };
      })
    );
  };

  const handleSelectAll = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        canView: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      }))
    );
  };

  const handleClearAll = () => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        canView: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        canDelegate: false,
        exceptionalActions: [],
      }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isoExpiry = expiresAt ? new Date(expiresAt).toISOString() : null;
      const payload = rows.map((r) => ({
        resource: r.resource,
        canView: Boolean(r.canView),
        canCreate: Boolean(r.canCreate),
        canUpdate: Boolean(r.canUpdate),
        canDelete: Boolean(r.canDelete),
        canDelegate: Boolean(r.canDelegate),
        exceptionalActions: r.exceptionalActions || [],
        expiresAt: isoExpiry,
      }));
      const res = await TeamService.saveMemberPermissions(teamId, member.id, payload);
      if (res.permissions) setRows(res.permissions);
      onNotify?.({
        type: 'success',
        message: `Permissions updated for ${member.name || member.email}.`,
      });
      onSaved?.();
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to save permissions.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await TeamService.revokeMemberPermissions(teamId, member.id);
      setConfirmRevokeOpen(false);
      await loadPermissions();
      onNotify?.({
        type: 'success',
        message: `All permissions revoked for ${member.name || member.email}.`,
      });
      onSaved?.();
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err?.response?.data?.error || err?.message || 'Failed to revoke permissions.',
      });
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[#E2E8F0] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E40AF] flex items-center justify-center border border-blue-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                CRUD Permission Matrix — {member?.name || member?.email}
              </h3>
              <p className="text-xs text-slate-500">
                Position: <span className="font-semibold text-[#1E40AF]">{member?.position || 'Member'}</span> · Assign module-level View, Create, Update, Delete &amp; Delegation authority.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="xs" onClick={handleSelectAll} disabled={loading}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Select All
            </Button>
            <Button variant="secondary" size="xs" onClick={handleClearAll} disabled={loading}>
              Clear Selected
            </Button>
            <Button variant="secondary" size="xs" onClick={loadPermissions} disabled={loading}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-600 font-medium">Expires (optional):</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="px-2 py-1 rounded-md border border-[#E2E8F0] text-xs text-slate-700 focus:outline-none focus:border-[#1E40AF]"
            />
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
              <span className="text-xs font-medium">Loading effective permissions...</span>
            </div>
          ) : (
            <div className="overflow-x-auto lg:overflow-visible border border-[#E2E8F0] rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Resource Module</th>
                    <th className="py-2.5 px-2 text-center">View</th>
                    <th className="py-2.5 px-2 text-center">Create</th>
                    <th className="py-2.5 px-2 text-center">Update</th>
                    <th className="py-2.5 px-2 text-center">Delete</th>
                    <th className="py-2.5 px-2 text-center">Full CRUD</th>
                    <th className="py-2.5 px-2 text-center">Delegate</th>
                    <th className="py-2.5 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {rows.map((row) => {
                    const isFullCrud =
                      row.canView && row.canCreate && row.canUpdate && row.canDelete;
                    const isSystem = (row.sources || []).includes('System Role');

                    return (
                      <tr key={row.resource} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{row.label}</div>
                          {row.availableExceptional?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {row.availableExceptional.map((exc) => {
                                const active = (row.exceptionalActions || []).includes(exc);
                                return (
                                  <label
                                    key={exc}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
                                      active
                                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                                        : 'bg-white border-slate-200 text-slate-500'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      disabled={isSystem}
                                      onChange={() => toggleExceptional(row.resource, exc)}
                                      className="rounded border-slate-300 text-amber-600 focus:ring-0"
                                    />
                                    {row.resource.replace('cms_', '')}.{exc}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {['canView', 'canCreate', 'canUpdate', 'canDelete'].map((field) => (
                          <td key={field} className="py-2.5 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(row[field])}
                              disabled={isSystem}
                              onChange={() => toggleOp(row.resource, field)}
                              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-0 cursor-pointer disabled:opacity-50"
                            />
                          </td>
                        ))}

                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isFullCrud}
                            disabled={isSystem}
                            onChange={() => toggleFullCrud(row.resource)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer disabled:opacity-50"
                          />
                        </td>

                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(row.canDelegate)}
                            disabled={isSystem}
                            onChange={() => toggleOp(row.resource, 'canDelegate')}
                            title="Allow Co-Lead to delegate this resource's permissions"
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-0 cursor-pointer disabled:opacity-50"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(row.sources || []).length === 0 ? (
                              <span className="text-[11px] text-slate-400 italic">None</span>
                            ) : (
                              row.sources.map((src) => {
                                const info = SOURCE_BADGE_MAP[src] || {
                                  variant: 'slate',
                                  label: src,
                                };
                                return (
                                  <Badge key={src} variant={info.variant} size="xs">
                                    {isSystem && <Lock className="w-2.5 h-2.5 mr-0.5 inline" />}
                                    {info.label}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmRevokeOpen(true)}
            disabled={loading || saving || revoking}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Revoke All
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={loading || saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1.5" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmRevokeOpen}
        onClose={() => setConfirmRevokeOpen(false)}
        onConfirm={handleRevokeAll}
        title="Revoke All Member Permissions"
        message={`Are you sure you want to immediately revoke all direct and delegated permissions for ${member?.name || member?.email} in this team?`}
        confirmText={revoking ? 'Revoking...' : 'Revoke Permissions'}
        variant="danger"
      />
    </div>
  );
}
