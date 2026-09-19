import React, { useCallback, useEffect, useState } from 'react';
import { Container, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Switch, CircularProgress, Alert, Tabs, Tab, TextField, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { getAllUsers, toggleUserUnlockStatus, getAllMessages, replySupportMessage, markMessageAsReadByAdmin, deleteSupportMessage } from '../services/firestoreService';
import { deleteUserAccount } from '../services/adminService';
import type { UserProfile } from '../types/user';
import type { SupportMessage } from '../types/message';

// Interface to flatten legacy replies into our new single-message format
interface ChatBubble {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  text: string;
  isSenderAdmin: boolean;
  createdAt: Date;
  isLegacyReply?: boolean;
}

export const AdminDashboard: React.FC = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [expandedThreads, setExpandedThreads] = useState<{ [key: string]: boolean }>({});
  
  // Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const handleCloseConfirm = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedUsers, fetchedMessages] = await Promise.all([
        getAllUsers(),
        getAllMessages()
      ]);
      setUsers(fetchedUsers);
      setMessages(fetchedMessages);
      
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
  }, [tabIndex]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggleUnlock = async (uid: string, currentStatus: boolean) => {
    try {
      await toggleUserUnlockStatus(uid, !currentStatus);
      setUsers(users.map(u => u.uid === uid ? { ...u, isUnlocked: !currentStatus } : u));
    } catch (err) {
      console.error(err);
      setError("Erro ao alterar status.");
    }
  };

  const handleDeleteUser = (uid: string) => {
    setConfirmDialog({
      open: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir permanentemente este usuário? Esta ação não pode ser desfeita.',
      onConfirm: () => {
        void (async () => {
          handleCloseConfirm();
          try {
            setLoading(true);
            await deleteUserAccount(uid);
            await fetchData();
          } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Erro ao deletar usuário.");
            setLoading(false);
          }
        })();
      }
    });
  };

  const handleReply = async (userId: string, userEmail: string, userName: string) => {
    const text = replyText[userId];
    if (!text || !text.trim()) return;
    try {
      await replySupportMessage(userId, userEmail, userName, text);
      setReplyText(prev => ({ ...prev, [userId]: '' }));
      await fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao responder mensagem.");
    }
  };

  const handleDeleteSingleMessage = async (messageId: string, isLegacyReply?: boolean) => {
    try {
      if (isLegacyReply) {
        // If it's a legacy reply, we can't easily delete just the reply without updating the doc, 
        // but since we are migrating, we can just warn or ignore. To keep it simple, we delete the whole doc.
        await deleteSupportMessage(messageId.replace('-reply', ''));
      } else {
        await deleteSupportMessage(messageId);
      }
      await fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao excluir mensagem.");
    }
  };

  const handleDeleteConversation = async (userId: string) => {
    try {
      setLoading(true);
      const userMsgs = messages.filter(m => m.userId === userId);
      await Promise.all(userMsgs.map(m => m.id ? deleteSupportMessage(m.id) : Promise.resolve()));
      await fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao excluir conversa.");
      setLoading(false);
    }
  };

  // Process and group all messages by user, flattening legacy replies
  const threads: Record<string, ChatBubble[]> = {};
  
  messages.forEach(msg => {
    if (!threads[msg.userId]) {
      threads[msg.userId] = [];
    }
    
    // Add the main message
    threads[msg.userId].push({
      id: msg.id || Math.random().toString(),
      userId: msg.userId,
      userEmail: msg.userEmail,
      userName: msg.userName,
      text: msg.text,
      isSenderAdmin: msg.sender === 'admin',
      createdAt: msg.createdAt,
    });
    
    // Add legacy reply if it exists
    if (msg.reply && msg.sender !== 'admin') {
      threads[msg.userId].push({
        id: (msg.id || Math.random().toString()) + '-reply',
        userId: msg.userId,
        userEmail: msg.userEmail,
        userName: msg.userName,
        text: msg.reply,
        isSenderAdmin: true,
        createdAt: msg.repliedAt || msg.createdAt,
        isLegacyReply: true,
      });
    }
  });

  // Sort bubbles in each thread chronologically
  Object.keys(threads).forEach(userId => {
    threads[userId].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  });

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
          {Object.keys(threads).length === 0 ? (
            <Typography>Nenhuma mensagem.</Typography>
          ) : (
            Object.values(threads).map((thread) => {
              if (thread.length === 0) return null;
              const latestMsg = thread[thread.length - 1];
              const isExpanded = expandedThreads[latestMsg.userId] || false;
              
              const toggleThread = (userId: string) => {
                setExpandedThreads(prev => ({ ...prev, [userId]: !prev[userId] }));
              };

              return (
                <Paper key={latestMsg.userId} sx={{ mb: 4, bgcolor: '#f8f9fa', overflow: 'hidden' }}>
                  <Box 
                    sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: isExpanded ? '#e0e0e0' : 'transparent' }}
                    onClick={() => toggleThread(latestMsg.userId)}
                  >
                    <Box>
                      <Typography variant="h6">
                        {latestMsg.userName} ({latestMsg.userEmail})
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Última interação: {latestMsg.createdAt.toLocaleDateString()} às {latestMsg.createdAt.toLocaleTimeString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="button" color="primary">
                        {isExpanded ? "Minimizar" : "Abrir"}
                      </Typography>
                      <Button variant="outlined" color="error" size="small" onClick={(e) => { e.stopPropagation(); void handleDeleteConversation(latestMsg.userId); }}>
                        Apagar Conversa
                      </Button>
                    </Box>
                  </Box>
                  
                  {isExpanded && (
                    <Box sx={{ p: 2, pt: 0 }}>
                      <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 1, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 1, mb: 2, mt: 2 }}>
                        {thread.map((bubble) => (
                          <Box 
                            key={bubble.id} 
                            sx={{ 
                              alignSelf: bubble.isSenderAdmin ? 'flex-end' : 'flex-start', 
                              bgcolor: bubble.isSenderAdmin ? '#e3f2fd' : '#dcf8c6', 
                              p: 1.5, 
                              borderRadius: 2, 
                              maxWidth: '80%', 
                              boxShadow: 1,
                              position: 'relative',
                              '&:hover .delete-btn': { opacity: 1 }
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                {bubble.createdAt.toLocaleString()}
                              </Typography>
                              <IconButton 
                                className="delete-btn"
                                size="small" 
                                color="error" 
                                sx={{ opacity: 0, transition: 'opacity 0.2s', padding: 0, ml: 1 }}
                                onClick={() => void handleDeleteSingleMessage(bubble.id, bubble.isLegacyReply)}
                                title="Apagar mensagem"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                              {bubble.text}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Enviar resposta..."
                          value={replyText[latestMsg.userId] || ''}
                          onChange={(e) => setReplyText({ ...replyText, [latestMsg.userId]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void handleReply(latestMsg.userId, latestMsg.userEmail, latestMsg.userName);
                            }
                          }}
                        />
                        <Button variant="contained" onClick={() => void handleReply(latestMsg.userId, latestMsg.userEmail, latestMsg.userName)}>
                          Responder
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Paper>
              );
            })
          )}
        </Box>
      )}
      <Dialog
        open={confirmDialog.open}
        onClose={handleCloseConfirm}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirm} color="primary">
            Cancelar
          </Button>
          <Button onClick={confirmDialog.onConfirm} color="error" variant="contained">
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};
