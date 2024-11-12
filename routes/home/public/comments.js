const express = require('express')
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection')
const auth = require('../../../Authentication/authentication')

router.post('/', auth, async (req, res) => {
    const { postId, comment } = req.body;
    const userId = req.user.Id
    const userRole = req.user.role
    try {
        const [checkPost] = await connectionPromise.query(`select * from posts where Id=${postId}`)
        if (checkPost == '') {
            res.status(400).json({ "message": "This post is no longer available..." })

        }
        else {
            const userComment =await connectionPromise.query(`insert into comments (PostId,UserType,CommentedById,Text) values(${postId},'${userRole}',${userId},'${comment}')`).then(
                res.status(200).json({ "message": "comment posted successfully..." })
            )
        }
    }
    catch {
        (err) => {
            res.status(500).json({ "message": err })
        }
    }

})
router.get('/', async (req, res) => {
    const postId = req.body.postId
    try {
        const comments = await connectionPromise.query(`SELECT 
c.Id,
c.Text,
c.Timestamp,
c.UserType,
CASE 
    WHEN UserType = 'student' THEN CONCAT(s.Fname, ' ', s.Lname)
    ELSE CONCAT(st.Fname, ' ', st.Lname)
END as commentorNames
FROM 
comments c
LEFT JOIN 
students s ON s.StudentId = c.CommentedById AND UserType = 'student'
LEFT JOIN 
staff st ON st.Id = c.CommentedById AND UserType = 'staff' where PostId=${postId} order by c.Timestamp asc`)
        res.json(comments[0])
    }
    catch {
        (err) => {
            console.log(err)
        }
    }
})
module.exports = router;
// 
