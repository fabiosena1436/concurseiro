import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Switch, CircularProgress, Alert, Tabs, Tab, TextField } from '@mui/material';
import { getAllUsers, toggleUserUnlockStatus, getAllMessages, replySupportMessage, markMessageAsReadByAdmin } from '../services/firestoreService';
import { deleteUserAccount } from '../services/adminService';
import type { UserProfile } from '../types/user';
import type { SupportMessage } from '../types/message';

export const AdminDashboard: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedUsers, fetchedMessages] = await Promise.all([
        getAllUsers(),
        getAllMessages()
      ]);
      setUsers(fetchedUsers);
      setMessages(fetchedMessages);
      
      // Marca mensagens como lidas pelo admin se a aba de mensagens estiver aberta
      if (tabIndex === 1) {
        fetchedMessages.forEach(msg => {
          if (!msg.isReadByAdmin && msg.id) {
            void markMessageAsReadByAdmin(msg.id);
          }
        });
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [tabIndex]); // Re-fetch or mark read when tab changes

  const handleToggleUnlock = async (uid: string, currentStatus: boolean) => {
    try {
      await toggleUserUnlockStatus(uid, !currentStatus);
      setUsers(users.map(u => u.uid === uid ? { ...u, isUnlocked: !currentStatus } : u));
    } catch (err) {
      console.error(err);
      alert("Erro ao alterar status.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este usuário?")) return;
    try {
      setLoading(true);
      await deleteUserAccount(uid);
      await fetchData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Erro ao deletar usuário.");
      setLoading(false);
    }
  };

  const handleReply = async (messageId: string) => {
    const text = replyText[messageId];
    if (!text || !text.trim()) return;
    try {
      await replySupportMessage(messageId, text);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Erro ao responder mensagem.");
    }
  };

  if (loading) {
    return (
      <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Painel Administrativo
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Tabs value={tabIndex} onChange={(_, newValue) => setTabIndex(newValue as number)} sx={{ mb: 3 }}>
        <Tab label="Usuários" />
        <Tab label="Mensagens" />
      </Tabs>

      {tabIndex === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>E-mail</TableCell>
                <TableCell>Telefone</TableCell>
                <TableCell align="center">Gerações</TableCell>
                <TableCell align="center">Ativo (Pago)</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.uid}>
                  <TableCell>{user.name || '-'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone || '-'}</TableCell>
                  <TableCell align="center">{user.generationCount || 0}</TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={!!user.isUnlocked}
                      onChange={() => void handleToggleUnlock(user.uid, !!user.isUnlocked)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Button 
                      variant="outlined" 
                      color="error" 
                      size="small"
                      onClick={() => void handleDeleteUser(user.uid)}
                    >
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">Nenhum usuário encontrado.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tabIndex === 1 && (
        <Box>
          {messages.length === 0 ? (
            <Typography>Nenhuma mensagem.</Typography>
          ) : (
            messages.map((msg) => (
              <Paper key={msg.id} sx={{ p: 2, mb: 2, borderLeft: msg.reply ? '4px solid green' : '4px solid orange' }}>
                <Typography variant="body2" color="text.secondary">
                  De: {msg.userName} ({msg.userEmail}) em {msg.createdAt.toLocaleString()}
                </Typography>
                <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
                  {msg.text}
                </Typography>
                
                {msg.reply ? (
                  <Box sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Sua Resposta:
                    </Typography>
                    <Typography variant="body1">
                      {msg.reply}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Escreva sua resposta..."
                      value={replyText[msg.id!] || ''}
                      onChange={(e) => setReplyText({ ...replyText, [msg.id!]: e.target.value })}
                    />
                    <Button variant="contained" onClick={() => void handleReply(msg.id!)}>
                      Responder
                    </Button>
                  </Box>
                )}
              </Paper>
            ))
          )}
        </Box>
      )}
    </Container>
  );
};
