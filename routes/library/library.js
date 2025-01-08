const express = require('express')
const router = express.Router()
const {Authenticate} = require('../../Authentication/authentication')
const connectionPromise = require('../../database & models/databaseConnection')
const multer = require('multer')
const path = require('path')
const fs = require('fs');
const os = require('os')


// general storage locations
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const libraryFolderLocation = path.join(uploadFolderPath, 'library')
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

router.post('/', uploadBook.array('files', 3), Authenticate, async (req, res) => {
    const { title, size, level, faculty, department, } = req.body;
    const thumbnail = req.files[0]
   
    const BookFile = req.files[1]
    
    const userRole = req.user.role;
    const user =req.user.Id;

    // adding back-slashes in the file path
    // const slashedFile1 = file1.replace(/\\/g, '\\\\');
    // const slashedFile2 = file2.replace(/\\/g, '\\\\');
    // implementing security door to ensure that only staff can upload books 
    if(thumbnail && BookFile){
        const file1 = thumbnail.path
        const file2 = BookFile.path
        const thumbnailUrl=`http://localhost:3000/`
        if (userRole=='staff') {
            try {
                await connectionPromise.query(`insert into library(Title,Size,Level,Faculty,Department,PostedById,ImageUrl,BookFileLocation) 
                values(?,?,?,?,?,?,?,?)`,[title,size,level,faculty,department,user,file1,file2]).then((results, error) => {
                    if (error) {
                        throw error
                    }
                    res.status(200).json({"message":"Book uploded successfully"})
    
    
                })
    
            }
            catch {
                (err) => {
                    console.log(err)
                }
            }
        }
        else {
            res.status(403).json({ "message": "opps!!!! it seams like you are not eligible to post your book in auca online library" })
        }
    }
    else{
        
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
