
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

interface TodoStats {
    total: number;
    completed: number;
    active: number;
}

// GET /todos — задачи с пагинацией, фильтром и статистикой
todosRouter.get('/', (req: AuthRequest, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const filter = String(req.query.filter || 'all');

    if (!['all', 'active', 'completed'].includes(filter)) {
        res.status(400).json({ error: 'Некорректный фильтр' });
        return;
    }

    const offset = (page - 1) * limit;
    const userId = req.userId;

    const filterSql =
        filter === 'active'
            ? 'AND completed = 0'
            : filter === 'completed'
                ? 'AND completed = 1'
                : '';

    db.get(
        `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
            COALESCE(SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END), 0) AS active
         FROM todos
         WHERE user_id = ?`,
        [userId],
        (statsError, stats: TodoStats) => {
            if (statsError) {
                res.status(500).json({ error: statsError.message });
                return;
            }

            db.get(
                `SELECT COUNT(*) AS total
                 FROM todos
                 WHERE user_id = ? ${filterSql}`,
                [userId],
                (countError, count: { total: number }) => {
                    if (countError) {
                        res.status(500).json({ error: countError.message });
                        return;
                    }

                    const total = count.total;
                    const totalPages = Math.ceil(total / limit);

                    db.all(
                        `SELECT * FROM todos
                         WHERE user_id = ? ${filterSql}
                         ORDER BY created_at DESC, id DESC
                         LIMIT ? OFFSET ?`,
                        [userId, limit, offset],
                        (todosError, rows: Todo[]) => {
                            if (todosError) {
                                res.status(500).json({ error: todosError.message });
                                return;
                            }

                            res.json({
                                todos: rows,
                                pagination: {
                                    page,
                                    limit,
                                    total,
                                    totalPages,
                                },
                                stats: {
                                    total: stats.total,
                                    completed: stats.completed,
                                    active: stats.active,
                                },
                            });
                        }
                    );
                }
            );
        }
    );
});

// GET /todos/:id — получить одну задачу
todosRouter.get('/:id', (req: AuthRequest, res: Response) => {
    const todoId = Number(req.params.id);

    if (isNaN(todoId)) {
        res.status(400).json({ error: 'Некорректный id' });
        return;
    }

    db.get(
        'SELECT * FROM todos WHERE id = ? AND user_id = ?',
        [todoId, req.userId],
        (err, todo: Todo | undefined) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!todo) {
                res.status(404).json({ error: 'Задача не найдена' });
                return;
            }
            res.json({ todo });
        }
    );
});

// POST /todos — создать задачу
todosRouter.post('/', (req: AuthRequest, res: Response) => {
    const { title, description } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'title обязателен' });
        return;
    }

    const safeDescription =
        typeof description === 'string' ? description.trim() : '';

    db.run(
        'INSERT INTO todos (title, description, user_id) VALUES (?, ?, ?)',
        [title.trim(), safeDescription, req.userId],
        function (this: { lastID: number }, err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            db.get(
                'SELECT * FROM todos WHERE id = ?',
                [this.lastID],
                (err, todo) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    res.status(201).json({ todo });
                }
            );
        }
    );
});

// PATCH /todos/:id — обновить задачу
todosRouter.patch('/:id', (req: AuthRequest, res: Response) => {
    const todoId = Number(req.params.id);
    const { title, description, completed } = req.body;

    if (isNaN(todoId)) {
        res.status(400).json({ error: 'Некорректный id' });
        return;
    }

    db.get(
        'SELECT * FROM todos WHERE id = ? AND user_id = ?',
        [todoId, req.userId],
        (err, todo: Todo | undefined) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (!todo) {
                res.status(404).json({ error: 'Задача не найдена' });
                return;
            }

            const newTitle =
                typeof title === 'string' && title.trim() ? title.trim() : todo.title;

            const newDescription =
                typeof description === 'string' ? description.trim() : todo.description;

            const newCompleted =
                typeof completed === 'boolean' ? (completed ? 1 : 0) : todo.completed;

            db.run(
                'UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ?',
                [newTitle, newDescription, newCompleted, todoId],
                (err) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, updated) => {
                        if (err) {
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        res.json({ todo: updated });
                    });
                }
            );
        }
    );
});

// DELETE /todos — удалить все задачи пользователя
todosRouter.delete('/', (req: AuthRequest, res: Response) => {
    db.run(
        'DELETE FROM todos WHERE user_id = ?',
        [req.userId],
        function (this: { changes: number }, err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: `Удалено задач: ${this.changes}` });
        }
    );
});

// DELETE /todos/:id — удалить одну задачу
todosRouter.delete('/:id', (req: AuthRequest, res: Response) => {
    const todoId = Number(req.params.id);

    if (isNaN(todoId)) {
        res.status(400).json({ error: 'Некорректный id' });
        return;
    }

    db.run(
        'DELETE FROM todos WHERE id = ? AND user_id = ?',
        [todoId, req.userId],
        function (this: { changes: number }, err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Задача не найдена' });
                return;
            }
            res.json({ message: 'Задача удалена' });
        }
    );
});
