import { Request, Response, NextFunction } from "express";
import { ZodObject, ZodIssue } from "zod";

export const validate = (schema: ZodObject<any, any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await schema.safeParseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: result.error.issues.map((issue: ZodIssue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      // Assign transformed values back to request
      if (result.data.body) req.body = result.data.body;
      if (result.data.query) req.query = result.data.query as any;
      if (result.data.params) req.params = result.data.params as any;

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
