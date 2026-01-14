// messagingHandler.js
const roomJoiningRouter = require('./groupChatAddition');
const connectionPromise = require('../../../database & models/databaseConnection');
const moment = require('moment');
const { set: setSocketDir, remove: removeSocketDir } = require('../../../socketDirectory');

module.exports = async (io) => {
    io.on('connection', async (socket) => {
        // Top-level try/catch so unhandled errors inside connection handler don't crash the process
        try {
            // Ensure socket.user exists (authentication middleware should set this)
            if (!socket.user || !socket.user.Id) {
                console.warn('Unauthenticated socket connected; disconnecting.');
                try { socket.disconnect(true); } catch (e) { /* ignore */ }
                return;
            }

            const connectedAt = new Date();
            const userId = socket.user.Id;
            const userRole = socket.user.role;
            console.log(`a user ${userId} is connected at ${connectedAt.toUTCString()}`);

            // --- Remove any previous socket for this user (avoid duplicates) ---
            try {
                // io.of('/').sockets is a Map; iterate its values to get Socket instances
                for (const s of io.of('/').sockets.values()) {
                    if (s && s.user && s.user.Id === userId && s.id !== socket.id) {
                        console.log(`[socket] Detected existing socket (${s.id}) for user ${userId}. Disconnecting old socket.`);
                        try { s.disconnect(true); } catch (e) { console.warn('[socket] error disconnecting old socket', e); }
                    }
                }
            } catch (err) {
                console.warn('[socket] error checking existing sockets', err);
            }

            // Saving socket in directory
            try {
                setSocketDir(userId, socket);
            } catch (err) {
                console.warn('[socket] socketDirectory.set failed', err);
            }

            // Helper: safe query wrapper with limited retries and backoff
            const safeQuery = async (sql, params = [], opts = {}) => {
                const maxRetries = typeof opts.retries === 'number' ? opts.retries : 3;
                const baseDelay = typeof opts.baseDelay === 'number' ? opts.baseDelay : 300; // ms
                let attempt = 0;

                while (attempt < maxRetries) {
                    try {
                        const res = await connectionPromise.query(sql, params);
                        return res; // [rows, fields]
                    } catch (err) {
                        attempt++;
                        const msg = err && err.message ? err.message : String(err);
                        console.error(`[DB] query error (attempt ${attempt}/${maxRetries}):`, msg);

                        // If the error is connection refused, wait and retry a few times
                        if (attempt >= maxRetries) {
                            console.error('[DB] max retries reached, returning empty result');
                            return [[], null];
                        }

                        // exponential backoff
                        const wait = baseDelay * Math.pow(2, attempt - 1);
                        await new Promise(res => setTimeout(res, wait));
                    }
                }

                // Fallback: return empty result
                return [[], null];
            };

            // --- finding the rooms the user belongs to ---
            const [roomsRows] = await safeQuery(
                'SELECT ClassId FROM roommembership WHERE MemberId = ? AND IsActive = ?',
                [userId, true]
            );

            const rooms = Array.isArray(roomsRows) ? roomsRows : [];

            // Join the rooms (sequentially to avoid heavy parallel ops)
            for (const row of rooms) {
                const classId = row.ClassId;
                try {
                    // ensure classId is string when joining
                    await socket.join(String(classId));
                    try { socket.emit('joinRooms', `you ${userId} have joined room ${classId}`); } catch (e) {/* ignore */ }
                } catch (err) {
                    console.warn(`[socket] join room ${classId} failed for user ${userId}`, err);
                }
            }

            // --- fetch lastSeen (if any) ---
            const [lastSeenRows] = await safeQuery('SELECT Timestamp FROM userstatus WHERE UserId = ?', [userId]);
            const lastSeenTimestamp = (Array.isArray(lastSeenRows) && lastSeenRows[0] && lastSeenRows[0].Timestamp)
                ? lastSeenRows[0].Timestamp
                : null;

            // --- check for newly joined rooms since lastSeen ---
            const [roomJoinDatesRows] = await safeQuery(
                'SELECT JoiningDate FROM roommembership WHERE MemberId = ? AND IsActive = ?',
                [userId, true]
            );
            const roomJoinDates = Array.isArray(roomJoinDatesRows) ? roomJoinDatesRows : [];

            if (lastSeenTimestamp && roomJoinDates.length > 0) {
                for (const r of roomJoinDates) {
                    try {
                        if (new Date(lastSeenTimestamp) < new Date(r.JoiningDate)) {
                            const [classMetadata] = await safeQuery(`
                SELECT cl.Id as ClassId, c.Name as ClassName, c.Code as CourseCode, g.GroupName, cl.ClassAvatar, cl.ClassStatus, r.MemberRole
                FROM courses c
                JOIN coursegroups g on c.CourseId = g.Id
                JOIN classes cl on g.Id = cl.CourseGroupId
                JOIN roommembership r on cl.Id = r.ClassId
                WHERE r.MemberId = ? and r.IsActive = ? and r.JoiningDate = ?
              `, [userId, true, r.JoiningDate]);

                            if (Array.isArray(classMetadata) && classMetadata.length > 0) {
                                try { socket.emit('newClasses', classMetadata); } catch (e) {/* ignore */ }
                            }
                        }
                        //else send all classes a user belongs to...
                        else{
                            const [classMetadata] = await safeQuery(`
                                SELECT cl.Id as ClassId, c.Name as ClassName, c.Code as CourseCode, g.GroupName, cl.ClassAvatar, cl.ClassStatus, r.MemberRole
                                FROM courses c
                                JOIN coursegroups g on c.CourseId = g.Id
                                JOIN classes cl on g.Id = cl.CourseGroupId
                                JOIN roommembership r on cl.Id = r.ClassId
                                WHERE r.MemberId = ? and r.IsActive = ?
                              `, [userId, true]);
                            try { socket.emit('newClasses', classMetadata); } catch (e) {/* ignore */}
                        }
                    } catch (err) {
                        console.warn('[socket] error checking new class join for user', userId, err);
                    }
                }
            }

            // --- fetch offline messages only if we have rooms ---
            const roomsArray = rooms.map(item => item.ClassId);
            let offlineGroupMessages = [];
            if (roomsArray.length > 0) {
                const placeholders = roomsArray.map(() => '?').join(',');
                const query = `
          SELECT m.Id, m.SenderId,
            CASE WHEN m.SenderType='staff' THEN st.Lname ELSE s.Lname END as Lname,
            CASE WHEN m.SenderType='staff' THEN st.ProfileUrl ELSE s.ProfileUrl END as ProfileImage,
            m.SenderType, m.Text, m.ClassId, m.Timestamp
          FROM messages m
          LEFT JOIN staff st on m.SenderId = st.Id
          LEFT JOIN students s on m.SenderId = s.StudentId
          WHERE ClassId IN (${placeholders})
          ${lastSeenTimestamp ? `AND m.Timestamp > ?` : ''}
          ORDER BY m.Timestamp
        `;
                const params = [...roomsArray];
                if (lastSeenTimestamp) params.push(lastSeenTimestamp);

                const [rows] = await safeQuery(query, params);
                if (Array.isArray(rows)) offlineGroupMessages = rows;
            }

            // emit offline messages (if any)
            try {
                socket.emit('messages', offlineGroupMessages);
            } catch (err) {
                console.warn('[socket] emit messages failed', err);
            }

            // update or insert user status to online
            try {
                const [checkUserStatus] = await safeQuery('SELECT * FROM userstatus WHERE UserId = ?', [userId]);
                if (!Array.isArray(checkUserStatus) || checkUserStatus.length === 0) {
                    await safeQuery('INSERT INTO userstatus (UserId, UserType, Status, Timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [userId, userRole, 'online']);
                    console.log('user status created successfully...');
                } else {
                    await safeQuery('UPDATE userstatus SET Status = ?, Timestamp = CURRENT_TIMESTAMP WHERE UserId = ?', ['online', userId]);
                    console.log('user status updated successfully...');
                }
            } catch (err) {
                console.warn('[socket] userstatus insert/update error', err);
            }

            // join announcement rooms
            try {
                socket.join('all');
                if (userRole === 'staff') {
                    socket.join('staff');
                    console.log('user is staff, joining staff room');
                } else {
                    socket.join('students');
                    console.log('user is student, joining student room');
                }
            } catch (err) {
                console.warn('[socket] joining announcement rooms failed', err);
            }

            // --- message sending handler ---
            socket.on('roomMessage', async ({ room, message, messageTemporaryId }, acknowledgment) => {
                try {
                    console.log(message)
                    await safeQuery(
                        'INSERT INTO messages (SenderId, SenderType, Text, ClassId) VALUES (?, ?, ?, ?)',
                        [userId, userRole, message, room]
                    );

                    const [incomingMessageRows] = await safeQuery(`
            SELECT m.Id, m.SenderId,
              CASE WHEN m.SenderType='staff' THEN st.Lname ELSE s.Lname END as Lname,
              CASE WHEN m.SenderType='staff' THEN st.ProfileUrl ELSE s.ProfileUrl END as ProfileImage,
              m.SenderType, m.Text, m.ClassId, m.Timestamp
            FROM messages m
            LEFT JOIN staff st on m.SenderId = st.Id
            LEFT JOIN students s on m.SenderId = s.StudentId
            WHERE m.SenderId = ? AND m.ClassId = ?
            ORDER BY m.Timestamp DESC
            LIMIT 1
          `, [userId, room]);

                    if (Array.isArray(incomingMessageRows) && incomingMessageRows.length > 0) {
                        console.log("this is working", incomingMessageRows, messageTemporaryId)
                        socket.to(room).emit('messages', incomingMessageRows);
                        acknowledgment(incomingMessageRows, messageTemporaryId);
                        

                    }
                } catch (error) {
                    console.log('database error while handling roomMessage:', error);
                    try { socket.emit('message_error', { message: 'Failed to send message' }); } catch (e) {/* ignore */ }
                }
            });
            socket.on('pinnedMessage', async ({ ClassId, MessageId }) => {
                if (!ClassId || !MessageId) {
                    console.log("no enough data (classId, message id)")
                }
                try {
                    const checkPinnedMessage = await safeQuery('select * from messages where ClassId=? and Id=? and IsPinned=?', [ClassId, MessageId, 1]);
                    if (checkPinnedMessage.length > 0) {
                        await safeQuery('update messages set IsPinned=? where Id=? and ClassId=?', [0, MessageId, ClassId])
                    }
                    await safeQuery('update messages set IsPinned=? where Id=? and ClassId=?', [1, MessageId, ClassId]);
                    console.log(typeof (ClassId))
                    socket.to(String(ClassId)).emit("messagePin", { ClassId, MessageId })
                    console.log("updated message pinning successfully!!!")
                }
                catch (err) {
                    console.log(err)
                }
            })

            // --- disconnect handler ---
            socket.on('disconnect', async (reason) => {
                // Use captured userId variable (avoid socket.user which might be altered)
                try {
                    console.log(`a user ${socket.id} is disconnected. reason: ${reason}`);
                    // remove from socket directory
                    try { removeSocketDir(userId); } catch (e) { console.warn('[socket] socketDirectory.remove failed', e); }

                    // update status to offline
                    await safeQuery('UPDATE userstatus SET Status = ?, Timestamp = CURRENT_TIMESTAMP WHERE UserId = ?', ['offline', userId]);
                    console.log('user status updated to offline successfully...');
                } catch (error) {
                    console.error('error while disconnecting user:', error);
                }
            });

        } catch (connErr) {
            // catch any unexpected error within connection handler
            console.error('[socket] unexpected error in connection handler:', connErr);
            try { socket.disconnect(true); } catch (e) { /* ignore */ }
        }
    });
};
