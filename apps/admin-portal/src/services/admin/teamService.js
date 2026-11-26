import apiClient from '@/lib/api';

export const TeamService = {
  // Get all teams
  getTeams: async () => {
    try {
      const res = await apiClient.get('/teams');
      return res.teams || [];
    } catch (err) {
      console.error('Failed to fetch teams:', err);
      throw err;
    }
  },

  // Get single team details
  getTeamById: async (id) => {
    try {
      const res = await apiClient.get(`/teams/${id}`);
      return res.team || null;
    } catch (err) {
      console.error(`Failed to fetch team ${id}:`, err);
      throw err;
    }
  },

  // Get available users for a team (accessible to Leads/Co-Leads of that team)
  getAvailableUsers: async (teamId) => {
    try {
      const res = await apiClient.get(`/teams/${teamId}/available-users`);
      return res.users || [];
    } catch (err) {
      console.error(`Failed to fetch available users for team ${teamId}:`, err);
      throw err;
    }
  },

  // Create team
  createTeam: async (teamData) => {
    try {
      const res = await apiClient.post('/teams', teamData);
      return res.team || res;
    } catch (err) {
      console.error('Failed to create team:', err);
      throw err;
    }
  },

  // Update team
  updateTeam: async (id, teamData) => {
    try {
      const res = await apiClient.put(`/teams/${id}`, teamData);
      return res.team || res;
    } catch (err) {
      console.error(`Failed to update team ${id}:`, err);
      throw err;
    }
  },

  // Delete team
  deleteTeam: async (id) => {
    try {
      const res = await apiClient.delete(`/teams/${id}`);
      return res;
    } catch (err) {
      console.error(`Failed to delete team ${id}:`, err);
      throw err;
    }
  },

  // Add members
  addMembers: async (teamId, userIds, position = 'Member') => {
    try {
      const res = await apiClient.post(`/teams/${teamId}/members`, { userIds, position });
      return res;
    } catch (err) {
      console.error(`Failed to add members to team ${teamId}:`, err);
      throw err;
    }
  },

  // Create/upsert new user with full profile + email and add to team
  createAndAddMember: async (teamId, memberData) => {
    try {
      const res = await apiClient.post(`/teams/${teamId}/members/new`, memberData);
      return res;
    } catch (err) {
      console.error(`Failed to create and add member to team ${teamId}:`, err);
      throw err;
    }
  },

  // Update individual system/custom roles for a team member
  updateMemberRoles: async (teamId, userId, roleIds) => {
    try {
      const res = await apiClient.put(`/teams/${teamId}/members/${userId}/roles`, { roleIds });
      return res;
    } catch (err) {
      console.error(`Failed to update roles for member ${userId} in team ${teamId}:`, err);
      throw err;
    }
  },

  // Update roles assigned to the whole team
  updateTeamRoles: async (teamId, roleIds) => {
    try {
      const res = await apiClient.put(`/teams/${teamId}/roles`, { roleIds });
      return res;
    } catch (err) {
      console.error(`Failed to update roles for team ${teamId}:`, err);
      throw err;
    }
  },

  // Get team overview stats
  getOverview: async () => {
    const res = await apiClient.get('/teams/overview');
    return res;
  },

  // Get team-scoped activity logs
  getTeamActivity: async (teamId) => {
    const res = await apiClient.get(`/teams/${teamId}/activity`);
    return res.logs || [];
  },

  // Per-member CRUD permissions & delegation
  getMemberPermissions: async (teamId, userId) => {
    const res = await apiClient.get(`/teams/${teamId}/member-permissions/${userId}`);
    return res;
  },

  saveMemberPermissions: async (teamId, userId, permissions) => {
    const res = await apiClient.put(`/teams/${teamId}/member-permissions/${userId}`, {
      permissions,
    });
    return res;
  },

  delegateMemberPermission: async (teamId, userId, payload) => {
    const res = await apiClient.post(
      `/teams/${teamId}/member-permissions/${userId}/delegate`,
      payload
    );
    return res;
  },

  revokeMemberPermissions: async (teamId, userId) => {
    const res = await apiClient.delete(`/teams/${teamId}/member-permissions/${userId}`);
    return res;
  },

  // Update member position inside team
  updateMemberPosition: async (teamId, userId, position, order) => {
    try {
      const res = await apiClient.patch(`/teams/${teamId}/members/${userId}`, {
        position,
        ...(order !== undefined ? { order } : {}),
      });
      return res;
    } catch (err) {
      console.error(`Failed to update member ${userId} position in team ${teamId}:`, err);
      throw err;
    }
  },

  // Remove member
  removeMember: async (teamId, userId) => {
    try {
      const res = await apiClient.delete(`/teams/${teamId}/members/${userId}`);
      return res;
    } catch (err) {
      console.error(`Failed to remove member ${userId} from team ${teamId}:`, err);
      throw err;
    }
  },
};

export default TeamService;

