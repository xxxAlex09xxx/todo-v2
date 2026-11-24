import { Router, Response } from 'express';
import { db } from '../db';
import {
    authMiddleware,
    adminMiddleware,
    AuthRequest,
} from '../middlewares/authMiddleware';

const router = Router();

// Все роуты — только для админа
router.use(authMiddleware, adminMiddleware);

// ---------- helpers ----------

const run = (sql: string, params: any[] = []) =>
    new Promise<void>((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve();
        });
    });

const get = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T | undefined>((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row as T)));
    });

const all = <T = any>(sql: string, params: any[] = []) =>
    new Promise<T[]>((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });

// ---------- GET /admin/users ----------

router.get('/users', async (_req: AuthRequest, res: Response) => {
    try {
        const users = await all<{
            id: number;
            name: string | null;
            email: string;
            role: string;
            status: string;
            created_at: string;
        }>(
            `SELECT id, name, email, role, status, created_at
             FROM users
             ORDER BY id DESC`
        );

        res.json({
            users: users.map((u) => ({ ...u, name: u.name ?? '' })),
        });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------- PATCH /admin/users/:id/role ----------

router.patch('/users/:id/role', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { role } = req.body as { role?: string };

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }
        if (role !== 'admin' && role !== 'user') {
            return res.status(400).json({ error: 'role должен быть admin или user' });
        }

        // защита от снятия роли с себя
        if (req.userId === id && role !== 'admin') {
            return res.status(400).json({ error: 'Нельзя снять роль admin с себя' });
        }

        const target = await get<{ id: number; role: string }>(
            `SELECT id, role FROM users WHERE id = ?`,
            [id]
        );
        if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

        // защита последнего админа
        if (target.role === 'admin' && role !== 'admin') {
            const admins = await get<{ c: number }>(
                `SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active'`
            );
            if ((admins?.c ?? 0) <= 1) {
                return res.status(400).json({ error: 'Нельзя понизить последнего администратора' });
            }
        }

        await run(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
        res.json({ message: 'Роль обновлена' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------- PATCH /admin/users/:id/status ----------

router.patch('/users/:id/status', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body as { status?: string };

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }
        if (status !== 'active' && status !== 'blocked') {
            return res.status(400).json({ error: 'status должен быть active или blocked' });
        }

        // нельзя заблокировать себя
        if (req.userId === id && status === 'blocked') {
            return res.status(400).json({ error: 'Нельзя заблокировать себя' });
        }

        const target = await get<{ id: number; role: string; status: string }>(
            `SELECT id, role, status FROM users WHERE id = ?`,
            [id]
        );
        if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

        // нельзя заблокировать последнего активного админа
        if (status === 'blocked' && target.role === 'admin') {
            const admins = await get<{ c: number }>(
                `SELECT COUNT(*) AS c FROM users
                 WHERE role = 'admin' AND status = 'active' AND id <> ?`,
                [id]
            );
            if ((admins?.c ?? 0) === 0) {
                return res.status(400).json({ error: 'Нельзя заблокировать последнего администратора' });
            }
        }

        await run(`UPDATE users SET status = ? WHERE id = ?`, [status, id]);

        // При блокировке — отзываем все refresh-токены
        if (status === 'blocked') {
            await run(
                `UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?`,
                [id]
            );
        }

        res.json({ message: 'Статус обновлён' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

// ---------- DELETE /admin/users/:id ----------

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        // нельзя удалить себя
        if (req.userId === id) {
            return res.status(400).json({ error: 'Нельзя удалить себя' });
        }

        const target = await get<{ id: number; role: string; status: string }>(
            `SELECT id, role, status FROM users WHERE id = ?`,
            [id]
        );
        if (!target) return res.status(404).json({ error: 'Пользователь не найден' });

        // нельзя удалить последнего активного админа
        if (target.role === 'admin' && target.status === 'active') {
            const admins = await get<{ c: number }>(
                `SELECT COUNT(*) AS c FROM users
                 WHERE role = 'admin' AND status = 'active' AND id <> ?`,
                [id]
            );
            if ((admins?.c ?? 0) === 0) {
                return res.status(400).json({ error: 'Нельзя удалить последнего администратора' });
            }
        }

        // ON DELETE CASCADE удалит todos и refresh_tokens
        await run(`DELETE FROM users WHERE id = ?`, [id]);

        res.json({ message: 'Пользователь удалён' });
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
});

export default router;