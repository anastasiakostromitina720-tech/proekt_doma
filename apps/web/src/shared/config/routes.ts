export const routes = {
  home: '/',
  login: '/login',
  register: '/register',
  dashboard: {
    projects: '/projects',
    settings: '/settings',
    project: (id: string) => `/projects/${id}`,
    editor: (id: string) => `/projects/${id}/editor`,
    viewer: (id: string) => `/projects/${id}/viewer`,
    redesign: (id: string) => `/projects/${id}/redesign`,
  },
} as const;
