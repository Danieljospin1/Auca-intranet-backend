const express = require('express');
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection');
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const auth = require('../../../Authentication/authentication')

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

router.post('/', upload.single('post'), auth, async (req, res) => {
    const file = req.file;

    const { description, audience } = req.body;
    const postedById = req.user.Id;
    const role = req.user.role;
    const filePath = file.path;
    const postImageUrl=`http://localhost:3000/home/posts/postImg/${path.basename(filePath)}`
    if (file) {
        try {
            
            // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
            // const escapedFilePath = filePath.replace(/\\/g, '\\\\');
            await connectionPromise.query(`insert into posts(CreatorId,ImageUrl,Description,Audience,PostedBy) values (${postedById},'${postImageUrl}','${description}','${audience}','${role}')`).then(() => {
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
    else {
        try {
            await connectionPromise.query(`insert into posts(CreatorId,Description,Audience,PostedBy) values (${postedById},'${description}','${audience}','${role}')`).then(() => {
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


router.get('/', auth, async (req, res) => {
    const studentFaculty = req.user.Faculty
    const id = req.user.Id
    const userRole = req.user.role
    try {
        const [posts] = await connectionPromise.query(`SELECT 
    p.Id,
    s.StudentId,
    s.Fname,
    s.Lname,
    p.CreatorId,
    s.Faculty,
    p.ImageUrl,
    p.Description,
    p.Audience,
    p.Timestamp,
    
    
    -- Subquery for counting likes
    (SELECT COUNT(*) FROM likes l WHERE l.PostId = p.Id) AS postlikes,
    
    -- Subquery for counting dislikes
    (SELECT COUNT(*) FROM dislikes d WHERE d.PostId = p.Id) AS postDislikes,
    
    -- Subquery for counting neutral reactions
    (SELECT COUNT(*) FROM neutral n WHERE n.PostId = p.Id) AS neutralReactions,
    
    -- Subquery for counting comments
    (SELECT COUNT(*) FROM comments c WHERE c.PostId = p.Id) AS postComments
    
FROM 
    posts p
LEFT JOIN 
    students s ON p.CreatorId = s.StudentId
WHERE 
    p.Audience = '${studentFaculty}' OR p.Audience = 'ALL'
GROUP BY 
    p.Id, s.StudentId, s.Fname, s.Lname, p.CreatorId, s.Faculty, p.ImageUrl, p.Description, p.Audience, p.Timestamp
ORDER BY 
    p.Timestamp DESC;

`)
        res.status(200).json(posts)
    }
    catch {
        (err) => {
            console.log(err);

        }
    }
})
router.delete('/', auth, async (req, res) => {
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