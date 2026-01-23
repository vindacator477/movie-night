import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function useSocket(sessionId: string | null, onUpdate: () => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('join_session', sessionId);
    });

    socket.on('participant_joined', () => {
      onUpdate();
    });

    socket.on('date_vote_updated', () => {
      onUpdate();
    });

    socket.on('movie_vote_updated', () => {
      onUpdate();
    });

    socket.on('session_advanced', () => {
      onUpdate();
    });

    socket.on('location_updated', () => {
      onUpdate();
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket.emit('leave_session', sessionId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, onUpdate]);

  return socketRef.current;
}
