
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
    fetchUsers,
    updateUserRole,
    updateUserStatus,
    deleteUserById,
} from '../api/users';

import type { UserRole, UserStatus } from '../api/users';

const USERS_KEY = ['users'];

export const useUsers = () => {
    const queryClient = useQueryClient();

    // Получение пользователей
    const {
        data,
        isLoading: loading,
        error: queryError,
    } = useQuery({
        queryKey: USERS_KEY,
        queryFn: fetchUsers,
    });

    const users = data?.users ?? [];
    const error = queryError?.message ?? null;

    // Изменение роли
    const updateRoleMutation = useMutation({
        mutationFn: ({ id, role }: { id: number; role: UserRole }) =>
            updateUserRole(id, role),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: USERS_KEY });
        },
    });

    // Изменение статуса
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: UserStatus }) =>
            updateUserStatus(id, status),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: USERS_KEY });
        },
    });

    // Удаление пользователя
    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteUserById(id),

        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: USERS_KEY });
        },
    });

    return {
        users,
        loading,
        error,

        updateUserRole: updateRoleMutation.mutateAsync,
        updatingRole: updateRoleMutation.isPending,

        updateUserStatus: updateStatusMutation.mutateAsync,
        updatingStatus: updateStatusMutation.isPending,

        deleteUser: deleteMutation.mutateAsync,
        deletingUser: deleteMutation.isPending,
    };
};
