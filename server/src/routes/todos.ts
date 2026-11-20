
// server/src/routes/todos.ts
import { Router, Response } from 'express';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';

export const todosRouter = Router();

todosRouter.use(authMiddleware);

interface Todo {
    id: number;
    title: string;
    description: string;
    completed: number;
    user_id: number;
    created_at: string;
}

const getUserId = (req: AuthRequest, res: Response): number | null => {
    if (typeof req.userId !== 'number') {
        res.status(401).json({ error: 'Необходима авторизация' });
        return null;
    }

    return req.userId;
};

// GET /todos — получить задачи с пагинацией и фильтрацией
todosRouter.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 5));
        const filter = String(req.query.filter || 'all');

        let where = 'WHERE user_id = ?';

        if (filter === 'active') {
            where += ' AND completed = 0';
        } else if (filter === 'completed') {
            where += ' AND completed = 1';
        }

        // Количество задач с учетом фильтра
        const countResult = await db.execute({
            sql: `SELECT COUNT(*) AS total FROM todos ${where}`,
            args: [userId]
        });

        const total = Number(countResult.rows[0]?.total ?? 0);
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.min(page, Math.max(totalPages, 1));
        const offset = (currentPage - 1) * limit;

        // Получаем задачи текущей страницы
        const todosResult = await db.execute({
            sql: `
                SELECT * FROM todos
                ${where}
                ORDER BY created_at DESC, id DESC
                LIMIT ? OFFSET ?
            `,
            args: [userId, limit, offset]
        });

        const rows = todosResult.rows as unknown as Todo[];

        // Общая статистика без учета фильтра
        const statsResult = await db.execute({
            sql: `
                SELECT
                    COUNT(*) AS total,
                    COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
                    COALESCE(SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END), 0) AS active
                FROM todos
                WHERE user_id = ?
            `,
            args: [userId]
        });

        const statsRow = statsResult.rows[0];

        const stats = {
            total: Number(statsRow.total),
            completed: Number(statsRow.completed),
            active: Number(statsRow.active)
        };

        res.json({
            todos: rows,
            pagination: {
                page: currentPage,
                limit,
                total,
                totalPages
            },
            stats
        });

    } catch (err: any) {
        console.error('Ошибка GET /todos:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /todos/:id — получить одну задачу
todosRouter.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const todoId = Number(req.params.id);

        if (!Number.isSafeInteger(todoId) || todoId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        const result = await db.execute({
            sql: 'SELECT * FROM todos WHERE id = ? AND user_id = ?',
            args: [todoId, userId]
        });

        const todo = result.rows[0] as unknown as Todo | undefined;

        if (!todo) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        res.json({ todo });

    } catch (err: any) {
        console.error('Ошибка GET /todos/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /todos — создать задачу
todosRouter.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const { title, description } = req.body;

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return res.status(400).json({ error: 'title обязателен' });
        }

        const safeDescription =
            typeof description === 'string' ? description.trim() : '';

        const result = await db.execute({
            sql: `
                INSERT INTO todos (title, description, user_id)
                VALUES (?, ?, ?)
            `,
            args: [title.trim(), safeDescription, userId]
        });

        const todoId = Number(result.lastInsertRowid);

        const todoResult = await db.execute({
            sql: 'SELECT * FROM todos WHERE id = ? AND user_id = ?',
            args: [todoId, userId]
        });

        const todo = todoResult.rows[0] as unknown as Todo;

        res.status(201).json({ todo });

    } catch (err: any) {
        console.error('Ошибка POST /todos:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /todos/:id — обновить задачу
todosRouter.patch('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const todoId = Number(req.params.id);
        const { title, description, completed } = req.body;

        if (!Number.isSafeInteger(todoId) || todoId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        const existingResult = await db.execute({
            sql: 'SELECT * FROM todos WHERE id = ? AND user_id = ?',
            args: [todoId, userId]
        });

        const todo = existingResult.rows[0] as unknown as Todo | undefined;

        if (!todo) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        const newTitle =
            typeof title === 'string' && title.trim()
                ? title.trim()
                : todo.title;

        const newDescription =
            typeof description === 'string'
                ? description.trim()
                : todo.description;

        const newCompleted =
            typeof completed === 'boolean'
                ? (completed ? 1 : 0)
                : todo.completed;

        await db.execute({
            sql: `
                UPDATE todos
                SET title = ?, description = ?, completed = ?
                WHERE id = ? AND user_id = ?
            `,
            args: [
                newTitle,
                newDescription,
                newCompleted,
                todoId,
                userId
            ]
        });

        const updatedResult = await db.execute({
            sql: 'SELECT * FROM todos WHERE id = ? AND user_id = ?',
            args: [todoId, userId]
        });

        const updated = updatedResult.rows[0] as unknown as Todo;

        res.json({ todo: updated });

    } catch (err: any) {
        console.error('Ошибка PATCH /todos/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /todos — удалить все задачи пользователя
todosRouter.delete('/', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const result = await db.execute({
            sql: 'DELETE FROM todos WHERE user_id = ?',
            args: [userId]
        });

        res.json({
            message: `Удалено задач: ${result.rowsAffected}`
        });

    } catch (err: any) {
        console.error('Ошибка DELETE /todos:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /todos/:id — удалить одну задачу
todosRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const userId = getUserId(req, res);
        if (userId === null) return;

        const todoId = Number(req.params.id);

        if (!Number.isSafeInteger(todoId) || todoId <= 0) {
            return res.status(400).json({ error: 'Некорректный id' });
        }

        const result = await db.execute({
            sql: 'DELETE FROM todos WHERE id = ? AND user_id = ?',
            args: [todoId, userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Задача не найдена' });
        }

        res.json({ message: 'Задача удалена' });

    } catch (err: any) {
        console.error('Ошибка DELETE /todos/:id:', err);
        res.status(500).json({ error: err.message });
    }
});
