import 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
