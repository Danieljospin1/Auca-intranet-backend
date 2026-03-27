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

    if (req.file) {
        const { originalUrl, thumbnailUrl, blurredUrl,resourceType } = await uploadImage(req.file.buffer, true, req.file.mimetype, req.file.originalname);
        console.log('Upload result........:', { originalUrl, thumbnailUrl, blurredUrl, resourceType });

        PostFile = originalUrl ? originalUrl : null;
        PostFileThumbnail = blurredUrl ? blurredUrl : thumbnailUrl ? thumbnailUrl : null;
    }





    const { description, audience } = req.body;
    const postedById = req.user.Id;
    const role = req.user.role;
    const io = req.app.get('io');


    // ── helper: send to alumni via Brevo ──────────────────────────────
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
                        sender: {
                            name: 'AUCA Communications',
                            email: 'danieljospin087@gmail.com'
                        },
                        to: [{ email: person.Email, name: person.Names }],
                        subject: subject,
                        htmlContent: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px;">
                                <h2 style="color: #003366;">AUCA Communications</h2>
                                <p style="font-size: 15px; line-height: 1.6;">${message}</p>
                                <hr style="margin-top: 30px;"/>
                                <small style="color: #999;">
                                    You are receiving this as an AUCA alumnus.
                                    <a href="${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(person.Email)}">
                                        Unsubscribe
                                    </a>
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





    if (PostFile && PostFileThumbnail) {

        const fileType = path.extname(PostFile)
        const fileMimeType = req.file.mimetype;
        const fileSize = fileSizeFormat(req.file.size)
        console.log(fileType, PostFile, PostFileThumbnail, fileMimeType, fileSize)



        try {
            await connectionPromise.query("SET time_zone = '+00:00'");


            // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
            // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
            const [insert] = await connectionPromise.query(`insert into posts(CreatorId,Description,PostedBy) values (?,?,?)`, [postedById, description, role]);
            if (!insert) {
                return res.status(500).json({ message: 'Error creating post.' });
            }
            const PostId = insert.insertId;
            await connectionPromise.query(`insert into postaudience(PostId,AudienceType) values (?,?)`, [PostId, audience]);
            console.log({ "this": PostId })

            console.log(fileType, PostFile, PostFileThumbnail, fileMimeType, fileSize)



            await connectionPromise.query(`insert into postfiles(PostId,FileType,ThumbnailUrl,FullUrl,MimeType,FileSize) values (?,?,?,?,?,?)`, [PostId, fileType, PostFileThumbnail, PostFile, fileMimeType, fileSize]);

             // ── socket or email based on audience ──
            if (audience === 'alumni') {
                const { sent, failed } = await sendToAlumni(
                    'New announcement from AUCA',
                    description
                );
                return res.status(201).json({
                    message: 'Post created and emails sent to alumni',
                    postId: PostId,
                    post,
                    emailsSent: sent,
                    emailsFailed: failed
                });
            }

            const post = await getPostById(PostId);
            if (post) {
                if (audience == 'all') {
                    io.to('all').emit('newPost', post);
                }
                if (audience == 'staff') {
                    io.to('staff').emit('newPost', post);
                }
                if (audience == 'students') {
                    io.to('students').emit('newPost', post);
                }
            }
            else {
                console.log("Post not found for socket emission");
            }

            // Send response AFTER everything completes with full post data
            res.status(201).json({
                message: `Post created successfully...`,
                postId: PostId,
                post: post,
                thumbnailUrl: PostFileThumbnail,
                fullUrl: PostFile,
                fileSize: fileSize
            })
        }
        catch (err) {
            console.log(err)
            return res.status(500).json({ message: 'Error creating post', error: err.message });
        }
    }
    else {
        try {

            if (description && audience) {
                console.log(audience)
                await connectionPromise.query("SET time_zone = '+00:00'");
                // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
                // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
                const [insert] = await connectionPromise.query(`insert into posts(CreatorId,Description,PostedBy) values (?,?,?)`, [postedById, description, role]);
                const PostId = insert.insertId;
                console.log({ "this.....": PostId })
                await connectionPromise.query(`insert into postaudience(PostId,AudienceType) values (?,?)`, [PostId, audience]);
                // refetching the post to emit it to the socket
                const post = await getPostById(PostId);

                // ── socket or email based on audience ──
                if (audience === 'alumni') {
                    const { sent, failed } = await sendToAlumni(
                        'New announcement from AUCA',
                        description
                    );
                    return res.status(201).json({
                        message: 'Post created and emails sent to alumni',
                        postId: PostId,
                        post,
                        emailsSent: sent,
                        emailsFailed: failed
                    });
                }
                if (post) {
                    if (audience == 'all') {
                        io.to('all').emit('newPost', post);
                    }
                    if (audience == 'staff') {
                        io.to('staff').emit('newPost', post);
                    }
                    if (audience == 'students') {
                        io.to('students').emit('newPost', post);
                    }
                }

                // Send response AFTER everything completes
                res.status(200).json({
                    message: `Post created successfully...`,
                    postId: PostId,
                    post: post,
                    postedById
                })

            }
            else {
                return res.status(400).json({ message: 'Please provide all required fields.' });
            }



        }

        catch (err) {
            console.log(err);
            return res.status(500).json({ message: 'Error creating post', error: err.message });
        }

    }

})


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
WHERE (pa.AudienceType = ? OR pa.AudienceType = 'all')
    AND CONVERT_TZ(p.Timestamp, @@session.time_zone, '+00:00') > ?
GROUP BY p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
         st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
         p.CreatorId, p.Description, p.Timestamp, f.FileType,
         f.ThumbnailUrl, f.FullUrl, f.FileSize, pa.AudienceType, st.Department
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