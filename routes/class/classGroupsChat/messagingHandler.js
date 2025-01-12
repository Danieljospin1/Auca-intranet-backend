const roomJoiningRouter = require('./groupChatAddition')
const connectionPromise = require('../../../database & models/databaseConnection')
const moment = require('moment');

module.exports = (io) => {
    io.on('connection', async (socket) => {

        const date = new Date()
        console.log(`a user ${socket.user.Id} is connected at ${date.toUTCString()}`);
        const userId = socket.user.Id
        const userRole = socket.user.role


        //finding the class groups the user belongs to.
        try {
            const [rooms] = await connectionPromise.query('SELECT CourseGroupId FROM roommembership WHERE MemberId=?', [userId]);
            rooms.forEach(({ CourseGroupId }) => {
                socket.join(CourseGroupId);
                socket.emit('joinRooms', `you ${userId} have joined room ${CourseGroupId}`)


            })
            //to search for time user was online
            const [utcUserLastSeen] = await connectionPromise.query(`select Timestamp from userstatus where UserId=?`, [userId])
            const userLastSeen = moment.utc(utcUserLastSeen[0].Timestamp).local().format("YYYY-MM-DD HH:mm:ss");
            console.log(userLastSeen)

            //fetching all messages from database
            const placeholders = rooms.map(() => '?').join(','); // Create placeholders like ?, ?, ?
            const query = `SELECT m.Id,m.SenderId,case when m.SenderType='staff' then st.Lname else s.Lname end as Lname,
            case when m.SenderType='staff' then st.ProfileUrl else s.ProfileUrl end as ProfileImage,
            m.SenderType,m.Text,m.CourseGroupId,m.Timestamp FROM messages m
            left join staff st on m.SenderId=st.Id 
            left join students s on m.SenderId=s.StudentId WHERE CourseGroupId IN (${placeholders}) AND m.Timestamp>'${userLastSeen}' ORDER BY Timestamp`;


            const [offlineGroupMessages] = await connectionPromise.query(query, rooms);
            socket.emit('messages', offlineGroupMessages);
            // Process and emit messages to the client


            //updating user status to be able to return messages sent when the user was offline
            const [checkUserStatus] = await connectionPromise.query(`select * from userstatus where UserId=?`, [userId])
            if (checkUserStatus.length == 0) {
                await connectionPromise.query(`insert into userstatus (UserId,UserType,Status) values (?,?,?)`, [userId, userRole, 'online']);
                console.log('user status created successfully...')
            }
            else {
                await connectionPromise.query(`update userstatus set Status=? where UserId=?`, ['online', userId])
                console.log('user status updated successfully...')
            }


        }


        catch {
            (err) => {
                console.log(err);
            }
        }
        socket.on('roomMessage', async ({ room, message }) => {
            try {
                await connectionPromise.query(
                    'INSERT INTO messages(SenderId, SenderType, Text, CourseGroupId) VALUES (?, ?, ?, ?)',
                    [userId, userRole, message, room]
                );
                const [incomingMessage]=await connectionPromise.query(`SELECT m.Id,m.SenderId,case when m.SenderType='staff' then st.Lname else s.Lname end as Lname,
            case when m.SenderType='staff' then st.ProfileUrl else s.ProfileUrl end as ProfileImage,
            m.SenderType,m.Text,m.CourseGroupId,m.Timestamp FROM messages m
            left join staff st on m.SenderId=st.Id 
            left join students s on m.SenderId=s.StudentId WHERE m.SenderId=? and m.CourseGroupId=? order by m.Timestamp desc limit 1`,[userId,room]);
            socket.to(room).emit('incomingMessage', incomingMessage);


            } catch (error) {
                console.log('database error:', error);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`a user ${socket.id} is disconnected`);
            const userId = socket.user.Id
            const userRole = socket.user.role
            await connectionPromise.query(`update userstatus set Status=? where UserId=?`, ['offline', userId])
            console.log('user status updated successfully...')

        })
    })
}