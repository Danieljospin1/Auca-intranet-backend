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


// storing images on server desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const postsFolderLocation = path.join(uploadFolderPath, 'posts')
const thumbNailFolderLocation = path.join(uploadFolderPath, 'thumbnails');

// defining image posts storage

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
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
const upload = multer({ storage: storage });

router.post('/', upload.fields([
    { name: "orgPostFile", maxCount: 1 },

    { name: "postFileThumbnail", maxCount: 1 }
]), Authenticate, async (req, res) => {
    const PostFile = req.files?.orgPostFile?.[0]?.path;
    const PostFileThumbnail = req.files?.postFileThumbnail?.[0]?.path;
    console.log(PostFile)




    const { description, audience } = req.body;
    const postedById = req.user.Id;
    const role = req.user.role;
    const io = req.app.get('io');

    



    if (PostFile && PostFileThumbnail) {
        const fileType = path.extname(PostFile)
        const fileMimeType = req.files?.orgPostFile?.[0]?.mimetype;
        const fileSize = fileSizeFormat(req.files?.orgPostFile?.[0]?.size)
        const postImageUrl = `http://localhost:3000/home/posts/postImg/${path.basename(PostFile)}`
        const postThumbnailUrl = `http://localhost:3000/home/posts/postImg/thbnl/${path.basename(PostFileThumbnail)}`



        try {


            // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
            // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
            const [insert] = await connectionPromise.query(`insert into posts(CreatorId,Description,PostedBy,Audience) values (?,?,?,?)`, [postedById, description, role, audience]);
            const PostId = insert.insertId;



            await connectionPromise.query(`insert into postfiles(PostId,FileType,ThumbnailUrl,FullUrl,MimeType,FileSize) values (?,?,?,?,?,?)`, [PostId, fileType, postThumbnailUrl, postImageUrl, fileMimeType, fileSize]).then(
                res.status(200).json({ message: `Post created successfully...`, postId: PostId })
            )
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
        }
        catch (err) {
            console.log(err)
        }
    }
    else{
        try {

        if (description && audience) {
            console.log(audience)
            // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
            // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
            const [insert] = await connectionPromise.query(`insert into posts(CreatorId,Description,PostedBy,Audience) values (?,?,?,?)`, [postedById, description, role, audience]).then(
                res.status(200).json({ message: `Post created successfully...`})
            )
            const PostId = insert.insertId;
            // refetching the post to emit it to the socket
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

        }
        else {
            return res.status(400).json({ message: 'Please provide all required fields.' });
        }



    }

    catch {
        (err) => {
            console.log(err);
        }
    }

    }

})


router.get('/', Authenticate, async (req, res) => {
    const id = req.user.Id
    const userRole = req.user.role == 'staff' ? 'staff' : 'students';
    try {
        const [posts] = await connectionPromise.query(`
            SELECT 
    p.Id,
    -- Selecting the appropriate details based on whether the post is from a student or staff member
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
    p.Audience,


    -- Subqueries for counting interactions
    (SELECT COUNT(*) FROM postreactions l WHERE l.PostId = p.Id) AS postReactions,
    (SELECT JSON_ARRAYAGG(l.ReactionType) FROM postreactions l WHERE l.PostId = p.Id) AS reactionTypes,
    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS postComments



FROM 
    posts p
-- LEFT JOIN with students to get student information if the creator is a student
LEFT JOIN 
    students s ON p.CreatorId = s.StudentId
-- LEFT JOIN with staff to get staff information if the creator is a staff member
LEFT JOIN 
    staff st ON p.CreatorId = st.Id
LEFT JOIN 
    postfiles f on p.Id=f.PostId
WHERE 
    p.Audience =? OR p.Audience = 'all'
GROUP BY 
    p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
    st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
    p.CreatorId, p.Description, p.Timestamp,f.FileType,
    f.ThumbnailUrl,
    f.FullUrl,
    f.FileSize,
    p.Audience
ORDER BY 
    p.Timestamp DESC;


`, [userRole])
        res.status(200).json(posts)
    }
    catch (err) {
        console.log(err)
    }
})
router.delete('/', Authenticate, async (req, res) => {
    const Id = req.body.Id
    try {
        await connectionPromise.query(`delete from posts where Id=?`, [Id]).then(
            res.status(200).json({ message: `Post deleted successfully...` })
        )
    }
    catch (err) {
        console.log(err)
    }
})
module.exports = router;