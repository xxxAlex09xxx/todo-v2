
import 'dotenv/config';


// Клиент будет создан при инициализации базы
export let db: any;

// Функция для создания таблиц при старте сервера
export async function initDb() {
    try {
        console.log('⏳ Подключение к Turso и инициализация таблиц...');

        // Динамически загружаем ES-модуль
        const { createClient } = await import('@libsql/client');

        db = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN!,
        });

        // 1. Таблица пользователей
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT DEFAULT 'Пользователь',
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                reset_token TEXT,
                reset_token_expires DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Таблица refresh-токенов
        await db.execute(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at DATETIME NOT NULL,
                revoked INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 3. Таблица задач
        await db.execute(`
            CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                completed INTEGER DEFAULT 0,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Все таблицы в Turso успешно созданы!');
    } catch (error) {
        console.error('❌ Ошибка инициализации БД Turso:', error);
        throw error;
    }
}
