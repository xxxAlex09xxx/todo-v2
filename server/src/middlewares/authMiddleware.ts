import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { db } from '../db';

export interface AuthRequest extends Request {
    userId?: number;
    userRole?: 'admin' | 'user';
    userStatus?: 'active' | 'blocked';
}

// 1️⃣ Только аутентификация — как у вас было
export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Токен не предоставлен' });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyAccessToken(token);
        req.userId = payload.userId;

        next();
    } catch {
        return res.status(401).json({ error: 'Невалидный токен' });
    }
};

// 2️⃣ Только для админа: проверяет роль + статус в БД
//    (ставится ПОСЛЕ authMiddleware)
export const adminMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Не аутентифицирован' });
    }

    db.get(
        `SELECT role, status FROM users WHERE id = ?`,
        [userId],
        (err, row: { role: 'admin' | 'user'; status: 'active' | 'blocked' } | undefined) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(401).json({ error: 'Пользователь не найден' });
            if (row.status === 'blocked') {
                return res.status(403).json({ error: 'Аккаунт заблокирован' });
            }
            if (row.role !== 'admin') {
                return res.status(403).json({ error: 'Только для администраторов' });
            }

            req.userRole = row.role;
            req.userStatus = row.status;
            next();
        }
    );
};