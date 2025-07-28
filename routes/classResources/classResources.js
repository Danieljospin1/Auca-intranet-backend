const express = require('express')
const router = express.Router()
const {Authenticate} = require('../../Authentication/authentication')
const connectionPromise = require('../../database & models/databaseConnection')
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const os = require('os')
const fileSizeFormat=require('../../utils/fileSizeFormat')


// general storage locations
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const libraryFolderLocation = path.join(uploadFolderPath, 'classResources')
// storage location for book thumbnails
const thumbnailStorageLocation = path.join(libraryFolderLocation, 'bookThumbnails')
// storage location for book files
const bookStorageLocation = path.join(libraryFolderLocation, 'bookFiles')

// files storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (path.extname(file.originalname) == '.pdf' || '.ppt' || '.xlsx' || '.doc') {
            cb(null, bookStorageLocation)
        }
        else {
            cb(null, thumbnailStorageLocation)
        }
    },
    filename: (req, file, cb) => {
        const filename = Date.now() + path.extname(file.originalname)
        cb(null, filename)
    }

})
const uploadBook = multer({ storage: storage })

router.post('/', uploadBook.single('resourceFile'), Authenticate, async (req, res) => {
    const { ClassId,title,Description } = req.body;
    const resourceFile=req.file;
    const fileSize=fileSizeFormat(resourceFile.size)
    const mimeType=resourceFile.mimetype;
    const fileType=path.extname(resourceFile.path);
    const fileUrl=`http://localhost:3000/class/classResources/flname/${resourceFile.originalname}`;
    const userRole = req.user.role;
    const userId =req.user.Id;
    const io=req.app.get('io');

    // adding back-slashes in the file path
    // const slashedFile1 = file1.replace(/\\/g, '\\\\');
    // const slashedFile2 = file2.replace(/\\/g, '\\\\');
    // implementing security door to ensure that only staff can upload books 
    try {
                await connectionPromise.query(`insert into classresources(ClassId,LecturerId,Title,Description,FileUrl,FileType,MimeType,FileSize) 
                values(?,?,?,?,?,?,?,?)`,[ClassId,userId,title,Description,fileUrl,fileType,mimeType,fileSize])
                const notificationTitle='New class resource shared'
                const notificationMessage=`Lecturer shared new class resource -${title}-`
                const notificationPost=await connectionPromise.query(`insert into notifications(Title,Message,Type,SenderId) values(?,?,?,?)`,[notificationTitle,notificationMessage,'system',userId]);
                const notificationPostId=notificationPost.insertId;
                await connectionPromise.query('insert into notificationtargets(NotificationId,AudienceType,AudienceValue) values(?,?,?)',[notificationPostId,'class',ClassId])
                io.to(ClassId).emit("newNotification",notificationMessage);
                res.status(200).json({"message":"Class resource uploded successfully"});
    
            }
            catch {
                (err) => {
                    console.log(err)
                }
            }
    
    })
    
router.get('/', Authenticate, async (req, res) => {
    const user = req.user.Id
    const studentFaculty = req.user.Faculty

    try {
        const results = await connectionPromise.query(`select * from library where Faculty = ? or Faculty='ALL'`,[studentFaculty])
        res.status(200).json(results[0])
    }
    catch {
        (err) => {
            res.send(err)
        }
    }
})
module.exports = router;
