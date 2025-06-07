const express = require('express');
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection');
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const {Authenticate} = require('../../../Authentication/authentication')

// storing images on server desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const postsFolderLocation = path.join(uploadFolderPath, 'posts')

// defining image posts storage

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, postsFolderLocation)
    },
    filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname)
        cb(null, fileName)
    }
})
const upload = multer({ storage: storage });

router.post('/', upload.single('post'), Authenticate, async (req, res) => {
    const file = req.file;

    const { description, audience } = req.body;
    const postedById = req.user.Id;
    const role = req.user.role;
    
    
    if (file) {
        const filePath = file.path;
        const postImageUrl=`http://localhost:3000/home/posts/postImg/${path.basename(filePath)}`
        try {
            
            // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
            // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
            const insert=await connectionPromise.query(`insert into posts(CreatorId,Description,PostedBy) values (?,?,?)`,[postedById,description,role]).then(async() => {
                
                res.status(200).json({ message: `Post uploaded successfully...` })
                console.log(typeof (file))

            })
            const PostId=insert.insertId;
            await connectionPromise.query(`insert into postaudience(PostId,AudienceType,AudienceValue) values(?,?,?)`,[PostId,])
        }
        catch {
            (err) => {
                console.log(err);
            }
        }
    }
    else {
        try {
            await connectionPromise.query(`insert into posts(CreatorId,Description,Audience,PostedBy) values (?,?,?,?)`,[postedById,description,audience,role]).then(() => {
                res.status(200).json({ message: `Post uploaded successfully...` })
                console.log(typeof (file))

            })
        }
        catch {
            (err) => {
                console.log(err);
            }
        }
    }
})


router.get('/', Authenticate, async (req, res) => {
    const studentFaculty = req.user.Faculty
    const id = req.user.Id
    const userRole = req.user.role
    try {
        const [posts] = await connectionPromise.query(`
            SELECT 
    p.Id,
    -- Select the appropriate details based on whether the post is from a student or staff member
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
    p.Audience,
    p.Timestamp,

    -- Subqueries for counting interactions
    (SELECT COUNT(*) FROM postreactions l WHERE ReactionType='liked' and l.PostId = p.Id) AS postlikes,
    (SELECT COUNT(*) FROM postreactions l WHERE ReactionType='disliked' and l.PostId = p.Id) AS postDislikes,
    (SELECT COUNT(*) FROM postreactions l WHERE ReactionType='neutralized'and l.PostId = p.Id) AS neutralReactions,
    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS postComments



FROM 
    posts p
-- LEFT JOIN with students to get student information if the creator is a student
LEFT JOIN 
    students s ON p.CreatorId = s.StudentId
-- LEFT JOIN with staff to get staff information if the creator is a staff member
LEFT JOIN 
    staff st ON p.CreatorId = st.Id
WHERE 
    p.Audience =? OR p.Audience = 'ALL'
GROUP BY 
    p.Id, s.StudentId, s.Fname, s.Lname, s.ProfileUrl, 
    st.Id, st.Fname, st.Lname, st.ProfileUrl, st.Role,
    p.CreatorId, p.Description, p.Audience, p.Timestamp
ORDER BY 
    p.Timestamp DESC;


`,[studentFaculty])
        res.status(200).json(posts)
    }
    catch {
        (err) => {
            console.log(err);

        }
    }
})
router.delete('/', Authenticate, async (req, res) => {
    const Id = req.body.Id
    try {
        await connectionPromise.query(`delete from posts where Id=${Id}`).then(
            res.status(200).json({ message: `Post deleted successfully...` })
        )
    }
    catch {
        (err) => {
            res.json(err)
        }
    }
})
module.exports = router;