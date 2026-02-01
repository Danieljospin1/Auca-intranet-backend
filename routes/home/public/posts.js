const express = require('express');
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection');
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const fileSizeFormat = require('../../../utils/fileSizeFormat');
const { Authenticate } = require('../../../Authentication/authentication')
const getPostById = require('../../../utils/getPosts');
require('dotenv').config();

// ==================== FIXED STORAGE PATH ====================
// Use /tmp directory on Render (or current directory as fallback)
const uploadBasePath = process.env.UPLOAD_PATH || path.join(__dirname, '../../../uploads');
const postsFolderLocation = path.join(uploadBasePath, 'posts');
const thumbNailFolderLocation = path.join(uploadBasePath, 'thumbnails');

// Create directories if they don't exist
const createUploadDirectories = () => {
    try {
        if (!fs.existsSync(uploadBasePath)) {
            fs.mkdirSync(uploadBasePath, { recursive: true });
            console.log('✅ Created upload base directory:', uploadBasePath);
        }
        if (!fs.existsSync(postsFolderLocation)) {
            fs.mkdirSync(postsFolderLocation, { recursive: true });
            console.log('✅ Created posts directory:', postsFolderLocation);
        }
        if (!fs.existsSync(thumbNailFolderLocation)) {
            fs.mkdirSync(thumbNailFolderLocation, { recursive: true });
            console.log('✅ Created thumbnails directory:', thumbNailFolderLocation);
        }
    } catch (error) {
        console.error('❌ Error creating upload directories:', error);
    }
};

// Create directories on server start
createUploadDirectories();

// defining image posts storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure directories exist before each upload
        createUploadDirectories();
        
        if (file.fieldname == 'orgPostFile') {
            cb(null, postsFolderLocation)
        }
        if (file.fieldname == 'postFileThumbnail') {
            cb(null, thumbNailFolderLocation)
        }
    },
    filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname)
        cb(null, fileName)
    }
})

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// ==================== SERVE UPLOADED FILES ====================
// Serve post images
router.get('/postImg/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(postsFolderLocation, filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

// Serve thumbnail images
router.get('/postImg/thbnl/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(thumbNailFolderLocation, filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).json({ error: 'Thumbnail not found' });
    }
});

// ==================== POST ROUTE - CREATE NEW POST ====================
router.post('/', upload.fields([
    { name: "orgPostFile", maxCount: 1 },
    { name: "postFileThumbnail", maxCount: 1 }
]), Authenticate, async (req, res) => {
    try {
        const PostFile = req.files?.orgPostFile?.[0]?.path;
        const PostFileThumbnail = req.files?.postFileThumbnail?.[0]?.path;
        
        console.log("POST /home/posts - Request received");
        console.log("PostFile:", PostFile);
        console.log("PostFileThumbnail:", PostFileThumbnail);
        console.log("Request body:", req.body);
        console.log("User:", req.user);

        const { description, audience } = req.body;
        const postedById = req.user.Id;
        const role = req.user.role;
        const io = req.app.get('io');

        // Validate required fields
        if (!description || !audience) {
            // Clean up uploaded files if validation fails
            if (PostFile) fs.unlink(PostFile, (err) => err && console.error("Error deleting file:", err));
            if (PostFileThumbnail) fs.unlink(PostFileThumbnail, (err) => err && console.error("Error deleting file:", err));
            
            return res.status(400).json({ 
                success: false,
                message: 'Description and audience are required fields.' 
            });
        }

        await connectionPromise.query("SET time_zone = '+00:00'");

        // INSERT POST
        const [insert] = await connectionPromise.query(
            `INSERT INTO posts(CreatorId, Description, PostedBy, Audience) VALUES (?,?,?,?)`, 
            [postedById, description, role, audience]
        );
        const PostId = insert.insertId;
        console.log("Post created with ID:", PostId);

        // If image files are provided, insert them
        if (PostFile && PostFileThumbnail) {
            const fileType = path.extname(PostFile);
            const fileMimeType = req.files?.orgPostFile?.[0]?.mimetype;
            const fileSize = fileSizeFormat(req.files?.orgPostFile?.[0]?.size);
            
            // Construct URLs - these will be served by the routes above
            const postImageUrl = `${process.env.serverIp}/home/posts/postImg/${path.basename(PostFile)}`;
            const postThumbnailUrl = `${process.env.serverIp}/home/posts/postImg/thbnl/${path.basename(PostFileThumbnail)}`;
            
            console.log("Inserting post files:", {
                fileType,
                postImageUrl,
                postThumbnailUrl,
                fileMimeType,
                fileSize
            });

            await connectionPromise.query(
                `INSERT INTO postfiles(PostId, FileType, ThumbnailUrl, FullUrl, MimeType, FileSize) VALUES (?,?,?,?,?,?)`, 
                [PostId, fileType, postThumbnailUrl, postImageUrl, fileMimeType, fileSize]
            );
        }

        // Fetch the complete post with user details
        const post = await getPostById(PostId);
        console.log("Complete post fetched:", post ? "Success" : "Failed");

        // Emit socket event
        if (post && io) {
            try {
                if (audience === 'all') {
                    io.to('all').emit('newPost', post);
                    console.log("Socket event emitted to 'all'");
                } else if (audience === 'staff') {
                    io.to('staff').emit('newPost', post);
                    console.log("Socket event emitted to 'staff'");
                } else if (audience === 'students') {
                    io.to('students').emit('newPost', post);
                    console.log("Socket event emitted to 'students'");
                }
            } catch (socketErr) {
                console.error("Error emitting socket event:", socketErr);
                // Don't fail the request if socket emission fails
            }
        }

        // Send success response
        res.status(201).json({ 
            success: true,
            message: 'Post created successfully',
            postId: PostId,
            post: post, // Include complete post data
            thumbnailUrl: PostFileThumbnail ? `${process.env.serverIp}/home/posts/postImg/thbnl/${path.basename(PostFileThumbnail)}` : null,
            fullUrl: PostFile ? `${process.env.serverIp}/home/posts/postImg/${path.basename(PostFile)}` : null
        });

    } catch (err) {
        console.error("Error creating post:", err);
        
        // Clean up uploaded files if post creation failed
        if (req.files?.orgPostFile?.[0]?.path) {
            fs.unlink(req.files.orgPostFile[0].path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file:", unlinkErr);
            });
        }
        if (req.files?.postFileThumbnail?.[0]?.path) {
            fs.unlink(req.files.postFileThumbnail[0].path, (unlinkErr) => {
                if (unlinkErr) console.error("Error deleting file:", unlinkErr);
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Error creating post',
            error: err.message 
        });
    }
});


