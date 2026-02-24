const express = require('express');
const router = express.Router();
const connectionPromise = require('../database & models/databaseConnection');
const { Authenticate } = require('../Authentication/authentication');
const { get } = require('../socketDirectory');


// ══════════════════════════════════════════════════════
// GET /courses
// Returns all available courses with their class info
// Protected — requires JWT
// ══════════════════════════════════════════════════════
router.get('/', Authenticate, async (req, res) => {
    try {
        const [courses] = await connectionPromise.query(`
            SELECT 
                cl.Id          AS ClassId,
                c.Name         AS ClassName,
                c.Code         AS CourseCode,
                g.GroupName,
                cl.Semester,
                cl.AcademicYear,
                cl.ClassStatus
            FROM courses c
            JOIN coursegroups g  ON c.CourseId = g.Id
            JOIN classes cl      ON g.Id = cl.CourseGroupId
            ORDER BY c.Name ASC
        `);
        res.status(200).json(courses);
    } catch (err) {
        console.error('GET /courses error:', err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});


// ══════════════════════════════════════════════════════
// POST /courses/register-course
// Body: { classId }
// Registers the authenticated student into a class group
// Reuses the exact same roommembership logic as groupChatAddition.js
// Protected — requires JWT
// ══════════════════════════════════════════════════════
router.post('/register-course', Authenticate, async (req, res) => {
    const memberId = req.user.Id;
    const { classId } = req.body;
    const io  = req.app.get('io');
    const userSocket = get(Number(memberId));

    if (!classId) {
        return res.status(400).json({ error: 'classId is required' });
    }

    try {
        // 1. Confirm the class exists
        const [classCheck] = await connectionPromise.query(
            'SELECT Id FROM classes WHERE Id = ?',
            [classId]
        );
        if (classCheck.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // 2. Prevent duplicate registration — same check as groupChatAddition.js
        const [alreadyMember] = await connectionPromise.query(
            'SELECT Id FROM roommembership WHERE ClassId = ? AND MemberId = ? AND IsActive = ?',
            [classId, memberId, true]
        );
        if (alreadyMember.length > 0) {
            return res.status(409).json({ error: 'You are already registered in this course' });
        }

        // 3. Add student to roommembership
        await connectionPromise.query(
            'INSERT INTO roommembership (ClassId, MemberId, MemberRole) VALUES (?, ?, ?)',
            [classId, memberId, 'student']
        );

        // 4. Post system message to the group chat — same pattern as groupChatAddition.js
        await connectionPromise.query(
            'INSERT INTO messages (Text, ClassId, MessageType) VALUES (?, ?, ?)',
            [`student with Id ${memberId} joined this class `, classId, 'system']
        );

        // 5. Notify all room members via socket
        if (io) {
            io.to(Number(classId)).emit('classNewJoin', `student with Id ${memberId} joined class`);
        }

        // 6. If student is online — join their socket to the room & push class metadata to them
        if (userSocket) {
            userSocket.join(Number(classId));
            userSocket.emit('classNewJoin', `you have joined ${classId} class`);

            const [classMetadata] = await connectionPromise.query(`
                SELECT cl.Id AS ClassId, c.Name AS ClassName, c.Code AS CourseCode,
                       g.GroupName, cl.ClassAvatar, cl.ClassStatus, r.MemberRole
                FROM courses c
                JOIN coursegroups g       ON c.CourseId = g.Id
                JOIN classes cl           ON g.Id = cl.CourseGroupId
                JOIN roommembership r     ON cl.Id = r.ClassId
                WHERE r.MemberId = ? AND cl.Id = ? AND r.IsActive = ?
            `, [memberId, classId, true]);

            userSocket.emit('newClasses', classMetadata);
        }

        // 7. Auto-add lecturer to the room if not already there — same as groupChatAddition.js
        const [lecturerInRoom] = await connectionPromise.query(
            `SELECT Id FROM roommembership WHERE ClassId = ? AND MemberRole = 'lecturer'`,
            [classId]
        );
        if (lecturerInRoom.length === 0) {
            const [roomLecturer] = await connectionPromise.query(
                'SELECT LecturerId FROM lecturercourses WHERE ClassId = ?',
                [classId]
            );
            if (roomLecturer.length > 0) {
                const lecturerId = roomLecturer[0].LecturerId;
                await connectionPromise.query(
                    'INSERT INTO roommembership (ClassId, MemberId, MemberRole) VALUES (?, ?, ?)',
                    [classId, lecturerId, 'lecturer']
                );
                await connectionPromise.query(
                    'INSERT INTO messages (Text, ClassId, MessageType) VALUES (?, ?, ?)',
                    ['Lecturer joined this class ', classId, 'system']
                );
                if (io) {
                    io.to(Number(classId)).emit('classNewJoin', 'lecturer joined class');
                }
            }
        }

        // 8. Return the registered course metadata to the client
        const [registeredCourse] = await connectionPromise.query(`
            SELECT cl.Id AS ClassId, c.Name AS ClassName, c.Code AS CourseCode,
                   g.GroupName, cl.ClassAvatar, cl.ClassStatus
            FROM courses c
            JOIN coursegroups g   ON c.CourseId = g.Id
            JOIN classes cl       ON g.Id = cl.CourseGroupId
            WHERE cl.Id = ?
        `, [classId]);

        res.status(201).json({
            message: 'Successfully registered for course',
            course: registeredCourse[0] || null
        });

    } catch (err) {
        console.error('POST /courses/register-course error:', err);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});


// ══════════════════════════════════════════════════════
// GET /courses/my-courses
// Returns all courses the authenticated student is enrolled in
// Protected — requires JWT
// ══════════════════════════════════════════════════════
router.get('/my-courses', Authenticate, async (req, res) => {
    const memberId = req.user.Id;
    try {
        const [myCourses] = await connectionPromise.query(`
            SELECT cl.Id AS ClassId, c.Name AS ClassName, c.Code AS CourseCode,
                   g.GroupName, cl.ClassAvatar, cl.ClassStatus, r.MemberRole
            FROM courses c
            JOIN coursegroups g   ON c.CourseId = g.Id
            JOIN classes cl       ON g.Id = cl.CourseGroupId
            JOIN roommembership r ON cl.Id = r.ClassId
            WHERE r.MemberId = ? AND r.IsActive = ?
            ORDER BY c.Name ASC
        `, [memberId, true]);

        res.status(200).json(myCourses);
    } catch (err) {
        console.error('GET /courses/my-courses error:', err);
        res.status(500).json({ error: 'Failed to fetch your courses' });
    }
});


module.exports = router;