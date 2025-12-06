import { useEffect, useRef } from 'react';
import { database } from '@/lib/firebase';
import { ref, onDisconnect, set, serverTimestamp, onValue, push, update, remove } from 'firebase/database';
import { getCurrentUser } from '@/lib/auth';

export const usePresence = () => {
    const user = getCurrentUser();
    const connectionRef = useRef<any>(null);
    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

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
                if (connectionRef.current) {
                    remove(connectionRef.current).catch(() => { });
                }

                const con = push(connectionsRef);
                connectionRef.current = con;

                // 2. When this device disconnects, remove ONLY this connection
                onDisconnect(con).remove();

                // 3. When this device disconnects, update the last_changed timestamp
                onDisconnect(lastChangedRef).set(serverTimestamp());

                // 4. Set this device as connected with initial timestamps
                set(con, {
                    connectedAt: serverTimestamp(),
                    lastActive: serverTimestamp(),
                    device: navigator.userAgent
                });

                // 5. Update user metadata
                update(userStatusRef, {
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    state: 'online'
                });

                // 6. Start Heartbeat
                if (heartbeatRef.current) clearInterval(heartbeatRef.current);
                heartbeatRef.current = setInterval(() => {
                    if (connectionRef.current) {
                        update(connectionRef.current, {
                            lastActive: serverTimestamp()
                        });
                    }
                }, 60000); // Update every minute
            }
        });

        return () => {
            unsubscribe();
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
            if (connectionRef.current) {
                remove(connectionRef.current).catch((err) => console.error("Error removing connection on unmount:", err));
                connectionRef.current = null;
            }
        };
    }, [user?.id]);
};
