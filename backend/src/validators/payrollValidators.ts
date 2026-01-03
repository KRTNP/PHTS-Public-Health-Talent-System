import { body } from 'express-validator';
import { validate } from '../middlewares/validationMiddleware.js';

export const calculatePayrollValidator = validate([
  body('year')
    .exists()
    .withMessage('year is required')
    .isInt({ min: 1900, max: 3000 })
    .withMessage('year must be a valid number'),
  body('month')
    .exists()
    .withMessage('month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('month must be between 1-12'),
  body('citizen_id')
    .optional({ nullable: true })
    .isString()
    .withMessage('citizen_id must be a string'),
]);
