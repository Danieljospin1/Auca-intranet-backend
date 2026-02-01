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

// ==================== FIXED STORAGE PATH WITH DETAILED LOGGING ====================
console.log('==========================================');
console.log('📁 POST UPLOAD CONFIGURATION');
console.log('==========================================');
console.log('Current directory (__dirname):', __dirname);
console.log('Process working directory:', process.cwd());
console.log('Environment UPLOAD_PATH:', process.env.UPLOAD_PATH || 'NOT SET');

// Use /tmp directory on Render (or current directory as fallback)
const uploadBasePath = process.env.UPLOAD_PATH || path.join(__dirname, '../../../uploads');
const postsFolderLocation = path.join(uploadBasePath, 'posts');
const thumbNailFolderLocation = path.join(uploadBasePath, 'thumbnails');

console.log('Upload base path:', uploadBasePath);
console.log('Posts folder:', postsFolderLocation);
console.log('Thumbnails folder:', thumbNailFolderLocation);

// Create directories if they don't exist
const createUploadDirectories = () => {
    try {
        console.log('\n📂 Creating upload directories...');
        
        if (!fs.existsSync(uploadBasePath)) {
            fs.mkdirSync(uploadBasePath, { recursive: true });
            console.log('✅ Created upload base directory:', uploadBasePath);
        } else {
            console.log('✓ Upload base directory already exists');
        }
        
        if (!fs.existsSync(postsFolderLocation)) {
            fs.mkdirSync(postsFolderLocation, { recursive: true });
            console.log('✅ Created posts directory:', postsFolderLocation);
        } else {
            console.log('✓ Posts directory already exists');
        }
        
        if (!fs.existsSync(thumbNailFolderLocation)) {
            fs.mkdirSync(thumbNailFolderLocation, { recursive: true });
            console.log('✅ Created thumbnails directory:', thumbNailFolderLocation);
        } else {
            console.log('✓ Thumbnails directory already exists');
        }
        
        // Test write permissions
        const testFile = path.join(uploadBasePath, '.write-test');
        try {
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ Write permissions verified');
        } catch (writeErr) {
            console.error('❌ PERMISSION ERROR - Cannot write to upload directory!');
            console.error('Error:', writeErr.message);
            throw writeErr;
        }
        
        console.log('==========================================\n');
        
    } catch (error) {
        console.error('\n❌ CRITICAL ERROR creating upload directories:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Stack:', error.stack);
        console.error('==========================================\n');
        throw error;
    }
};

// Create directories on server start
try {
    createUploadDirectories();
} catch (initError) {
    console.error('FATAL: Could not initialize upload directories:', initError);
}

// defining image posts storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        console.log(`\n📤 Multer destination for field: ${file.fieldname}`);
        
        // Ensure directories exist before each upload
        try {
            createUploadDirectories();
        } catch (dirErr) {
            console.error('Error in createUploadDirectories:', dirErr);
            return cb(dirErr);
        }
        
        if (file.fieldname == 'orgPostFile') {
            console.log('→ Using posts folder:', postsFolderLocation);
            cb(null, postsFolderLocation);
        } else if (file.fieldname == 'postFileThumbnail') {
            console.log('→ Using thumbnails folder:', thumbNailFolderLocation);
            cb(null, thumbNailFolderLocation);
        } else {
            console.error('❌ Unknown fieldname:', file.fieldname);
            cb(new Error('Unknown file field'));
        }
    },
    filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname);
        console.log(`→ Generated filename: ${fileName}`);
        cb(null, fileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('\n🔍 Multer file filter check:');
        console.log('→ Fieldname:', file.fieldname);
        console.log('→ Original name:', file.originalname);
        console.log('→ Mimetype:', file.mimetype);
        
        // Accept all image types
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// ==================== SERVE UPLOADED FILES ====================
router.get('/postImg/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(postsFolderLocation, filename);
    
    console.log('\n📥 Serving post image:', filename);
    console.log('→ Full path:', filepath);
    
    if (fs.existsSync(filepath)) {
        console.log('✅ File found, sending...');
        res.sendFile(filepath);
    } else {
        console.log('❌ File not found');
        res.status(404).json({ error: 'Image not found' });
    }
});

router.get('/postImg/thbnl/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(thumbNailFolderLocation, filename);
    
    console.log('\n📥 Serving thumbnail:', filename);
    console.log('→ Full path:', filepath);
    
    if (fs.existsSync(filepath)) {
        console.log('✅ File found, sending...');
        res.sendFile(filepath);
    } else {
        console.log('❌ File not found');
        res.status(404).json({ error: 'Thumbnail not found' });
    }
});

