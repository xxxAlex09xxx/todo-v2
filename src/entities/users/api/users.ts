
import { apiFetch } from '@/shared/api/client';

const API_URL = 'http://localhost:5000/admin/users';

// Пользователь с сервера
export interface UserFromServer {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'user';
    status: 'active' | 'blocked';
    created_at: string;
}

interface UsersResponse {
    users: UserFromServer[];
}

interface MessageResponse {
    message: string;
}

export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'blocked';

// GET /admin/users — получить пользователей
export const fetchUsers = async (): Promise<{ users: UserFromServer[] }> => {
    const response = await apiFetch(API_URL);

    if (!response.ok) {
        throw new Error(`Ошибка загрузки пользователей: ${response.status}`);
    }

    const data: UsersResponse = await response.json();

    return {
        users: data.users,
    };
};

// PATCH /admin/users/:id/role — изменить роль
export const updateUserRole = async (
    id: number,
    role: UserRole
): Promise<void> => {
    const response = await apiFetch(`${API_URL}/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }

    await response.json() as MessageResponse;
};

// PATCH /admin/users/:id/status — изменить статус
export const updateUserStatus = async (
    id: number,
    status: UserStatus
): Promise<void> => {
    const response = await apiFetch(`${API_URL}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }

    await response.json() as MessageResponse;
};

// DELETE /admin/users/:id — удалить пользователя
export const deleteUserById = async (id: number): Promise<void> => {
    const response = await apiFetch(`${API_URL}/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Ошибка: ${response.status}`);
    }

    await response.json() as MessageResponse;
};
