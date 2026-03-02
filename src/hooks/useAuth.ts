import { useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User, IdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../types/user';

interface AuthState {
  user: User | null;
  userData: UserProfile | null;
  claims: IdTokenResult['claims'] | null;
  loading: boolean;
  isAdmin: boolean;
}

export const useAuth = (): AuthState => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [claims, setClaims] = useState<IdTokenResult['claims'] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            if (user) {
                void (async () => {
                    setLoading(true);
                    try {
                        // Fetch user profile from Firestore
                        const userDocRef = doc(db, 'users', user.uid);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            setUserData(userDocSnap.data() as UserProfile);
                        }

                        // Fetch custom claims from the ID token
                        const idTokenResult = await user.getIdTokenResult();
                        setClaims(idTokenResult.claims);

                    } catch (error) {
                        console.error("Error fetching user data or claims:", error);
                        setUserData(null);
                        setClaims(null);
                    } finally {
                        setLoading(false);
                    }
                })();
            } else {
                setUserData(null);
                setClaims(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return { user, userData, claims, loading, isAdmin: claims?.admin === true };
};
