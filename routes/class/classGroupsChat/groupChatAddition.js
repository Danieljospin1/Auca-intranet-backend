const connectionPromise = require('../../../database & models/databaseConnection')
const express = require('express')
const router = express.Router()
const {Authenticate} = require('../../../Authentication/authentication')



//post route that takes student ids and their registered cources from registration system and adds them to their respective chat groups
router.post('/:classId/:memberId/', async (req, res) => {
    const classId = req.params.classId
    const memberId = req.params.memberId
    const id=1
    const io=req.app.get('io');//returning io instance setted in main file(app.js)
    

    if (classId && memberId) {
        const [studentClassMembershipCheck]=await connectionPromise.query('select * from roommembership where ClassId=? and MemberId=?',[classId,memberId]);
        if(studentClassMembershipCheck.length==0){
            await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, memberId, 'student']);
            io.to(Number(classId)).emit('classNewJoin',`student with Id ${memberId} joined class`)//here we used Number in order to match with the datatype of class ids
            
        }
        else{
            res.status(403).json('you re arleady in the class...')
        }
        
        
        const [lecturerRoomMembershipCheck] = await connectionPromise.query(`select * from roommembership where ClassId=? and MemberRole='lecturer'`, [classId])
        if (lecturerRoomMembershipCheck.length == 0) {
            const [roomLecturer] = await connectionPromise.query(`select LecturerId from lecturercourses where ClassId=?`, [classId])
            if (roomLecturer.length == 0) {
                console.log({ "message": "there is no lecturer for this course." })
            }
            else {
                const LecturerId = roomLecturer.map(id => id.LecturerId)
                console.log(roomLecturer)
                console.log(LecturerId)
                await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, LecturerId, 'lecturer'])
                console.log({ "message": "class lecturer has been added to the group" })
                io.to(classId).emit('classNewJoin','lecturer joined class')
            }
        }
        else {
            console.log('lecturer is already in the group...')
        }
        res.json({ "message": "the student have joined room successfully..." })
    }
    else {
        res.json({ "errror": "enter required data" })
    }
})
// route to leave the class group for both students and lecturers
router.delete('/',Authenticate,async (req, res) => {
    const { classId } = req.body;
    const memberId = req.user.Id;
    const userRole=req.user.role;
    const io=req.app.get('io');//returning io instance setted in main file(app.js)

    if (!classId || !memberId) {
        return res.status(400).json({ error: "Enter required data" });
    }

    try {
        await connectionPromise.query(
            `DELETE FROM roommembership WHERE ClassId = ? AND MemberId = ?`,
            [classId, memberId]
        );
        if(userRole=='student'){
            io.to(classId).emit('classLefting',`student with Id ${memberId} has left the class group chat`)
        }
        else{
            io.to(classId).emit('classLefting','class lecturer has left the class group chat');
        }
        res.json({ message: "You have been removed from the room..." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the member" });
    }
});
module.exports = router;