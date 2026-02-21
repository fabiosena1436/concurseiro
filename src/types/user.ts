export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  socialName: string | null;
  phone: string | null;
  // Adicione outros campos de perfil que você queira salvar, como histórico de simulados, etc.
}
