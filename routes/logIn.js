require('dotenv').config();
const express = require('express');
const router = express.Router();
const token = require('jsonwebtoken');
const connectionPromise = require('../database & models/databaseConnection');


router.post('/', async (req, res) => {
    const { Id, Password, UserType } = req.body;
    console.log("[Login] Request received:", { Id, UserType });

    if (!Id || !Password) {
        return res.status(400).json({ message: "Please input Your Id/Email And Password" });
    }
    if (!UserType) {
        return res.status(400).json({ message: "Unable to get user type." });
    }

    try {
        if (UserType.toLowerCase() === "student") {
            // Find student by StudentId OR Email to allow logging in with either
            const [student] = await connectionPromise.query(`SELECT * FROM students WHERE (StudentId = ? OR Email = ?) AND Password = ?`,[Id, Id, Password]);

            if (!student[0]) {
                return res.status(401).json({ message: "invalid user credentials" });
            }

            const actualStudentId = student[0].StudentId;
            const [studentProfile] = await connectionPromise.query(
                `SELECT StudentId, Fname, Lname, Email, Phone, Faculty, Department, ProfileUrl, StudyLevel FROM students WHERE StudentId = ?`,
                [actualStudentId]
            );

            const faculty = studentProfile[0]?.Faculty || student[0]?.Faculty || null;
            const accessToken = token.sign({"Id": actualStudentId, "StudyLevel": studentProfile[0]?.StudyLevel, "Faculty": faculty,"Department": studentProfile[0]?.Department,"role": "student"},process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30d' });

            const refreshToken = token.sign({"Id": actualStudentId,"StudyLevel": studentProfile[0]?.StudyLevel,"Faculty": faculty,"Department": studentProfile[0]?.Department,"role": "student"},process.env.REFRESH_TOKEN_SECRET,{ expiresIn: '30d' });

            return res.status(200).send({ accessToken, refreshToken, studentProfile });
        }

        if (UserType.toLowerCase() === "aucasa") {
            const [student] = await connectionPromise.query(
                `SELECT * FROM students WHERE (StudentId = ? OR Email = ?) AND Password = ?`,
                [Id, Id, Password]
            );

            if (!student[0]) {
                return res.status(401).json({ message: "invalid user credentials" });
            }

            const actualStudentId = student[0].StudentId;
            const [aucasaUserRole] = await connectionPromise.query( `SELECT role FROM aucasa WHERE StudentId = ? AND IsInService = 1`,[actualStudentId]);

            if (!aucasaUserRole[0]) {
                return res.status(401).json({ message: "invalid user credentials." });
            }

            const [studentProfile] = await connectionPromise.query( `SELECT StudentId, Fname, Lname, Email, Phone, Faculty, Department, ProfileUrl, StudyLevel FROM students WHERE StudentId = ?`, [actualStudentId]);

            const faculty = studentProfile[0]?.Faculty || student[0]?.Faculty || null;
            const accessToken = token.sign({ "Id": actualStudentId,"StudyLevel": studentProfile[0]?.StudyLevel,"Faculty": faculty,"Department": studentProfile[0]?.Department, "role": "student", "aucasaUserRole": aucasaUserRole[0].role},process.env.ACCESS_TOKEN_SECRET,{ expiresIn: '30d' });

            const refreshToken = token.sign({ "Id": actualStudentId,"StudyLevel": studentProfile[0]?.StudyLevel, "Faculty": faculty, "Department": studentProfile[0]?.Department, "role": "student", "aucasaUserRole": aucasaUserRole[0].role},process.env.REFRESH_TOKEN_SECRET,{ expiresIn: '30d' });

            return res.status(200).send({ accessToken, refreshToken, studentProfile, aucasaUserRole });
        }

        if (UserType.toLowerCase() === "staff") {
            const [staff] = await connectionPromise.query(
                `SELECT * FROM staff WHERE (Email = ? OR Id = ?) AND Password = ?`,
                [Id, Id, Password]
            );

            if (!staff[0]) {
                return res.status(401).json({ message: "invalid user credentials" });
            }

            const actualStaffId = staff[0].Id;
            const [staffProfile] = await connectionPromise.query(
                `SELECT Id, Fname, Lname, Email, Department, Role, ProfileUrl FROM staff WHERE Id = ?`,
                [actualStaffId]
            );

            const department = staffProfile[0]?.Department || staff[0]?.Department || null;
            const accessToken = token.sign(
                {
                    "Id": actualStaffId,
                    "Department": department,
                    "role": "staff"
                },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: '30d' }
            );

            const refreshToken = token.sign(
                {
                    "Id": actualStaffId,
                    "Department": department,
                    "role": "staff"
                },
                process.env.REFRESH_TOKEN_SECRET,
                { expiresIn: '30d' }
            );

            return res.status(200).send({ accessToken, refreshToken, staffProfile });
        }

        return res.status(400).json({ message: "Invalid user type." });
    }
    catch (err) {
        console.error("[Login] Server error:", err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

module.exports = router;