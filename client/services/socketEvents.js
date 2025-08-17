// services/socketEvents.js
import { getSocket } from './socket';

// Helper function to get socket instance
const getSocketInstance = () => {
  const socket = getSocket();
  if (!socket) {
    console.warn('⚠️ Socket not initialized. Call initializeSocket() first.');
    return null;
  }
  return socket;
};

// Initialize socket event listeners when socket is available
let socket = null;

const initializeSocketListeners = () => {
  socket = getSocketInstance();
  if (!socket) return;

  socket.on('connect', () => {
    // Silent connection - no console log
  });

  socket.on('joinedGroup', (data) => {
    // Silent join - no console log
  });

  socket.on('listUpdate', (data) => {
    // Silent update - no console log
  });
};

// Initialize listeners when module loads
setTimeout(initializeSocketListeners, 100);

/**
 * Listen for group changes (e.g. members added/removed, group deleted)
 * @param {Function} callback - function to run when groupUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerGroupUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('groupUpdate', callback);
  return () => socket.off('groupUpdate', callback);
}

/**
 * Listen for shopping list changes (e.g. item added/removed/changed)
 * @param {Function} callback - function to run when listUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerListUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('listUpdate', (data) => {
    callback(data);
  });
  return () => socket.off('listUpdate', callback);
}

/**
 * Listen for suggestion updates (favorites, purchases, etc.)
 * @param {Function} callback - function to run when suggestionUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerSuggestionUpdates(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('suggestionUpdate', (data) => {
    callback(data);
  });
  return () => socket.off('suggestionUpdate', callback);
}

export function registerGroupNotifications(callback) {
  const socket = getSocketInstance();
  if (!socket) return () => {};
  
  socket.on('groupCreated', (data) => {
    callback(data);
  });
  
  socket.on('memberAdded', (data) => {
    callback(data);
  });
  
  return () => {
    socket.off('groupCreated', callback);
    socket.off('memberAdded', callback);
  };
}

/**
 * Emit that the user is joining a socket room (group or list)
 * @param {string} roomId - groupId or listId
 */
export function joinRoom(roomId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('joinGroup', roomId);
}

export function joinListRoom(listId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('joinList', listId);
}

export function emitListUpdate(listId) {
  const socket = getSocketInstance();
  if (!socket) return;
  
  socket.emit('listUpdate', { listId });
}
