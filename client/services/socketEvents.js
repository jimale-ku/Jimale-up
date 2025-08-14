// services/socketEvents.js
import socket from './socket';

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('joinedGroup', (data) => {
  console.log('👥 Joined group room:', data);
});

socket.on('listUpdate', (data) => {
  console.log('📢 Received listUpdate:', data);
});

/**
 * Listen for group changes (e.g. members added/removed, group deleted)
 * @param {Function} callback - function to run when groupUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerGroupUpdates(callback) {
  socket.on('groupUpdate', callback);
  return () => socket.off('groupUpdate', callback);
}

/**
 * Listen for shopping list changes (e.g. item added/removed/changed)
 * @param {Function} callback - function to run when listUpdate is received
 * @returns {Function} unsubscribe function
 */
export function registerListUpdates(callback) {
  socket.on('listUpdate', (data) => {
    console.log('📢 List update received in registerListUpdates:', data);
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
  socket.on('suggestionUpdate', (data) => {
    console.log('📊 Suggestion update received:', data);
    callback(data);
  });
  return () => socket.off('suggestionUpdate', callback);
}

/**
 * Emit that the user is joining a socket room (group or list)
 * @param {string} roomId - groupId or listId
 */
export function joinRoom(roomId) {
  socket.emit('joinGroup', roomId);
}

export function joinListRoom(listId) {
  socket.emit('joinList', listId);
}

export function emitListUpdate(listId) {
  socket.emit('listUpdate', { listId });
}