// ==================== GET ROUTE - FETCH POSTS ====================
router.get('/', Authenticate, async (req, res) => {
    const id = req.user.Id;
    const userRole = req.user.role == 'staff' ? 'staff' : 'students';
    const userLastOnlineTimestamp = req.query.since;
    
    console.log('Raw since parameter:', userLastOnlineTimestamp);
    
    // Check if since parameter exists and is valid
    if (userLastOnlineTimestamp) {
        const userLastOnlineDate = new Date(userLastOnlineTimestamp);
        console.log('Parsed date:', userLastOnlineDate);
        console.log('Is valid date:', !isNaN(userLastOnlineDate.getTime()));
        
        // Validate the date
        if (isNaN(userLastOnlineDate.getTime())) {
            return res.status(400).json({ 
                error: 'Invalid timestamp format',
                received: userLastOnlineTimestamp,
                expected: 'ISO 8601 format like 2025-08-16T19:40:23.443Z'
            });
        }
        
        try {
            await connectionPromise.query("SET time_zone = '+00:00'");
            
            // Convert to MySQL datetime format for debugging
            const mysqlDateFormat = userLastOnlineDate.toISOString().slice(0, 19).replace('T', ' ');
            console.log('MySQL format:', mysqlDateFormat);
            
            const query = `
                SELECT 
                    p.Id,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.StudentId 
                        ELSE st.Id 
                    END AS CreatorId,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.Fname 
                        ELSE st.Fname 
                    END AS Fname,   
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.Lname 
                        ELSE st.Lname 
                    END AS Lname,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.ProfileUrl 
                        ELSE st.ProfileUrl 
                    END AS ProfileUrl,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN 'Student' 
                        ELSE st.Role 
                    END AS Role,
                    p.Description,
                    p.Timestamp,
                    f.FileType,
                    f.ThumbnailUrl,
                    f.FullUrl,
                    f.FileSize,
                    p.Audience as AudienceType,
                    st.Department,
                    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
                    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
                    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
                FROM posts p
                LEFT JOIN students s ON p.CreatorId = s.StudentId
                LEFT JOIN staff st ON p.CreatorId = st.Id
                LEFT JOIN postfiles f ON p.Id = f.PostId
                WHERE (p.Audience = ? OR p.Audience = 'all') 
                    AND CONVERT_TZ(p.Timestamp, @@session.time_zone, '+00:00') > ?
                GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
                         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
                         p.CreatorId, p.Description, p.Timestamp, f.FileType,
                         f.ThumbnailUrl, f.FullUrl, f.FileSize, p.Audience,st.Department
                ORDER BY p.Timestamp DESC
            `;
            
            console.log('Executing query with params:', [userRole, userLastOnlineDate]);
            
            const [posts] = await connectionPromise.query(query, [userRole, userLastOnlineDate]);
            
            console.log('Query result count:', posts.length);
            
            // Format timestamps to ISO strings for consistency
            const formattedPosts = posts.map(post => ({
                ...post,
                Timestamp: new Date(post.Timestamp).toISOString()
            }));
            
            res.status(200).json({
                success: true,
                posts: formattedPosts,
                count: formattedPosts.length,
                since: userLastOnlineTimestamp,
                server_time: new Date().toISOString()
            });
            
        } catch (err) {
            console.error('Database error:', err);
            res.status(500).json({ 
                error: "Error fetching posts",
                details: err.message 
            });
        }
    } else {
        // Original code for when no 'since' parameter is provided
        try {
            await connectionPromise.query("SET time_zone = '+00:00'");
            
            const [posts] = await connectionPromise.query(`
                SELECT 
                    p.Id,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.StudentId 
                        ELSE st.Id 
                    END AS CreatorId,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.Fname 
                        ELSE st.Fname 
                    END AS Fname,   
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.Lname 
                        ELSE st.Lname 
                    END AS Lname,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN s.ProfileUrl 
                        ELSE st.ProfileUrl 
                    END AS ProfileUrl,
                    CASE 
                        WHEN s.StudentId IS NOT NULL THEN 'Student' 
                        ELSE st.Role 
                    END AS Role,
                    p.Description,
                    p.Timestamp,
                    f.FileType,
                    f.ThumbnailUrl,
                    f.FullUrl,
                    f.FileSize,
                    p.Audience as AudienceType,
                    st.Department,
                    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
                    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
                    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
                FROM posts p
                LEFT JOIN students s ON p.CreatorId = s.StudentId
                LEFT JOIN staff st ON p.CreatorId = st.Id
                LEFT JOIN postfiles f ON p.Id = f.PostId
                WHERE p.Audience = ? OR p.Audience = 'all'
                GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
                         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
                         p.CreatorId, p.Description, p.Timestamp, f.FileType,
                         f.ThumbnailUrl, f.FullUrl, f.FileSize, p.Audience,st.Department
                ORDER BY p.Timestamp DESC
            `, [userRole]);
            
            // Format timestamps to ISO strings for consistency
            const formattedPosts = posts.map(post => ({
                ...post,
                Timestamp: new Date(post.Timestamp).toISOString()
            }));
            
            res.status(200).json({
                success: true,
                posts: formattedPosts,
                count: formattedPosts.length,
                server_time: new Date().toISOString()
            });
            
        } catch (err) {
            console.error('Database error:', err);
            res.status(500).json({ 
                error: "Error fetching posts",
                details: err.message 
            });
        }
    }
});

