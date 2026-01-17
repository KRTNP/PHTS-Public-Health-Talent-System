/**
 * PHTS System - Express Type Extensions
 *
 * Extends Express Request interface to include authenticated user
 *
 * Date: 2025-12-30
 */

import { JwtPayload } from './auth.js';

declare global {
  namespace Express {
    /**
     * Override Passport's User type with our JwtPayload
     * This allows TypeScript to recognize req.user in protected routes
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
    interface User extends JwtPayload {}

    interface Request {
      uploadSessionId?: string;
    }
  }
}

export {};
