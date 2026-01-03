import { validationResult, type ValidationChain } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

/**
 * Wrap express-validator chains and return 400 with details when invalid.
 */
export const validate = (chains: ValidationChain[]) => {
  return [
    ...chains,
    (req: Request, res: Response, next: NextFunction) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return res.status(400).json({ errors: result.array() });
      }
      next();
    },
  ];
};
