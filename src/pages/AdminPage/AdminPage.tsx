
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    TextField,
    InputAdornment,
    Chip,
    AppBar,
    Toolbar,
    Container,
    MenuItem,
    CircularProgress,
    Alert,
} from '@mui/material';

import {
    Search as SearchIcon,
    Delete as DeleteIcon,
    ArrowBack as ArrowBackIcon,
    Block as BlockIcon,
    CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import { useUsers } from '@/entities/users';

const AdminPage = () => {
    const [search, setSearch] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);

    const {
        users,
        loading,
        error,
        updateUserRole,
        updateUserStatus,
        deleteUser,
    } = useUsers();

    // Поиск по имени и email
    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
    );

    // Изменение роли
    const handleRoleChange = async (
        id: number,
        role: 'admin' | 'user'
    ) => {
        try {
            setActionError(null);
            await updateUserRole({ id, role });
        } catch (err) {
            setActionError(
                err instanceof Error ? err.message : 'Ошибка изменения роли'
            );
        }
    };

    // Блокировка / разблокировка
    const handleStatusChange = async (
        id: number,
        status: 'active' | 'blocked'
    ) => {
        try {
            setActionError(null);
            await updateUserStatus({ id, status });
        } catch (err) {
            setActionError(
                err instanceof Error ? err.message : 'Ошибка изменения статуса'
            );
        }
    };

    // Удаление пользователя
    const handleDelete = async (id: number, name: string) => {
        if (!window.confirm(`Удалить пользователя ${name}?`)) return;

        try {
            setActionError(null);
            await deleteUser(id);
        } catch (err) {
            setActionError(
                err instanceof Error ? err.message : 'Ошибка удаления пользователя'
            );
        }
    };

    return (
        <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh', pb: 4 }}>
            <AppBar position="static" color="default" elevation={1}>
                <Toolbar>
                    <IconButton
                        component={RouterLink}
                        to="/"
                        edge="start"
                        color="inherit"
                        sx={{ mr: 2 }}
                    >
                        <ArrowBackIcon />
                    </IconButton>

                    <Typography
                        variant="h6"
                        component="div"
                        sx={{ flexGrow: 1, fontWeight: 'bold' }}
                    >
                        Админ-панель
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="lg" sx={{ mt: 4 }}>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <TextField
                        size="small"
                        placeholder="Поиск по имени или email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        sx={{ width: 300, bgcolor: 'white', borderRadius: 1 }}
                    />
                </Box>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {actionError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {actionError}
                    </Alert>
                )}

                <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
                    <Table sx={{ minWidth: 850 }}>
                        <TableHead sx={{ bgcolor: '#fafafa' }}>
                            <TableRow>
                                <TableCell><strong>ID</strong></TableCell>
                                <TableCell><strong>Имя</strong></TableCell>
                                <TableCell><strong>Email</strong></TableCell>
                                <TableCell><strong>Роль</strong></TableCell>
                                <TableCell><strong>Статус</strong></TableCell>
                                <TableCell align="right"><strong>Действия</strong></TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id} hover>
                                        <TableCell>{user.id}</TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>

                                        <TableCell>
                                            <TextField
                                                select
                                                size="small"
                                                value={user.role}
                                                onChange={(e) =>
                                                    handleRoleChange(
                                                        user.id,
                                                        e.target.value as 'admin' | 'user'
                                                    )
                                                }
                                                sx={{ minWidth: 130 }}
                                            >
                                                <MenuItem value="admin">Админ</MenuItem>
                                                <MenuItem value="user">Пользователь</MenuItem>
                                            </TextField>
                                        </TableCell>

                                        <TableCell>
                                            <Chip
                                                label={user.status === 'active' ? 'Активен' : 'Заблокирован'}
                                                color={user.status === 'active' ? 'success' : 'error'}
                                                size="small"
                                                variant="outlined"
                                            />
                                        </TableCell>

                                        <TableCell align="right">
                                            <IconButton
                                                color={user.status === 'active' ? 'warning' : 'success'}
                                                title={user.status === 'active' ? 'Заблокировать' : 'Разблокировать'}
                                                onClick={() =>
                                                    handleStatusChange(
                                                        user.id,
                                                        user.status === 'active' ? 'blocked' : 'active'
                                                    )
                                                }
                                            >
                                                {user.status === 'active' ? (
                                                    <BlockIcon />
                                                ) : (
                                                    <CheckCircleIcon />
                                                )}
                                            </IconButton>

                                            <IconButton
                                                color="error"
                                                title="Удалить"
                                                onClick={() => handleDelete(user.id, user.name)}
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        Пользователи не найдены
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <Typography sx={{ mt: 2 }} color="text.secondary">
                    Всего пользователей: {users.length}
                </Typography>
            </Container>
        </Box>
    );
};

export default AdminPage;
