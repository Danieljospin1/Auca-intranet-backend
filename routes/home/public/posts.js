const express = require('express');
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection');
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const fileSizeFormat = require('../../../utils/fileSizeFormat');
const { Authenticate } = require('../../../Authentication/authentication')
const { get } = require('../../../socketDirectory')
const getPostById = require('../../../utils/getPosts');
require('dotenv').config();
const upload = require("../../../fileHandler/upload");
const uploadImage = require("../../../fileHandler/uploadFile");




// WE will use cloudinary to store images instead of local storage





router.post('/', upload.single("PostFile"), Authenticate, async (req, res) => {
    let PostFile;
    let PostFileThumbnail;
    let PostFileResourceType;

    if (req.file) {
        const { originalUrl, thumbnailUrl, blurredUrl, resourceType } = await uploadImage(
            req.file.buffer, true, req.file.mimetype, req.file.originalname
        );
        console.log('Upload result........:', { originalUrl, thumbnailUrl, blurredUrl, resourceType });

        PostFile             = originalUrl  || null;
        PostFileThumbnail    = blurredUrl   || thumbnailUrl || null;
        PostFileResourceType = resourceType || null;
    }

    const { description, audience } = req.body;

    // Parse audienceList — app sends it as a JSON string via FormData
    let audienceList = [];
    if (req.body.audienceList) {
        try {
            audienceList = JSON.parse(req.body.audienceList);
            if (!Array.isArray(audienceList)) audienceList = [];
        } catch {
            audienceList = [];
        }
    }

    const postedById = req.user.Id;
    const role       = req.user.role;
    const io         = req.app.get('io');

    // ── helper: insert audience into postaudience table ──────────────
    //
    // Everything lives in the same postaudience table as AudienceType.
    //
    // Case 1 — students WITH precision targets:
    //   Don't store 'students'. Instead insert one row per target
    //   e.g. ['Software Engineering', 'Marketing'] → 2 rows
    //
    // Case 2 — all other audiences OR students with no targets:
    //   Insert a single row with the broad type (original behavior)
    //
    async function insertAudience(PostId) {
        const isPrecisionTargeted = audience === 'students' && audienceList.length > 0;

        if (isPrecisionTargeted) {
            const values = audienceList.map(target => [PostId, target]);
            await connectionPromise.query(
                `INSERT INTO postaudience (PostId, AudienceType) VALUES ?`,
                [values]
            );
            console.log(`Precision audience stored for post ${PostId}:`, audienceList);
        } else {
            await connectionPromise.query(
                `INSERT INTO postaudience (PostId, AudienceType) VALUES (?, ?)`,
                [PostId, audience]
            );
            console.log(`Broad audience stored for post ${PostId}:`, audience);
        }
    }
    // ─────────────────────────────────────────────────────────────────

    // ── helper: emit socket to correct room ──────────────────────────
    function emitPost(post) {
        if (!post) return console.log("Post not found for socket emission");
        if (audience === 'all')      io.to('all').emit('newPost', post);
        if (audience === 'staff')    io.to('staff').emit('newPost', post);
        if (audience === 'students') io.to('students').emit('newPost', post);
    }
    // ─────────────────────────────────────────────────────────────────

    // ── helper: send to alumni via Brevo ─────────────────────────────
    async function sendToAlumni(subject, message) {
        const db = await connectionPromise;
        const [alumniList] = await db.query(
            `SELECT Names, Email FROM alumni WHERE OptedOut = FALSE`
        );

        if (alumniList.length === 0) return { sent: 0, failed: 0 };

        let sent = 0, failed = 0;

        for (const person of alumniList) {
            try {
                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'api-key': process.env.BREVO_API_KEY,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        sender: { name: 'AUCA Communications', email: 'danieljospin087@gmail.com' },
                        to: [{ email: person.Email, name: person.Names }],
                        subject,
                        htmlContent: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
                                <h2 style="color: #003366;">AUCA Communications</h2>
                                <p style="font-size: 15px; line-height: 1.6;">${message}</p>
                                <hr style="margin-top: 30px;"/>
                                <small style="color: #999;">
                                    You are receiving this as an AUCA alumnus.
                                    <a href="${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(person.Email)}">Unsubscribe</a>
                                </small>
                            </div>
                        `,
                    }),
                });
                response.ok ? sent++ : failed++;
            } catch (err) {
                console.error(`Failed to send to ${person.Email}:`, err.message);
                failed++;
            }
        }

        console.log(`Email sending completed. Sent: ${sent}, Failed: ${failed}`);
        return { sent, failed };
    }
    // ─────────────────────────────────────────────────────────────────

    try {
        await connectionPromise.query("SET time_zone = '+00:00'");

        if (!description || !audience) {
            return res.status(400).json({ message: 'Please provide all required fields.' });
        }

        // ── 1. Create the post ────────────────────────────────────────
        const [insert] = await connectionPromise.query(
            `INSERT INTO posts (CreatorId, Description, PostedBy) VALUES (?, ?, ?)`,
            [postedById, description, role]
        );
        if (!insert) return res.status(500).json({ message: 'Error creating post.' });

        const PostId = insert.insertId;

        // ── 2. Store audience ─────────────────────────────────────────
        await insertAudience(PostId);

        // ── 3. Store file if attached ─────────────────────────────────
        if (PostFile) {
            const fileType     = path.extname(PostFile);
            const fileMimeType = req.file.mimetype;
            const fileSize     = fileSizeFormat(req.file.size);

            await connectionPromise.query(
                `INSERT INTO postfiles (PostId, FileType, ThumbnailUrl, FullUrl, MimeType, FileSize, ResourceType)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [PostId, fileType, PostFileThumbnail, PostFile, fileMimeType, fileSize, PostFileResourceType]
            );
        }

        // ── 4. Alumni: send emails instead of socket ──────────────────
        if (audience === 'alumni') {
            const { sent, failed } = await sendToAlumni('New announcement from AUCA', description);
            return res.status(201).json({
                message: 'Post created and emails sent to alumni',
                postId: PostId,
                emailsSent: sent,
                emailsFailed: failed
            });
        }

        // ── 5. Fetch full post and emit via socket ────────────────────
        const post = await getPostById(PostId);
        emitPost(post);

        // ── 6. Respond ────────────────────────────────────────────────
        return res.status(201).json({
            message: 'Post created successfully',
            postId: PostId,
            post,
            thumbnailUrl:  PostFileThumbnail  || null,
            fullUrl:       PostFile           || null,
            fileSize:      req.file ? fileSizeFormat(req.file.size) : null,
            resourceType:  PostFileResourceType || null,
            audienceList,
        });

    } catch (err) {
        console.error('Post creation error:', err);
        return res.status(500).json({ message: 'Error creating post', error: err.message });
    }
});


