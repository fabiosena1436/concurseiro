import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from './useAuth';

export const useUnreadMessages = () => {
  const { user, userData } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userQuery = query(
      collection(db, 'messages'),
      where('userId', '==', user.uid),
    );

    const unsubscribeUser = onSnapshot(userQuery, (snapshot) => {
      const count = snapshot.docs.filter((message) => {
        const data = message.data();
        return data.isReadByUser === false && Boolean(data.reply);
      }).length;
      setUnreadCount(count);
    });

    let unsubscribeAdmin = () => {};
    if (user.email === 'fabiosena1436@gmail.com' || userData?.isAdmin) {
      const adminQuery = query(
        collection(db, 'messages'),
        where('isReadByAdmin', '==', false),
      );

      unsubscribeAdmin = onSnapshot(adminQuery, (snapshot) => {
        setAdminUnreadCount(snapshot.docs.length);
      });
    }

    return () => {
      unsubscribeUser();
      unsubscribeAdmin();
    };
  }, [user, userData]);

  return {
    unreadCount: user ? unreadCount : 0,
    adminUnreadCount: user ? adminUnreadCount : 0,
  };
};
