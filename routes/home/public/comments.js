const express = require('express')
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection')
const {Authenticate} = require('../../../Authentication/authentication')

router.post('/', Authenticate, async (req, res) => {
    const { postId, comment } = req.body;
    const userId = req.user.Id;
    const userRole = req.user.role;
    const io = req.app.get('io');
    
    try {
        // Check if post exists
        const [checkPost] = await connectionPromise.query(`select * from posts where Id=?`, [postId]);
        
        if (!checkPost || checkPost.length === 0) {
            return res.status(400).json({ "message": "This post is no longer available..." });
        }

        // Insert the comment
        const [insertResult] = await connectionPromise.query(
            `insert into comments (PostId,UserType,CommentedById,Text) values(?,?,?,?)`,
            [postId, userRole, userId, comment]
        );

        const commentId = insertResult.insertId;

        // Update post comment count
        await connectionPromise.query(
            `UPDATE posts SET PostComments = PostComments + 1 WHERE Id = ?`,
            [postId]
        );

        // Fetch the complete comment with user details
        const [newComment] = await connectionPromise.query(`
            SELECT 
                c.Id,
                c.Text,
                c.Timestamp,
                c.UserType,
                c.PostId,
                CASE 
                    WHEN UserType = 'student' THEN CONCAT(s.Fname, ' ', s.Lname)
                    ELSE CONCAT(st.Fname, ' ', st.Lname)
                END as commentorNames,
                CASE
                    WHEN UserType='student' THEN s.ProfileUrl
                    ELSE st.ProfileUrl
                END as commentorProfile
            FROM comments c
            LEFT JOIN students s ON s.StudentId = c.CommentedById AND UserType = 'student'
            LEFT JOIN staff st ON st.Id = c.CommentedById AND UserType = 'staff' 
            WHERE c.Id = ?
        `, [commentId]);

        // Get updated comment count
        const [postData] = await connectionPromise.query(
            `SELECT PostComments FROM posts WHERE Id = ?`,
            [postId]
        );

        // ✅ Emit socket event for real-time comment updates
        if (newComment && newComment.length > 0) {
            io.emit('commentAdded', {
                PostId: postId,
                comment: newComment[0],
                commentCount: postData[0].PostComments
            });
            console.log('[Socket] Emitted commentAdded event for post:', postId);
        }

        res.status(200).json({ 
            message: "comment posted successfully...",
            comment: newComment[0],
            commentCount: postData[0].PostComments
        });

    } catch (err) {
        console.error('Error posting comment:', err);
        res.status(500).json({ message: err.message || "Error posting comment" });
    }
})
router.get('/', async (req, res) => {
    const {postId} = req.query
    try {
        const [comments] = await connectionPromise.query(`SELECT 
c.Id,
c.Text,
c.Timestamp,
c.UserType,
CASE 
    WHEN UserType = 'student' THEN CONCAT(s.Fname, ' ', s.Lname)
    ELSE CONCAT(st.Fname, ' ', st.Lname)
END as commentorNames,
CASE
WHEN UserType='student' THEN s.ProfileUrl
ELSE st.ProfileUrl
END as commentorProfile
FROM 
comments c
LEFT JOIN 
students s ON s.StudentId = c.CommentedById AND UserType = 'student'
LEFT JOIN 
staff st ON st.Id = c.CommentedById AND UserType = 'staff' where PostId=? order by c.Timestamp asc`,[postId])
        res.json(comments)
    }
    catch {
        (err) => {
            console.log(err)
        }
    }
})
module.exports = router;
//