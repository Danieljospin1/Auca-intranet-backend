const express = require('express')
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection')
const {Authenticate} = require('../../../Authentication/authentication')

// ✅ POST: Create a new comment
router.post('/', Authenticate, async (req, res) => {
    const { postId, comment } = req.body;
    const userId = req.user.Id;
    const userRole = req.user.role;
    
    // ✅ FIX #1: Validate input
    if (!postId || !comment || comment.trim() === '') {
        return res.status(400).json({ 
            "message": "Post ID and comment text are required" 
        });
    }
    
    try {
        // Check if post exists
        const [checkPost] = await connectionPromise.query(
            `SELECT Id FROM posts WHERE Id=?`, 
            [postId]
        );
        
        // ✅ FIX #2: Proper array length check
        if (!checkPost || checkPost.length === 0) {
            return res.status(404).json({ 
                "message": "This post is no longer available..." 
            });
        }
        
        // Insert comment
        await connectionPromise.query(
            `INSERT INTO comments (PostId, UserType, CommentedById, Text) VALUES (?, ?, ?, ?)`,
            [postId, userRole, userId, comment.trim()]
        );
        
        return res.status(200).json({ 
            "message": "Comment posted successfully" 
        });
        
    } catch (err) {
        // ✅ FIX #3: Proper error handling
        console.error('[POST /comments] Error posting comment:', err);
        return res.status(500).json({ 
            "message": "Failed to post comment",
            "error": process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// ✅ GET: Fetch comments for a specific post
router.get('/', async (req, res) => {
    const { postId } = req.query;
    
    // ✅ FIX #4: Validate postId parameter
    if (!postId) {
        return res.status(400).json({ 
            "message": "Post ID is required" 
        });
    }
    
    try {
        const [comments] = await connectionPromise.query(`
            SELECT 
                c.Id,
                c.PostId,
                c.Text,
                c.Timestamp,
                c.UserType,
                CASE 
                    WHEN c.UserType = 'student' THEN CONCAT(s.Fname, ' ', s.Lname)
                    ELSE CONCAT(st.Fname, ' ', st.Lname)
                END as commentorNames,
                CASE
                    WHEN c.UserType = 'student' THEN s.ProfileUrl
                    ELSE st.ProfileUrl
                END as commentorProfile
            FROM 
                comments c
            LEFT JOIN 
                students s ON s.StudentId = c.CommentedById AND c.UserType = 'student'
            LEFT JOIN 
                staff st ON st.Id = c.CommentedById AND c.UserType = 'staff' 
            WHERE c.PostId = ?
            ORDER BY c.Timestamp DESC
        `, [postId]);
        
        // ✅ Always return an array (even if empty)
        return res.status(200).json(comments || []);
        
    } catch (err) {
        // ✅ FIX #5: Proper error handling with logging
        console.error(`[GET /comments] Error fetching comments for post ${postId}:`, err);
        return res.status(500).json({ 
            "message": "Failed to fetch comments",
            "error": process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// ✅ DELETE: Delete a comment (bonus feature for future use)
router.delete('/:commentId', Authenticate, async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.Id;
    const userRole = req.user.role;
    
    if (!commentId) {
        return res.status(400).json({ 
            "message": "Comment ID is required" 
        });
    }
    
    try {
        // Check if comment exists and belongs to the user
        const [comment] = await connectionPromise.query(
            `SELECT CommentedById, UserType FROM comments WHERE Id = ?`,
            [commentId]
        );
        
        if (!comment || comment.length === 0) {
            return res.status(404).json({ 
                "message": "Comment not found" 
            });
        }
        
        // Verify ownership
        if (comment[0].CommentedById !== userId.toString()) {
            return res.status(403).json({ 
                "message": "You can only delete your own comments" 
            });
        }
        
        // Delete the comment
        await connectionPromise.query(
            `DELETE FROM comments WHERE Id = ?`,
            [commentId]
        );
        
        return res.status(200).json({ 
            "message": "Comment deleted successfully" 
        });
        
    } catch (err) {
        console.error(`[DELETE /comments] Error deleting comment ${commentId}:`, err);
        return res.status(500).json({ 
            "message": "Failed to delete comment",
            "error": process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

module.exports = router;