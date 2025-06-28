const connectionPromise = require('../../../database & models/databaseConnection')
const express = require('express')
const router = express.Router()
const { Authenticate } = require('../../../Authentication/authentication')
const { get } = require('../../../socketDirectory');



//post route that takes student ids and their registered cources from registration system and adds them to their respective chat groups
router.post('/:classId/:memberId/', async (req, res) => {
    const classId = req.params.classId
    const memberId = req.params.memberId;
    const io = req.app.get('io');//returning io instance setted in main file(app.js)
    const userSocket = get(Number(memberId));


    if (classId && memberId) {
        const [studentClassMembershipCheck] = await connectionPromise.query('select * from roommembership where ClassId=? and MemberId=? and IsActive=?', [classId, memberId,true]);
        if (studentClassMembershipCheck.length == 0) {
            await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, memberId, 'student']);
            await connectionPromise.query(`insert into messages (Text,ClassId,MessageType) values(?,?,?)`, [`student with Id ${memberId} joined this class `, classId, 'system']);
            io.to(Number(classId)).emit('classNewJoin', `student with Id ${memberId} joined class`)//here we used Number in order to match with the datatype of class ids
            if (userSocket) { //if the user is online...
                userSocket.join(Number(classId));
                userSocket.emit('classNewJoin', `you have joined ${classId} class`);
                //querying class meta data a user joined....

                const [classMetadata] = await connectionPromise.query(`
                                    select r.Id as roomId,c.CourseId,c.Name,c.Code,g.GroupName,cl.ClassAvatar,Cl.ClassStatus,r.MemberRole from 
                                    courses c join courseGroups g on c.CourseId=g.Id 
                                    join classes cl on g.Id=cl.CourseGroupId 
                                    join roommembership r on cl.Id=r.ClassId where r.MemberId=? AND c.CourseId=? and r.IsActive=?`, [memberId,classId,true]);
                userSocket.emit('newClasses', classMetadata)
                

            }
            res.json({ "message": "the student have joined room successfully..." })
        }
        else {
            return res.status(403).json({ 'message': 'you are arleady in the class...' })
        }


        const [lecturerRoomMembershipCheck] = await connectionPromise.query(`select * from roommembership where ClassId=? and MemberRole='lecturer'`, [classId])
        if (lecturerRoomMembershipCheck.length == 0) {
            const [roomLecturer] = await connectionPromise.query(`select LecturerId from lecturercourses where ClassId=?`, [classId])
            if (roomLecturer.length == 0) {
                return console.log({ "message": "there is no lecturer for this course." })
                
            }
            else {
                const LecturerId = roomLecturer.map(id => id.LecturerId)
                await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, LecturerId, 'lecturer'])
                console.log({ "message": "class lecturer has been added to the group" })
                await connectionPromise.query(`insert into messages (Text,ClassId,MessageType) values(?,?,?)`, [`Lecturer joined this class `, classId, 'system']);
                return io.to(Number(classId)).emit('classNewJoin', 'lecturer joined class')
                
            }
        }
        else {
            return console.log('lecturer is already in the group...')
        }

    }
    else {
        res.json({ "errror": "enter required data" })
    }
})
// route to leave the class group for both students and lecturers
router.delete('/', Authenticate, async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.Id;
    const userRole = req.user.role;
    const io = req.app.get('io');//returning io instance setted in main file(app.js)
    const userSocket = get(Number(memberId));

    if (!classId || !memberId) {
        return res.status(400).json({ error: "Enter required data" });
    }

    try {
        await connectionPromise.query(
            `update roommembership set IsActive=?,LeftAt=NOW() WHERE ClassId = ? AND MemberId = ?`,
            [false,classId, memberId]
        );
        
        if (userRole == 'student') {
            io.to(classId).emit('classLefting', `student with Id ${memberId} has left the class group chat`)
        }
        else {
            io.to(classId).emit('classLefting', 'class lecturer has left the class group chat');
        }
        userSocket?userSocket.emit("ClassLeave",{"ClassId":classId,"IsActive":false}):null 
        res.json({ message: "You have been removed from the room..." });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the member" });
    }
});
module.exports = router;