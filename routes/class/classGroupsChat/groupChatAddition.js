const connectionPromise = require('../../../database & models/databaseConnection')
const express = require('express')
const router = express.Router()
const {Authenticate} = require('../../../Authentication/authentication')

//post route that takes student ids and their registered cources from registration system and adds them to their respective chat groups
router.post('/:classId/:memberId/', async (req, res) => {
    const classId = req.params.classId
    const memberId = req.params.memberId

    if (classId && memberId) {
        await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, memberId, 'student'])

        const [lecturerRoomMembershipCheck] = await connectionPromise.query(`select * from roommembership where ClassId=? and MemberRole='lecturer'`, [classId])
        if (lecturerRoomMembershipCheck.length == 0) {
            const [roomLecturer] = await connectionPromise.query(`select LecturerId from lecturercourses where ClassId=?`, [classId])
            if (roomLecturer.length == 0) {
                console.log({ "message": "there is no lecturer for this course." })
            }
            else {
                const LecturerId = roomLecturer.map(id => id.LecturerId)
                await connectionPromise.query(`insert into roommembership(ClassId,MemberId,MemberRole) values(?,?,?)`, [classId, LecturerId, 'lecturer'])
                console.log({ "message": "class lecturer has been added to the group" })
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

    if (!classId || !memberId) {
        return res.status(400).json({ error: "Enter required data" });
    }

    try {
        await connectionPromise.query(
            `DELETE FROM roommembership WHERE ClassId = ? AND MemberId = ?`,
            [classId, memberId]
        );
        res.json({ message: "You have been removed from the room..." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "An error occurred while removing the member" });
    }
});
module.exports = router;