
// server/src/routes/users.ts
import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

export const usersRouter = Router();

// Авторизация и проверка прав администратора
usersRouter.use(authMiddleware);
usersRouter.use(adminMiddleware);

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    created_at: string;
}

// GET /admin/users — получить всех пользователей
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.execute({
            sql: `
                SELECT id, name, email, role, status, created_at
                FROM users
                ORDER BY created_at DESC
            `,
            args: []
        });

        const users = result.rows as unknown as User[];

        res.json({ users });

    } catch (err: any) {
        console.error('Ошибка GET /admin/users:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /admin/users/:id/role — изменить роль пользователя
usersRouter.patch('/:id/role', async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.params.id);
        const { role } = req.body;

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        if (role !== 'admin' && role !== 'user') {
            return res.status(400).json({ error: 'Некорректная роль' });
        }

        // Запрещаем админу менять собственную роль
        if (userId === req.userId) {
            return res.status(400).json({
                error: 'Нельзя изменить свою собственную роль'
            });
        }

        const result = await db.execute({
            sql: 'UPDATE users SET role = ? WHERE id = ?',
            args: [role, userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ message: 'Роль успешно обновлена' });

    } catch (err: any) {
        console.error('Ошибка PATCH /admin/users/:id/role:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /admin/users/:id/status — заблокировать/разблокировать
usersRouter.patch('/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        if (status !== 'active' && status !== 'blocked') {
            return res.status(400).json({ error: 'Некорректный статус' });
        }

        // Запрещаем админу блокировать самого себя
        if (userId === req.userId) {
            return res.status(400).json({
                error: 'Нельзя изменить статус самого себя'
            });
        }

        const result = await db.execute({
            sql: 'UPDATE users SET status = ? WHERE id = ?',
            args: [status, userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // При блокировке отзываем все refresh-токены пользователя
        if (status === 'blocked') {
            await db.execute({
                sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
                args: [userId]
            });
        }

        res.json({ message: 'Статус успешно обновлен' });

    } catch (err: any) {
        console.error('Ошибка PATCH /admin/users/:id/status:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /admin/users/:id — удалить пользователя
usersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = Number(req.params.id);

        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        // Запрещаем админу удалить самого себя
        if (userId === req.userId) {
            return res.status(400).json({
                error: 'Нельзя удалить самого себя'
            });
        }

        const result = await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ message: 'Пользователь удален' });

    } catch (err: any) {
        console.error('Ошибка DELETE /admin/users/:id:', err);
        res.status(500).json({ error: err.message });
    }
});
