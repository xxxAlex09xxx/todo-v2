// server/src/routes/auth.ts
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { hashPassword, comparePassword } from '../utils/password';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware';
import crypto from 'crypto';
import { sendResetEmail } from '../utils/mailer';
import {
    saveRefreshToken,
    findRefreshToken,
    hashToken,
} from '../utils/tokens';
import {
    createAccessToken,
    createRefreshToken,
    verifyRefreshToken,
} from '../utils/jwt';
import { config } from '../config';

export const authRouter = Router();

interface User {
    id: number;
    email: string;
    password_hash: string;
    created_at: string;
    role: string;
    reset_token: string | null;
    reset_token_expires: string | null;
}

interface AuthBody {
    email: string;
    password: string;
}

// 📌 POST /auth/register
authRouter.post('/register', async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        // Проверяем, есть ли такой пользователь
        const existingResult = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [email]
        });
        if (existingResult.rows.length > 0) {
            return res.status(409).json({ error: 'Email уже занят' });
        }

        const passwordHash = await hashPassword(password);

        // Создаем пользователя
        const insertResult = await db.execute({
            sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            args: [email, passwordHash]
        });
        
        // @libsql/client возвращает lastInsertRowid как bigint.
        // Преобразуем его в number, чтобы Express мог сериализовать ID в JSON.
        const userId = Number(insertResult.lastInsertRowid);
        if (!Number.isSafeInteger(userId) || userId <= 0) {
            throw new Error('Не удалось создать пользователя');
        }

        const accessToken = createAccessToken(userId);
        const refreshToken = createRefreshToken(userId);

        console.log(`\n🔵 REGISTER: Пользователь ${email} создан (ID: ${userId})`);

        // Удаляем старые токены (на всякий случай)
        await db.execute({
            sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
            args: [userId]
        });

        // Сохраняем новый токен
        await saveRefreshToken(Number(userId), refreshToken);
        console.log('✅ Новый токен сохранен в REGISTER');

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.isProd,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        
        res.status(201).json({
            accessToken,
            user: { id: userId, email, role: 'user' },
        });
    } catch (err: any) {
        console.error('Ошибка в /register:', err);
        res.status(500).json({ error: err.message });
    }
});

// 📌 POST /auth/login
authRouter.post('/login', async (req: Request<{}, {}, AuthBody>, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE email = ?',
            args: [email]
        });
        const user = userResult.rows[0] as unknown as User | undefined;

        if (!user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const isValid = await comparePassword(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const accessToken = createAccessToken(user.id);
        const refreshToken = createRefreshToken(user.id);

        console.log(`\n🟢 LOGIN: Пользователь ${email} вошел (ID: ${user.id})`);

        await db.execute({
            sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
            args: [user.id]
        });

        await saveRefreshToken(user.id, refreshToken);
        console.log('✅ Новый токен сохранен в LOGIN');

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: config.isProd,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({
            accessToken,
            user: { id: user.id, email: user.email, role: user.role },
        });
    } catch (err: any) {
        console.error('Ошибка в /login:', err);
        res.status(500).json({ error: err.message });
    }
});

// 📌 POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            console.log('❌ REFRESH: Токен отсутствует в куки');
            return res.status(401).json({ error: 'Refresh token отсутствует' });
        }

        let payload;
        try {
            payload = verifyRefreshToken(refreshToken);
        } catch {
            console.log('❌ REFRESH: Невалидный токен');
            return res.status(401).json({ error: 'Невалидный refresh token' });
        }

        const stored = await findRefreshToken(refreshToken);

        if (!stored || stored.revoked === 1) {
            console.log('❌ REFRESH: Токен отозван или не найден');
            res.clearCookie('refreshToken', { httpOnly: true, secure: config.isProd, sameSite: 'lax' });
            return res.status(401).json({ error: 'Refresh token отозван' });
        }

        if (new Date(stored.expires_at).getTime() < Date.now()) {
            console.log('❌ REFRESH: Токен истек');
            res.clearCookie('refreshToken', { httpOnly: true, secure: config.isProd, sameSite: 'lax' });
            return res.status(401).json({ error: 'Refresh token истёк' });
        }

        console.log('🔄 REFRESH: Обновляем токен для user:', payload.userId);

        const tokenHash = hashToken(refreshToken);
        
        // Удаляем старый токен
        await db.execute({
            sql: 'DELETE FROM refresh_tokens WHERE token_hash = ?',
            args: [tokenHash]
        });
        console.log('🗑️ Старый токен в REFRESH удален');

        const newAccessToken = createAccessToken(payload.userId);
        const newRefreshToken = createRefreshToken(payload.userId);
        
        await saveRefreshToken(payload.userId, newRefreshToken);
        console.log('✅ Новый токен сохранен в REFRESH');

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: config.isProd,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.json({ accessToken: newAccessToken });
    } catch (err: any) {
        console.error('Ошибка в /refresh:', err);
        res.status(500).json({ error: err.message });
    }
});

// 📌 POST /auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            console.log('🚪 LOGOUT: Удаляем токен при выходе');
            const tokenHash = hashToken(refreshToken);
            await db.execute({
                sql: 'DELETE FROM refresh_tokens WHERE token_hash = ?',
                args: [tokenHash]
            });
            console.log('🗑️ Токен удален в LOGOUT');
        }

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: config.isProd,
            sameSite: 'lax',
        });

        res.json({ message: 'Выход выполнен' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 📌 GET /auth/me
authRouter.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        res.setHeader('Cache-Control', 'no-store');
        
        const userResult = await db.execute({
            sql: 'SELECT id, email, role FROM users WHERE id = ?',
            args: [req.userId!]
        });
        const user = userResult.rows[0];

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ user });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 📌 POST /auth/forgot-password
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        if (!email) return res.status(400).json({ error: 'Email обязателен' });

        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE email = ?',
            args: [email]
        });
        const user = userResult.rows[0] as unknown as User | undefined;

        if (!user) {
            // Не палим, есть ли такой email
            return res.json({ message: 'Если email зарегистрирован, письмо отправлено' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        await db.execute({
            sql: 'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
            args: [resetToken, expiresAt, user.id]
        });

        try {
            await sendResetEmail(user.email, resetToken);
        } catch (mailErr) {
            console.error('❌ Ошибка отправки письма:', mailErr);
        }

        res.json({ message: 'Если email зарегистрирован, письмо отправлено' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// 📌 POST /auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Неверные данные' });
        }

        const userResult = await db.execute({
            sql: 'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?',
            args: [token, new Date().toISOString()]
        });
        const user = userResult.rows[0] as unknown as User | undefined;

        if (!user) {
            return res.status(400).json({ error: 'Токен недействителен или истек' });
        }

        const passwordHash = await hashPassword(newPassword);

        await db.execute({
            sql: 'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
            args: [passwordHash, user.id]
        });

        // Сбрасываем все сессии
        await db.execute({
            sql: 'DELETE FROM refresh_tokens WHERE user_id = ?',
            args: [user.id]
        });

        res.json({ message: 'Пароль успешно изменен. Все сессии сброшены.' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});