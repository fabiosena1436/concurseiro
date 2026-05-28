import { Timestamp } from "firebase/firestore";

export interface SupportMessage {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  text: string;
  sender?: 'user' | 'admin'; // Optional for legacy compatibility
  reply?: string;
  createdAt: Date;
  repliedAt?: Date;
  isReadByAdmin: boolean;
  isReadByUser: boolean;
}
