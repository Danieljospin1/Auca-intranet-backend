const express=require('express');
const router=express.Router();
const {Authenticate}=require('../Authentication/authentication')
const connectionPromise=require('../database & models/databaseConnection');
const path = require('path')
const os=require('os')
const multer=require('multer')

router.get('/',Authenticate,async(req,res)=>{
    const userID=req.user.Id;
    try{
        const [staffProfile]=await connectionPromise.query(`select * from staff where Id=?`,[userID]);
        res.status(200).send(staffProfile[0]);
    }
    catch{(err)=>{
        res.status(500).json({message:err.message})
    }}
    

})
// the following is the route to upload profile for staff
// we will use multer to handle image file uploads
// storing images on server desktop
const desktopFolderPath = path.join(os.homedir(), 'Desktop');
const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
const profile = path.join(uploadFolderPath, 'profiles');
const profileImagePath = path.join(profile, 'staffImages')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null,profileImagePath)
    },
    filename: (req, file, cb) => {
        const profileName=Date.now() + path.extname(file.originalname)
        cb(null,profileName)
    }

})
const upload = multer({ storage: storage });

router.post('/',upload.single('profile'),Authenticate,async(req,res)=>{
    const userId = req.user.Id;
    const profile = req.file;
    const profilePath = profile.path;
    // escapedFilePath will convert a single backslash profile path to a double backslash to solve database problem
    // const escapedProfilePath = profilePath.replace(/\\/g, '\\\\');
    const ProfileUrl=`http://localhost:3000/staff/imgProfile/${path.basename(profilePath)}`
    try {

        await connectionPromise.query(`update staff set ProfileUrl=? where Id=?`,[ProfileUrl,userId]).then(
            res.send('Profile uploaded...')
            
        ).catch((err)=>{
            res.status(500).json({ message: err.message })
        })
    }
    catch{(error)=>{
        res.status(500).json({ message: error.message })
    }}

})

module.exports=router;