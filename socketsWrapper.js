const roomJoiningRouter = require('./routes/class/classGroupsChat/groupChatAddition')
const connectionPromise = require('./database & models/databaseConnection')

module.exports = (io) => {
    io.on('connection', async (socket) => {


        console.log(`a user ${socket.user.Id} is connected`);
        const userId = socket.user.Id
        const userRole = socket.user.role

        //finding the class groups the user belongs to.
        try {
            const [rooms] = await connectionPromise.query('SELECT CourseGroupId FROM roommembership WHERE MemberId=?', [userId]);
            rooms.forEach(({ CourseGroupId }) => {
                socket.join(CourseGroupId);
                socket.emit('joinRooms', `you ${userId} have joined room ${CourseGroupId}`)


            })
            //fetching all messages from database
            const placeholders = rooms.map(() => '?').join(','); // Create placeholders like ?, ?, ?
            const query = `SELECT m.Id, case when m.SenderType='staff' then st.Lname else s.Lname end as Lname,
            case when m.SenderType='staff' then st.ProfileUrl else s.ProfileUrl end as ProfileImage,
            m.SenderType,m.Text,m.CourseGroupId,m.Timestamp FROM messages m
            left join staff st on m.SenderId=st.Id 
            left join students s on m.SenderId=s.StudentId WHERE CourseGroupId IN (${placeholders}) ORDER BY Timestamp`;


            const [offlineGroupMessages] = await connectionPromise.query(query, rooms);
            socket.emit('messages', offlineGroupMessages);
            // Process and emit messages to the client


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
                if(userRole=='staff'){
                    const [staffSenderDetails]=await connectionPromise.query(`select Id,Fname,Lname,ProfileUrl from staff where Id=?`,[userId]);
                    // Emit the message after successful storage
                    socket.to(room).emit('incomingMessage', {staffSenderDetails,message});
                }
                else{
                    const [studentSenderDetails]=await connectionPromise.query(`select StudentId,Fname,Lname,ProfileUrl from students where StudentId=?`,[userId]);
                    studentSenderDetails.push({"message":message})
                    // Emit the message after successful storage
                    socket.to(room).emit('incomingMessage', {studentSenderDetails});
                }

                console.log('message sent');
                console.log(message, room);

                
            } catch (error) {
                console.log('database error:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`a user ${socket.id} is disconnected`);
        })
    })
}