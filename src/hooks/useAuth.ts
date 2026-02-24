import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../types/user';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            if (user) {
                void (async () => {
                    try {
                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            setUserData(userDocSnap.data() as UserProfile);
                        }
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                        setUserData(null);
                    } finally {
                        setLoading(false);
                    }
                })();
            } else {
                setUserData(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return { user, userData, loading };
};