router.get('/', Authenticate, async (req, res) => {
    const id = req.user.Id;
    const userRole = req.user.role == 'staff' ? 'staff' : 'students';
    const userLastOnlineTimestamp = req.query.since;
    const userFaculty = req.user.Faculty;
    const userDepartment = req.user.Department;
    const userStudyLevel = req.user.StudyLevel;

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

            const staffQuery = `
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
    pa.AudienceType,
    st.Department,
    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
FROM posts p
LEFT JOIN students s ON p.CreatorId = s.StudentId
LEFT JOIN staff st ON p.CreatorId = st.Id
LEFT JOIN postfiles f ON p.Id = f.PostId
INNER JOIN postaudience pa ON pa.PostId = p.Id
WHERE (pa.AudienceType ='staff' OR pa.AudienceType = 'all')
    AND CONVERT_TZ(p.Timestamp, @@session.time_zone, '+00:00') > ?
GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
         p.CreatorId, p.Description, p.Timestamp, f.FileType,
         f.ThumbnailUrl, f.FullUrl, f.FileSize, pa.AudienceType, st.Department
ORDER BY p.Timestamp DESC
            `;


            const studentsQuery=`
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
    pa.AudienceType,
    st.Department,
    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
FROM posts p
LEFT JOIN students s ON p.CreatorId = s.StudentId
LEFT JOIN staff st ON p.CreatorId = st.Id
LEFT JOIN postfiles f ON p.Id = f.PostId
INNER JOIN postaudience pa ON pa.PostId = p.Id
WHERE (pa.AudienceType IN  (?,?,?,'students','all'))
    AND CONVERT_TZ(p.Timestamp, @@session.time_zone, '+00:00') > ?
GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
         p.CreatorId, p.Description, p.Timestamp, f.FileType,
         f.ThumbnailUrl, f.FullUrl, f.FileSize, pa.AudienceType, st.Department
ORDER BY p.Timestamp DESC
            `;

            console.log('Executing query with params:', [userRole, userLastOnlineDate]);
            var posts;

            if (userRole === 'staff') {
                 [posts] = await connectionPromise.query(staffQuery, [ userLastOnlineDate]);
            }
            if (userRole === 'students') {
                    [posts] = await connectionPromise.query(studentsQuery, [userStudyLevel,userFaculty,userDepartment, userLastOnlineDate]);
            }

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
            var posts;
            var studentsQuery=`
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
                    pa.AudienceType as AudienceType,
                    st.Department,
                    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
                    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
                    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
                FROM posts p
                LEFT JOIN students s ON p.CreatorId = s.StudentId
                LEFT JOIN staff st ON p.CreatorId = st.Id
                LEFT JOIN postfiles f ON p.Id = f.PostId
                LEFT JOIN postaudience pa ON p.Id = pa.PostId
                WHERE pa.AudienceType IN (?,?,?,'students','all')
                GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
                         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
                         p.CreatorId, p.Description, p.Timestamp, f.FileType,
                         f.ThumbnailUrl, f.FullUrl, f.FileSize, pa.AudienceType,st.Department
                ORDER BY p.Timestamp DESC
            `;
            var staffQuery=`
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
                    pa.AudienceType as AudienceType,
                    st.Department,
                    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS PostReactions,
                    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS ReactionTypes,
                    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS PostComments
                FROM posts p
                LEFT JOIN students s ON p.CreatorId = s.StudentId
                LEFT JOIN staff st ON p.CreatorId = st.Id
                LEFT JOIN postfiles f ON p.Id = f.PostId
                LEFT JOIN postaudience pa ON p.Id = pa.PostId
                WHERE pa.AudienceType = 'staff' OR pa.AudienceType = 'all'
                GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
                         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
                         p.CreatorId, p.Description, p.Timestamp, f.FileType,
                         f.ThumbnailUrl, f.FullUrl, f.FileSize, pa.AudienceType,st.Department
                ORDER BY p.Timestamp DESC
            `;

             if (userRole === 'staff') {
                    [posts] = await connectionPromise.query(staffQuery);
             }
                if (userRole === 'students') {
                    [posts] = await connectionPromise.query(studentsQuery, [userStudyLevel,userFaculty,userDepartment]);
                }

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

router.delete('/', Authenticate, async (req, res) => {
    const Id = req.body.Id;
    const io = req.app.get('io');

    if (!Id) {
        return res.status(400).json({ error: 'Post ID is required' });
    }

    try {
        const [result] = await connectionPromise.query(`DELETE FROM posts WHERE Id = ?`, [Id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        //  NEW: Emit socket event to notify all users
        io.emit('postDeleted', { PostId: Id });
        console.log('[Socket] Emitted postDeleted event for post:', Id);

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