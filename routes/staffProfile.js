const express=require('express');
const router=express.Router();
const {Authenticate}=require('../Authentication/authentication')
const connectionPromise=require('../database & models/databaseConnection');
const path = require('path')
const os=require('os')
const multer=require('multer')
const uploadImage=require('../fileHandler/uploadImage');
const upload=require('../fileHandler/upload')

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

router.post('/',upload.single('profile'),Authenticate,async(req,res)=>{
    const userId = req.user.Id;
    const { originalUrl } = await uploadImage(req.file.buffer,true);
    // escapedFilePath will convert a single backslash profile path to a double backslash to solve database problem
    // const escapedProfilePath = profilePath.replace(/\\/g, '\\\\');
    // const ProfileUrl=`http://192.168.1.71:3000/staff/imgProfile/${path.basename(profilePath)}`
    if(!originalUrl){
        return res.status(400).json({ message: "No profile image uploaded" });
    }
    try {

        await connectionPromise.query(`update staff set ProfileUrl=? where Id=?`,[originalUrl,userId]).then(
            res.send('Profile uploaded...')
            
        ).catch((err)=>{
            res.status(500).json({ message: err.message })
        })
    }
    catch{(error)=>{
        res.status(500).json({ message: error.message })
    }}

})
router.patch('/',Authenticate,async(req,res)=>{
    const userId=req.user.Id;
    const {Email,PhoneNumber}=req.body;
    try{
        if(!Email && !PhoneNumber){
            return res.status(400).json({message:"Please provide at least one field to update"});
        }
        if(Email && !PhoneNumber){
            await connectionPromise.query(`update staff set Email=? where Id=?`,[Email,userId]).then(
                res.status(200).send('Email updated successfully')
            ).catch((err)=>{
                res.status(500).json({ message: err.message })
            })
        }
        if(PhoneNumber && !Email){
            await connectionPromise.query(`update staff set PhoneNumber=? where Id=?`,[PhoneNumber,userId]).then(
                res.status(200).send('Phone number updated successfully')
            ).catch((err)=>{
                res.status(500).json({ message: err.message })
            })
        }
        if(Email && PhoneNumber){
            await connectionPromise.query(`update staff set Email=?,PhoneNumber=? where Id=?`,[Email,PhoneNumber,userId]).then(
                res.status(200).send('Email and Phone number updated successfully')
            ).catch((err)=>{
                res.status(500).json({ message: err.message })
            })
        }
    }
    catch(error){
        res.status(500).json({ message: error.message })
    }
})

module.exports=router;