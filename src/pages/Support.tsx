import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, TextField, Button, Paper, CircularProgress, Alert, Divider } from '@mui/material';
import { useAuth } from '../hooks/useAuth';
import { sendSupportMessage, getUserMessages, markMessageAsReadByUser } from '../services/firestoreService';
import type { SupportMessage } from '../types/message';

export const Support: React.FC = () => {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    if (!user) return;
    try {
      const data = await getUserMessages(user.uid);
      setMessages(data);
      
      // Marca como lida
      data.forEach(msg => {
        if (!msg.isReadByUser && msg.reply && msg.id) {
          void markMessageAsReadByUser(msg.id);
        }
      });
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar mensagens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMessages();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      setSending(true);
      await sendSupportMessage({
        userId: user.uid,
        userEmail: user.email || '',
        userName: userData?.name || 'Usuário',
        text: newMessage,
      });
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      console.error(err);
      setError("Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Suporte & Mensagens
      </Typography>
      <Typography variant="body1" paragraph>
        Envie uma mensagem para o administrador para solicitar desbloqueios ou tirar dúvidas.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="h5" gutterBottom>
        Histórico de Conversa
      </Typography>
      <Paper sx={{ p: 2, mb: 4, display: 'flex', flexDirection: 'column', bgcolor: '#f8f9fa' }}>
        <Box sx={{ height: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
          {messages.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>Nenhuma mensagem encontrada. Envie sua primeira dúvida abaixo.</Typography>
          ) : (
            messages.slice().reverse().map((msg) => (
              <React.Fragment key={msg.id}>
                {/* User Message */}
                <Box sx={{ alignSelf: 'flex-end', bgcolor: '#dcf8c6', p: 1.5, borderRadius: 2, maxWidth: '80%', ml: 'auto', boxShadow: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
                    Você - {msg.createdAt.toLocaleString()}
                  </Typography>
                  <Typography variant="body1">
                    {msg.text}
                  </Typography>
                </Box>

                {/* Admin Reply */}
                {msg.reply && (
                  <Box sx={{ alignSelf: 'flex-start', bgcolor: '#ffffff', p: 1.5, borderRadius: 2, maxWidth: '80%', mr: 'auto', boxShadow: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
                      Admin - {msg.repliedAt?.toLocaleString() || ''}
                    </Typography>
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {msg.reply}
                    </Typography>
                  </Box>
                )}
              </React.Fragment>
            ))
          )}
        </Box>
        
        {/* Input box inside chat */}
        <Box component="form" onSubmit={handleSend} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" disabled={sending || !newMessage.trim()}>
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};
