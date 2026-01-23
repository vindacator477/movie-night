import { Server, Socket } from 'socket.io';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    // Join a session room
    socket.on('join_session', (sessionId: string) => {
      socket.join(sessionId);
      console.log(`Socket ${socket.id} joined session ${sessionId}`);
    });

    // Leave a session room
    socket.on('leave_session', (sessionId: string) => {
      socket.leave(sessionId);
      console.log(`Socket ${socket.id} left session ${sessionId}`);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
