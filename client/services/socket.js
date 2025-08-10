import { io } from 'socket.io-client';

const socket = io('http://192.168.100.41:5000'); 
export default socket;
