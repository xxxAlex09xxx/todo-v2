
import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import { adminMiddleware } from '../middlewares/adminMiddleware';

const router = Router();

// Все маршруты требуют авторизации и прав администратора
router.use(authMiddleware, adminMiddleware);

// GET /admin/users — получить всех пользователей
router.get('/users', async (_req, res: Response) => {
    try {
        const result = await db.execute(`
            SELECT id, name, email, role, status, created_at
            FROM users
            ORDER BY id DESC
        `);

        const users = result.rows.map((row: any) => ({
            id: Number(row.id),
            name: String(row.name ?? 'Пользователь'),
            email: String(row.email),
            role: String(row.role) as 'admin' | 'user',
            status: String(row.status) as 'active' | 'blocked',
            created_at: String(row.created_at ?? '')
        }));

        return res.json({ users });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        return res.status(500).json({
            error: 'Не удалось получить пользователей'
        });
    }
});

// PATCH /admin/users/:id/role — изменить роль
router.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { role } = req.body;

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный ID' });
        }

        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }

        if (id === req.userId && role !== 'admin') {
            return res.status(400).json({
                error: 'Нельзя снять права администратора с самого себя'
            });
        }

        const result = await db.execute({
            sql: 'UPDATE users SET role = ? WHERE id = ?',
            args: [role, id]
        });

        if (Number(result.rowsAffected) === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ message: 'Роль успешно изменена' });
    } catch (error) {
        console.error('Ошибка изменения роли:', error);
        return res.status(500).json({
            error: 'Не удалось изменить роль'
        });
    }
});

// PATCH /admin/users/:id/status — блокировка / разблокировка
router.patch('/users/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный ID' });
        }

        if (!['active', 'blocked'].includes(status)) {
            return res.status(400).json({ error: 'Некорректный статус' });
        }

        if (id === Number(req.userId) && status === 'blocked') {
            return res.status(400).json({
                error: 'Нельзя заблокировать самого себя'
            });
        }

        const result = await db.execute({
            sql: 'UPDATE users SET status = ? WHERE id = ?',
            args: [status, id]
        });

        if (Number(result.rowsAffected) === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ message: 'Статус успешно изменён' });
    } catch (error) {
        console.error('Ошибка изменения статуса:', error);
        return res.status(500).json({
            error: 'Не удалось изменить статус'
        });
    }
});

// DELETE /admin/users/:id — удалить пользователя
router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный ID' });
        }

        if (id === req.userId) {
            return res.status(400).json({
                error: 'Нельзя удалить самого себя'
            });
        }

        const result = await db.execute({
            sql: 'DELETE FROM users WHERE id = ?',
            args: [id]
        });

        if (Number(result.rowsAffected) === 0) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        return res.json({ message: 'Пользователь удалён' });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        return res.status(500).json({
            error: 'Не удалось удалить пользователя'
        });
    }
});

export default router;
