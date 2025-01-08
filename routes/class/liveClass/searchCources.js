const express = require('express');
const router = express.Router();
const {Authenticate} = require('../../../Authentication/authentication');
const connectionPromise = require('../../../database & models/databaseConnection');

router.get('/',Authenticate,async(req,res) =>{
    const lecturerId = req.user.Id;
    try {
        const [courseList] = await connectionPromise.query(
          `SELECT c.CourseId, 
                  c.Name AS CourseName, 
                  cg.GroupName 
                   
           FROM LecturerCources l
           LEFT JOIN courseGroups cg ON l.CourseGroupId = cg.Id
           LEFT JOIN courses c ON cg.CourseId = c.CourseId
           WHERE l.LecturerId = ?;`, 
          [lecturerId]
        );
        res.json(courseList);
      } catch (err) {
        console.error('Error fetching data:', err); // Log the error for debugging
        res.status(500).json({ message: 'Error fetching data' });
      }
    
})
module.exports = router;