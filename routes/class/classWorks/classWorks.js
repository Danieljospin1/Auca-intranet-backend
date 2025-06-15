const express = require('express')
const router = express.Router()
const { Authenticate } = require('../../../Authentication/authentication')
const connectionPromise = require('../../../database & models/databaseConnection')
const fileSizeFormat = require('../../../utils/fileSizeFormat');
const path = require('path')
const os = require('os')
const multer = require('multer')


//route for lecturers to post classworks

// storing images on server desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const classWorksFolderLocation = path.join(uploadFolderPath, 'classWorks')

// defining classwork files storage

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, classWorksFolderLocation)
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname
        cb(null, fileName)
    }
})
const upload = multer({ storage: storage });

router.post('/', upload.single('classWorkFile'), Authenticate, async (req, res) => {
    const LecturerId = req.user.Id
    const { ClassId, Description, DeadLine, WorkTitle } = req.body
    const ClassWorkFile = req.file
    const userRole = req.user.role
    const io = req.app.get('io');

    if (userRole == 'staff') {
        if (ClassWorkFile) {
            const fileType = path.extname(ClassWorkFile.path);
            const mimeType = ClassWorkFile.mimetype;
            const fileSize = fileSizeFormat(ClassWorkFile.size);
            console.log(fileType);
            const classWorkFileUrl = `http://localhost:3000/class/classWorks/flName/${ClassWorkFile.originalname}`
            try {
                const [ClassWorkId] = await connectionPromise.query('insert into classWorks(ClassId,LecturerId,Description,Deadline,WorkTitle) values(?,?,?,?,?)', [ClassId, LecturerId, Description, DeadLine, WorkTitle]);
                const ClassWorkGeneratedId = ClassWorkId.insertId;

                console.log(ClassWorkGeneratedId)
                await connectionPromise.query(`insert into classworkfiles(ClassWorkId,FileType,FileUrl,MimeType,FileSize) values(?,?,?,?,?)`, [ClassWorkGeneratedId, fileType, classWorkFileUrl, mimeType, fileSize]);
                const [otherData] = await connectionPromise.query('select cw.CreatedAt,cg.GroupName,cs.Name from classworks cw left join classworkfiles cwf on cw.Id=cwf.ClassWorkId left join classes c on cw.ClassId=c.Id left join coursegroups cg on c.CourseGroupId=cg.Id left join courses cs on cg.CourseId=cs.CourseId WHERE cw.ClassId=1 order by cw.CreatedAt limit 1', [ClassId])
                console.log(otherData[0].CreatedAt)
                const WorkData = [{
                    "Id": ClassWorkGeneratedId,
                    "ClassId": ClassId,
                    "LecturerId": LecturerId,
                    "Description": Description,
                    "Deadline": DeadLine,
                    "CreatedAt": otherData[0].CreatedAt,
                    "WorkTitle": WorkTitle,
                    "FileType": fileSize,
                    "FileUrl": classWorkFileUrl,
                    "MimeType": mimeType,
                    "FileSize": fileSize,
                    "GroupName": otherData[0].GroupName,
                    "Name": otherData[0].Name
                }]


                io.to(Number(ClassId)).emit("newClassWork", WorkData);

                res.status(201).json({ message: 'Classwork posted successfully', classWorkFileUrl })
            }
            catch (error) {
                res.status(500).json({ message: 'Error posting classwork', error })
            }
        }
        else {
            try {
                await connectionPromise.query('insert into classWorks(ClassId,LecturerId,Description,Deadline) values(?,?,?,?,?)', [ClassId, LecturerId, Description, DeadLine])
                res.status(201).json({ message: 'Classwork posted successfully' })
            }
            catch (error) {
                res.status(500).json({ message: 'Error posting classwork', error })
            }
        }
    }
    else {
        res.status(403).json({ message: 'You are not authorized to post classwork' })
    }
})



router.get('/', Authenticate, async (req, res) => {
    const userId = req.user.Id
    const userRole = req.user.role
    if (userRole == 'student') {
        console.log(userRole);
        try {
            const [studentClasses] = await connectionPromise.query(
                'SELECT ClassId FROM roommembership WHERE MemberId=?',
                [userId]
            );

            const queries = studentClasses.map(({ ClassId }) =>
                connectionPromise.query('select cw.Id,cw.ClassId,cw.LecturerId,cw.Description,cw.Deadline,cw.CreatedAt,cw.WorkTitle,cwf.FileType,cwf.FileUrl,cwf.MimeType,cwf.FileSize,cg.GroupName,cs.Name from classworks cw left join classworkfiles cwf on cw.Id=cwf.ClassWorkId left join classes c on cw.ClassId=c.Id left join coursegroups cg on c.CourseGroupId=cg.Id left join courses cs on cg.CourseId=cs.CourseId WHERE cw.ClassId=? order by cw.CreatedAt desc', [ClassId])
            );

            const results = await Promise.all(queries);

            const classWorks = results.flatMap(([rows]) => rows); // flatten all results into one array
            res.status(200).json(classWorks);


        }
        catch (error) {
            res.status(500).json({ message: 'Error fetching classworks', error });
        }
    }
    else {
        try {
            const [classWorks] = await connectionPromise.query('select * from classWorks where LecturerId=?', [userId])
            res.status(200).json(classWorks)
        }
        catch (error) {
            res.status(500).json({ message: 'Error fetching classworks', error })
        }
    }
})

router.delete('/', Authenticate, async (req, res) => {
    const userId = req.user.Id
    const userRole = req.user.role
    const classWorkId = req.body.classWorkId
    if (userRole === 'staff') {
        try {
            const [classWorkCheck] = await connectionPromise.query('select * from classworks where Id=? and LecturerId=?', [classWorkId, userId])
            if (classWorkCheck.length === 0) {
                res.status(404).json({ message: 'Classwork not found' })
            }
            else {
                try {
                    await connectionPromise.query('delete from classworks where Id=?', [classWorkId])
                    res.status(200).json({ message: 'Classwork deleted successfully' })
                }
                catch (error) {
                    res.status(500).json({ message: 'Error deleting classwork', error })
                }
            }
        }
        catch (error) {
            res.status(500).json({ message: 'Error checking classwork', error })
        }
    }
    else {
        res.status(403).json({ message: 'Forbidden', error: 'You are not authorized to delete classwork' })
    }

})
module.exports = router;