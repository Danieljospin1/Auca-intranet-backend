const express = require('express')
const router = express.Router()
const path = require('path')
const os=require('os')
// this is the endpoint which will be used to fetch profile images for auca students
router.get('/:ProfileId', (req, res) => {
    const ProfileId = req.params.ProfileId;
    const desktopFolderPath = path.join(os.homedir(), 'Desktop');
    const uploadFolderPath = path.join(desktopFolderPath, 'project-storage-files');
    const profileImageData = path.join(uploadFolderPath, 'profiles');
    
    const profileData = path.join(profileImageData, `${ProfileId}`)
    if(profileData){
        res.sendFile(profileData, (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(404).send(`<h1>image no found...</h1>`);
            }
        });
    
    }
    else{
        res.status(404).json({"message":"err fetching image..."})
    }


})
module.exports=router;