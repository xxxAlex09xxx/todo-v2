
// server/src/middlewares/adminMiddleware.ts

import { Response, NextFunction } from 'express';
import { db } from '../db';
import { AuthRequest } from './authMiddleware';

export const adminMiddleware = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // Проверяем авторизацию
        if (!req.userId) {
            return res.status(401).json({
                error: 'Не авторизован'
            });
        }

        // Получаем роль пользователя из Turso
        const result = await db.execute({
            sql: 'SELECT role FROM users WHERE id = ?',
            args: [req.userId]
        });

       const role = result.rows[0]?.['role'];

        // Проверяем существование пользователя и его права
        if (role !== 'admin') {
            return res.status(403).json({
                error: 'Доступ запрещен. Требуются права администратора.'
            });
        }

        next();

    } catch (err: any) {
        console.error('Ошибка adminMiddleware:', err);

        return res.status(500).json({
            error: 'Ошибка проверки прав администратора'
        });
    }
};
