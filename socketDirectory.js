// sockets/socketDirectory.js which will be used to manage user sockets accross components
const userSocketMap = new Map();   // userId  ►  socket instance

function set(userId, socket)  { userSocketMap.set(userId, socket); console.log(`userId: ${userId} socket:${socket}`) }
function get(userId)          { return userSocketMap.get(userId); }
function remove(userId)       { userSocketMap.delete(userId); }

module.exports = { set, get, remove };
