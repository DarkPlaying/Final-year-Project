import { useEffect } from 'react';
import { database } from '@/lib/firebase';
import { ref, onDisconnect, set, serverTimestamp, onValue, push, update } from 'firebase/database';
import { getCurrentUser } from '@/lib/auth';

export const usePresence = () => {
    const user = getCurrentUser();

    useEffect(() => {
        if (!user) return;

        // References
        const userStatusRef = ref(database, '/status/' + user.id);
        const connectionsRef = ref(database, `/status/${user.id}/connections`);
        const lastChangedRef = ref(database, `/status/${user.id}/last_changed`);
        const connectedRef = ref(database, '.info/connected');

        const unsubscribe = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // We're connected!

                // 1. Create a reference to this specific device's connection
                const con = push(connectionsRef);

                // 2. When this device disconnects, remove ONLY this connection
                onDisconnect(con).remove();

                // 3. When this device disconnects, update the last_changed timestamp
                // (This will happen for every tab close, but that's fine - the latest one wins)
                onDisconnect(lastChangedRef).set(serverTimestamp());

                // 4. Set this device as connected
                set(con, {
                    connectedAt: serverTimestamp(),
                    device: navigator.userAgent
                });

                // 5. Update user metadata at the root level so we can identify them
                // We use 'update' so we don't overwrite the 'connections' node
                update(userStatusRef, {
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    state: 'online' // Kept for backward compatibility/easy checking, but 'connections' is the source of truth
                });

                // 6. We do NOT set 'state' to offline on disconnect here.
                // The viewer (Teacher Dashboard) will determine offline status 
                // by checking if 'connections' is empty.
            }
        });

        return () => {
            unsubscribe();
        };
    }, [user?.id]);
};