// ==================== POST ROUTE - CREATE NEW POST ====================
router.post('/', upload.fields([
    { name: "orgPostFile", maxCount: 1 },
    { name: "postFileThumbnail", maxCount: 1 }
]), Authenticate, async (req, res) => {
    console.log('\n\n╔════════════════════════════════════════╗');
    console.log('║   NEW POST CREATION REQUEST RECEIVED   ║');
    console.log('╚════════════════════════════════════════╝');
    
    try {
        const PostFile = req.files?.orgPostFile?.[0]?.path;
        const PostFileThumbnail = req.files?.postFileThumbnail?.[0]?.path;
        
        console.log('\n📋 Request Details:');
        console.log('→ User ID:', req.user?.Id);
        console.log('→ User Role:', req.user?.role);
        console.log('→ Has orgPostFile:', !!req.files?.orgPostFile);
        console.log('→ Has postFileThumbnail:', !!req.files?.postFileThumbnail);
        console.log('→ PostFile path:', PostFile || 'N/A');
        console.log('→ Thumbnail path:', PostFileThumbnail || 'N/A');
        console.log('→ Description:', req.body.description?.substring(0, 50) || 'N/A');
        console.log('→ Audience:', req.body.audience);

        const { description, audience } = req.body;
        const postedById = req.user.Id;
        const role = req.user.role;
        const io = req.app.get('io');

        // Validate required fields
        if (!description || !audience) {
            console.log('\n❌ Validation failed: Missing required fields');
            
            // Clean up uploaded files
            if (PostFile) {
                fs.unlink(PostFile, (err) => {
                    if (err) console.error('Error deleting file:', err);
                    else console.log('Cleaned up PostFile');
                });
            }
            if (PostFileThumbnail) {
                fs.unlink(PostFileThumbnail, (err) => {
                    if (err) console.error('Error deleting file:', err);
                    else console.log('Cleaned up PostFileThumbnail');
                });
            }
            
            return res.status(400).json({ 
                success: false,
                message: 'Description and audience are required fields.' 
            });
        }

        console.log('\n✅ Validation passed');
        console.log('\n🗄️  Setting timezone...');
        await connectionPromise.query("SET time_zone = '+00:00'");
        console.log('✓ Timezone set');

        // INSERT POST
        console.log('\n💾 Inserting post into database...');
        const [insert] = await connectionPromise.query(
            `INSERT INTO posts(CreatorId, Description, PostedBy, Audience) VALUES (?,?,?,?)`, 
            [postedById, description, role, audience]
        );
        const PostId = insert.insertId;
        console.log('✅ Post created with ID:', PostId);

        // If image files are provided, insert them
        if (PostFile && PostFileThumbnail) {
            console.log('\n🖼️  Processing image files...');
            
            const fileType = path.extname(PostFile);
            const fileMimeType = req.files?.orgPostFile?.[0]?.mimetype;
            const fileSize = fileSizeFormat(req.files?.orgPostFile?.[0]?.size);
            
            // Construct URLs
            const postImageUrl = `${process.env.serverIp}/home/posts/postImg/${path.basename(PostFile)}`;
            const postThumbnailUrl = `${process.env.serverIp}/home/posts/postImg/thbnl/${path.basename(PostFileThumbnail)}`;
            
            console.log('→ File type:', fileType);
            console.log('→ MIME type:', fileMimeType);
            console.log('→ File size:', fileSize);
            console.log('→ Image URL:', postImageUrl);
            console.log('→ Thumbnail URL:', postThumbnailUrl);

            console.log('\n💾 Inserting file metadata into database...');
            await connectionPromise.query(
                `INSERT INTO postfiles(PostId, FileType, ThumbnailUrl, FullUrl, MimeType, FileSize) VALUES (?,?,?,?,?,?)`, 
                [PostId, fileType, postThumbnailUrl, postImageUrl, fileMimeType, fileSize]
            );
            console.log('✅ File metadata saved');
        } else {
            console.log('\n📝 No images attached (text-only post)');
        }

        // Fetch the complete post with user details
        console.log('\n🔍 Fetching complete post details...');
        const post = await getPostById(PostId);
        
        if (post) {
            console.log('✅ Post details fetched successfully');
            console.log('→ Post structure:', Object.keys(post));
        } else {
            console.log('⚠️  Warning: Could not fetch complete post details');
        }

        // Emit socket event
        if (post && io) {
            console.log('\n📡 Emitting socket event...');
            try {
                const room = audience === 'all' ? 'all' : audience === 'staff' ? 'staff' : 'students';
                io.to(room).emit('newPost', post);
                console.log(`✅ Socket event emitted to room: ${room}`);
            } catch (socketErr) {
                console.error('⚠️  Socket emission failed:', socketErr.message);
            }
        } else {
            if (!post) console.log('⚠️  No post data to emit');
            if (!io) console.log('⚠️  Socket.io not available');
        }

        // Send success response
        console.log('\n✅ POST CREATION SUCCESSFUL');
        console.log('╚════════════════════════════════════════╝\n');
        
        res.status(201).json({ 
            success: true,
            message: 'Post created successfully',
            postId: PostId,
            post: post,
            thumbnailUrl: PostFileThumbnail ? `${process.env.serverIp}/home/posts/postImg/thbnl/${path.basename(PostFileThumbnail)}` : null,
            fullUrl: PostFile ? `${process.env.serverIp}/home/posts/postImg/${path.basename(PostFile)}` : null
        });

    } catch (err) {
        console.error('\n\n❌❌❌ POST CREATION FAILED ❌❌❌');
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);
        console.error('Error code:', err.code);
        console.error('Error stack:', err.stack);
        console.error('╚════════════════════════════════════════╝\n');
        
        // Clean up uploaded files if post creation failed
        if (req.files?.orgPostFile?.[0]?.path) {
            fs.unlink(req.files.orgPostFile[0].path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                else console.log('Cleaned up failed upload: orgPostFile');
            });
        }
        if (req.files?.postFileThumbnail?.[0]?.path) {
            fs.unlink(req.files.postFileThumbnail[0].path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                else console.log('Cleaned up failed upload: postFileThumbnail');
            });
        }
        
        res.status(500).json({ 
            success: false,
            message: 'Error creating post',
            error: err.message,
            errorType: err.name,
            errorCode: err.code
        });
    }
});


