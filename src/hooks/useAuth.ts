import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../types/user';

// This email only decides whether to try bootstrap. The Function checks its own
// server-side allowlist and is the authority that grants the custom claim.
const bootstrapEmail = 'fabiosena1436@gmail.com';
let pendingBootstrap: Promise<void> | null = null;

const refreshAdminAccess = async (user: User): Promise<boolean> => {
    const current = await user.getIdTokenResult();
    if (current.claims.admin === true) return true;
    if (user.email?.toLowerCase() !== bootstrapEmail) return false;

    pendingBootstrap ??= (async () => {
        const token = await user.getIdToken();
        const response = await fetch('https://us-central1-simulado-concurso-ia.cloudfunctions.net/grantAdminAccess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ data: { email: user.email } }),
        });
        if (!response.ok) throw new Error('Não foi possível ativar o acesso administrativo.');
        await user.getIdToken(true);
    })().finally(() => { pendingBootstrap = null; });
    try {
        await pendingBootstrap;
        return (await user.getIdTokenResult()).claims.admin === true;
    } catch (error) {
        console.error('Falha ao ativar acesso administrativo:', error);
        return false;
    }
};

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
                        setIsAdmin(await refreshAdminAccess(user));

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
