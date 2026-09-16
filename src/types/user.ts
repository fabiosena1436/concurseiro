export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  socialName: string | null;
  phone: string | null;
  generationCount?: number;
  isUnlocked?: boolean;
}