// ==================== DELETE ROUTE - DELETE POST ====================
router.delete('/', Authenticate, async (req, res) => {
    const Id = req.body.Id;
    
    if (!Id) {
        return res.status(400).json({ error: 'Post ID is required' });
    }
    
    try {
        // Get file paths before deleting from database
        const [fileData] = await connectionPromise.query(
            `SELECT FullUrl, ThumbnailUrl FROM postfiles WHERE PostId = ?`, 
            [Id]
        );
        
        // Delete the post (this will cascade delete postfiles due to foreign key)
        const [result] = await connectionPromise.query(`DELETE FROM posts WHERE Id = ?`, [Id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Delete actual files from disk
        if (fileData.length > 0) {
            const fullUrl = fileData[0].FullUrl;
            const thumbnailUrl = fileData[0].ThumbnailUrl;
            
            // Extract filename from URL and delete file
            if (fullUrl) {
                const filename = path.basename(new URL(fullUrl).pathname);
                const filepath = path.join(postsFolderLocation, filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log('Deleted post image:', filepath);
                }
            }
            
            if (thumbnailUrl) {
                const filename = path.basename(new URL(thumbnailUrl).pathname);
                const filepath = path.join(thumbNailFolderLocation, filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log('Deleted thumbnail image:', filepath);
                }
            }
        }
        
        res.status(200).json({ 
            success: true,
            message: `Post deleted successfully`,
            deletedId: Id 
        });
        
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ 
            error: 'Error deleting post',
            details: err.message 
        });
    }
});

module.exports = router;