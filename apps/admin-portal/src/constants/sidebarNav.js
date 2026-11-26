import {
  LayoutDashboard,
  Bell,
  UserCheck,
  Rocket,
  CalendarDays,
  Users2,
  Image as ImageIcon,
  HelpCircle,
  GraduationCap,
  ClipboardCheck,
  History,
  Shield,
  User,
  Sliders,
  Mic,
  Inbox,
  FileText,
} from '@/components/icons';
import { PERMISSIONS, ROLES } from './rbac';

export const SIDEBAR_NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
        badge: null,
      },
    ],
  },
  {
    title: 'Main Website Management',
    items: [
      {
        label: 'Notices',
        href: '/main-website/notices',
        icon: Bell,
        permission: PERMISSIONS.MANAGE_NOTICES,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Incubations',
        href: '/main-website/incubations',
        icon: Rocket,
        permission: PERMISSIONS.MANAGE_INCUBATIONS,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Entrepreneur Talks',
        href: '/main-website/talks',
        icon: Mic,
        permission: PERMISSIONS.MANAGE_TALKS,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Events',
        href: '/main-website/events',
        icon: CalendarDays,
        permission: PERMISSIONS.MANAGE_EVENTS,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Gallery',
        href: '/main-website/gallery',
        icon: ImageIcon,
        permission: PERMISSIONS.MANAGE_GALLERY,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'FAQs',
        href: '/main-website/faqs',
        icon: HelpCircle,
        permission: PERMISSIONS.MANAGE_FAQS,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Inquiries',
        href: '/main-website/queries',
        icon: Inbox,
        permission: PERMISSIONS.MANAGE_QUERIES,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
    ],
  },
  {
    title: 'Inductions',
    items: [
      {
        label: 'Candidates',
        href: '/induction/candidates',
        icon: GraduationCap,
        permission: PERMISSIONS.INDUCTION_VIEW,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Evaluation',
        href: '/induction/evaluation',
        icon: ClipboardCheck,
        permission: PERMISSIONS.INDUCTION_EVALUATE,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Induction Settings',
        href: '/induction/settings',
        icon: Sliders,
        permission: PERMISSIONS.INDUCTION_SETTINGS,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },
  {
    title: 'Team',
    items: [
      {
        label: 'Teams Management',
        href: '/team-management',
        icon: Shield,
        permission: PERMISSIONS.MANAGE_TEAMS,
        allowTeamAdmin: true,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Role Management',
        href: '/role-management',
        icon: Shield,
        permission: PERMISSIONS.MANAGE_USERS,
        roles: [ROLES.SUPER_ADMIN],
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Users',
        href: '/users',
        icon: Users2,
        permission: PERMISSIONS.MANAGE_USERS,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
      },
      {
        label: 'Activity Log',
        href: '/activity-log',
        icon: History,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MEMBER],
      },
      {
        label: 'Profile',
        href: '/profile',
        icon: User,
        roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MEMBER],
      },
    ],
  },
];
