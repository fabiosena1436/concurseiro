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

      <Box component="form" onSubmit={handleSend} sx={{ mb: 4 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Sua mensagem"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          required
          sx={{ mb: 2 }}
        />
        <Button type="submit" variant="contained" disabled={sending || !newMessage.trim()}>
          {sending ? "Enviando..." : "Enviar Mensagem"}
        </Button>
      </Box>

      <Typography variant="h5" gutterBottom>
        Histórico
      </Typography>
      {messages.length === 0 ? (
        <Typography color="text.secondary">Nenhuma mensagem encontrada.</Typography>
      ) : (
        messages.map((msg) => (
          <Paper key={msg.id} sx={{ p: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Enviado em: {msg.createdAt.toLocaleString()}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              Você:
            </Typography>
            <Typography variant="body1" paragraph>
              {msg.text}
            </Typography>

            {msg.reply && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Respondido pelo Admin em: {msg.repliedAt?.toLocaleString()}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Admin:
                </Typography>
                <Typography variant="body1">
                  {msg.reply}
                </Typography>
              </Box>
            )}
            {!msg.reply && (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                Aguardando resposta...
              </Typography>
            )}
          </Paper>
        ))
      )}
    </Container>
  );
};
