const express = require('express');
const router = express.Router();
const {Authenticate} = require('../Authentication/authentication')
const connectionPromise = require('../database & models/databaseConnection');
const multer = require('multer')
const fs = require('fs')
const os = require('os')
const path = require('path');
require('dotenv').config();
const uploadImage=require('../fileHandler/uploadImage');
const upload=require('../fileHandler/upload')


router.get('/', Authenticate, async (req, res) => {
    const userID = req.user.Id;
    try {
        const [userProfile] = await connectionPromise.query(`select * from students where StudentId=?`,[userID]);
        res.status(200).send(userProfile[0]);
    }
    catch {
        (err) => {
            res.status(500).json({ message: err.message })
        }
    }


})
router.patch('/', Authenticate, async (req, res) => {
    const Phone = req.body.phone;
    const Email = req.body.email;
    const StudentId = req.user.Id;
    try {
        if (Phone && Email) {
            const [userProfile] = await connectionPromise.query(`update students set Phone=?,Email=? where studentId=? `,[Phone,Email,StudentId])
            res.send("email and phone updated...")
        }
        if (Phone && !Email) {
            const [userProfile] = await connectionPromise.query(`update students set Phone=? where StudentId=?`,[Phone,StudentId]);
            res.send("phone updated...")
        }

        if (!Phone && Email) {
            const [userProfile] = await connectionPromise.query(`update students set Email=? where StudentId=?}`,[Email,StudentId]);
            res.send("Email updated...")



        }
        else {
            res.status(400).json({ message: "there is no new email or new phone number you have entered " });
        }
    }
    catch { (err) => { res.status(500).json({ message: err.message }) } }
})
// the following is the route to upload profile for students
// we will use multer to handle image file uploads
// storing images on server desktop
// const desktopFolderPath = path.join(os.homedir(), 'Desktop');
// const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
// const profileImagePath = path.join(uploadFolderPath, 'profiles');

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null,profileImagePath)
//     },
//     filename: (req, file, cb) => {
//         const profileName=Date.now() + path.extname(file.originalname)
//         cb(null,profileName)
//     }

// })

// const upload = multer({ storage: storage });


router.post('/', upload.single('profile'), Authenticate, async (req, res) => {
    const StudentId = req.user.Id;
    const { originalUrl } = await uploadImage(req.file.buffer,false);

    if(!originalUrl){
        return res.status(400).json({ message: "No profile image uploaded" });
    }
    // escapedFilePath will convert a single backslash profile path to a double backslash to solve database problem
    // const escapedProfilePath = profilePath.replace(/\\/g, '\\\\');
    // const ProfileUrl=`${process.env.serverIp}/student/imgProfile/${path.basename(profilePath)}`
    try {

        await connectionPromise.query(`update students set ProfileUrl=? where StudentId=?`,[originalUrl,StudentId]).then(
            res.send('Profile uploaded...')
            
        ).catch((err)=>{
            res.status(500).json({ message: err.message })
        })
    }
    catch{(error)=>{
        res.status(500).json({ message: error.message })
    }}
})
router.delete('/', Authenticate, async (req, res)=>{
    // this is the route to delete student profile image
    const StudentId = req.user.Id;
    try {
        const [studentProfile] = await connectionPromise.query(`select ProfileUrl from students where StudentId=?`,[StudentId]);
        if (studentProfile[0].ProfileUrl) {
            const profileImage = studentProfile[0].ProfileUrl.split('/').pop();
            const profileImagePath = path.join(uploadFolderPath, 'profiles', profileImage);
            fs.unlink(profileImagePath, (err) => {
                if (err) {
                    return res.status(500).json({ message: "Error deleting profile image" });
                }
                connectionPromise.query(`update students set ProfileUrl=NULL where StudentId=?`,[StudentId]);
                res.status(200).json({ message: "Profile image deleted successfully" });
            });
        } else {
            res.status(404).json({ message: "No profile image found to delete" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
})
module.exports = router;