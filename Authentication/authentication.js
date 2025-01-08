const jwt = require('jsonwebtoken');
require('dotenv').config();

// Core function for token verification
function verifyToken(tokenReceived, callback) {
    jwt.verify(tokenReceived, process.env.ACCESS_TOKEN_SECRET, (error, user) => {
        if (error) {
            return callback(error, null);
        }
        callback(null, user); // Return user information if token is valid
    });
}

// HTTP Middleware for Express
function Authenticate(req, res, next) {
    const tokenHeader = req.headers['authorization'];
    const tokenReceived = tokenHeader && tokenHeader.split(' ')[1]; // Extract token

    if (tokenReceived == null) {
        return res.status(401).send({ message: 'Unauthorized' });
    }

    // Use the core function for token verification
    verifyToken(tokenReceived, (error, user) => {
        if (error) {
            return res.status(403).send({ message: 'Failed to authenticate' });
        }
        req.user = user; // Attach user data to the request object
        next();
    });
}

// Socket.IO Middleware for authentication
function socketAuthenticate(socket, next) {
    const tokenReceived = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1]; // Extract token

    if (tokenReceived == null) {
        return next(new Error('Unauthorized'));
    }

    // Use the core function for token verification
    verifyToken(tokenReceived, (error, user) => {
        if (error) {
            return next(new Error('Failed to authenticate'));
        }
        socket.user = user; // Attach user data to the socket object
        next(); // Proceed to the next event
    });
}

module.exports = {
    Authenticate,
    socketAuthenticate
};