// ==================== GET ROUTE - FETCH POSTS ====================
router.get('/', Authenticate, async (req, res) => {
    const id = req.user.Id;
    const userRole = req.user.role == 'staff' ? 'staff' : 'students';
    const userLastOnlineTimestamp = req.query.since;
    
    console.log('\n📥 GET POSTS REQUEST');
    console.log('→ User:', id);
    console.log('→ Role:', userRole);
    console.log('→ Since:', userLastOnlineTimestamp || 'N/A (fetch all)');
    
    // Check if since parameter exists and is valid
    if (userLastOnlineTimestamp) {
        const userLastOnlineDate = new Date(userLastOnlineTimestamp);
        
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
            
            const [posts] = await connectionPromise.query(query, [userRole, userLastOnlineDate]);
            
            console.log(`✅ Found ${posts.length} posts since ${userLastOnlineTimestamp}`);
            
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
            console.error('❌ Database error:', err.message);
            res.status(500).json({ 
                error: "Error fetching posts",
                details: err.message 
            });
        }
    } else {
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
            
            console.log(`✅ Found ${posts.length} total posts`);
            
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
            console.error('❌ Database error:', err.message);
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
    
    console.log('\n🗑️  DELETE POST REQUEST');
    console.log('→ Post ID:', Id);
    
    if (!Id) {
        return res.status(400).json({ error: 'Post ID is required' });
    }
    
    try {
        // Get file paths before deleting
        const [fileData] = await connectionPromise.query(
            `SELECT FullUrl, ThumbnailUrl FROM postfiles WHERE PostId = ?`, 
            [Id]
        );
        
        const [result] = await connectionPromise.query(`DELETE FROM posts WHERE Id = ?`, [Id]);
        
        if (result.affectedRows === 0) {
            console.log('❌ Post not found');
            return res.status(404).json({ error: 'Post not found' });
        }
        
        // Delete files from disk
        if (fileData.length > 0) {
            const fullUrl = fileData[0].FullUrl;
            const thumbnailUrl = fileData[0].ThumbnailUrl;
            
            if (fullUrl) {
                const filename = path.basename(new URL(fullUrl).pathname);
                const filepath = path.join(postsFolderLocation, filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log('✓ Deleted post image');
                }
            }
            
            if (thumbnailUrl) {
                const filename = path.basename(new URL(thumbnailUrl).pathname);
                const filepath = path.join(thumbNailFolderLocation, filename);
                if (fs.existsSync(filepath)) {
                    fs.unlinkSync(filepath);
                    console.log('✓ Deleted thumbnail');
                }
            }
        }
        
        console.log('✅ Post deleted successfully');
        res.status(200).json({ 
            success: true,
            message: `Post deleted successfully`,
            deletedId: Id 
        });
        
    } catch (err) {
        console.error('❌ Delete error:', err.message);
        res.status(500).json({ 
            error: 'Error deleting post',
            details: err.message 
        });
    }
});

module.exports = router;