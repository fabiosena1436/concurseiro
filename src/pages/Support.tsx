import React, { useCallback, useState, useEffect } from 'react';
import { Container, Typography, Box, TextField, Button, Paper, CircularProgress, Alert, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../hooks/useAuth';
import { sendSupportMessage, getUserMessages, markMessageAsReadByUser, deleteSupportMessage } from '../services/firestoreService';
import type { SupportMessage } from '../types/message';

interface ChatBubble {
  id: string;
  text: string;
  isSenderUser: boolean;
  createdAt: Date;
  isLegacyReply?: boolean;
}

export const Support: React.FC = () => {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getUserMessages(user.uid);
      setMessages(data);
      
      // Marca como lida
      data.forEach(msg => {
        if (!msg.isReadByUser && msg.id && msg.sender === 'admin') {
          void markMessageAsReadByUser(msg.id);
        } else if (!msg.isReadByUser && msg.id && msg.reply) {
          void markMessageAsReadByUser(msg.id);
        }
      });
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar mensagens.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const handleDeleteSingleMessage = async (messageId: string, isLegacyReply?: boolean) => {
    try {
      if (isLegacyReply) {
        await deleteSupportMessage(messageId.replace('-reply', ''));
      } else {
        await deleteSupportMessage(messageId);
      }
      await fetchMessages();
    } catch (err) {
      console.error(err);
      setError("Erro ao excluir mensagem.");
    }
  };

  if (loading) {
    return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Container>;
  }

  // Flatten messages to a single thread
  const chatBubbles: ChatBubble[] = [];
  
  messages.forEach(msg => {
    chatBubbles.push({
      id: msg.id || Math.random().toString(),
      text: msg.text,
      isSenderUser: msg.sender !== 'admin',
      createdAt: msg.createdAt,
    });

    if (msg.reply && msg.sender !== 'admin') {
      chatBubbles.push({
        id: (msg.id || Math.random().toString()) + '-reply',
        text: msg.reply,
        isSenderUser: false,
        createdAt: msg.repliedAt || msg.createdAt,
        isLegacyReply: true,
      });
    }
  });

  chatBubbles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Suporte & Mensagens
      </Typography>
      <Typography variant="body1" paragraph>
        Envie uma mensagem para o administrador para solicitar desbloqueios ou tirar dúvidas.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ mb: 4, bgcolor: '#f8f9fa', overflow: 'hidden' }}>
        <Box 
          sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', bgcolor: isExpanded ? '#e0e0e0' : 'transparent' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Box>
            <Typography variant="h6">
              Sua Conversa
            </Typography>
            {chatBubbles.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                Última mensagem: {chatBubbles[chatBubbles.length - 1].createdAt.toLocaleDateString()} às {chatBubbles[chatBubbles.length - 1].createdAt.toLocaleTimeString()}
              </Typography>
            )}
          </Box>
          <Typography variant="button" color="primary">
            {isExpanded ? "Minimizar" : "Abrir"}
          </Typography>
        </Box>

        {isExpanded && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ height: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, mb: 2, bgcolor: '#ffffff', p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {chatBubbles.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ mt: 2 }}>Nenhuma mensagem encontrada. Envie sua primeira dúvida abaixo.</Typography>
              ) : (
                chatBubbles.map((bubble) => (
                  <Box 
                    key={bubble.id} 
                    sx={{ 
                      alignSelf: bubble.isSenderUser ? 'flex-end' : 'flex-start', 
                      bgcolor: bubble.isSenderUser ? '#dcf8c6' : '#ffffff', 
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
                        {bubble.isSenderUser ? 'Você' : 'Admin'} - {bubble.createdAt.toLocaleString()}
                      </Typography>
                      {/* Only allow deleting own messages, or all messages? The user said "poder excluir as msgs". Let's allow deleting any message in their own thread to keep it clean */}
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
                ))
              )}
            </Box>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button variant="contained" onClick={() => void handleSend()} disabled={sending || !newMessage.trim()}>
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Container>
  );
};
