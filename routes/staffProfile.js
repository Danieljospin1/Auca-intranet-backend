const express=require('express');
const router=express.Router();
const {Authenticate}=require('../Authentication/authentication')
const connectionPromise=require('../database & models/databaseConnection');
const path = require('path')
const os=require('os')
const multer=require('multer')
const uploadImage=require('../fileHandler/uploadImage');
const upload=require('../fileHandler/upload')

router.get('/', Authenticate, async (req, res) => {
    const userID = req.user.Id;
    try {
        const [staffProfile] = await connectionPromise.query(`select * from staff where Id=?`, [userID]);
        return res.status(200).send(staffProfile[0]);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
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

router.post('/', upload.single('profile'), Authenticate, async (req, res) => {
    const userId = req.user.Id;
    const { originalUrl } = await uploadImage(req.file.buffer, true);

    if (!originalUrl) {
        return res.status(400).json({ message: "No profile image uploaded" });
    }

    try {
        await connectionPromise.query(`update staff set ProfileUrl=? where Id=?`, [originalUrl, userId]);
        return res.status(200).send('Profile uploaded...');
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
})
router.patch('/', Authenticate, async (req, res) => {
    const userId = req.user.Id;
    const { Email, PhoneNumber } = req.body;

    if (!Email && !PhoneNumber) {
        return res.status(400).json({ message: "Please provide at least one field to update" });
    }

    try {
        if (Email && PhoneNumber) {
            await connectionPromise.query(
                `update staff set Email=?,PhoneNumber=? where Id=?`,
                [Email, PhoneNumber, userId]
            );
            return res.status(200).send('Email and Phone number updated successfully');
        }
        if (Email && !PhoneNumber) {
            await connectionPromise.query(`update staff set Email=? where Id=?`, [Email, userId]);
            return res.status(200).send('Email updated successfully');
        }
        if (!Email && PhoneNumber) {
            await connectionPromise.query(`update staff set PhoneNumber=? where Id=?`, [PhoneNumber, userId]);
            return res.status(200).send('Phone number updated successfully');
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
})

module.exports=router;