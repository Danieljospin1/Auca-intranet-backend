const roomJoiningRouter = require('./groupChatAddition')
const connectionPromise = require('../../../database & models/databaseConnection')
const moment = require('moment');
const {set,remove} = require( '../../../socketDirectory');


module.exports = async(io) => {
    io.on('connection', async (socket) => {

        const date = new Date()
        console.log(`a user ${socket.user.Id} is connected at ${date.toUTCString()}`);
        const userId = socket.user.Id
        const userRole = socket.user.role

        //saving user socket in socket directory
        set(userId,socket);
        


        //finding the class groups the user belongs to.
        try {
            const [rooms] = await connectionPromise.query('SELECT ClassId FROM roommembership WHERE MemberId=? and IsActive=?', [userId,true]);
            rooms.forEach(({ ClassId }) => {
                socket.join(ClassId);
                socket.emit('joinRooms', `you ${userId} have joined room ${ClassId}`)
                
                


            })
            //checking for new classes user joined while offline
            const [lastSeen]=await connectionPromise.query(`select Timestamp from userstatus where UserId=?`,[userId]);
            const [roomJoinDates]=await connectionPromise.query(`select JoiningDate from roommembership where MemberId=?`,[userId]);
            roomJoinDates.forEach(async(roomJoinDate)=>{
                console.log(lastSeen[0].Timestamp)
                if(lastSeen[0].Timestamp < roomJoinDate.JoiningDate){
                    const [classMetadata] = await connectionPromise.query(`
                                                        select r.Id as roomId,c.CourseId,c.Name,c.Code,g.GroupName,cl.ClassAvatar,Cl.ClassStatus,r.MemberRole from 
                                                        courses c join courseGroups g on c.CourseId=g.Id 
                                                        join classes cl on g.Id=cl.CourseGroupId 
                                                        join roommembership r on cl.Id=r.ClassId where r.MemberId=?`, [userId]);
                    socket.emit('newClasses',classMetadata);
                }
                
            })

            //updating user status to be able to return messages sent when the user was offline
            const [checkUserStatus] = await connectionPromise.query(`select * from userstatus where UserId=?`, [userId])
            console.log(checkUserStatus)
            if (checkUserStatus.length == 0) {
                await connectionPromise.query(`insert into userstatus (UserId,UserType,Status) values (?,?,?)`, [userId, userRole, 'online']);
                console.log('user status created successfully...')
                
            }
            else {
                null
            }
            //to search for time user was online
            const [utcUserLastSeen] = await connectionPromise.query(`select Timestamp from userstatus where UserId=?`, [userId])
            const userLastSeen = moment.utc(utcUserLastSeen[0].Timestamp).local().format("YYYY-MM-DD HH:mm:ss");


            //fetching all messages from database
            const placeholders = rooms.map(() => '?').join(','); // Create placeholders like ?, ?, ?
            const query = `SELECT m.Id,m.SenderId,case when m.SenderType='staff' then st.Lname else s.Lname end as Lname,
            case when m.SenderType='staff' then st.ProfileUrl else s.ProfileUrl end as ProfileImage,
            m.SenderType,m.Text,m.ClassId,m.Timestamp FROM messages m
            left join staff st on m.SenderId=st.Id 
            left join students s on m.SenderId=s.StudentId WHERE ClassId IN (${placeholders}) AND m.Timestamp>'${userLastSeen}' ORDER BY Timestamp`;

            const roomsArray = rooms.map(item => item.ClassId); // this line will convert from [ { CourseGroupId: 1 }, { CourseGroupId: 2 } ] to [1,2] to access all messages from all rooms
            

            const [offlineGroupMessages] = await connectionPromise.query(query, roomsArray);
            socket.emit('messages', offlineGroupMessages);
            
            // Process and emit messages to the client

            await connectionPromise.query(`update userstatus set Status=? where UserId=?`, ['online', userId])
                console.log('user status updated successfully...')
            


        }
        


        catch {
            (err) => {
                console.log(err);
            }
        }
        
        socket.on('roomMessage', async ({ room, message }) => {
            try {
                await connectionPromise.query(
                    'INSERT INTO messages(SenderId, SenderType, Text, ClassId) VALUES (?, ?, ?, ?)',
                    [userId, userRole, message, room]
                );
                const [incomingMessage] = await connectionPromise.query(`SELECT m.Id,m.SenderId,case when m.SenderType='staff' then st.Lname else s.Lname end as Lname,
            case when m.SenderType='staff' then st.ProfileUrl else s.ProfileUrl end as ProfileImage,
            m.SenderType,m.Text,m.ClassId,m.Timestamp FROM messages m
            left join staff st on m.SenderId=st.Id 
            left join students s on m.SenderId=s.StudentId WHERE m.SenderId=? and m.ClassId=? order by m.Timestamp desc limit 1`, [userId, room]);
                socket.to(room).emit('incomingMessage', incomingMessage);


            } catch (error) {
                console.log('database error:', error);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`a user ${socket.id} is disconnected`);
            const userId = socket.user.Id
            const userRole = socket.user.role
            remove(userId);
            await connectionPromise.query(`update userstatus set Status=? where UserId=?`, ['offline', userId])
            console.log('user status updated successfully...')

        })
    })
}
