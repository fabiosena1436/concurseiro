import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

export const useUnreadMessages = () => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setAdminUnreadCount(0);
      return;
    }

    // Listener for regular user
    const userQuery = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
      where('isReadByUser', '==', false),
      where('reply', '!=', null)
    );

    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    let unsubscribeAdmin = () => {};
    // Listener for admin (could be optimized to only run if user is admin)
    if (user.email === 'fabiosena1436@gmail.com' || (user as any).isAdmin) {
      const adminQuery = query(
        collection(db, 'messages'),
        where('isReadByAdmin', '==', false)
      );
      
      unsubscribeAdmin = onSnapshot(adminQuery, (snapshot) => {
        setAdminUnreadCount(snapshot.docs.length);
      });
    }

    return () => {
      unsubscribeUser();
      unsubscribeAdmin();
    };
  }, [user]);

  return { unreadCount, adminUnreadCount };
};
