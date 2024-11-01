const express = require('express');
const router = express.Router()
const connectionPromise = require('../../../database & models/databaseConnection');
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const auth = require('../../../Authentication/authentication')

// storing images on pc desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');

// defining image posts storage

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadFolderPath)
    },
    filename: function (req, file, cb) {
        const fileName = Date.now() + path.extname(file.originalname)
        cb(null, fileName)
    }
})
const upload = multer({ storage: storage });

router.post('/', upload.single('post'), auth, async (req, res) => {
    try {
        const file = req.file;
        const filePath = file.path;
        const { description, audience } = req.body;
        const postedById = req.user.Id;
        const role = req.user.role;


        // escapedFilePath will convert a single backslash file path to a double backslash to solve database problem
        const escapedFilePath = filePath.replace(/\\/g, '\\\\');
        await connectionPromise.query(`insert into posts(CreatorId,ImageUrl,Description,Audience,PostedBy) values (${postedById},'${escapedFilePath}','${description}','${audience}','${role}')`).then(() => {
            res.status(200).json({ message: `Post uploaded successfully...` })

        })
    }
    catch {
        (err) => {
            console.log(err);
        }
    }
})


router.get('/', auth, async (req, res) => {
    const studentFaculty = req.user.Faculty
    const id = req.user.Id
    const userRole = req.user.role
    try {
        const [posts] = await connectionPromise.query(`select p.Id,
 s.StudentId,
 s.Fname,
 s.Lname,
 p.CreatorId,
 s.Faculty,
 p.ImageUrl,
 p.Description,
 p.Audience,
 p.Timestamp,
 count(case when l.PostId=p.Id then 1 end) as postlikes
 ,count(case when d.PostId=p.Id then 1 end) as postDislikes,
 count(case when n.PostId=p.Id then 1 end) as neutralReactions
 from posts p left join students s on p.CreatorId=s.StudentId left join
 likes l on p.Id=l.PostId left join dislikes d on p.Id=d.PostId left join neutral n on p.Id=n.PostId where p.Audience='${studentFaculty}' OR p.Audience='ALL' group by 
 p.Id order by p.Timestamp desc;`)
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