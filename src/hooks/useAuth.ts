import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../types/user';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);

            if (user) {
                void (async () => {
                    try {
                        const tokenResult = await user.getIdTokenResult();
                        setIsAdmin(Boolean(tokenResult.claims.admin));

                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            const data = userDocSnap.data() as UserProfile;
                            setUserData(data);
                        } else {
                            setUserData(null);
                        }
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                        setUserData(null);
                        setIsAdmin(false);
                    } finally {
                        setLoading(false);
                    }
                })();
            } else {
                setUserData(null);
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return { user, userData, isAdmin, loading };
};
