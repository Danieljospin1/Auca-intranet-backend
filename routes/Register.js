require('dotenv').config();
const express = require('express');
const router = express.Router();
const connectionPromise = require('../database & models/databaseConnection');

/**
 * POST /register
 * students: StudentId, Fname, Lname, Email, Phone(int), Faculty, Department, StudyLevel, Password
 * staff:    Fname, Lname, Email, Phone(int), Department, Role, Password  (Id is auto_increment)
 */
router.post('/', async (req, res) => {
    const {
        userRole,
        id,
        fullName,
        email,
        phone,
        password,
        confirmPassword,
        faculty,
        department,
        studyLevel,   // students only
    } = req.body;

    console.log('[Register] Request received:', { userRole, id, email });

    
    if (!userRole || !fullName || !email || !phone || !password || !confirmPassword || !faculty || !department) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Phone is INT in both tables
    const phoneNumber = parseInt(phone, 10);
    if (isNaN(phoneNumber)) {
        return res.status(400).json({ message: 'Phone must be a valid number' });
    }

    // Split fullName → Fname / Lname
    const nameParts = fullName.trim().split(' ');
    const Fname     = nameParts[0];
    const Lname     = nameParts.slice(1).join(' ') || nameParts[0];

    try {

        
        if (userRole === 'student') {

            if (!id) {
                return res.status(400).json({ message: 'Student ID is required' });
            }
            if (!studyLevel) {
                return res.status(400).json({ message: 'Study level is required' });
            }

            // Duplicate check
            const [existing] = await connectionPromise.query(
                `SELECT StudentId FROM students WHERE StudentId = ? OR Email = ?`,
                [id, email]
            );
            if (existing.length > 0) {
                return res.status(409).json({ message: 'A student with this ID or email already exists' });
            }

            await connectionPromise.query(
                `INSERT INTO students
                    (StudentId, Fname, Lname, Email, Phone, Faculty, Department, StudyLevel, Password, ProfileUrl)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
                [id, Fname, Lname, email, phoneNumber, faculty, department, studyLevel, password]
            );

            console.log('[Register] Student created:', id);
            return res.status(201).json({ message: 'Registration successful! Please log in.' });
        }

       
        if (userRole === 'staff') {

            // Duplicate check — Email is UNIQUE in staff
            const [existing] = await connectionPromise.query(
                `SELECT Id FROM staff WHERE Email = ?`,
                [email]
            );
            if (existing.length > 0) {
                return res.status(409).json({ message: 'A staff member with this email already exists' });
            }

            // Id is auto_increment — do NOT insert it
            await connectionPromise.query(
                `INSERT INTO staff
                    (Fname, Lname, Email, Phone, Department, Role, Password, ProfileUrl)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
                [Fname, Lname, email, phoneNumber, department, 'Lecturer', password]
            );

            console.log('[Register] Staff created:', email);
            return res.status(201).json({ message: 'Registration successful! Please log in.' });
        }

        return res.status(400).json({ message: 'Invalid userRole' });

    } catch (err) {
        console.error('[Register] DB error:', err);
        return res.status(500).json({ message: 'Server error. Please try again later.', error: err.message });
    }
});

module.exports = router;